// Admin panel: analytics, users, recipes, ingredients, meal plans, content, feedback,
// messages, activity log and data export.
import { state, loadCatalogue } from '../core/state.js';
import { api, dataSource } from '../core/api.js';
import { link, navigate } from '../core/router.js';
import { esc, fmt, storage, debounce, downloadFile, loadScript, today, $, $$ } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { dishSvg, ingredientSvg } from '../ui/art.js';
import { barChart, barList, ring, mountChart, animateCounters } from '../ui/charts.js';
import { toast, modal, confirmDialog, field, formData, showErrors, busy, emptyState, toCsv } from '../ui/components.js';
import { CATEGORIES } from '../data/recipes/index.js';
import { INGREDIENT_TYPES } from '../data/ingredients.js';
import { SLOTS } from '../data/plans.js';
import { SHEETS } from '../shared/schema.js';
import { setSeo } from '../core/seo.js';
import { track } from '../core/analytics.js';

const TABS = [
  ['overview', 'Overview', 'chart'], ['users', 'Users', 'users'], ['recipes', 'Recipes', 'book'], ['ingredients', 'Ingredients', 'leaf'],
  ['meal-plans', 'Meal plans', 'calendar'], ['content', 'Content', 'edit'], ['feedback', 'Feedback', 'star'], ['messages', 'Messages', 'mail'],
  ['activity', 'Activity log', 'activity'], ['export', 'Export', 'download'],
];
const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

// ---------- generic table with search and paging ----------
function dataTable(el, { columns, rows, search = (r) => JSON.stringify(r), pageSize = 15, empty = 'Nothing here yet.', toolbar = '' }) {
  let q = '';
  let page = 0;
  el.innerHTML = `<div class="table-tools">${toolbar}<div class="search-box">${icon('search')}<label class="sr-only" for="tbl-q">Filter rows</label><input class="input" id="tbl-q" type="search" placeholder="Filter…"></div></div><div class="table-wrap"><table class="data"><thead><tr>${columns.map((c) => `<th scope="col" ${c.num ? 'style="text-align:right"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead><tbody></tbody></table></div><div class="pager row"></div>`;
  const tbody = el.querySelector('tbody');
  const pager = el.querySelector('.pager');
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter((r) => { const s = search(r).toLowerCase(); return words.every((w) => s.includes(w)); });
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.min(page, pages - 1);
    const slice = list.slice(page * pageSize, page * pageSize + pageSize);
    tbody.innerHTML = slice.length ? slice.map((r) => `<tr>${columns.map((c) => `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : esc(r[c.key] ?? '')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}" class="muted" style="text-align:center;padding:28px">${esc(q ? 'No rows match this filter.' : empty)}</td></tr>`;
    pager.innerHTML = `<span class="muted small">${list.length} row${list.length === 1 ? '' : 's'}</span><span class="spacer"></span>${pages > 1 ? `<button class="btn btn-sm" type="button" data-page="-1" ${page === 0 ? 'disabled' : ''}>${icon('left')}Prev</button><span class="small num">${page + 1} / ${pages}</span><button class="btn btn-sm" type="button" data-page="1" ${page >= pages - 1 ? 'disabled' : ''}>Next${icon('right')}</button>` : ''}`;
  };
  el.querySelector('#tbl-q').addEventListener('input', debounce((e) => { q = e.target.value; page = 0; draw(); }, 150));
  pager.addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) { page += Number(b.dataset.page); draw(); } });
  draw();
  return { update(newRows) { rows = newRows; draw(); } };
}

const statusBadge = (s) => `<span class="badge ${s === 'new' ? 'warn' : s === 'resolved' ? 'ok' : 'info'}">${esc(s)}</span>`;
const statusSelect = (id, s, kind) => `<label class="sr-only" for="st-${esc(id)}">Status</label><select class="select select-sm" id="st-${esc(id)}" data-status="${kind}:${esc(id)}">${['new', 'reviewed', 'resolved'].map((x) => `<option ${x === s ? 'selected' : ''}>${x}</option>`).join('')}</select>`;

export default async function render(view, { params, path }) {
  setSeo({ path, title: 'Admin Panel', description: 'Platform analytics and content management.' });
  if (!state.user) {
    storage.set('next', '/admin');
    view.innerHTML = emptyState({ title: 'Admins only', text: 'Log in with the admin account to manage users, recipes and analytics.', action: `<a class="btn btn-primary" href="${link('/login')}">Log in</a>`, art: `<svg class="empty-art" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">${icon('shield').replace(/<\/?svg[^>]*>/g, '')}</svg>` });
    return;
  }
  if (state.user.role !== 'admin') { view.innerHTML = emptyState({ title: 'You do not have admin access', text: 'Ask the site owner to give your account the admin role.', action: `<a class="btn" href="${link('/')}">Go home</a>` }); return; }

  const tab = TABS.some(([k]) => k === params.tab) ? params.tab : 'overview';
  view.innerHTML = `
  <div class="page-head"><div class="stack"><span class="eyebrow">Admin · ${{ google: 'Google Sheets', memory: 'Local memory store', demo: 'Preview data' }[dataSource()] || 'Live data'}</span><h1>Admin panel</h1></div></div>
  <div class="admin">
    <nav class="admin-tabs" aria-label="Admin sections">${TABS.map(([k, l, ic]) => `<a href="${link(`/admin/${k}`)}" ${k === tab ? 'aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <div class="admin-body" id="admin-body"><div class="skeleton" style="height:320px"></div></div>
  </div>`;
  const body = $('#admin-body', view);
  try {
    await SECTIONS[tab](body);
    animateCounters(body);
  } catch (e) {
    body.innerHTML = emptyState({ title: 'Could not load this section', text: e.message, action: '<button class="btn" type="button" data-reload>Reload</button>' });
    body.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
  }
}

// ---------- sections ----------
const SECTIONS = {
  async overview(el) {
    let days = 30;
    const draw = async () => {
      const { summary: s, counts, mode } = await api.get('admin/summary', { days });
      const t = s.totals;
      const kpi = (label, value, sub = '', ic = 'chart') => `<div class="stat kpi"><span class="label">${icon(ic)}${esc(label)}</span><span class="value num" data-count="${value}">${fmt.n(value)}</span>${sub ? `<span class="delta muted">${sub}</span>` : ''}</div>`;
      el.innerHTML = `
        <div class="panel-head"><p class="muted">Data source: <b>${esc(mode === 'google' ? 'Google Sheets' : mode === 'demo' ? 'Browser preview' : 'Local memory')}</b> · ${counts.recipes} recipes · ${counts.ingredients} ingredients · ${counts.plans} plans</p>
          <div class="seg" role="tablist" aria-label="Date range">${[7, 30, 90].map((d) => `<button role="tab" type="button" aria-selected="${d === days}" data-range="${d}">${d} days</button>`).join('')}</div></div>
        <div class="kpi-grid stagger">
          ${kpi('Registered users', t.users, `+${t.newUsers} in ${days} days`, 'users')}
          ${kpi('Page views', t.pageViews, `${fmt.n(t.sessions)} sessions`, 'eye')}
          ${kpi('Recipe views', t.recipeViews, `${fmt.n(t.cookModes)} cook-mode starts`, 'book')}
          ${kpi('Searches', t.searches, `${s.zeroResultSearches.length} terms with no results`, 'search')}
          ${kpi('Unique visitors', t.visitors, `DAU ${t.dau} · WAU ${t.wau} · MAU ${t.mau}`, 'activity')}
          ${kpi('Meal logs', t.mealLogs, `${fmt.n(t.favouritesAdded)} favourites added`, 'log')}
        </div>
        <div class="admin-grid">
          <section class="panel span-2"><div class="panel-head"><h2>Daily traffic</h2><div class="legend-row" style="margin:0"><span><i style="background:var(--leaf)"></i>Page views</span><span><i style="background:var(--protein)"></i>Visitors</span></div></div><div id="daily-chart" class="chart-box"></div></section>
          <section class="panel ret"><h2>Returning visitors</h2>${ring({ value: t.returningRate, max: 100, size: 140, color: 'var(--turmeric)', label: 'Returning visitors', sub: 'percent' })}<p class="muted small center">${fmt.n(t.returningVisitors)} of ${fmt.n(t.visitors)} visitors came back</p>
            <div class="open-items">${t.newFeedback ? `<a class="badge warn" href="${link('/admin/feedback')}">${t.newFeedback} new feedback</a>` : ''}${t.newContacts ? `<a class="badge warn" href="${link('/admin/messages')}">${t.newContacts} new messages</a>` : ''}</div></section>
          <section class="panel"><h2>Weekly page views</h2><div id="weekly-chart" class="chart-box"></div></section>
          <section class="panel"><h2>Monthly page views</h2><div id="monthly-chart" class="chart-box"></div></section>
          <section class="panel"><h2>Most viewed recipes</h2>${barList(s.topRecipes)}</section>
          <section class="panel"><h2>Top searches</h2>${barList(s.topSearches, { color: 'var(--protein)' })}${s.zeroResultSearches.length ? `<p class="small" style="margin-top:12px"><b>No results for:</b> ${s.zeroResultSearches.map((z) => `<span class="badge danger">${esc(z.key)} · ${z.count}</span>`).join(' ')}</p>` : ''}</section>
          <section class="panel"><h2>Popular meal plans</h2>${barList(s.popularPlans, { color: 'var(--turmeric)' })}</section>
          <section class="panel"><h2>Top pages</h2>${barList(s.topPages)}</section>
          <section class="panel"><h2>Devices</h2>${barList(s.devices, { color: 'var(--steel)' })}<h2 style="margin-top:18px">Referrers</h2>${barList(s.referrers, { color: 'var(--steel)' })}</section>
        </div>
        <p class="muted small" style="margin-top:12px">First-party analytics from the Analytics sheet. Google Analytics 4 receives the same events when GA_MEASUREMENT_ID is set.</p>`;
      mountChart($('#daily-chart', el), (w) => barChart({ width: w, data: s.daily.map((d) => ({ label: d.date, short: d.date.slice(8), value: d.pageViews, visitors: d.visitors })), line: 'visitors', unit: 'views', lineUnit: 'visitors', height: 230 }));
      mountChart($('#weekly-chart', el), (w) => barChart({ width: w, data: s.weekly.map((d) => ({ label: `Week of ${d.week}`, short: d.week.slice(5).replace('-', '/'), value: d.views })), unit: 'views', height: 190, color: 'var(--protein)' }));
      mountChart($('#monthly-chart', el), (w) => barChart({ width: w, data: s.monthly.map((d) => ({ label: d.month, short: new Date(`${d.month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' }), value: d.views })), unit: 'views', height: 190, color: 'var(--turmeric)' }));
      animateCounters(el);
    };
    await draw();
    el.addEventListener('click', async (e) => { const b = e.target.closest('[data-range]'); if (b) { days = Number(b.dataset.range); await draw(); } });
  },

  async users(el) {
    let { users } = await api.get('admin/users');
    const table = dataTable(el, {
      rows: users,
      search: (u) => `${u.name} ${u.email} ${u.role} ${u.status}`,
      columns: [
        { label: 'Name', render: (u) => `<b>${esc(u.name)}</b><br><span class="muted small">${esc(u.email)}</span>` },
        { label: 'Role', render: (u) => `<label class="sr-only" for="role-${esc(u.id)}">Role</label><select class="select select-sm" id="role-${esc(u.id)}" data-role="${esc(u.id)}" ${u.id === 'admin' ? 'disabled' : ''}>${['user', 'admin'].map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>` },
        { label: 'Status', render: (u) => `<button class="badge ${u.status === 'active' ? 'ok' : 'danger'} badge-btn" type="button" data-toggle-status="${esc(u.id)}" ${u.id === 'admin' ? 'disabled' : ''} aria-label="Toggle status for ${esc(u.name)}">${esc(u.status)}</button>` },
        { label: 'Goal', render: (u) => esc(u.goal || '') },
        { label: 'Joined', render: (u) => (u.createdAt ? fmt.date(u.createdAt) : '') },
        { label: 'Last login', render: (u) => (u.lastLoginAt ? fmt.ago(u.lastLoginAt) : 'never') },
        { label: 'Logins', num: true, render: (u) => fmt.n(u.loginCount || 0) },
        { label: 'Actions', render: (u) => (u.id === 'admin' ? '<span class="muted small">env account</span>' : `<div class="row" style="flex-wrap:nowrap"><button class="icon-btn" type="button" data-set-pw="${esc(u.id)}" aria-label="Set password for ${esc(u.name)}">${icon('settings')}</button><button class="icon-btn" type="button" data-del-user="${esc(u.id)}" aria-label="Delete ${esc(u.name)}">${icon('trash')}</button></div>`) },
      ],
    });
    const refresh = async () => { ({ users } = await api.get('admin/users')); table.update(users); };
    el.addEventListener('change', async (e) => {
      const sel = e.target.closest('[data-role]');
      if (!sel) return;
      try { await api.put(`admin/users/${sel.dataset.role}`, { role: sel.value }); toast('Role updated'); await refresh(); } catch (err) { toast(err.message, 'alert', 'error'); }
    });
    el.addEventListener('click', async (e) => {
      const st = e.target.closest('[data-toggle-status]');
      if (st) {
        const u = users.find((x) => x.id === st.dataset.toggleStatus);
        try { await api.put(`admin/users/${u.id}`, { status: u.status === 'active' ? 'disabled' : 'active' }); toast(`${u.name} is now ${u.status === 'active' ? 'disabled' : 'active'}`); await refresh(); } catch (err) { toast(err.message, 'alert', 'error'); }
      }
      const del = e.target.closest('[data-del-user]');
      if (del) {
        const u = users.find((x) => x.id === del.dataset.delUser);
        if (!await confirmDialog(`Delete ${u.name} (${u.email})? Their meal logs stay in the Meal Logs sheet.`, { title: 'Delete user?', confirmLabel: 'Delete', danger: true })) return;
        try { await api.del(`admin/users/${u.id}`); toast('User deleted'); await refresh(); } catch (err) { toast(err.message, 'alert', 'error'); }
      }
      const pw = e.target.closest('[data-set-pw]');
      if (pw) {
        const u = users.find((x) => x.id === pw.dataset.setPw);
        const m = modal({ title: `Set a new password for ${u.name}`, body: `<form class="stack" novalidate>${field({ id: 'password', label: 'New password', type: 'text', hint: 'At least 8 characters with a letter and a number. Share it with them privately.' })}<button class="btn btn-primary" type="submit">Set password</button></form>` });
        m.el.querySelector('form').addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const form = ev.currentTarget;
          await busy(form.querySelector('button'), async () => {
            try { const r = await api.post(`admin/users/${u.id}/password`, formData(form)); m.close(); toast(r.message, 'shield'); } catch (err) { showErrors(form, err); }
          });
        });
      }
    });
  },

  async recipes(el) {
    let { items } = await api.get('admin/recipes');
    const table = dataTable(el, {
      rows: items,
      toolbar: `<button class="btn btn-primary" type="button" id="new-recipe">${icon('plus')}New recipe</button>`,
      search: (r) => `${r.name} ${r.category} ${r.mealType} ${(r.tags || []).join(' ')}`,
      columns: [
        { label: 'Recipe', render: (r) => `<div class="row" style="flex-wrap:nowrap"><span class="tbl-thumb">${dishSvg(r)}</span><span><b>${esc(r.name)}</b><br><span class="muted small">${esc(r.id)}</span></span></div>` },
        { label: 'Category', render: (r) => esc(CATEGORIES.find((c) => c.id === r.category)?.label || r.category) },
        { label: 'Kcal', num: true, render: (r) => fmt.n(r.nutrition?.calories) },
        { label: 'Protein', num: true, render: (r) => `${fmt.n(r.nutrition?.protein, 1)} g` },
        { label: 'Status', render: (r) => (r.published === false ? '<span class="badge">Hidden</span>' : '<span class="badge ok">Published</span>') },
        { label: 'Actions', render: (r) => `<div class="row" style="flex-wrap:nowrap"><a class="icon-btn" href="${link(`/recipe/${r.id}`)}" aria-label="View ${esc(r.name)}">${icon('eye')}</a><button class="icon-btn" type="button" data-edit="${esc(r.id)}" aria-label="Edit ${esc(r.name)}">${icon('edit')}</button><button class="icon-btn" type="button" data-del="${esc(r.id)}" aria-label="Delete ${esc(r.name)}">${icon('trash')}</button></div>` },
      ],
    });
    const refresh = async () => { ({ items } = await api.get('admin/recipes')); table.update(items); await loadCatalogue(); };
    el.addEventListener('click', async (e) => {
      if (e.target.closest('#new-recipe')) recipeEditor(null, refresh);
      const ed = e.target.closest('[data-edit]');
      if (ed) recipeEditor(items.find((r) => r.id === ed.dataset.edit), refresh);
      const del = e.target.closest('[data-del]');
      if (del) {
        const r = items.find((x) => x.id === del.dataset.del);
        if (!await confirmDialog(`Delete “${r.name}” from the Recipes sheet? Plans that use it will skip it.`, { title: 'Delete recipe?', confirmLabel: 'Delete', danger: true })) return;
        try { await api.del(`admin/recipes/${r.id}`); toast('Recipe deleted'); await refresh(); } catch (err) { toast(err.message, 'alert', 'error'); }
      }
    });
  },

  async ingredients(el) {
    let { items } = await api.get('admin/ingredients');
    const table = dataTable(el, {
      rows: items,
      toolbar: `<button class="btn btn-primary" type="button" id="new-ing">${icon('plus')}New ingredient</button>`,
      search: (i) => `${i.name} ${i.local} ${i.type}`,
      columns: [
        { label: 'Ingredient', render: (i) => `<div class="row" style="flex-wrap:nowrap"><span class="tbl-thumb">${ingredientSvg(i, { size: 36 })}</span><span><b>${esc(i.name)}</b><br><span class="muted small">${esc(i.local)}</span></span></div>` },
        { label: 'Type', render: (i) => esc(INGREDIENT_TYPES[i.type] || i.type) },
        { label: 'Used in', num: true, render: (i) => fmt.n(state.recipes.filter((r) => r.ingredients.some((x) => x.id === i.id)).length) },
        { label: 'Benefit', render: (i) => `<span class="small">${esc(i.benefit)}</span>` },
        { label: 'Actions', render: (i) => `<div class="row" style="flex-wrap:nowrap"><button class="icon-btn" type="button" data-edit="${esc(i.id)}" aria-label="Edit ${esc(i.name)}">${icon('edit')}</button><button class="icon-btn" type="button" data-del="${esc(i.id)}" aria-label="Delete ${esc(i.name)}">${icon('trash')}</button></div>` },
      ],
    });
    const refresh = async () => { ({ items } = await api.get('admin/ingredients')); table.update(items); await loadCatalogue(); };
    const editor = (ing) => {
      const m = modal({
        title: ing ? `Edit ${ing.name}` : 'New ingredient',
        body: `<form class="stack" novalidate><div class="form-grid">
          ${field({ id: 'name', label: 'Name', value: ing?.name || '' })}${field({ id: 'local', label: 'Tamil name', value: ing?.local || '' })}
          ${field({ id: 'type', label: 'Type', type: 'select', value: ing?.type || 'vegetable', options: Object.entries(INGREDIENT_TYPES) })}
          ${field({ id: 'shape', label: 'Illustration shape', type: 'select', value: ing?.shape || 'round', options: ['round', 'long', 'leaf', 'head', 'bulb', 'pod', 'grain', 'powder', 'liquid', 'egg', 'meat', 'cluster', 'wedge', 'seed', 'root'] })}
          ${field({ id: 'color', label: 'Main colour', type: 'color', value: ing?.color || '#4F9A3B' })}${field({ id: 'color2', label: 'Second colour', type: 'color', value: ing?.color2 || '#A9D88A' })}
          ${field({ id: 'benefit', label: 'Benefit', type: 'textarea', value: ing?.benefit || '', full: true })}
        </div><button class="btn btn-primary" type="submit">Save ingredient</button></form>`,
      });
      m.el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        await busy(form.querySelector('button[type="submit"]'), async () => {
          try { if (ing) await api.put(`admin/ingredients/${ing.id}`, formData(form)); else await api.post('admin/ingredients', formData(form)); m.close(); toast('Ingredient saved'); await refresh(); } catch (err) { showErrors(form, err); }
        });
      });
    };
    el.addEventListener('click', async (e) => {
      if (e.target.closest('#new-ing')) editor(null);
      const ed = e.target.closest('[data-edit]');
      if (ed) editor(items.find((i) => i.id === ed.dataset.edit));
      const del = e.target.closest('[data-del]');
      if (del) {
        if (!await confirmDialog('Delete this ingredient? Recipes keep their text but lose the picture link.', { title: 'Delete ingredient?', confirmLabel: 'Delete', danger: true })) return;
        try { await api.del(`admin/ingredients/${del.dataset.del}`); toast('Ingredient deleted'); await refresh(); } catch (err) { toast(err.message, 'alert', 'error'); }
      }
    });
  },

  async 'meal-plans'(el) {
    let { items } = await api.get('admin/meal-plans');
    const table = dataTable(el, {
      rows: items,
      toolbar: `<button class="btn btn-primary" type="button" id="new-plan">${icon('plus')}New plan</button>`,
      search: (p) => `${p.name} ${p.goal}`,
      columns: [
        { label: 'Plan', render: (p) => `<b>${esc(p.name)}</b><br><span class="muted small">${esc(p.id)}</span>` },
        { label: 'Goal', render: (p) => esc(p.goal || '') },
        { label: 'Days', num: true, render: (p) => fmt.n((p.days || []).length) },
        { label: 'Featured', render: (p) => (p.featured ? '<span class="badge warn">Featured</span>' : '') },
        { label: 'Actions', render: (p) => `<div class="row" style="flex-wrap:nowrap"><a class="icon-btn" href="${link(`/meal-plans/${p.id}`)}" aria-label="View ${esc(p.name)}">${icon('eye')}</a><button class="icon-btn" type="button" data-edit="${esc(p.id)}" aria-label="Edit ${esc(p.name)}">${icon('edit')}</button><button class="icon-btn" type="button" data-del="${esc(p.id)}" aria-label="Delete ${esc(p.name)}">${icon('trash')}</button></div>` },
      ],
    });
    const refresh = async () => { ({ items } = await api.get('admin/meal-plans')); table.update(items); await loadCatalogue(); };
    const editor = (p) => {
      const template = p?.days || [{ key: 'mon', label: 'Monday', chicken: 'Grilled', slots: Object.fromEntries(SLOTS.map((s) => [s.id, []])) }];
      const m = modal({
        title: p ? `Edit ${p.name}` : 'New meal plan',
        wide: true,
        body: `<form class="stack" novalidate><div class="form-grid">
          ${field({ id: 'name', label: 'Name', value: p?.name || '', full: true })}
          ${field({ id: 'summary', label: 'Summary', type: 'textarea', value: p?.summary || '', full: true, attrs: 'rows="2"' })}
          ${field({ id: 'goal', label: 'Goal', value: p?.goal || '' })}${field({ id: 'level', label: 'Level', value: p?.level || '' })}
          ${field({ id: 'duration', label: 'Duration', value: p?.duration || '' })}${field({ id: 'color', label: 'Colour', type: 'color', value: p?.color || '#1F6B45' })}
          <label class="check full"><input type="checkbox" name="featured" ${p?.featured ? 'checked' : ''}> Feature on the meal plans page</label>
          ${field({ id: 'days', label: 'Days (JSON)', type: 'textarea', value: JSON.stringify(template, null, 2), full: true, attrs: 'rows="14" spellcheck="false" style="font-family:var(--font-data);font-size:.8rem"', hint: `Each day: key, label, chicken, and slots (${SLOTS.map((s) => s.id).join(', ')}) holding items like {"id":"idli","portion":1}.` })}
        </div><button class="btn btn-primary" type="submit">Save plan</button></form>`,
      });
      m.el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const d = formData(form);
        let daysJson;
        try { daysJson = JSON.parse(d.days); } catch { showErrors(form, { message: 'Days must be valid JSON.', fields: { days: 'Check commas and brackets.' } }); return; }
        const unknown = daysJson.flatMap((day) => Object.values(day.slots || {}).flat().map((it) => it.id)).filter((id) => !state.recipeMap[id]);
        if (unknown.length) { showErrors(form, { message: `Unknown recipe ids: ${[...new Set(unknown)].join(', ')}`, fields: { days: 'Use recipe ids from the Recipes tab.' } }); return; }
        await busy(form.querySelector('button[type="submit"]'), async () => {
          try {
            const payload = { ...d, featured: form.featured.checked, days: daysJson };
            if (p) await api.put(`admin/meal-plans/${p.id}`, payload); else await api.post('admin/meal-plans', payload);
            m.close(); toast('Plan saved'); await refresh();
          } catch (err) { showErrors(form, err); }
        });
      });
    };
    el.addEventListener('click', async (e) => {
      if (e.target.closest('#new-plan')) editor(null);
      const ed = e.target.closest('[data-edit]');
      if (ed) editor(items.find((p) => p.id === ed.dataset.edit));
      const del = e.target.closest('[data-del]');
      if (del) {
        if (!await confirmDialog('Delete this meal plan? Members following it fall back to the featured plan.', { title: 'Delete plan?', confirmLabel: 'Delete', danger: true })) return;
        try { await api.del(`admin/meal-plans/${del.dataset.del}`); toast('Plan deleted'); await refresh(); } catch (err) { toast(err.message, 'alert', 'error'); }
      }
    });
  },

  async content(el) {
    const { content } = await api.get('admin/content');
    const keys = [['siteName', 'Site name'], ['heroTitle', 'Home headline'], ['heroSubtitle', 'Home sub-headline'], ['announcement', 'Announcement'], ['trainerNote', 'Trainer note'], ['contactEmail', 'Contact email']];
    el.innerHTML = `<div class="grid-2">
      <form class="panel stack" id="content-form" novalidate><h2>Site content</h2><p class="muted small">Stored in the Content sheet. Changes show to visitors on their next page load.</p>
        ${keys.map(([k, l]) => field({ id: k, label: l, type: ['heroSubtitle', 'trainerNote'].includes(k) ? 'textarea' : 'text', value: content[k] || '', attrs: ['heroSubtitle', 'trainerNote'].includes(k) ? 'rows="3"' : '' })).join('')}
        <button class="btn btn-primary" type="submit" style="align-self:flex-start">Save content</button></form>
      <section class="panel stack"><h2>Set up the Google Sheet</h2><p class="muted">Creates any missing tabs with their headers, then copies the built-in recipes, ingredients, meal plans and site text into the sheet so you can edit them here. Only missing rows are added; nothing is overwritten. Safe to press again.</p>
        <button class="btn btn-accent" type="button" id="seed" style="align-self:flex-start">${icon('download')}Set up sheet and load recipes</button><div id="seed-out"></div>
        <h2 style="margin-top:10px">Sheets used</h2><ul class="sheet-list">${Object.values(SHEETS).map((s) => `<li>${icon('list')}<b>${esc(s.title)}</b><span class="muted small">${s.columns.length} columns</span></li>`).join('')}</ul></section>
    </div>`;
    $('#content-form', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      await busy(form.querySelector('button[type="submit"]'), async () => {
        try { await api.put('admin/content', { content: formData(form) }); await loadCatalogue(); toast('Content saved'); } catch (err) { showErrors(form, err); }
      });
    });
    $('#seed', el).addEventListener('click', async (e) => {
      await busy(e.currentTarget, async () => {
        try { const { inserted, tabsCreated = [] } = await api.post('admin/seed'); $('#seed-out', el).innerHTML = `<div class="alert success">${tabsCreated.length ? `Created tabs: ${esc(tabsCreated.join(', '))}. ` : ''}Added ${Object.entries(inserted).map(([k, v]) => `${v} ${k}`).join(', ')}.</div>`; await loadCatalogue(); } catch (err) { toast(err.message, 'alert', 'error'); }
      });
    });
  },

  async feedback(el) { await ticketSection(el, 'feedback'); },
  async messages(el) { await ticketSection(el, 'contact'); },

  async activity(el) {
    const { items } = await api.get('admin/activity', { limit: 1000 });
    const actions = [...new Set(items.map((i) => i.action))].sort();
    let rows = items;
    const table = dataTable(el, {
      rows,
      pageSize: 25,
      toolbar: `<label class="sr-only" for="act-filter">Action</label><select class="select" id="act-filter" style="width:auto"><option value="">All actions</option>${actions.map((a) => `<option>${esc(a)}</option>`).join('')}</select>`,
      search: (a) => `${a.action} ${a.email} ${a.entity} ${a.entityId} ${a.details}`,
      columns: [
        { label: 'When', render: (a) => `<span class="num small" title="${esc(a.timestamp)}">${fmt.dateTime(a.timestamp)}</span>` },
        { label: 'Who', render: (a) => esc(a.email || 'guest') },
        { label: 'Action', render: (a) => `<span class="badge ${/fail|delete/.test(a.action) ? 'danger' : /admin/.test(a.action) ? 'warn' : 'info'}">${esc(a.action)}</span>` },
        { label: 'Item', render: (a) => `${esc(a.entity)} <span class="muted small">${esc(a.entityId)}</span>` },
        { label: 'Details', render: (a) => `<span class="small">${esc(a.details)}</span>` },
        { label: 'IP', render: (a) => `<span class="num small">${esc(a.ip)}</span>` },
      ],
    });
    $('#act-filter', el).addEventListener('change', (e) => { rows = e.target.value ? items.filter((i) => i.action === e.target.value) : items; table.update(rows); });
  },

  async export(el) {
    const sets = Object.entries(SHEETS);
    el.innerHTML = `<p class="muted" style="margin-bottom:14px">Download any sheet as CSV or Excel. Password hashes and reset tokens are never exported.</p>
      <div class="export-grid">${sets.map(([k, s]) => `<div class="panel export-card"><h3>${esc(s.title)}</h3><p class="muted small">${s.columns.length} columns</p><div class="row"><button class="btn btn-sm" type="button" data-csv="${k}">${icon('download')}CSV</button><button class="btn btn-sm" type="button" data-xlsx="${k}">${icon('download')}Excel</button></div></div>`).join('')}</div>
      <button class="btn btn-primary" type="button" id="xlsx-all" style="margin-top:16px">${icon('download')}Everything in one Excel workbook</button>`;
    const fetchSet = (k) => api.get(`admin/export/${k}`);
    const toSheetRows = (data) => data.rows.map((r) => Object.fromEntries(data.columns.map((c) => [c, r[c] === null || r[c] === undefined ? '' : typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c]])));
    el.addEventListener('click', async (e) => {
      const csv = e.target.closest('[data-csv]');
      const xl = e.target.closest('[data-xlsx]');
      const all = e.target.closest('#xlsx-all');
      const btn = csv || xl || all;
      if (!btn) return;
      await busy(btn, async () => {
        try {
          if (csv) {
            const data = await fetchSet(csv.dataset.csv);
            downloadFile(`platefit-${csv.dataset.csv}-${today()}.csv`, toCsv(data.columns, data.rows), 'text/csv');
            toast(`Prepared ${data.rows.length} rows`, 'download');
          } else {
            await loadScript(XLSX_SRC);
            const wb = window.XLSX.utils.book_new();
            const keys = all ? sets.map(([k]) => k) : [xl.dataset.xlsx];
            for (const k of keys) {
              const data = await fetchSet(k);
              const ws = window.XLSX.utils.json_to_sheet(toSheetRows(data), { header: data.columns });
              window.XLSX.utils.book_append_sheet(wb, ws, data.title.slice(0, 31));
            }
            const out = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            downloadFile(`platefit-${all ? 'all' : keys[0]}-${today()}.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            toast('Excel file prepared', 'download');
          }
          track('export', { query: csv?.dataset.csv || xl?.dataset.xlsx || 'all' });
        } catch (err) { toast(err.message || 'Export failed', 'alert', 'error'); }
      });
    });
  },
};

async function ticketSection(el, kind) {
  const path = kind === 'contact' ? 'admin/contact' : 'admin/feedback';
  let { items } = await api.get(path);
  const columns = kind === 'contact'
    ? [
      { label: 'Received', render: (c) => `<span class="small">${fmt.dateTime(c.createdAt)}</span>` },
      { label: 'From', render: (c) => `<b>${esc(c.name)}</b><br><span class="muted small">${esc(c.email)}</span>` },
      { label: 'Message', render: (c) => `<b>${esc(c.subject)}</b><br><span class="small">${esc(c.message)}</span>` },
      { label: 'Status', render: (c) => statusSelect(c.id, c.status, 'contact') },
      { label: '', render: (c) => `<button class="icon-btn" type="button" data-del="${esc(c.id)}" aria-label="Delete message">${icon('trash')}</button>` },
    ]
    : [
      { label: 'Received', render: (f) => `<span class="small">${fmt.dateTime(f.createdAt)}</span>` },
      { label: 'Recipe', render: (f) => (f.recipeId ? `<a href="${link(`/recipe/${f.recipeId}`)}">${esc(state.recipeMap[f.recipeId]?.name || f.recipeId)}</a>` : '<span class="muted">General</span>') },
      { label: 'Rating', render: (f) => `<span class="stars-static" aria-label="${f.rating} of 5">${'★'.repeat(f.rating)}<span class="muted">${'★'.repeat(5 - f.rating)}</span></span>` },
      { label: 'Comment', render: (f) => `<span class="small">${esc(f.message || '')}</span><br><span class="muted small">${esc(f.userName)}${f.email ? ` · ${esc(f.email)}` : ''}</span>` },
      { label: 'Status', render: (f) => statusSelect(f.id, f.status, 'feedback') },
      { label: '', render: (f) => `<button class="icon-btn" type="button" data-del="${esc(f.id)}" aria-label="Delete feedback">${icon('trash')}</button>` },
    ];
  const avg = kind === 'feedback' && items.length ? items.reduce((a, f) => a + f.rating, 0) / items.length : null;
  const table = dataTable(el, {
    rows: items,
    toolbar: `<div class="row">${['new', 'reviewed', 'resolved'].map((s) => `${statusBadge(s)} <b class="num">${items.filter((i) => i.status === s).length}</b>`).join('&nbsp;&nbsp;')}${avg !== null ? `&nbsp;&nbsp;<span class="badge info">Average ${fmt.n(avg, 1)} ★</span>` : ''}</div>`,
    search: (x) => JSON.stringify(x),
    empty: kind === 'contact' ? 'No messages yet.' : 'No feedback yet.',
    columns,
  });
  const refresh = async () => { ({ items } = await api.get(path)); table.update(items); };
  el.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    const [, id] = sel.dataset.status.split(':');
    try { await api.put(`${path}/${id}`, { status: sel.value }); toast(`Marked ${sel.value}`); } catch (err) { toast(err.message, 'alert', 'error'); }
  });
  el.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    if (!await confirmDialog('This permanently removes the row from the sheet.', { title: 'Delete?', confirmLabel: 'Delete', danger: true })) return;
    try { await api.del(`${path}/${del.dataset.del}`); toast('Deleted'); await refresh(); } catch (err) { toast(err.message, 'alert', 'error'); }
  });
}

// ---------- recipe editor ----------
function recipeEditor(r, onSaved) {
  const lines = (arr) => (arr || []).join('\n');
  const ingLines = (r?.ingredients || []).map((i) => [i.id || i.name, i.qty, i.note].filter((x, k) => k < 2 || x).join(' | ')).join('\n');
  const stepLines = (r?.steps || []).map((s) => [s.title, s.text, s.minutes || ''].join(' | ').replace(/ \| $/, '')).join('\n');
  const n = r?.nutrition || {};
  const colors = r?.art?.colors || ['#1F6B45', '#E8A317', '#C8402A'];
  const m = modal({
    title: r ? `Edit ${r.name}` : 'New recipe',
    wide: true,
    body: `<form class="stack" novalidate id="recipe-form">
      <div class="form-grid">
        ${field({ id: 'name', label: 'Recipe name', value: r?.name || '' })}${field({ id: 'local', label: 'Tamil / local name', value: r?.local || '' })}
        ${field({ id: 'category', label: 'Category', type: 'select', value: r?.category || 'lunch', options: CATEGORIES.map((c) => [c.id, c.label]) })}
        ${field({ id: 'mealType', label: 'Meal type', type: 'select', value: r?.mealType || 'Lunch', options: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Beverage'] })}
        ${field({ id: 'slot', label: 'Time slot', type: 'select', value: r?.slot || 'lunch', options: [...SLOTS.map((s) => [s.id, `${s.time} · ${s.label}`]), ['all-day', 'All day']] })}
        ${field({ id: 'difficulty', label: 'Difficulty', type: 'select', value: r?.difficulty || 'Easy', options: ['Easy', 'Medium', 'Hard'] })}
        ${field({ id: 'summary', label: 'Summary', type: 'textarea', value: r?.summary || '', full: true, attrs: 'rows="2"' })}
        ${field({ id: 'planNote', label: 'Plan note', value: r?.planNote || '', full: true })}
        ${field({ id: 'serving', label: 'Serving size', value: r?.serving || '' })}${field({ id: 'yield', label: 'Servings made', type: 'number', value: r?.yield || 1, attrs: 'min="1" max="50"' })}
        ${field({ id: 'prep', label: 'Prep time (min)', type: 'number', value: r?.prep ?? '', attrs: 'min="0"' })}${field({ id: 'cook', label: 'Cook time (min)', type: 'number', value: r?.cook ?? '', attrs: 'min="0"' })}
        ${field({ id: 'wait', label: 'Waiting time (soaking, fermenting…)', value: r?.wait || '', full: true })}
        ${field({ id: 'calories', label: 'Calories (kcal)', type: 'number', value: n.calories ?? '', attrs: 'min="0" step="1"' })}${field({ id: 'protein', label: 'Protein (g)', type: 'number', value: n.protein ?? '', attrs: 'min="0" step="0.1"' })}
        ${field({ id: 'carbs', label: 'Carbs (g)', type: 'number', value: n.carbs ?? '', attrs: 'min="0" step="0.1"' })}${field({ id: 'fat', label: 'Fat (g)', type: 'number', value: n.fat ?? '', attrs: 'min="0" step="0.1"' })}
        ${field({ id: 'fibre', label: 'Fibre (g)', type: 'number', value: n.fibre ?? '', attrs: 'min="0" step="0.1"' })}
        <label class="check"><input type="checkbox" name="published" ${r?.published === false ? '' : 'checked'}> Published</label>
        ${field({ id: 'ingredients', label: 'Ingredients, one per line: ingredient id or name | quantity | note', type: 'textarea', value: ingLines, full: true, attrs: 'rows="7" spellcheck="false"', hint: 'Example: chicken | 250 g | boneless. Missing quantities show as “Not Specified”.' })}
        ${field({ id: 'steps', label: 'Steps, one per line: title | instruction | minutes (optional)', type: 'textarea', value: stepLines, full: true, attrs: 'rows="7"' })}
        ${field({ id: 'storage', label: 'Storage', type: 'textarea', value: r?.storage || '', full: true, attrs: 'rows="2"' })}
        ${field({ id: 'benefits', label: 'Benefits (one per line)', type: 'textarea', value: lines(r?.benefits), attrs: 'rows="4"' })}
        ${field({ id: 'tips', label: 'Tips (one per line)', type: 'textarea', value: lines(r?.tips), attrs: 'rows="4"' })}
        ${field({ id: 'mistakes', label: 'Mistakes to avoid (one per line)', type: 'textarea', value: lines(r?.mistakes), attrs: 'rows="4"' })}
        ${field({ id: 'tags', label: 'Tags (comma separated)', value: (r?.tags || []).join(', ') })}
        ${field({ id: 'dish', label: 'Illustration', type: 'select', value: r?.art?.dish || 'plate', options: ['plate', 'bowl', 'cup', 'glass', 'stack', 'flat', 'fruit'] })}
        <div class="field"><span class="label-text">Illustration colours</span><div class="row">${colors.map((c, i) => `<label class="sr-only" for="c${i}">Colour ${i + 1}</label><input type="color" id="c${i}" name="c${i}" value="${esc(c)}">`).join('')}</div></div>
      </div>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save recipe</button></div>
    </form>`,
  });
  m.el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = formData(form);
    const split = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
    const payload = {
      name: d.name, local: d.local, category: d.category, mealType: d.mealType, slot: d.slot, difficulty: d.difficulty,
      summary: d.summary, planNote: d.planNote, serving: d.serving, yield: d.yield, prep: d.prep, cook: d.cook, wait: d.wait,
      nutrition: { calories: d.calories, protein: d.protein, carbs: d.carbs, fat: d.fat, fibre: d.fibre },
      published: form.published.checked,
      ingredients: split(d.ingredients).map((line) => { const [a, qty, note] = line.split('|').map((x) => x.trim()); const ing = state.ingredientMap[a]; return { id: ing ? a : null, name: ing ? ing.name : a, qty: qty || 'Not Specified', note: note || '' }; }),
      steps: split(d.steps).map((line) => { const [title, text, mins] = line.split('|').map((x) => x.trim()); return { title, text: text || title, minutes: Number(mins) || 0 }; }),
      storage: d.storage, benefits: split(d.benefits), tips: split(d.tips), mistakes: split(d.mistakes),
      tags: d.tags.split(',').map((x) => x.trim()).filter(Boolean),
      art: { dish: d.dish, colors: [d.c0, d.c1, d.c2], items: r?.art?.items },
    };
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        if (r) await api.put(`admin/recipes/${r.id}`, payload); else await api.post('admin/recipes', payload);
        m.close();
        toast('Recipe saved', 'book');
        await onSaved();
      } catch (err) { showErrors(form, err); }
    });
  });
}

