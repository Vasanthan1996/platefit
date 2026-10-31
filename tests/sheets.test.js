// Exercises the Google Sheets driver against a fake Sheets API (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createSheetsStore } from '../api/_lib/google-sheets.js';

function fakeGoogle() {
  const tabs = new Map(); // title -> { id, rows: string[][] }
  let nextId = 1;
  const calls = [];
  const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const titleOf = (enc) => decodeURIComponent(enc).split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");

  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    calls.push(`${opts.method || 'GET'} ${u.pathname}`);
    if (u.hostname === 'oauth2.googleapis.com') return json({ access_token: 'tok', expires_in: 3600 });
    const path = u.pathname.replace(/^\/v4\/spreadsheets\/sheet123/, '');
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (path === '' && u.search.includes('fields=')) return json({ sheets: [...tabs].map(([title, t]) => ({ properties: { title, sheetId: t.id } })) });
    if (path === ':batchUpdate') {
      for (const r of body.requests) {
        if (r.addSheet) tabs.set(r.addSheet.properties.title, { id: nextId++, rows: [] });
        if (r.deleteDimension) {
          const t = [...tabs.values()].find((x) => x.id === r.deleteDimension.range.sheetId);
          t.rows.splice(r.deleteDimension.range.startIndex, 1);
        }
      }
      return json({});
    }
    const m = path.match(/^\/values\/([^:]+)(:append)?$/);
    if (m) {
      const title = titleOf(m[1]);
      const a1 = decodeURIComponent(m[1]).split('!')[1] || '';
      const t = tabs.get(title);
      if (m[2]) { t.rows.push(...body.values); return json({}); }
      if ((opts.method || 'GET') === 'PUT') {
        const row = Number((a1.match(/^A(\d+)/) || [0, 1])[1]);
        t.rows[row - 1] = body.values[0];
        return json({});
      }
      if (a1 === '1:1') return json({ values: t.rows[0] ? [t.rows[0]] : [] });
      return json({ values: t.rows });
    }
    return json({ error: { message: `unhandled ${path}` } }, 404);
  };
  return { tabs, calls };
}

test('sheets driver: setup, insert, read, update, delete', async () => {
  const fake = fakeGoogle();
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const store = createSheetsStore({ sheetId: 'sheet123', account: { email: 'svc@x.iam.gserviceaccount.com', key: privateKey }, cacheMs: 0 });

  const res = await store.setup();
  assert.ok(res.created.includes('Meal Plans'));
  assert.ok(res.created.includes('Contact Form Submissions'));
  assert.equal(fake.tabs.get('Users').rows[0][0], 'id');

  await store.insert('users', { id: 'u1', name: '=cmd()', email: 'a@b.co', role: 'user', favourites: ['idli'], weightKg: 80, createdAt: 'x' });
  await store.insertMany('users', [{ id: 'u2', name: 'Two', email: 'c@d.co' }, { id: 'u3', name: 'Three', email: 'e@f.co' }]);
  const all = await store.list('users');
  assert.equal(all.length, 3);
  assert.deepEqual(all[0].favourites, ['idli']);
  assert.equal(all[0].weightKg, 80);
  assert.equal(all[0].name, '=cmd()'); // stored as RAW text, never evaluated

  const up = await store.update('users', 'u2', { name: 'Two Updated' });
  assert.equal(up.name, 'Two Updated');
  assert.equal((await store.get('users', 'u2')).name, 'Two Updated');
  assert.equal(await store.update('users', 'missing', { name: 'x' }), null);

  assert.equal(await store.remove('users', 'u1'), true);
  assert.deepEqual((await store.list('users')).map((u) => u.id), ['u2', 'u3']);
  assert.ok(fake.calls.some((c) => c.includes('values/')));
});
