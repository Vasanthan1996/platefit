// Router. Clean URLs (history API) on the deployed site; hash routes (#recipe--idli)
// in the static preview, where only a plain #name survives reloads.
let mode = 'history';
let base = '/';
let routes = [];
let onRoute = () => {};

export function configureRouter({ routeMode, appBase, table, handler }) {
  mode = routeMode;
  base = appBase;
  routes = table.map(([pattern, load, opts = {}]) => ({ parts: pattern.split('/').filter(Boolean), pattern, load, ...opts }));
  onRoute = handler;
  addEventListener(mode === 'hash' ? 'hashchange' : 'popstate', () => resolve());
  document.addEventListener('click', interceptLinks);
}

export const routerMode = () => mode;

export function link(path) {
  const [p, q] = path.split('?');
  if (mode === 'hash') {
    const name = p.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).join('--');
    const extra = q ? `--${new URLSearchParams(q).values().next().value || ''}` : '';
    return name ? `#${name}${extra}` : '#home';
  }
  return `${base}${p.replace(/^\//, '')}${q ? `?${q}` : ''}`;
}

export function current() {
  if (mode === 'hash') {
    const name = decodeURIComponent(location.hash.slice(1));
    if (!name || name === 'home') return { path: '/', query: {} };
    return { path: `/${name.split('--').join('/')}`, query: {} };
  }
  const path = `/${location.pathname.slice(base.length).replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/';
  return { path, query: Object.fromEntries(new URLSearchParams(location.search)) };
}

export function navigate(path, { replace = false } = {}) {
  const target = link(path);
  if (mode === 'hash') {
    if (location.hash === target) return resolve();
    if (replace) { history.replaceState(null, '', target); return resolve(); }
    location.hash = target;
    return undefined;
  }
  if (replace) history.replaceState(null, '', target); else history.pushState(null, '', target);
  return resolve();
}

function interceptLinks(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.external !== undefined) return;
  const href = a.getAttribute('href');
  if (mode === 'hash') return; // the browser handles #routes
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(base) || url.pathname.startsWith(`${base}api/`) || /\.[a-z0-9]+$/i.test(url.pathname)) return;
  e.preventDefault();
  const path = `/${url.pathname.slice(base.length)}${url.search}`;
  if (path === `${current().path}${location.search}`) return;
  navigate(path);
}

export function match(path) {
  const segs = path.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      if (r.parts[i].startsWith(':')) params[r.parts[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (r.parts[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

export async function resolve() {
  const { path, query } = current();
  const found = match(path);
  await onRoute({ path, query, ...(found || { route: null, params: {} }) });
}
