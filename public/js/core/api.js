// API client. Uses the live server when /api/v1/health answers; otherwise runs the
// demo backend inside the page so the whole app still works as a preview.
import { storage } from './utils.js';

export class ApiError extends Error {
  constructor(status, message, fields) { super(message); this.status = status; this.fields = fields || null; }
}

let mode = 'demo';
let base = '/';
let demo = null;
let reason = '';
let server = 'demo';

async function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => { t = setTimeout(() => reject(new Error('timeout')), ms); });
  try { return await Promise.race([promise, timeout]); } finally { clearTimeout(t); }
}

export async function initApi(appBase) {
  base = appBase;
  const forceDemo = /[?&]demo=1\b/.test(location.search) || location.protocol === 'file:';
  if (!forceDemo) {
    try {
      const res = await withTimeout(fetch(`${base}api/v1/health`, { headers: { accept: 'application/json' }, credentials: 'same-origin' }), 3500);
      const type = res.headers.get('content-type') || '';
      if (type.includes('application/json')) {
        const json = await res.json();
        if (res.ok && json.ok) { mode = 'live'; server = json.mode || 'live'; return { mode, info: json }; }
        reason = json.problem || '';
      }
    } catch { /* no server: fall through to demo */ }
  }
  const { createDemoBackend } = await import('./demo.js');
  demo = await createDemoBackend();
  mode = 'demo';
  return { mode, reason };
}

export const apiMode = () => mode;
export const demoReason = () => reason;
// google | memory | demo
export const dataSource = () => server;
export function resetDemo() { if (demo) { demo.reset(); storage.remove('demo-token'); } }

async function request(method, path, body = null, query = null) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''))}` : '';
  let status;
  let data;
  if (mode === 'live') {
    let res;
    try {
      res = await fetch(`${base}api/v1/${path}${qs}`, {
        method,
        credentials: 'same-origin',
        headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), 'x-requested-with': 'PlateFit' },
        body: body ? JSON.stringify(body) : undefined,
        keepalive: path === 'analytics/events',
      });
    } catch {
      throw new ApiError(0, 'You appear to be offline. Check your connection and try again.');
    }
    status = res.status;
    data = await res.json().catch(() => ({}));
  } else {
    const token = storage.get('demo-token', '');
    const out = await demo.api.handle({
      method, path, query: query || {}, body: body ? JSON.parse(JSON.stringify(body)) : {}, token, ip: 'demo', userAgent: navigator.userAgent,
    });
    if (out.session) { if (out.session.clear) storage.remove('demo-token'); else storage.set('demo-token', out.session.token); }
    status = out.status;
    data = out.body || {};
    delete data.token;
  }
  if (status >= 400) throw new ApiError(status, data.error || 'Something went wrong.', data.fields);
  return data;
}

export const api = {
  get: (path, query) => request('GET', path, null, query),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};
