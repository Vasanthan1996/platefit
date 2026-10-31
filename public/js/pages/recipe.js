import { state, isFav, activePlan } from '../core/state.js';
import { link, navigate } from '../core/router.js';
import { esc, fmt, scaleQty, today, $, $$, prefersReducedMotion } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { recipeMedia, ingredientSvg } from '../ui/art.js';
import { macroDonut } from '../ui/charts.js';
import { recipeCard, toast, modal, field, formData, showErrors, busy, confetti } from '../ui/components.js';
import { CATEGORY_MAP, NUTRITION_NOTE } from '../data/recipes/index.js';
import { SLOTS, SLOT_MAP } from '../data/plans.js';
import { api } from '../core/api.js';
import { setSeo, recipeJsonLd } from '../core/seo.js';
import { track } from '../core/analytics.js';

const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

export default async function render(view, { params, path }) {
  const r = state.recipeMap[params.id];
  if (!r) {
    const mod = await import('./notfound.js');
    return mod.default(view, { path, message: 'That recipe is not in the plan.' });
  }
  const cat = CATEGORY_MAP[r.category];
  const slot = SLOT_MAP[r.slot];
  const n = r.nutrition;
  const origin = (state.config.siteUrl || location.origin).replace(/\/$/, '');
  setSeo({ path, title: r.name, description: `${r.summary} ${n.calories} kcal, ${n.protein} g protein per serving. Ingredients, steps, storage and tips.`, type: 'article', jsonld: recipeJsonLd(r, `${origin}/recipe/${r.id}`) });
  track('recipe_view', { recipeId: r.id });

  const plan = activePlan();
  const days = (plan.days || []).filter((d) => Object.values(d.slots || {}).some((items) => items.some((it) => it.id === r.id || (it.alternatives || []).includes(r.id)))).map((d) => d.label);
  const related = state.recipes.filter((x) => x.category === r.category && x.id !== r.id).slice(0, 3);
  let servings = 1;

  const ingRows = () => r.ingredients.map((ing, i) => {
    const meta = ing.id ? state.ingredientMap[ing.id] : null;
    return `<li class="ing-row"><label class="check"><input type="checkbox" data-ing-check="${i}"><span class="ing-icon">${meta ? ingredientSvg(meta, { size: 40 }) : ''}</span>
      <span class="ing-text"><b>${esc(ing.name)}</b>${meta?.local && meta.local !== ing.name ? ` <span class="muted">(${esc(meta.local)})</span>` : ''}${ing.note ? `<span class="ing-note">${esc(ing.note)}</span>` : ''}</span></label>
      <span class="ing-qty num">${esc(scaleQty(ing.qty, servings))}</span></li>`;
  }).join('');

  const nutriRows = () => {
    const k = servings;
    const row = (label, v, unit, cls) => `<tr><th scope="row"><span class="dot-key ${cls}"></span>${label}</th><td class="num">${v === null ? 'Not Specified' : `${fmt.n(v * k, unit === 'kcal' ? 0 : 1)} ${unit}`}</td></tr>`;
    return row('Calories', n.calories, 'kcal', 'kcal') + row('Protein', n.protein, 'g', 'protein') + row('Carbohydrates', n.carbs, 'g', 'carbs') + row('Fat', n.fat, 'g', 'fat') + row('Fibre', n.fibre, 'g', '');
  };

  view.innerHTML = `
  <nav class="crumbs" aria-label="Breadcrumb"><a href="${link('/')}">Home</a>${icon('right')}<a href="${link(cat?.path || '/recipes')}">${esc(cat?.label || 'Recipes')}</a>${icon('right')}<span aria-current="page">${esc(r.name)}</span></nav>
  <article class="recipe" itemscope itemtype="https://schema.org/Recipe">
    <header class="recipe-hero">
      <div class="recipe-media" style="--art:${esc(r.art.colors[0])}"><div class="floaty">${recipeMedia(r, { eager: true })}</div></div>
      <div class="recipe-intro stack">
        <div class="row"><span class="badge info">${esc(r.mealType)}</span>${slot ? `<span class="badge">${icon('clock')} ${esc(slot.window)}</span>` : ''}<span class="badge">${esc(r.difficulty)}</span></div>
        <h1 itemprop="name">${esc(r.name)}</h1>
        ${r.local ? `<p class="local">${esc(r.local)}</p>` : ''}
        <p class="lede" itemprop="description">${esc(r.summary)}</p>
        ${r.planNote ? `<p class="plan-note">${icon('calendar')}<span>${esc(r.planNote)}</span></p>` : ''}
        <div class="macro-tiles">
          <div class="mt kcal"><span>Calories</span><b class="num" data-count="${n.calories ?? 0}">${n.calories ?? '–'}</b><em>kcal</em></div>
          <div class="mt protein"><span>Protein</span><b class="num">${n.protein ?? '–'}</b><em>g</em></div>
          <div class="mt carbs"><span>Carbs</span><b class="num">${n.carbs ?? '–'}</b><em>g</em></div>
          <div class="mt fat"><span>Fat</span><b class="num">${n.fat ?? '–'}</b><em>g</em></div>
        </div>
        <dl class="facts">
          <div><dt>Serving</dt><dd itemprop="recipeYield">${esc(r.serving)}</dd></div>
          <div><dt>Meal category</dt><dd itemprop="recipeCategory">${esc(r.mealType)}</dd></div>
          <div><dt>Prep</dt><dd>${fmt.mins(r.prep)}</dd></div>
          <div><dt>Cook</dt><dd>${fmt.mins(r.cook)}</dd></div>
          ${r.wait ? `<div class="wide"><dt>Plan ahead</dt><dd>${esc(r.wait)}</dd></div>` : ''}
        </dl>
        <p class="approx">${icon('info')}<span>Approximate values per serving. <button class="link-btn" type="button" id="about-nutrition">How these are estimated</button></span></p>
        <div class="row actions">
          <button class="btn btn-accent btn-lg pulse" type="button" id="cook-btn">${icon('play')}Start cook mode</button>
          <button class="btn btn-lg" type="button" data-fav="${esc(r.id)}" aria-pressed="${isFav(r.id)}">${icon('heart')}<span>${isFav(r.id) ? 'Saved' : 'Save'}</span></button>
          <button class="btn btn-lg" type="button" id="log-btn">${icon('log')}Log this meal</button>
          <button class="icon-btn" type="button" id="share-btn" aria-label="Copy link to this recipe">${icon('copy')}</button>
        </div>
      </div>
    </header>

    <div class="recipe-body">
      <div class="stack" style="gap:20px;min-width:0">
        <section class="panel" aria-labelledby="ing-title">
          <div class="panel-head"><h2 id="ing-title">Ingredients</h2>
            <div class="stepper" role="group" aria-label="Servings"><button class="icon-btn" type="button" id="srv-minus" aria-label="Fewer servings">${icon('minus')}</button><span class="num" id="srv-val" aria-live="polite">1 serving</span><button class="icon-btn" type="button" id="srv-plus" aria-label="More servings">${icon('plus')}</button></div>
          </div>
          <p class="muted small">Serving: ${esc(r.serving)}. ${r.yield > 1 ? `This recipe makes ${r.yield} servings as written; quantities marked “for the batch” cover all of them.` : ''} Tick items as you gather them.</p>
          <ul class="ing-list" id="ing-list">${ingRows()}</ul>
          <div class="ing-gallery" aria-label="Ingredient pictures">${[...new Map(r.ingredients.filter((i) => i.id).map((i) => [i.id, state.ingredientMap[i.id]])).values()].filter(Boolean).map((m) => `<figure><span>${ingredientSvg(m, { size: 64 })}</span><figcaption>${esc(m.name.split('(')[0].trim())}</figcaption></figure>`).join('')}</div>
        </section>

        <section class="panel" aria-labelledby="steps-title">
          <div class="panel-head"><h2 id="steps-title">Step by step</h2><span class="muted">${r.steps.length} steps</span></div>
          <ol class="steps">${r.steps.map((s) => `<li class="step" data-reveal><span class="step-n num">${s.n}</span><div class="stack" style="gap:6px"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>${s.minutes ? `<button class="btn btn-sm step-timer" type="button" data-timer="${s.minutes}">${icon('timer')}<span>${s.minutes > 120 ? `Wait ${fmtMin(s.minutes)}` : `Start ${fmtMin(s.minutes)} timer`}</span></button>` : ''}</div></li>`).join('')}</ol>
        </section>

        <div class="grid-2">
          <section class="panel tips" aria-labelledby="tips-title"><h2 id="tips-title">${icon('sparkle')}Cooking tips</h2><ul>${r.tips.map((t) => `<li>${esc(t)}</li>`).join('') || '<li>Not Specified</li>'}</ul></section>
          <section class="panel mistakes" aria-labelledby="mist-title"><h2 id="mist-title">${icon('alert')}Mistakes to avoid</h2><ul>${r.mistakes.map((t) => `<li>${esc(t)}</li>`).join('') || '<li>Not Specified</li>'}</ul></section>
        </div>
        <section class="panel" aria-labelledby="store-title"><h2 id="store-title" class="with-ic">${icon('book')}Storage</h2><p>${esc(r.storage)}</p></section>

        <section class="panel" aria-labelledby="fb-title">
          <h2 id="fb-title">Rate this recipe</h2>
          <form id="fb-form" class="stack" novalidate>
            <fieldset class="stars" data-field="rating"><legend class="sr-only">Rating</legend>${[5, 4, 3, 2, 1].map((v) => `<input type="radio" id="star-${v}" name="rating" value="${v}"><label for="star-${v}" title="${v} star${v > 1 ? 's' : ''}">${icon('star')}<span class="sr-only">${v} star${v > 1 ? 's' : ''}</span></label>`).join('')}<span class="error" hidden></span></fieldset>
            ${field({ id: 'message', label: 'Comment (optional)', type: 'textarea', attrs: 'rows="3" placeholder="What worked? What would you change?"' })}
            ${state.user ? '' : `<div class="form-grid">${field({ id: 'name', label: 'Name (optional)' })}${field({ id: 'email', label: 'Email (optional)', type: 'email' })}</div>`}
            <button class="btn btn-primary" type="submit" style="align-self:flex-start">Send feedback</button>
          </form>
        </section>
      </div>

      <aside class="recipe-aside stack" style="gap:20px">
        <section class="panel" aria-labelledby="nut-title">
          <div class="panel-head"><h2 id="nut-title">Nutrition</h2><span class="badge warn">Approx.</span></div>
          ${macroDonut({ protein: n.protein || 0, carbs: n.carbs || 0, fat: n.fat || 0 })}
          <table class="nutri"><caption class="sr-only">Nutrition per serving</caption><tbody id="nutri-body">${nutriRows()}</tbody></table>
          <p class="muted small" id="nutri-for">For 1 serving (${esc(r.serving)})</p>
        </section>
        ${days.length ? `<section class="panel"><h2 class="with-ic">${icon('calendar')}In your plan</h2><div class="chips" style="margin-top:12px">${days.map((d) => `<a class="chip" href="${link(`/meal-plans/${plan.id}`)}">${esc(d)}</a>`).join('')}</div></section>` : ''}
        <section class="panel benefits"><h2 class="with-ic">${icon('dumbbell')}Why it helps</h2><ul>${r.benefits.map((b) => `<li>${icon('check')}<span>${esc(b)}</span></li>`).join('')}</ul></section>
      </aside>
    </div>

    ${related.length ? `<section class="section"><div class="section-head"><h2>More ${esc((cat?.label || '').toLowerCase())}</h2><a class="btn btn-ghost" href="${link(cat?.path || '/recipes')}">See all ${icon('arrow')}</a></div><div class="grid-cards">${related.map((x) => recipeCard(x, { showCategory: false })).join('')}</div></section>` : ''}
  </article>`;

  // Servings stepper
  const setServings = (v) => {
    servings = Math.min(10, Math.max(0.5, v));
    $('#srv-val', view).textContent = `${fmt.n(servings, 1)} serving${servings === 1 ? '' : 's'}`;
    $('#ing-list', view).innerHTML = ingRows();
    $('#nutri-body', view).innerHTML = nutriRows();
    $('#nutri-for', view).textContent = servings === 1 ? `For 1 serving (${r.serving})` : `For ${fmt.n(servings, 1)} servings`;
  };
  $('#srv-minus', view).addEventListener('click', () => setServings(servings <= 1 ? servings - 0.5 : servings - 1));
  $('#srv-plus', view).addEventListener('click', () => setServings(servings < 1 ? servings + 0.5 : servings + 1));

  // Inline step timers
  const timers = new Map();
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-timer]');
    if (!b) return;
    const mins = Number(b.dataset.timer);
    if (mins > 120) { toast(`Set a reminder: this step takes about ${fmtMin(mins)}.`, 'clock'); return; }
    if (timers.has(b)) { clearInterval(timers.get(b)); timers.delete(b); b.querySelector('span').textContent = `Start ${fmtMin(mins)} timer`; b.classList.remove('running'); return; }
    let left = mins * 60;
    b.classList.add('running');
    const tick = () => {
      b.querySelector('span').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left · tap to stop`;
      if (left-- <= 0) { clearInterval(timers.get(b)); timers.delete(b); b.classList.remove('running'); b.querySelector('span').textContent = 'Done!'; beep(); toast('Timer finished', 'timer'); }
    };
    tick();
    timers.set(b, setInterval(tick, 1000));
  });

  // Save button label follows favourite state
  const saveBtn = view.querySelector('.actions [data-fav]');
  const syncSave = () => { const on = isFav(r.id); saveBtn.setAttribute('aria-pressed', String(on)); saveBtn.querySelector('span').textContent = on ? 'Saved' : 'Save'; };
  saveBtn.addEventListener('click', () => setTimeout(syncSave, 50));

  $('#share-btn', view).addEventListener('click', async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast(url, 'copy'); }
  });
  $('#about-nutrition', view).addEventListener('click', () => modal({ title: 'About these numbers', body: `<p>${esc(NUTRITION_NOTE)}</p><p class="muted" style="margin-top:12px">Your trainer’s document does not list calories or recipe quantities, so every quantity here is a standard home-cooking amount chosen to fit the plan’s portions. Adjust them with your trainer.</p>` }));
  $('#log-btn', view).addEventListener('click', () => openLogModal(r));
  $('#cook-btn', view).addEventListener('click', () => cookMode(r));

  // Feedback
  $('#fb-form', view).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const res = await api.post('feedback', { ...formData(form), recipeId: r.id });
        showErrors(form, null);
        form.reset();
        toast(res.message, 'star');
        track('feedback', { recipeId: r.id });
      } catch (err) { showErrors(form, err); }
    });
  });

  return () => { for (const t of timers.values()) clearInterval(t); };
}

let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.25);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t);
      o.stop(audioCtx.currentTime + t + 0.3);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch { /* sound unavailable */ }
}

export function openLogModal(r, { date = today(), slot = r.slot, onDone = null } = {}) {
  if (!state.user) {
    toast('Log in to track meals.', 'user');
    navigate('/login');
    return;
  }
  const m = modal({
    title: `Log ${r.name}`,
    body: `<form id="log-form" class="stack" novalidate>
      <div class="form-grid">
        ${field({ id: 'date', label: 'Date', type: 'date', value: date })}
        ${field({ id: 'slot', label: 'Meal time', type: 'select', value: SLOT_MAP[slot] ? slot : 'lunch', options: SLOTS.map((s) => [s.id, `${s.time} · ${s.label}`]) })}
        ${field({ id: 'servings', label: 'Servings', type: 'number', value: 1, attrs: 'min="0.25" max="10" step="0.25"', hint: r.serving })}
      </div>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit">${icon('check')}Add to my log</button></div>
    </form>`,
  });
  m.el.querySelector('#log-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    await busy(form.querySelector('button[type="submit"]'), async () => {
      try {
        const d = formData(form);
        await api.post('logs', { type: 'meal', recipeId: r.id, date: d.date, slot: d.slot, servings: Number(d.servings) });
        m.close();
        toast(`Logged ${r.name}`);
        track('meal_log', { recipeId: r.id });
        if (onDone) onDone();
      } catch (err) { showErrors(form, err); }
    });
  });
}

// ---------- Cook mode: interactive walkthrough ----------
function cookMode(r) {
  track('cook_mode_start', { recipeId: r.id });
  let i = 0;
  let timer = null;
  let left = 0;
  let lock = null;
  const root = document.createElement('div');
  root.className = 'cook-root';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `Cook mode: ${r.name}`);
  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';
  if ('wakeLock' in navigator) navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {});

  const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };
  const draw = () => {
    const s = r.steps[i];
    const last = i === r.steps.length - 1;
    const pct = ((i + 1) / r.steps.length) * 100;
    root.innerHTML = `
      <div class="cook-top"><button class="icon-btn" type="button" data-act="close" aria-label="Exit cook mode">${icon('x')}</button><div class="cook-title"><b>${esc(r.name)}</b><span class="muted">Step ${i + 1} of ${r.steps.length}</span></div><button class="btn btn-sm" type="button" data-act="ings">${icon('list')}Ingredients</button></div>
      <div class="cook-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${r.steps.length}" aria-valuenow="${i + 1}"><i style="width:${pct}%"></i></div>
      <div class="cook-dots">${r.steps.map((_, k) => `<button type="button" class="${k === i ? 'on' : k < i ? 'done' : ''}" data-go="${k}" aria-label="Go to step ${k + 1}"></button>`).join('')}</div>
      <div class="cook-stage" aria-live="polite">
        <span class="cook-n num">${String(s.n).padStart(2, '0')}</span>
        <h2>${esc(s.title)}</h2>
        <p>${esc(s.text)}</p>
        ${s.minutes ? (s.minutes > 120 ? `<p class="cook-wait">${icon('clock')}This step takes about ${fmtMin(s.minutes)}. Come back when it is ready.</p>` : `<div class="cook-timer"><span class="num" id="cook-clock">${String(s.minutes).padStart(2, '0')}:00</span><button class="btn btn-accent" type="button" data-act="timer">${icon('play')}Start timer</button><button class="btn" type="button" data-act="reset">${icon('reset')}Reset</button></div>`) : ''}
      </div>
      <div class="cook-nav"><button class="btn btn-lg" type="button" data-act="prev" ${i === 0 ? 'disabled' : ''}>${icon('left')}Back</button><button class="btn btn-primary btn-lg" type="button" data-act="${last ? 'finish' : 'next'}">${last ? `${icon('check')}Finish` : `Next${icon('right')}`}</button></div>
      <div class="cook-ings" hidden><h3>Ingredients</h3><ul>${r.ingredients.map((g) => `<li><span>${esc(g.name)}</span><b class="num">${esc(g.qty)}</b></li>`).join('')}</ul></div>`;
    left = (s.minutes || 0) * 60;
    root.querySelector('[data-act="next"], [data-act="finish"]')?.focus();
  };
  const close = () => { stopTimer(); lock?.release?.().catch(() => {}); root.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  const go = (k) => { stopTimer(); i = Math.max(0, Math.min(r.steps.length - 1, k)); draw(); };
  const toggleTimer = () => {
    const btn = root.querySelector('[data-act="timer"]');
    if (!btn) return;
    if (timer) { stopTimer(); btn.innerHTML = `${icon('play')}Resume`; return; }
    btn.innerHTML = `${icon('pause')}Pause`;
    timer = setInterval(() => {
      left -= 1;
      const clock = root.querySelector('#cook-clock');
      if (clock) clock.textContent = `${String(Math.floor(Math.max(left, 0) / 60)).padStart(2, '0')}:${String(Math.max(left, 0) % 60).padStart(2, '0')}`;
      if (left <= 0) { stopTimer(); beep(); toast(`${r.steps[i].title}: time is up`, 'timer'); btn.innerHTML = `${icon('check')}Done`; }
    }, 1000);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); toggleTimer(); }
  };
  document.addEventListener('keydown', onKey);
  let touchX = null;
  root.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1)); touchX = null; });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act], [data-go]');
    if (!b) return;
    if (b.dataset.go !== undefined) return go(Number(b.dataset.go));
    const act = b.dataset.act;
    if (act === 'close') close();
    if (act === 'prev') go(i - 1);
    if (act === 'next') go(i + 1);
    if (act === 'timer') toggleTimer();
    if (act === 'reset') { stopTimer(); draw(); }
    if (act === 'ings') { const p = root.querySelector('.cook-ings'); p.hidden = !p.hidden; }
    if (act === 'finish') {
      stopTimer();
      track('cook_mode_finish', { recipeId: r.id });
      if (!prefersReducedMotion()) confetti();
      root.querySelector('.cook-stage').innerHTML = `<span class="cook-n num">✓</span><h2>Ready to eat</h2><p>${esc(r.name)} is done. Log it so it counts toward today’s protein.</p><div class="row" style="justify-content:center"><button class="btn btn-primary btn-lg" type="button" data-act="log">${icon('log')}Log this meal</button><button class="btn btn-lg" type="button" data-act="close">Close</button></div>`;
      root.querySelector('.cook-nav').hidden = true;
    }
    if (act === 'log') { close(); openLogModal(r); }
  });
  draw();
}
