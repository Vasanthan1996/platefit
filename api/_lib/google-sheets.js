// Google Sheets driver using a service account and the Sheets REST API (no SDK needed).
// Every tab has a header row; rows are matched to columns by header name, so the
// admin can add columns to the right without breaking anything.
import crypto from 'node:crypto';
import { SHEETS, encodeRow, decodeRow } from '../../public/js/shared/schema.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const b64url = (s) => Buffer.from(s).toString('base64url');

const unquote = (v) => String(v).trim().replace(/^['"]|['"]$/g, '');

// Accepts the whole JSON key file (recommended), the same as base64, or email + private key.
export function readServiceAccount(env) {
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON && env.GOOGLE_SERVICE_ACCOUNT_JSON.trim()) {
    const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
    const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    if (!json.client_email || !json.private_key) throw new Error('Key file is missing client_email or private_key');
    return { email: json.client_email, key: json.private_key.replace(/\\n/g, '\n') };
  }
  if (env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY) {
    return { email: unquote(env.GOOGLE_SERVICE_ACCOUNT_EMAIL), key: unquote(env.GOOGLE_PRIVATE_KEY).replace(/\\n/g, '\n') };
  }
  return null;
}

export function createSheetsStore({ sheetId, account, cacheMs = 4000 }) {
  let token = null;
  let tokenExp = 0;
  let sheetIds = null;
  const cache = new Map();

  async function accessToken() {
    if (token && Date.now() < tokenExp - 60000) return token;
    const now = Math.floor(Date.now() / 1000);
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({ iss: account.email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(account.key).toString('base64url');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Google auth failed: ${json.error_description || json.error || res.status}`);
    token = json.access_token;
    tokenExp = Date.now() + json.expires_in * 1000;
    return token;
  }

  async function call(path, { method = 'GET', body } = {}, attempt = 0) {
    const res = await fetch(`${API}/${sheetId}${path}`, {
      method,
      headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt + Math.random() * 200));
      return call(path, { method, body }, attempt + 1);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Sheets ${method} ${path.split('?')[0]} failed (${res.status}): ${json.error?.message || 'unknown error'}`);
    return json;
  }

  const range = (title, a1 = '') => encodeURIComponent(`'${title.replace(/'/g, "''")}'${a1 ? `!${a1}` : ''}`);
  const colLetter = (n) => { let s = ''; for (n += 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

  async function tabs() {
    if (sheetIds) return sheetIds;
    const meta = await call('?fields=sheets.properties(sheetId,title)');
    sheetIds = Object.fromEntries(meta.sheets.map((s) => [s.properties.title, s.properties.sheetId]));
    return sheetIds;
  }

  // Reads the whole tab: returns header list and rows with their sheet row number.
  async function read(key) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < cacheMs) return hit.data;
    const { title } = SHEETS[key];
    const json = await call(`/values/${range(title, 'A1:ZZ')}?majorDimension=ROWS`);
    const values = json.values || [];
    const headers = values[0] && values[0].length ? values[0] : SHEETS[key].columns.map((c) => c.name);
    const rows = [];
    for (let i = 1; i < values.length; i++) {
      const line = values[i];
      if (!line || !line.some((c) => c !== '')) continue;
      const obj = {};
      headers.forEach((h, j) => { obj[h] = line[j] ?? ''; });
      if (!obj.id) continue;
      rows.push({ rowNumber: i + 1, obj });
    }
    const data = { headers, rows };
    cache.set(key, { at: Date.now(), data });
    return data;
  }
  const invalidate = (key) => cache.delete(key);
  const lineFor = (headers, key, obj) => { const enc = encodeRow(key, obj); return headers.map((h) => enc[h] ?? ''); };

  return {
    label: 'google-sheets',
    async list(key) { return (await read(key)).rows.map((r) => decodeRow(key, r.obj)); },
    async get(key, id) { const r = (await read(key)).rows.find((x) => x.obj.id === id); return r ? decodeRow(key, r.obj) : null; },
    async insert(key, obj) { await this.insertMany(key, [obj]); return obj; },
    async insertMany(key, objs) {
      if (!objs.length) return 0;
      const { headers } = await read(key);
      await call(`/values/${range(SHEETS[key].title, 'A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', body: { values: objs.map((o) => lineFor(headers, key, o)) },
      });
      invalidate(key);
      return objs.length;
    },
    async update(key, id, patch) {
      invalidate(key);
      const { headers, rows } = await read(key);
      const r = rows.find((x) => x.obj.id === id);
      if (!r) return null;
      const merged = { ...decodeRow(key, r.obj), ...patch, id };
      const a1 = `A${r.rowNumber}:${colLetter(headers.length - 1)}${r.rowNumber}`;
      await call(`/values/${range(SHEETS[key].title, a1)}?valueInputOption=RAW`, { method: 'PUT', body: { values: [lineFor(headers, key, merged)] } });
      invalidate(key);
      return merged;
    },
    async remove(key, id) {
      invalidate(key);
      const { rows } = await read(key);
      const r = rows.find((x) => x.obj.id === id);
      if (!r) return false;
      const ids = await tabs();
      await call(':batchUpdate', { method: 'POST', body: { requests: [{ deleteDimension: { range: { sheetId: ids[SHEETS[key].title], dimension: 'ROWS', startIndex: r.rowNumber - 1, endIndex: r.rowNumber } } }] } });
      invalidate(key);
      return true;
    },
    async count(key) { return (await read(key)).rows.length; },

    // Cheap check on cold start: one metadata call; runs setup only if a tab is missing.
    async ensureReady() {
      const ids = await tabs();
      if (Object.values(SHEETS).every((t) => t.title in ids)) return { created: [], headerFixes: [] };
      return this.setup();
    },

    // Creates any missing tabs, writes header rows and freezes them. Safe to run repeatedly.
    async setup() {
      const ids = await tabs();
      const missing = Object.values(SHEETS).filter((s) => !(s.title in ids));
      if (missing.length) {
        await call(':batchUpdate', { method: 'POST', body: { requests: missing.map((s) => ({ addSheet: { properties: { title: s.title, gridProperties: { frozenRowCount: 1 } } } })) } });
        sheetIds = null;
      }
      const created = missing.map((s) => s.title);
      const fresh = await tabs();
      const headerFixes = [];
      for (const [key, def] of Object.entries(SHEETS)) {
        const json = await call(`/values/${range(def.title, '1:1')}`);
        const current = (json.values && json.values[0]) || [];
        const wanted = def.columns.map((c) => c.name);
        const merged = [...current, ...wanted.filter((w) => !current.includes(w))];
        if (merged.length !== current.length) {
          await call(`/values/${range(def.title, 'A1')}?valueInputOption=RAW`, { method: 'PUT', body: { values: [merged] } });
          headerFixes.push(def.title);
        }
        cache.delete(key);
      }
      await call(':batchUpdate', {
        method: 'POST',
        body: {
          requests: Object.values(SHEETS).map((s) => ({
            repeatCell: {
              range: { sheetId: fresh[s.title], startRowIndex: 0, endRowIndex: 1 },
              cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.9, green: 0.95, blue: 0.91 } } },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          })),
        },
      });
      return { created, headerFixes };
    },
  };
}
