// Builds one API instance per server process and adapts Node requests to it.
import crypto from 'node:crypto';
import { createApi } from '../../public/js/shared/api-core.js';
import { createMemoryStore } from '../../public/js/shared/memory-store.js';
import { SEED } from '../../public/js/data/seed.js';
import { createNodeCrypto } from './node-crypto.js';
import { createSheetsStore, readServiceAccount } from './google-sheets.js';

const COOKIE = 'pf_session';
let instance = null;

function resendMailer(env) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return null;
  return {
    async send({ to, subject, html, text }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, text }),
      });
      if (!res.ok) throw new Error(`Email failed: ${res.status}`);
    },
  };
}

const VARS_HINT = 'In Vercel open your project > Settings > Environment Variables, add GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON, then redeploy.';

// Turns Google errors into a sentence the site owner can act on.
function explainGoogleError(e, account) {
  const msg = String(e && e.message || e);
  if (/auth failed|invalid_grant|PEM|DECODER|private key|asn1/i.test(msg)) return 'Google rejected the service account key. Paste the whole downloaded JSON key file into GOOGLE_SERVICE_ACCOUNT_JSON, then redeploy.';
  if (/\(403\)/.test(msg)) return `Google Sheets refused access. Share the sheet with ${account?.email || 'the service account email'} as Editor, and make sure the Google Sheets API is enabled in your Google Cloud project.`;
  if (/\(404\)/.test(msg)) return 'No spreadsheet matches GOOGLE_SHEET_ID. Copy the id from the sheet address (the part between /d/ and /edit) and redeploy.';
  return `Google Sheets error: ${msg}`;
}

export function getRuntime(env = process.env) {
  if (instance) return instance;
  const isProd = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || Boolean(env.VERCEL);
  let mode;
  let store;
  let problem = '';
  let account = null;
  try { account = readServiceAccount(env); } catch { problem = 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid. Open the downloaded key file, copy everything from the first { to the last }, paste it as the value, then redeploy.'; }

  if (env.GOOGLE_SHEET_ID && account) {
    mode = 'google';
    // Accept either the bare id or the full sheet address pasted from the browser.
    const sheetId = (env.GOOGLE_SHEET_ID.match(/\/d\/([\w-]+)/) || [null, env.GOOGLE_SHEET_ID.trim()])[1];
    store = createSheetsStore({ sheetId, account });
  } else if (!problem && (!isProd || env.ALLOW_MEMORY_STORE === 'true')) {
    mode = 'memory';
    store = createMemoryStore({ label: 'memory' });
  } else {
    mode = 'unconfigured';
    if (!problem) problem = env.GOOGLE_SHEET_ID ? `The Google service account key is missing. ${VARS_HINT}` : `Google Sheets is not connected yet. ${VARS_HINT}`;
  }

  // Session signing key. JWT_SECRET is best; without it a key is derived from the
  // service account's private key so sessions still work across serverless instances.
  let secret = env.JWT_SECRET && env.JWT_SECRET.length >= 32 ? env.JWT_SECRET : '';
  if (!secret && mode === 'google') secret = crypto.createHash('sha256').update(`platefit-session-v1:${account.key}`).digest('hex');
  if (!secret) secret = crypto.randomBytes(48).toString('hex'); // memory mode: sessions reset on restart

  const siteUrl = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  const api = mode === 'unconfigured' ? null : createApi({
    store,
    crypto: createNodeCrypto(secret),
    env: {
      ADMIN_USERNAME: (env.ADMIN_USERNAME || 'admin').trim(),
      ADMIN_PASSWORD: env.ADMIN_PASSWORD || '',
      ADMIN_PASSWORD_HASH: (env.ADMIN_PASSWORD_HASH || '').trim(),
      SITE_URL: siteUrl,
      GA_MEASUREMENT_ID: env.GA_MEASUREMENT_ID || '',
      DEV_RESET_LINKS: mode === 'memory',
    },
    seed: SEED,
    mail: resendMailer(env),
    mode,
  });

  // First request after a deploy: create any missing tabs with their header rows.
  let ready = null;
  const ensureReady = async () => {
    if (mode !== 'google') return;
    if (!ready) ready = store.ensureReady().catch((e) => { ready = null; throw e; });
    await ready;
  };
  instance = { api, mode, problem, store, ensureReady, account };
  return instance;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((p) => p.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') { try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
    if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8') || '{}'); } catch { return {}; } }
    return req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 200000) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

// Shared by the Vercel function and the local server.
export async function handleNode(req, res, path, query) {
  const { api, mode, problem, ensureReady, account } = getRuntime();
  const method = (req.method || 'GET').toUpperCase();

  if (!api) {
    if (path === 'health') return send(res, 200, { ok: false, mode, problem });
    return send(res, 503, { error: problem || 'The server is not configured yet.' });
  }
  try {
    await ensureReady();
  } catch (e) {
    console.error('[sheets]', e);
    const why = explainGoogleError(e, account);
    if (path === 'health') return send(res, 200, { ok: false, mode, problem: why });
    return send(res, 503, { error: why });
  }

  // CSRF protection: state-changing requests must come from our own front end.
  if (method !== 'GET' && method !== 'HEAD' && req.headers['x-requested-with'] !== 'PlateFit') {
    return send(res, 403, { error: 'Request blocked. Missing X-Requested-With header.' });
  }

  let body = {};
  try { if (method !== 'GET') body = await readBody(req); } catch (e) { return send(res, e.status || 400, { error: 'Request body is too large.' }); }

  const cookies = parseCookies(req.headers.cookie);
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : cookies[COOKIE] || '';
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

  const result = await api.handle({ method, path, query, body, token, ip, userAgent: req.headers['user-agent'] || '' });

  const headers = {};
  if (result.session) {
    const secure = (req.headers['x-forwarded-proto'] || '').includes('https') || process.env.VERCEL ? '; Secure' : '';
    headers['set-cookie'] = result.session.clear
      ? `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
      : `${COOKIE}=${result.session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${result.session.maxAge}${secure}`;
  }
  // The token is delivered in an HttpOnly cookie; never echo it in JSON for the browser.
  if (result.body && result.body.token) delete result.body.token;
  return send(res, result.status, result.body, headers);
}
