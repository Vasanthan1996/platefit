// PlateFit app entry: boots data, draws the shell, wires routing, search and theme.
import { initApi, apiMode, demoReason, resetDemo, api } from './core/api.js';
import { state, loadCatalogue, refreshUser, setUser, subscribe } from './core/state.js';
import { configureRouter, resolve, link, navigate, current } from './core/router.js';
import { initAnalytics, track } from './core/analytics.js';
import { esc, $, $$, storage, debounce, highlight, initials } from './core/utils.js';
import { icon } from './ui/icons.js';
import { logoSvg, setPhotoManifest, setAssetBase, dishSvg, ingredientSvg } from './ui/art.js';
import { animateCounters } from './ui/charts.js';
import { bindFavourites, toast, ripple, confirmDialog } from './ui/components.js';
import { CATEGORIES } from './data/recipes/index.js';
import { SLOT_MAP } from './data/plans.js';
import { setSeo } from './core/seo.js';

const BASE = new URL('../', import.meta.url).pathname;

const NAV = [
  { group: 'Overview', items: [['/', 'Home', 'home'], ['/dashboard', 'Dashboard', 'gauge']] },
  { group: 'Through the day', items: [
    ['/beverages', 'Beverages', 'cup', SLOT_MAP['early-morning'].time],
    ['/breakfast', 'Breakfast', 'sunrise', SLOT_MAP.breakfast.time],
    ['/salads', 'Salads', 'leaf', SLOT_MAP['mid-morning'].time],
    ['/lunch', 'Lunch', 'bowl', SLOT_MAP.lunch.time],
    ['/fruits', 'Fruits', 'apple', SLOT_MAP['after-lunch'].time],
    ['/snacks', 'Snacks', 'snack', SLOT_MAP.evening.time],
    ['/dinner', 'Dinner', 'moon', SLOT_MAP.dinner.time],
  ] },
  { group: 'Planning', items: [['/meal-plans', 'Meal Plans', 'calendar'], ['/favourites', 'Favourites', 'heart']] },
  { group: 'Account', items: [['/profile', 'Profile', 'user'], ['/admin', 'Admin Panel', 'shield']] },
];
const TABS = [['/', 'Home', 'home'], ['/dashboard', 'Track', 'gauge'], ['/meal-plans', 'Plans', 'calendar'], ['/favourites', 'Saved', 'heart'], ['/profile', 'Profile', 'user']];

const page = (name) => () => import(`./pages/${name}.js`);
const ROUTES = [
  ['/', page('home')],
  ['/dashboard', page('dashboard')],
  ['/recipes', page('category'), { category: 'all' }],
  ...CATEGORIES.map((c) => [c.path, page('category'), { category: c.id }]),
  ['/recipe/:id', page('recipe')],
  ['/meal-plans', page('plans')],
  ['/meal-plans/:id', page('plan')],
  ['/favourites', page('favourites')],
  ['/profile', page('profile')],
  ['/login', page('auth'), { form: 'login' }],
  ['/register', page('auth'), { form: 'register' }],
  ['/forgot-password', page('auth'), { form: 'forgot' }],
  ['/reset-password', page('auth'), { form: 'reset' }],
  ['/reset-password/:token', page('auth'), { form: 'reset' }],
  ['/admin', page('admin')],
  ['/admin/:tab', page('admin')],
];

// ---------- theme ----------
function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.dataset.theme = choice; else if (storage.get('theme')) delete root.dataset.theme;
  const btn = $('#theme-btn');
  if (btn) {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    btn.innerHTML = icon(dark ? 'sun' : 'moon');
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }
}
function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  storage.set('theme', next);
  applyTheme(next);
  track('theme_toggle', { query: next });
}

// ---------- shell ----------
function shellHtml() {
  const nav = NAV.map((g) => `<div class="nav-group"><div class="nav-label">${g.group}</div>${g.items.map(([p, label, ic, time]) => `<a class="nav-link" href="${link(p)}" data-path="${p}">${icon(ic)}<span>${label}</span>${time ? `<span class="nav-time">${time}</span>` : ''}</a>`).join('')}</div>`).join('');
  return `<a class="skip-link" href="#main">Skip to content</a>
  <div class="shell">
    <aside class="sidebar" id="sidebar" aria-label="Main navigation">
      <a class="brand" href="${link('/')}">${logoSvg()}<span class="brand-name">Plate<span>Fit</span></span></a>
      <nav class="stack" style="gap:14px">${nav}</nav>
      <div class="sidebar-foot">Wake 5:00 AM · Sleep 10:30 PM<br>Water 3–3.5 L a day</div>
    </aside>
    <div class="main">
      <div id="banner-slot"></div>
      <header class="topbar">
        <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button>
        <a class="brand" href="${link('/')}" aria-label="PlateFit home">${logoSvg()}<span class="brand-name">Plate<span>Fit</span></span></a>
        <button class="search-trigger" id="search-btn" type="button" aria-label="Search recipes">${icon('search')}<span><span class="label-long">Search recipes, ingredients, plans</span><span class="label-short" aria-hidden="true"></span></span><kbd>Ctrl K</kbd></button>
        <button class="icon-btn" id="theme-btn" type="button" aria-label="Toggle theme"></button>
        <div id="account-slot" class="row" style="flex-wrap:nowrap"></div>
      </header>
      <main id="main" class="view" tabindex="-1"></main>
      <footer class="footer"><span>© ${new Date().getFullYear()} PlateFit · Nutrition values are estimates, not medical advice.</span><span class="row" style="gap:16px"><a href="${link('/meal-plans')}">Meal plans</a><a href="${link('/recipes')}">All recipes</a><a href="${link('/')}#contact" data-scroll="contact">Contact</a></span></footer>
      <nav class="tabbar" aria-label="Quick navigation">${TABS.map(([p, l, ic]) => `<a href="${link(p)}" data-path="${p}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    </div>
  </div>
  <div class="drawer-scrim" id="drawer-scrim"></div>`;
}

function renderBanner() {
  const slot = $('#banner-slot');
  if (apiMode() !== 'demo') { slot.innerHTML = state.content.announcement ? '' : ''; return; }
  const why = demoReason() ? ` Setup needed: ${demoReason()}` : '';
  slot.innerHTML = `<div class="banner" role="note">${icon('info')}<span><b>Preview mode.</b> Data is stored only in this browser and includes sample entries.${esc(why)}</span><button class="btn btn-sm" id="reset-demo" type="button">Reset sample data</button></div>`;
  $('#reset-demo').addEventListener('click', async () => {
    if (!await confirmDialog('This clears everything you added in this preview and restores the sample data.', { title: 'Reset preview data?', confirmLabel: 'Reset', danger: true })) return;
    resetDemo();
    location.reload();
  });
}

function renderAccount() {
  const slot = $('#account-slot');
  const u = state.user;
  if (!u) {
    slot.innerHTML = `<a class="btn btn-primary btn-sm" href="${link('/login')}">${icon('user')}<span>Log in</span></a>`;
    return;
  }
  slot.innerHTML = `<div class="account-menu"><button class="avatar-btn" id="account-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu for ${esc(u.name)}"><span class="avatar">${esc(initials(u.name))}</span></button>
    <div class="menu" id="account-menu" role="menu" hidden>
      <div class="menu-head"><b>${esc(u.name)}</b><span class="muted">${esc(u.email)}</span>${u.role === 'admin' ? '<span class="badge warn">Admin</span>' : ''}</div>
      <a role="menuitem" href="${link('/dashboard')}">${icon('gauge')}Dashboard</a>
      <a role="menuitem" href="${link('/profile')}">${icon('user')}Profile</a>
      ${u.role === 'admin' ? `<a role="menuitem" href="${link('/admin')}">${icon('shield')}Admin panel</a>` : ''}
      <button role="menuitem" type="button" id="logout-btn">${icon('logout')}Log out</button>
    </div></div>`;
  const btn = $('#account-btn');
  const menu = $('#account-menu');
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.account-menu')) close(); });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  $('#logout-btn').addEventListener('click', async () => {
    close();
    try { await api.post('auth/logout'); } catch { /* ignore */ }
    setUser(null);
    toast('You are logged out.');
    navigate('/');
  });
}

function setActiveNav(path) {
  $$('[data-path]').forEach((a) => {
    const p = a.dataset.path;
    const on = p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

function drawer(open) {
  document.body.classList.toggle('drawer-open', open);
  $('#menu-btn')?.setAttribute('aria-expanded', String(open));
  if (open) $('#sidebar a')?.focus();
}

// ---------- global search ----------
function searchIndex() {
  return state.recipes.map((r) => ({ r, text: `${r.name} ${r.local} ${r.tags.join(' ')} ${r.ingredients.map((i) => i.name).join(' ')} ${r.category}`.toLowerCase() }));
}
function openSearch(initial = '') {
  if ($('.search-root')) return;
  const root = document.createElement('div');
  root.className = 'modal-root search-root';
  root.innerHTML = `<div class="modal-backdrop" data-close></div><div class="search-panel" role="dialog" aria-modal="true" aria-label="Search">
    <div class="search-input">${icon('search')}<input id="global-search" type="search" placeholder="Search: chicken, keerai, protein, idli…" autocomplete="off" aria-controls="search-results" value="${esc(initial)}"><button class="btn btn-ghost btn-sm" type="button" data-close>Esc</button></div>
    <div class="search-results" id="search-results" role="listbox"></div></div>`;
  document.body.appendChild(root);
  const input = $('#global-search', root);
  const results = $('#search-results', root);
  const idx = searchIndex();
  let sel = 0;
  const close = () => { root.remove(); document.removeEventListener('keydown', onKey); };
  const trackSearch = debounce((q, n) => { if (q.length > 1) track('search', { query: q, results: n }); }, 900);
  const render = () => {
    const q = input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const recipes = (q ? idx.filter((x) => words.every((w) => x.text.includes(w))) : idx.slice(0, 6)).slice(0, 8).map((x) => x.r);
    const ings = q ? state.ingredients.filter((i) => `${i.name} ${i.local}`.toLowerCase().includes(q)).slice(0, 4) : [];
    const plans = q ? state.plans.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 2) : [];
    const cats = q ? CATEGORIES.filter((c) => c.label.toLowerCase().includes(q)) : [];
    let html = '';
    if (recipes.length) html += `<div class="search-group">${q ? 'Recipes' : 'Popular recipes'}</div>${recipes.map((r) => `<a class="search-item" role="option" href="${link(`/recipe/${r.id}`)}"><span class="thumb">${dishSvg(r)}</span><span><span class="t">${highlight(r.name, q)}</span><br><span class="s">${esc(r.mealType)} · ${r.nutrition.calories} kcal · ${r.nutrition.protein} g protein</span></span></a>`).join('')}`;
    if (cats.length) html += `<div class="search-group">Categories</div>${cats.map((c) => `<a class="search-item" role="option" href="${link(c.path)}"><span class="thumb">${icon('list')}</span><span class="t">${highlight(c.label, q)}</span></a>`).join('')}`;
    if (ings.length) html += `<div class="search-group">Ingredients</div>${ings.map((i) => `<a class="search-item" role="option" href="${link('/recipes')}" data-ing="${i.id}"><span class="thumb">${ingredientSvg(i, { size: 40 })}</span><span><span class="t">${highlight(i.name, q)}</span><br><span class="s">${esc(i.local)} · recipes using it</span></span></a>`).join('')}`;
    if (plans.length) html += `<div class="search-group">Meal plans</div>${plans.map((p) => `<a class="search-item" role="option" href="${link(`/meal-plans/${p.id}`)}"><span class="thumb">${icon('calendar')}</span><span class="t">${highlight(p.name, q)}</span></a>`).join('')}`;
    if (!html) html = `<div class="empty" style="padding:28px"><h3>No matches for “${esc(input.value)}”</h3><p>Try an ingredient like chicken, egg, keerai or chana.</p></div>`;
    results.innerHTML = html;
    sel = 0;
    highlightSel();
    trackSearch(q, recipes.length + ings.length + plans.length);
  };
  const items = () => $$('.search-item', results);
  const highlightSel = () => items().forEach((el, i) => el.setAttribute('aria-selected', String(i === sel)));
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, items().length - 1); highlightSel(); items()[sel]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); highlightSel(); items()[sel]?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); items()[sel]?.click(); }
  };
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    else if (e.target.closest('.search-item')) {
      const ing = e.target.closest('[data-ing]');
      if (ing) storage.set('ingredient-filter', ing.dataset.ing);
      close();
    }
  });
  input.addEventListener('input', render);
  render();
  input.focus();
}

// ---------- routing ----------
let cleanup = null;
let firstRoute = true;
async function onRoute({ path, query, route, params }) {
  drawer(false);
  setActiveNav(path);
  const view = $('#main');
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  if (!firstRoute) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  view.classList.remove('entering');
  try {
    if (!route) {
      const mod = await import('./pages/notfound.js');
      cleanup = await mod.default(view, { path });
    } else {
      const mod = await route.load();
      cleanup = await mod.default(view, { params, query, path, route, app: { navigate, link } });
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><h3>This page could not load</h3><p>${esc(e.message || 'Unknown error')}</p><a class="btn btn-primary" href="${link('/')}">Go home</a></div>`;
  }
  void view.offsetWidth;
  view.classList.add('entering');
  animateCounters(view);
  if (!firstRoute) view.focus({ preventScroll: true });
  firstRoute = false;
  track('page_view', { path });
}

async function boot() {
  applyTheme(storage.get('theme'));
  setAssetBase(BASE);
  const { mode } = await initApi(BASE);
  state.mode = mode;
  try {
    const res = await fetch(`${BASE}images/manifest.json`, { cache: 'no-cache' });
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) setPhotoManifest(await res.json());
  } catch { /* no photos yet */ }
  await Promise.all([loadCatalogue(), refreshUser()]);

  document.getElementById('app').innerHTML = shellHtml();
  applyTheme(storage.get('theme'));
  renderBanner();
  renderAccount();
  subscribe((what) => { if (what === 'user') renderAccount(); });

  $('#theme-btn').addEventListener('click', toggleTheme);
  $('#search-btn').addEventListener('click', () => openSearch());
  $('#menu-btn').addEventListener('click', () => drawer(!document.body.classList.contains('drawer-open')));
  $('#drawer-scrim').addEventListener('click', () => drawer(false));
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName))) { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') drawer(false);
  });
  document.addEventListener('pointerdown', ripple);
  bindFavourites(document.body);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scroll]');
    if (!a) return;
    const target = document.getElementById(a.dataset.scroll);
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    else if (current().path !== '/') { e.preventDefault(); storage.set('scroll-to', a.dataset.scroll); navigate('/'); }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(storage.get('theme')));

  const routeMode = document.querySelector('meta[name="pf-routing"]')?.content === 'history' && location.protocol !== 'file:' ? 'history' : 'hash';
  configureRouter({ routeMode, appBase: BASE, table: ROUTES, handler: onRoute });
  initAnalytics(state.config);
  setSeo({ path: current().path });
  await resolve();

  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('done'); setTimeout(() => splash.remove(), 500); }
}

boot().catch((e) => {
  console.error(e);
  const app = document.getElementById('app');
  app.innerHTML = `<div class="empty" style="min-height:80vh"><h3>PlateFit could not start</h3><p>${esc(e.message)}</p><button class="btn btn-primary" id="retry-boot" type="button">Try again</button></div>`;
  document.getElementById('retry-boot')?.addEventListener('click', () => location.reload());
  document.getElementById('splash')?.remove();
});
