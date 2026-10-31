import { state, activePlan } from '../core/state.js';
import { link } from '../core/router.js';
import { esc, fmt, today, storage, $, $$ } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { dishSvg, ingredientSvg } from '../ui/art.js';
import { recipeCard, sectionHead, field, formData, showErrors, busy, toast, modal } from '../ui/components.js';
import { CATEGORIES } from '../data/recipes/index.js';
import { SLOTS, ROUTINE } from '../data/plans.js';
import { INGREDIENT_TYPES } from '../data/ingredients.js';
import { planDayFor, planAverages } from '../core/nutrition.js';
import { api } from '../core/api.js';
import { setSeo } from '../core/seo.js';
import { track } from '../core/analytics.js';

function currentSlotIndex() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const starts = SLOTS.map((s) => { const [t, ap] = s.time.split(' '); let [h, m] = t.split(':').map(Number); if (ap === 'PM' && h !== 12) h += 12; return h * 60 + m; });
  let idx = 0;
  starts.forEach((st, i) => { if (mins >= st - 20) idx = i; });
  if (mins < starts[0] - 20) return 0;
  return idx;
}

export default async function render(view) {
  const c = state.content;
  const plan = activePlan();
  const day = planDayFor(plan, today());
  const avg = planAverages(plan, state.recipeMap);
  const nowIdx = currentSlotIndex();
  setSeo({ path: '/', title: '', description: c.heroSubtitle });

  const timeline = SLOTS.map((s, i) => {
    const items = (day?.slots?.[s.id] || []).map((it) => state.recipeMap[it.id]).filter(Boolean);
    const state_ = i < nowIdx ? 'past' : i === nowIdx ? 'now' : 'next';
    return `<li class="tl-item ${state_}">
      <span class="tl-time num">${s.time}</span>
      <span class="tl-dot" aria-hidden="true"></span>
      <div class="tl-body"><b>${s.label}${state_ === 'now' ? '<span class="badge warn">Now</span>' : ''}</b>
        <div class="tl-foods">${items.map((r) => `<a href="${link(`/recipe/${r.id}`)}" class="tl-food" title="${esc(r.name)}"><span class="tl-thumb">${dishSvg(r)}</span><span>${esc(r.name.replace(/\s*\(.*?\)\s*/g, ' ').trim())}</span></a>`).join('')}</div>
      </div></li>`;
  }).join('');

  const catCards = CATEGORIES.map((cat) => {
    const list = state.recipes.filter((r) => r.category === cat.id);
    const hero = list.find((r) => ['grilled-chicken', 'idli', 'chapati', 'chana-sundal', 'salad-beetroot-carrot-cabbage', 'pomegranate', 'green-tea'].includes(r.id)) || list[0];
    const slot = SLOTS.find((s) => s.id === hero?.slot);
    return `<a class="cat-card" href="${link(cat.path)}" style="--art:${esc(hero?.art.colors[0] || '#1F6B45')}">
      <span class="cat-art">${hero ? dishSvg(hero) : ''}</span>
      <span class="cat-text"><span class="cat-time num">${slot ? slot.time : ''}</span><b>${esc(cat.label)}</b><span class="muted">${esc(cat.blurb)}</span><span class="cat-count">${list.length} recipes ${icon('arrow')}</span></span>
    </a>`;
  }).join('');

  const featured = ['grilled-chicken', 'salad-sprouts', 'idli', 'tandoori-chicken', 'chana-sundal', 'murungai-keerai-poriyal', 'pepper-chicken', 'salad-kosambari'].map((id) => state.recipeMap[id]).filter(Boolean);
  const types = Object.entries(INGREDIENT_TYPES).filter(([k]) => state.ingredients.some((i) => i.type === k));

  view.innerHTML = `
  <section class="hero">
    <div class="hero-copy stack">
      <span class="eyebrow">Trainer-approved · South Indian · High protein</span>
      <h1>${esc(c.heroTitle)}</h1>
      <p class="lede">${esc(c.heroSubtitle)}</p>
      <div class="row" style="gap:12px;margin-top:6px">
        <a class="btn btn-primary btn-lg" href="${link('/dashboard')}">${icon('gauge')}Track today</a>
        <a class="btn btn-lg" href="${link(`/meal-plans/${plan.id}`)}">${icon('calendar')}See the 7-day plan</a>
      </div>
      <dl class="hero-stats">
        <div><dt>Recipes</dt><dd class="num" data-count="${state.recipes.length}">${state.recipes.length}</dd></div>
        <div><dt>Ingredients</dt><dd class="num" data-count="${state.ingredients.length}">${state.ingredients.length}</dd></div>
        <div><dt>Protein a day</dt><dd class="num"><span data-count="${Math.round(avg.protein)}">${Math.round(avg.protein)}</span><small> g</small></dd></div>
        <div><dt>Calories a day</dt><dd class="num"><span data-count="${Math.round(avg.calories)}">${fmt.n(avg.calories)}</span></dd></div>
      </dl>
    </div>
    <aside class="today-card" aria-labelledby="today-title">
      <div class="today-head"><div><span class="eyebrow">${esc(day?.label || 'Today')}${day?.chicken ? ` · ${esc(day.chicken)} chicken` : ''}</span><h2 id="today-title">Today’s plate, by the clock</h2></div><a class="btn btn-sm" href="${link('/dashboard')}">Log meals</a></div>
      <ol class="timeline">${timeline}</ol>
    </aside>
  </section>

  <section class="section" aria-labelledby="cats-title">
    ${sectionHead('Seven collections', 'Every meal of the day', `<a class="btn btn-ghost" href="${link('/recipes')}">All ${state.recipes.length} recipes ${icon('arrow')}</a>`).replace('<h2>', '<h2 id="cats-title">')}
    <div class="cat-grid stagger">${catCards}</div>
  </section>

  <section class="section plate-section" aria-labelledby="plate-title">
    <div class="plate-visual" data-reveal>
      <svg viewBox="0 0 320 320" role="img" aria-label="Lunch plate: 30 percent rice, 70 percent vegetables and greens">
        <circle cx="160" cy="160" r="150" fill="#EEF2F3" stroke="#C5CED2" stroke-width="2"/>
        <circle cx="160" cy="160" r="122" fill="#F7F9F9"/>
        <path class="plate-rice" d="M160 160 L160 38 A122 122 0 0 1 276 197.7 Z" fill="#FFFFFF" stroke="#E6E1D4"/>
        <path class="plate-veg" d="M160 160 L276 197.7 A122 122 0 1 1 160 38 Z" fill="#CFE7C0"/>
        <g class="plate-labels" font-family="DM Mono, monospace" font-weight="500">
          <text x="210" y="120" font-size="22" fill="#6E6553" text-anchor="middle">30%</text><text x="210" y="142" font-size="12" fill="#6E6553" text-anchor="middle">rice</text>
          <text x="120" y="200" font-size="30" fill="#1F5A33" text-anchor="middle">70%</text><text x="120" y="222" font-size="12" fill="#1F5A33" text-anchor="middle">vegetables + greens</text>
        </g>
      </svg>
    </div>
    <div class="stack" style="gap:18px">
      ${sectionHead('The plate method', 'Fill the plate before the rice').replace('<h2>', '<h2 id="plate-title">')}
      <p class="lede">At lunch, vegetables and keerai take 70% of the plate. Rice gets the last 30%, or swap it for one cup of mapillai samba red rice. Protein sits on top of that.</p>
      <ul class="protein-list">
        <li><span class="pl-time num">8:30 AM</span><b>2 egg whites</b><span class="muted">with idli or wheat dosa</span></li>
        <li><span class="pl-time num">1:00 PM</span><b>250 g chicken + 2 eggs</b><span class="muted">grilled, curry, tandoori, pepper or salna</span></li>
        <li><span class="pl-time num">8:00 PM</span><b>2 egg whites</b><span class="muted">only if your trainer confirms</span></li>
      </ul>
      <div class="routine">
        <div>${icon('wake')}<span><b class="num">${ROUTINE.wake}</b> wake</span></div>
        <div>${icon('moon')}<span><b class="num">${ROUTINE.sleep}</b> sleep</span></div>
        <div>${icon('drop')}<span><b class="num">${ROUTINE.water}</b> water</span></div>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="feat-title">
    ${sectionHead('Most cooked', 'High-protein favourites', `<div class="row"><button class="icon-btn" type="button" data-scroll-row="-1" aria-label="Scroll left">${icon('left')}</button><button class="icon-btn" type="button" data-scroll-row="1" aria-label="Scroll right">${icon('right')}</button></div>`).replace('<h2>', '<h2 id="feat-title">')}
    <div class="scroll-row" id="feat-row">${featured.map((r) => recipeCard(r)).join('')}</div>
  </section>

  <section class="section" aria-labelledby="pantry-title">
    ${sectionHead('The pantry', `${state.ingredients.length} ingredients in this plan`).replace('<h2>', '<h2 id="pantry-title">')}
    <div class="chips" role="group" aria-label="Filter ingredients">
      <button class="chip" type="button" aria-pressed="true" data-type="all">All <span class="count">${state.ingredients.length}</span></button>
      ${types.map(([k, label]) => `<button class="chip" type="button" aria-pressed="false" data-type="${k}">${esc(label)} <span class="count">${state.ingredients.filter((i) => i.type === k).length}</span></button>`).join('')}
    </div>
    <div class="pantry" id="pantry"></div>
  </section>

  <section class="section contact" id="contact" aria-labelledby="contact-title">
    <div class="stack" style="gap:14px">
      ${sectionHead('Questions', 'Ask about the plan').replace('<h2>', '<h2 id="contact-title">')}
      <p class="lede">Swaps for vegetarian days, portion questions, or a bug on the site. Messages go straight to the admin inbox.</p>
      <blockquote class="trainer-note">“${esc(c.trainerNote)}”<cite>Your trainer’s note on the plan</cite></blockquote>
    </div>
    <form class="panel stack" id="contact-form" novalidate>
      <div class="form-grid">
        ${field({ id: 'name', label: 'Your name', attrs: 'autocomplete="name" required' })}
        ${field({ id: 'email', label: 'Email', type: 'email', attrs: 'autocomplete="email" required' })}
        ${field({ id: 'subject', label: 'Subject', full: true, attrs: 'placeholder="e.g. Vegetarian swap for chicken"' })}
        ${field({ id: 'message', label: 'Message', type: 'textarea', full: true, attrs: 'required minlength="10"' })}
      </div>
      <button class="btn btn-primary" type="submit">${icon('mail')}Send message</button>
    </form>
  </section>`;

  // Pantry
  const pantry = $('#pantry', view);
  const drawPantry = (type) => {
    const list = type === 'all' ? state.ingredients : state.ingredients.filter((i) => i.type === type);
    pantry.innerHTML = list.map((i) => `<button class="ing-tile" type="button" data-ing="${esc(i.id)}"><span class="ing-art">${ingredientSvg(i, { size: 56 })}</span><b>${esc(i.name.split('(')[0].trim())}</b><span class="muted">${esc(i.local)}</span></button>`).join('');
    pantry.classList.remove('stagger'); void pantry.offsetWidth; pantry.classList.add('stagger');
  };
  drawPantry('all');
  view.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    $$('[data-type]', view).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawPantry(b.dataset.type);
  });
  pantry.addEventListener('click', (e) => {
    const t = e.target.closest('[data-ing]');
    if (!t) return;
    const ing = state.ingredientMap[t.dataset.ing];
    const uses = state.recipes.filter((r) => r.ingredients.some((x) => x.id === ing.id));
    const m = modal({
      title: ing.name,
      body: `<div class="ing-detail"><span class="ing-art lg">${ingredientSvg(ing, { size: 96 })}</span><div class="stack" style="gap:6px"><span class="badge">${esc(INGREDIENT_TYPES[ing.type] || ing.type)}</span><p><b>Tamil:</b> ${esc(ing.local)}</p><p>${esc(ing.benefit)}</p></div></div>
        <h3 style="margin:20px 0 10px">Used in ${uses.length} recipe${uses.length === 1 ? '' : 's'}</h3>
        <div class="mini-list">${uses.map((r) => { const q = r.ingredients.find((x) => x.id === ing.id); return `<a class="mini-item" href="${link(`/recipe/${r.id}`)}"><span class="tl-thumb">${dishSvg(r)}</span><span><b>${esc(r.name)}</b><br><span class="muted">${esc(q.qty)}</span></span></a>`; }).join('')}</div>`,
    });
    m.el.addEventListener('click', (ev) => { if (ev.target.closest('a')) m.close(); });
  });

  // Featured row scroll
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-scroll-row]');
    if (!b) return;
    const row = $('#feat-row', view);
    row.scrollBy({ left: Number(b.dataset.scrollRow) * row.clientWidth * 0.8, behavior: 'smooth' });
  });

  // Contact form
  $('#contact-form', view).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button[type="submit"]');
    await busy(btn, async () => {
      try {
        const res = await api.post('contact', formData(form));
        showErrors(form, null);
        form.reset();
        toast(res.message);
        track('contact');
      } catch (err) { showErrors(form, err); }
    });
  });

  const scrollTo = storage.get('scroll-to');
  if (scrollTo) { storage.remove('scroll-to'); setTimeout(() => document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth' }), 200); }
}

