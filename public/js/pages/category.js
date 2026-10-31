import { state } from '../core/state.js';
import { esc, fmt, debounce, storage, $, $$ } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { recipeCard, emptyState } from '../ui/components.js';
import { CATEGORY_MAP, CATEGORIES } from '../data/recipes/index.js';
import { SLOT_MAP } from '../data/plans.js';
import { setSeo } from '../core/seo.js';
import { link } from '../core/router.js';
import { track } from '../core/analytics.js';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Beverage'];
const SORTS = [['plan', 'Plan order'], ['protein', 'Most protein'], ['calories-asc', 'Fewest calories'], ['calories-desc', 'Most calories'], ['quick', 'Quickest'], ['name', 'Name A–Z']];

export default async function render(view, { route, query, path }) {
  const catId = route.category;
  const cat = catId === 'all' ? { id: 'all', label: 'All recipes', blurb: 'Every recipe in the plan, with filters for calories, macros and ingredients.' } : CATEGORY_MAP[catId];
  const base = catId === 'all' ? state.recipes : state.recipes.filter((r) => r.category === catId);
  const slot = base[0] && catId !== 'all' ? SLOT_MAP[base[0].slot] : null;
  setSeo({ path, title: cat.label, description: `${cat.blurb} ${base.length} South Indian recipes with ingredients, steps and nutrition.` });

  const maxCal = Math.max(...base.map((r) => r.nutrition.calories || 0), 50);
  const calCeil = Math.ceil(maxCal / 50) * 50;
  const usedIngredients = [...new Set(base.flatMap((r) => r.ingredients.map((i) => i.id)).filter(Boolean))]
    .map((id) => state.ingredientMap[id]).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));

  const f = {
    q: query.q || '',
    types: new Set(),
    calMin: 0,
    calMax: calCeil,
    proteinMin: 0,
    carbsMax: 400,
    fatMax: 100,
    ingredients: new Set([query.ingredient, storage.get('ingredient-filter')].filter((x) => x && state.ingredientMap[x])),
    sort: 'plan',
  };
  storage.remove('ingredient-filter');

  view.innerHTML = `
  <div class="page-head">
    <div class="stack">
      <span class="eyebrow">${slot ? `${esc(slot.window)} · ${esc(slot.label)}` : 'Recipe library'}</span>
      <h1>${esc(cat.label)}</h1>
      <p class="lede">${esc(cat.blurb)}</p>
    </div>
    ${catId === 'all' ? '' : `<div class="chips">${CATEGORIES.map((c) => `<a class="chip ${c.id === catId ? 'active' : ''}" href="${link(c.path)}">${esc(c.label)}</a>`).join('')}</div>`}
  </div>
  <div class="catalog">
    <aside class="filters panel" id="filters" aria-label="Filters">
      <div class="panel-head" style="margin-bottom:8px"><h2 style="font-size:var(--step-1)">Filters</h2><button class="btn btn-ghost btn-sm" type="button" id="reset-filters">Reset</button></div>
      ${catId === 'all' ? `<fieldset class="fgroup"><legend>Meal type</legend><div class="chips">${MEAL_TYPES.map((t) => `<button class="chip" type="button" aria-pressed="false" data-mtype="${t}">${t}</button>`).join('')}</div></fieldset>` : ''}
      <fieldset class="fgroup"><legend>Calories per serving</legend>
        <div class="range-pair"><label class="sr-only" for="cal-min">Minimum calories</label><input type="range" id="cal-min" min="0" max="${calCeil}" step="10" value="0"><label class="sr-only" for="cal-max">Maximum calories</label><input type="range" id="cal-max" min="0" max="${calCeil}" step="10" value="${calCeil}"></div>
        <div class="range-read num" id="cal-read">0–${calCeil} kcal</div>
      </fieldset>
      <fieldset class="fgroup"><legend>Nutrition</legend>
        <label class="range-row" for="protein-min"><span>Protein at least</span><b class="num" id="protein-read">0 g</b></label><input type="range" id="protein-min" min="0" max="60" step="1" value="0">
        <label class="range-row" for="carbs-max"><span>Carbs at most</span><b class="num" id="carbs-read">any</b></label><input type="range" id="carbs-max" min="0" max="80" step="1" value="80">
        <label class="range-row" for="fat-max"><span>Fat at most</span><b class="num" id="fat-read">any</b></label><input type="range" id="fat-max" min="0" max="25" step="0.5" value="25">
      </fieldset>
      <fieldset class="fgroup"><legend>Contains ingredient</legend>
        <label class="sr-only" for="ing-select">Add an ingredient filter</label>
        <select class="select" id="ing-select"><option value="">Add an ingredient…</option>${usedIngredients.map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select>
        <div class="chips" id="ing-chips" style="margin-top:10px"></div>
      </fieldset>
    </aside>
    <div class="results stack">
      <div class="toolbar">
        <div class="search-box">${icon('search')}<label class="sr-only" for="q">Search in ${esc(cat.label)}</label><input class="input" id="q" type="search" placeholder="Search ${esc(cat.label.toLowerCase())}…" value="${esc(f.q)}"></div>
        <label class="sr-only" for="sort">Sort by</label>
        <select class="select" id="sort" style="width:auto">${SORTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        <button class="btn filters-toggle" type="button" id="filters-toggle" aria-controls="filters" aria-expanded="false">${icon('filter')}Filters</button>
      </div>
      <p class="muted" id="count" aria-live="polite"></p>
      <div class="grid-cards" id="grid"></div>
    </div>
  </div>`;

  const grid = $('#grid', view);
  const count = $('#count', view);
  const order = new Map(state.recipes.map((r, i) => [r.id, i]));

  const apply = () => {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    let list = base.filter((r) => {
      const n = r.nutrition;
      if (words.length) {
        const text = `${r.name} ${r.local} ${r.summary} ${r.tags.join(' ')} ${r.ingredients.map((i) => i.name).join(' ')}`.toLowerCase();
        if (!words.every((w) => text.includes(w))) return false;
      }
      if (f.types.size && !f.types.has(r.mealType)) return false;
      if ((n.calories ?? 0) < f.calMin || (n.calories ?? 0) > f.calMax) return false;
      if ((n.protein ?? 0) < f.proteinMin) return false;
      if (f.carbsMax < 80 && (n.carbs ?? 0) > f.carbsMax) return false;
      if (f.fatMax < 25 && (n.fat ?? 0) > f.fatMax) return false;
      for (const id of f.ingredients) if (!r.ingredients.some((i) => i.id === id)) return false;
      return true;
    });
    const by = {
      plan: (a, b) => order.get(a.id) - order.get(b.id),
      protein: (a, b) => (b.nutrition.protein || 0) - (a.nutrition.protein || 0),
      'calories-asc': (a, b) => (a.nutrition.calories || 0) - (b.nutrition.calories || 0),
      'calories-desc': (a, b) => (b.nutrition.calories || 0) - (a.nutrition.calories || 0),
      quick: (a, b) => ((a.prep || 0) + (a.cook || 0)) - ((b.prep || 0) + (b.cook || 0)),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    list = list.sort(by[f.sort]);
    count.textContent = `${list.length} of ${base.length} recipe${base.length === 1 ? '' : 's'}`;
    grid.innerHTML = list.length ? list.map((r) => recipeCard(r, { showCategory: catId === 'all' })).join('') : emptyState({ title: 'No recipes match these filters', text: 'Widen the calorie range or remove an ingredient filter.', action: '<button class="btn" type="button" data-reset>Reset filters</button>' });
    grid.classList.remove('stagger'); void grid.offsetWidth; grid.classList.add('stagger');
    $('#ing-chips', view).innerHTML = [...f.ingredients].map((id) => `<button class="chip active" type="button" data-remove-ing="${esc(id)}" aria-label="Remove ${esc(state.ingredientMap[id]?.name)} filter">${esc(state.ingredientMap[id]?.name.split('(')[0])} ${icon('x')}</button>`).join('');
    $('#cal-read', view).textContent = `${fmt.n(f.calMin)}–${fmt.n(f.calMax)} kcal`;
    $('#protein-read', view).textContent = `${f.proteinMin} g`;
    $('#carbs-read', view).textContent = f.carbsMax >= 80 ? 'any' : `${f.carbsMax} g`;
    $('#fat-read', view).textContent = f.fatMax >= 25 ? 'any' : `${f.fatMax} g`;
    return list.length;
  };
  const trackSearch = debounce((q, n) => { if (q.length > 1) track('search', { query: q, results: n }); }, 900);

  $('#q', view).addEventListener('input', (e) => { f.q = e.target.value; const n = apply(); trackSearch(f.q.trim().toLowerCase(), n); });
  $('#sort', view).addEventListener('change', (e) => { f.sort = e.target.value; apply(); });
  const calMin = $('#cal-min', view);
  const calMax = $('#cal-max', view);
  calMin.addEventListener('input', () => { f.calMin = Math.min(Number(calMin.value), f.calMax); calMin.value = f.calMin; apply(); });
  calMax.addEventListener('input', () => { f.calMax = Math.max(Number(calMax.value), f.calMin); calMax.value = f.calMax; apply(); });
  $('#protein-min', view).addEventListener('input', (e) => { f.proteinMin = Number(e.target.value); apply(); });
  $('#carbs-max', view).addEventListener('input', (e) => { f.carbsMax = Number(e.target.value); apply(); });
  $('#fat-max', view).addEventListener('input', (e) => { f.fatMax = Number(e.target.value); apply(); });
  $('#ing-select', view).addEventListener('change', (e) => { if (e.target.value) f.ingredients.add(e.target.value); e.target.value = ''; apply(); });
  const reset = () => {
    Object.assign(f, { q: '', calMin: 0, calMax: calCeil, proteinMin: 0, carbsMax: 80, fatMax: 25, sort: 'plan' });
    f.types.clear(); f.ingredients.clear();
    $('#q', view).value = ''; calMin.value = 0; calMax.value = calCeil; $('#protein-min', view).value = 0; $('#carbs-max', view).value = 80; $('#fat-max', view).value = 25; $('#sort', view).value = 'plan';
    $$('[data-mtype]', view).forEach((b) => b.setAttribute('aria-pressed', 'false'));
    apply();
  };
  $('#reset-filters', view).addEventListener('click', reset);
  view.addEventListener('click', (e) => {
    if (e.target.closest('[data-reset]')) reset();
    const rm = e.target.closest('[data-remove-ing]');
    if (rm) { f.ingredients.delete(rm.dataset.removeIng); apply(); }
    const mt = e.target.closest('[data-mtype]');
    if (mt) { const t = mt.dataset.mtype; if (f.types.has(t)) f.types.delete(t); else f.types.add(t); mt.setAttribute('aria-pressed', String(f.types.has(t))); apply(); }
  });
  const toggle = $('#filters-toggle', view);
  toggle.addEventListener('click', () => { const open = !view.querySelector('.catalog').classList.toggle('filters-closed'); toggle.setAttribute('aria-expanded', String(open)); });
  view.querySelector('.catalog').classList.add('filters-closed');
  f.carbsMax = 80; f.fatMax = 25;
  apply();
}
