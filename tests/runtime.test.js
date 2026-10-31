// Simulates a fresh Vercel deployment: no variables, a bad key, a sheet not shared, and a working sheet.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const keyJson = JSON.stringify({ type: 'service_account', client_email: 'svc@demo.iam.gserviceaccount.com', private_key: privateKey });

let n = 0;
async function freshRuntime(env) {
  for (const k of Object.keys(process.env)) if (/^(GOOGLE_|ADMIN_|JWT_|SITE_URL|VERCEL)/.test(k)) delete process.env[k];
  Object.assign(process.env, { VERCEL: '1', VERCEL_ENV: 'production' }, env);
  return import(`../api/_lib/runtime.js?case=${n++}`);
}
function call(mod, method, path, body) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(b) { resolve({ status: this.statusCode, body: JSON.parse(b), headers: this.headers }); } };
    const req = { method, headers: { 'x-requested-with': 'PlateFit', 'x-forwarded-proto': 'https' }, body: body || {}, socket: {} };
    mod.handleNode(req, res, path, {});
  });
}
function fakeSheets({ status = 200 } = {}) {
  const tabs = new Map();
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url);
    const j = (b, s = 200) => ({ ok: s < 400, status: s, json: async () => b });
    if (u.hostname === 'oauth2.googleapis.com') return j({ access_token: 't', expires_in: 3600 });
    if (status !== 200) return j({ error: { message: 'The caller does not have permission' } }, status);
    const path = u.pathname.replace(/^\/v4\/spreadsheets\/[\w-]+/, '');
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (path === '' ) return j({ sheets: [...tabs.keys()].map((title, i) => ({ properties: { title, sheetId: i } })) });
    if (path === ':batchUpdate') { for (const r of body.requests) if (r.addSheet) tabs.set(r.addSheet.properties.title, []); return j({}); }
    const m = path.match(/^\/values\/([^:]+)(:append)?$/);
    const title = decodeURIComponent(m[1]).split('!')[0].replace(/^'|'$/g, '');
    const rows = tabs.get(title);
    if (m[2]) { rows.push(...body.values); return j({}); }
    if ((opts.method || 'GET') === 'PUT') { const a1 = decodeURIComponent(m[1]).split('!')[1]; rows[Number(a1.match(/^A(\d+)/)[1]) - 1] = body.values[0]; return j({}); }
    return j({ values: decodeURIComponent(m[1]).endsWith('1:1') ? rows.slice(0, 1) : rows });
  };
  return tabs;
}

test('fresh deploy with no variables: site falls back to preview with a clear reason', async () => {
  const mod = await freshRuntime({});
  const h = await call(mod, 'GET', 'health');
  assert.equal(h.body.ok, false);
  assert.match(h.body.problem, /GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON/);
});

test('broken key JSON is explained', async () => {
  const mod = await freshRuntime({ GOOGLE_SHEET_ID: 'abc', GOOGLE_SERVICE_ACCOUNT_JSON: '{ not json' });
  const h = await call(mod, 'GET', 'health');
  assert.match(h.body.problem, /not valid/);
});

test('sheet not shared with the service account is explained', async () => {
  fakeSheets({ status: 403 });
  const mod = await freshRuntime({ GOOGLE_SHEET_ID: 'abc', GOOGLE_SERVICE_ACCOUNT_JSON: keyJson, ADMIN_PASSWORD: 'admin@123' });
  const h = await call(mod, 'GET', 'health');
  assert.equal(h.body.ok, false);
  assert.match(h.body.problem, /Share the sheet with svc@demo/);
});

test('working sheet: tabs auto-created, no JWT_SECRET needed, full sheet URL accepted, admin can seed', async () => {
  const tabs = fakeSheets();
  const mod = await freshRuntime({ GOOGLE_SHEET_ID: 'https://docs.google.com/spreadsheets/d/1AbC-xyz_123/edit#gid=0', GOOGLE_SERVICE_ACCOUNT_JSON: keyJson, ADMIN_PASSWORD: 'admin@123' });
  const h = await call(mod, 'GET', 'health');
  assert.equal(h.body.ok, true);
  assert.equal(h.body.mode, 'google');
  assert.equal(tabs.size, 10);
  assert.equal(tabs.get('Users')[0][0], 'id');
  const login = await call(mod, 'POST', 'auth/login', { identifier: 'admin', password: 'admin@123' });
  assert.equal(login.status, 200);
  assert.match(login.headers['set-cookie'], /pf_session=.+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=\d+; Secure/);
  const recipes = await call(mod, 'GET', 'recipes');
  assert.equal(recipes.body.recipes.length, 55);
});

test('admin password missing gives a setup message', async () => {
  fakeSheets();
  const mod = await freshRuntime({ GOOGLE_SHEET_ID: 'abc', GOOGLE_SERVICE_ACCOUNT_JSON: keyJson });
  const r = await call(mod, 'POST', 'auth/login', { identifier: 'admin', password: 'x' });
  assert.equal(r.status, 503);
  assert.match(r.body.error, /Add ADMIN_PASSWORD/);
});
