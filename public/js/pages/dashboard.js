import { state, targets, activePlan, setUser } from '../core/state.js';
import { api, apiMode } from '../core/api.js';
import { link, navigate } from '../core/router.js';
import { esc, fmt, today, addDays, $, $$ } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { dishSvg } from '../ui/art.js';
import { ring, barChart, lineChart, heatmap, macroDonut, mountChart, animateCounters } from '../ui/charts.js';
import { toast, modal, field, formData, showErrors, busy, confetti, emptyState } from '../ui/components.js';
import { SLOTS } from '../data/plans.js';
import { planDayFor, logTotals } from '../core/nutrition.js';
import { setSeo } from '../core/seo.js';
import { track } from '../core/analytics.js';

const dayLabel = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }); };
const shortDay = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString('en-IN', { weekday: 'short' }); };

function guestView(view) {
  view.innerHTML = `<div class="guest-hero panel">
    <div class="stack" style="gap:14px;max-width:560px">
      <span class="eyebrow">Daily tracker</span>
      <h1>Tick off each meal. Watch the protein add up.</h1>
      <p class="lede">Log the plan in one tap per meal, add water and weight, and see your week and month in charts. Create a free account to start.</p>
      <div class="row"><a class="btn btn-primary btn-lg" href="${link('/register')}">Create account</a><a class="btn btn-lg" href="${link('/login')}">Log in</a>
      ${apiMode() === 'demo' ? '<button class="btn btn-accent btn-lg" type="button" id="try-sample">Open the sample account</button>' : ''}</div>
    </div>
    <div class="guest-rings" aria-hidden="true">${ring({ value: 1680, max: 2200, label: 'Calories', unit: 'kcal' })}${ring({ value: 118, max: 140, color: 'var(--protein)', label: 'Protein', unit: 'g' })}</div>
  </div>`;
  $('#try-sample', view)?.addEventListener('click', async (e) => {
    const b = e.currentTarget;
    await busy(b, async () => {
      const { DEMO_ACCOUNTS } = await import('../core/demo.js');
      const { user } = await api.post('auth/login', { identifier: DEMO_ACCOUNTS.member.email, password: DEMO_ACCOUNTS.member.password });
      setUser(user);
      toast(`Signed in as ${user.name}`);
      navigate('/dashboard', { replace: true });
    });
  });
}

export default async function render(view, { path }) {
  setSeo({ path, title: 'Dashboard', description: 'Track meals, macros, water and weight against your plan.' });
  if (!state.user) return guestView(view);

  let date = today();
  let logs = [];
  let tab = 'week';
  const t = targets();
  const plan = activePlan();

  view.innerHTML = `<div class="skeleton" style="height:120px;margin-bottom:16px"></div><div class="grid-4">${'<div class="skeleton" style="height:180px"></div>'.repeat(4)}</div>`;

  async function load() {
    const res = await api.get('logs', { from: addDays(today(), -60), to: addDays(today(), 1) });
    logs = res.logs;
  }
  try { await load(); } catch (e) { view.innerHTML = emptyState({ title: 'Could not load your logs', text: e.message }); return; }

  const byDate = (d) => logs.filter((l) => l.date === d);
  const totalsFor = (d) => logTotals(byDate(d));

  function streak() {
    let n = 0;
    let d = totalsFor(today()).protein >= t.protein * 0.9 ? today() : addDays(today(), -1);
    while (totalsFor(d).protein >= t.protein * 0.9) { n++; d = addDays(d, -1); }
    return n;
  }

  function draw() {
    const tot = totalsFor(date);
    const day = planDayFor(plan, date);
    const dayLogs = byDate(date);
    const isToday = date === today();
    const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })();
    const used = new Set();
    const slotHtml = SLOTS.map((s) => {
      const items = day?.slots?.[s.id] || [];
      const rows = items.map((it) => {
        const r = state.recipeMap[it.id];
        if (!r) return '';
        const log = dayLogs.find((l) => l.type === 'meal' && l.recipeId === r.id && l.slot === s.id && !used.has(l.id));
        if (log) used.add(log.id);
        return `<li class="check-row ${log ? 'done' : ''}">
          <button class="tick" type="button" data-tick="${esc(r.id)}" data-slot="${s.id}" data-portion="${it.portion ?? 1}" ${log ? `data-log="${esc(log.id)}"` : ''} aria-pressed="${Boolean(log)}" aria-label="${log ? 'Unmark' : 'Mark'} ${esc(r.name)} as eaten">${icon('check')}</button>
          <a class="cr-thumb" href="${link(`/recipe/${r.id}`)}" tabindex="-1" aria-hidden="true">${dishSvg(r)}</a>
          <div class="cr-text"><a href="${link(`/recipe/${r.id}`)}">${esc(r.name)}</a>${it.optional ? `<span class="badge warn">${esc(it.note || 'Optional')}</span>` : ''}<span class="muted small">${fmt.n(r.nutrition.calories * (it.portion ?? 1))} kcal · ${fmt.n(r.nutrition.protein * (it.portion ?? 1), 1)} g protein</span></div>
        </li>`;
      }).join('');
      return `<div class="slot-block"><div class="slot-time"><b class="num">${s.time}</b><span>${s.label}</span></div><ul class="check-list">${rows || '<li class="muted small">Nothing planned</li>'}</ul></div>`;
    }).join('');
    const extras = dayLogs.filter((l) => l.type === 'meal' && !used.has(l.id));
    const water = tot.water;
    const weights = logs.filter((l) => l.type === 'weight').sort((a, b) => a.date.localeCompare(b.date));
    const latestW = weights.at(-1)?.value ?? state.user.weightKg;
    const startW = weights[0]?.value ?? latestW;
    const goalW = state.user.targetWeightKg;
    const goalPct = goalW && startW && latestW && startW !== goalW ? Math.max(0, Math.min(100, ((startW - latestW) / (startW - goalW)) * 100)) : 0;
    const week = Array.from({ length: 7 }, (_, k) => addDays(today(), k - 6));
    const proteinDays = week.filter((d) => totalsFor(d).protein >= t.protein * 0.9).length;
    const waterDays = week.filter((d) => totalsFor(d).water >= t.water * 0.9).length;
    const st = streak();

    view.innerHTML = `
    <div class="page-head dash-head">
      <div class="stack"><span class="eyebrow">${esc(plan.name)}${day?.chicken ? ` · ${esc(day.chicken)} chicken day` : ''}</span><h1>${isToday ? `${greeting}, ${esc(state.user.name.split(' ')[0])}` : esc(dayLabel(date))}</h1>${isToday ? `<p class="lede">${esc(dayLabel(date))}</p>` : ''}</div>
      <div class="date-nav" role="group" aria-label="Choose day"><button class="icon-btn" type="button" data-day="-1" aria-label="Previous day">${icon('left')}</button><label class="sr-only" for="pick-date">Date</label><input class="input" type="date" id="pick-date" value="${date}" max="${today()}"><button class="icon-btn" type="button" data-day="1" aria-label="Next day" ${isToday ? 'disabled' : ''}>${icon('right')}</button>${isToday ? '' : '<button class="btn btn-sm" type="button" data-day="today">Today</button>'}</div>
    </div>

    <div class="ring-row stagger">
      <div class="ring-card">${ring({ value: Math.round(tot.calories), max: t.calories, label: 'Calories', unit: 'kcal' })}<b>Calories</b><span class="muted small">${fmt.n(Math.max(t.calories - tot.calories, 0))} kcal left</span></div>
      <div class="ring-card">${ring({ value: Math.round(tot.protein), max: t.protein, color: 'var(--protein)', label: 'Protein', unit: 'g' })}<b>Protein</b><span class="muted small">${fmt.n(Math.max(t.protein - tot.protein, 0))} g to go</span></div>
      <div class="ring-card">${ring({ value: Math.round(tot.carbs), max: t.carbs, color: 'var(--carbs)', label: 'Carbs', unit: 'g' })}<b>Carbs</b><span class="muted small">limit ${fmt.n(t.carbs)} g</span></div>
      <div class="ring-card">${ring({ value: Math.round(tot.fat), max: t.fat, color: 'var(--fat)', label: 'Fat', unit: 'g' })}<b>Fat</b><span class="muted small">limit ${fmt.n(t.fat)} g</span></div>
      <div class="ring-card water-card"><div class="water-glass" style="--fill:${Math.min(water / t.water, 1) * 100}%" aria-hidden="true"><i></i></div><b class="num">${fmt.n(water, 2)} / ${fmt.n(t.water, 1)} L</b><span class="muted small">Water</span><div class="row" style="gap:6px;justify-content:center"><button class="btn btn-sm" type="button" data-water="0.25">+250 ml</button><button class="btn btn-sm" type="button" data-water="0.5">+500 ml</button></div></div>
    </div>

    <div class="dash-grid">
      <section class="panel" aria-labelledby="plan-title">
        <div class="panel-head"><h2 id="plan-title">${isToday ? 'Today’s plan' : 'Plan for this day'}</h2><div class="row"><span class="muted small">${dayLogs.filter((l) => l.type === 'meal').length} logged</span><button class="btn btn-sm" type="button" id="add-food">${icon('plus')}Add food</button></div></div>
        <div class="slots">${slotHtml}</div>
        ${extras.length ? `<h3 style="margin:18px 0 8px">Other foods</h3><ul class="check-list">${extras.map((l) => `<li class="check-row done"><span class="tick static">${icon('check')}</span><div class="cr-text"><b>${esc(l.recipeName)}</b><span class="muted small">${fmt.n(l.servings, 2)} × · ${fmt.n(l.calories)} kcal · ${fmt.n(l.protein, 1)} g protein</span></div><button class="icon-btn" type="button" data-del-log="${esc(l.id)}" aria-label="Delete ${esc(l.recipeName)}">${icon('trash')}</button></li>`).join('')}</ul>` : ''}
      </section>

      <div class="stack" style="gap:var(--gap)">
        <section class="panel" aria-labelledby="w-title">
          <div class="panel-head"><h2 id="w-title">Body weight</h2><span class="muted small">${weights.length} entries</span></div>
          <div class="weight-top"><div><span class="big num" data-count="${latestW ?? 0}">${latestW ? fmt.n(latestW, 1) : '–'}</span><span class="muted"> kg</span></div>${latestW && startW ? `<span class="badge ${latestW <= startW ? 'ok' : 'warn'}">${latestW <= startW ? '↓' : '↑'} ${fmt.n(Math.abs(startW - latestW), 1)} kg since ${fmt.date(weights[0]?.date || today(), { day: 'numeric', month: 'short' })}</span>` : ''}</div>
          ${goalW ? `<div class="goal-row"><span class="small muted">Goal ${fmt.n(goalW, 1)} kg</span><div class="progress" style="flex:1"><i style="--to:${goalPct.toFixed(0)}%"></i></div><b class="num small">${goalPct.toFixed(0)}%</b></div>` : `<p class="small muted">Set a target weight in <a href="${link('/profile')}">your profile</a> to track goal progress.</p>`}
          <div id="weight-chart" class="chart-box"></div>
          <form id="weight-form" class="row" style="margin-top:12px" novalidate><div class="field" data-field="value" style="flex:1"><label class="sr-only" for="w-in">Weight in kg</label><input class="input" id="w-in" name="value" type="number" step="0.1" min="25" max="300" placeholder="Today’s weight (kg)"><span class="error" hidden></span></div><button class="btn btn-primary" type="submit">${icon('scale')}Log</button></form>
        </section>
        <section class="panel goals" aria-labelledby="g-title">
          <h2 id="g-title">This week’s goals</h2>
          <ul>
            <li><span>${icon('target')}Protein target on</span><b class="num">${proteinDays}/7 days</b><div class="progress"><i style="--to:${(proteinDays / 7) * 100}%;--bar:var(--protein)"></i></div></li>
            <li><span>${icon('drop')}Water target on</span><b class="num">${waterDays}/7 days</b><div class="progress"><i style="--to:${(waterDays / 7) * 100}%;--bar:#3B9BD6"></i></div></li>
            <li><span>${icon('flame')}Protein streak</span><b class="num">${st} day${st === 1 ? '' : 's'}</b></li>
          </ul>
        </section>
      </div>
    </div>

    <section class="panel" aria-labelledby="trend-title" style="margin-top:var(--gap)">
      <div class="panel-head"><h2 id="trend-title">Progress</h2><div class="seg" role="tablist" aria-label="Range">${[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([k, l]) => `<button role="tab" type="button" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join('')}</div></div>
      <div id="trend"></div>
    </section>`;

    mountChart($('#weight-chart', view), (w) => lineChart({ width: w, height: 170, points: weights.slice(-12).map((x) => ({ value: x.value, label: x.date, short: x.date.slice(8) + '/' + x.date.slice(5, 7) })), unit: 'kg', target: goalW || null }));
    drawTrend();
    animateCounters(view);
  }

  function drawTrend() {
    const el = $('#trend', view);
    if (tab === 'day') {
      const tot = totalsFor(date);
      el.innerHTML = `<div class="trend-day">${macroDonut({ protein: tot.protein, carbs: tot.carbs, fat: tot.fat, label: 'Today by macro' })}<div class="stack small" style="gap:10px"><p><b>${fmt.n(tot.calories)} kcal</b> logged on ${esc(dayLabel(date))}.</p><p class="muted">Protein gives ${tot.calories ? Math.round((tot.protein * 4 / tot.calories) * 100) : 0}% of today’s calories. A high-protein plan usually sits between 25% and 35%.</p><p class="muted">Fibre so far: ${fmt.n(tot.fibre, 1)} g.</p></div></div>`;
      return;
    }
    const n = tab === 'week' ? 7 : 30;
    const series = Array.from({ length: n }, (_, k) => { const d = addDays(today(), k - (n - 1)); const tt = totalsFor(d); return { label: d, short: n === 7 ? shortDay(d) : d.slice(8), value: Math.round(tt.calories), protein: Math.round(tt.protein), d, tt }; });
    const logged = series.filter((s) => s.value > 0);
    const avg = (k) => (logged.length ? logged.reduce((a, s) => a + s.tt[k], 0) / logged.length : 0);
    el.innerHTML = `<div class="trend-stats">
        <div class="stat"><span class="label">Days logged</span><span class="value num">${logged.length}<small>/ ${n}</small></span></div>
        <div class="stat"><span class="label">Avg calories</span><span class="value num">${fmt.n(avg('calories'))}<small>kcal</small></span></div>
        <div class="stat"><span class="label">Avg protein</span><span class="value num">${fmt.n(avg('protein'))}<small>g</small></span></div>
        <div class="stat"><span class="label">Avg carbs / fat</span><span class="value num">${fmt.n(avg('carbs'))}<small>g</small> ${fmt.n(avg('fat'))}<small>g</small></span></div>
      </div>
      <div class="legend-row"><span><i style="background:var(--leaf)"></i>Calories (bars)</span><span><i style="background:var(--protein)"></i>Protein, g (line)</span><span><i class="dash"></i>Calorie target</span></div>
      <div id="trend-chart" class="chart-box"></div>
      ${tab === 'month' ? `<h3 style="margin:20px 0 10px">Protein target, last 30 days</h3>${heatmap({ days: series.map((s) => ({ date: s.d, value: s.value ? Math.min(s.tt.protein / t.protein, 1) : null })) })}` : ''}`;
    mountChart($('#trend-chart', view), (w) => barChart({ width: w, data: series, target: t.calories, unit: 'kcal', line: 'protein', lineUnit: 'g' }));
  }

  draw();

  // ---------- events ----------
  async function addLog(body) {
    const { log } = await api.post('logs', body);
    logs.push(log);
    return log;
  }
  view.addEventListener('click', async (e) => {
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) { date = dayBtn.dataset.day === 'today' ? today() : addDays(date, Number(dayBtn.dataset.day)); if (date > today()) date = today(); draw(); return; }
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; $$('[data-tab]', view).forEach((b) => b.setAttribute('aria-selected', String(b === tabBtn))); drawTrend(); return; }
    const tick = e.target.closest('[data-tick]');
    if (tick) {
      tick.disabled = true;
      try {
        if (tick.dataset.log) {
          await api.del(`logs/${tick.dataset.log}`);
          logs = logs.filter((l) => l.id !== tick.dataset.log);
        } else {
          const before = totalsFor(date).protein;
          await addLog({ type: 'meal', date, slot: tick.dataset.slot, recipeId: tick.dataset.tick, servings: Number(tick.dataset.portion) || 1 });
          track('meal_log', { recipeId: tick.dataset.tick });
          if (before < t.protein && totalsFor(date).protein >= t.protein) { confetti(); toast('Protein target reached for the day!', 'target'); }
        }
        draw();
      } catch (err) { toast(err.message, 'alert', 'error'); tick.disabled = false; }
      return;
    }
    const water = e.target.closest('[data-water]');
    if (water) {
      try {
        const before = totalsFor(date).water;
        await addLog({ type: 'water', date, value: Number(water.dataset.water) });
        if (before < t.water && totalsFor(date).water >= t.water) { confetti(40); toast('Water target reached!', 'drop'); } else toast(`Added ${Number(water.dataset.water) * 1000} ml water`, 'drop');
        draw();
      } catch (err) { toast(err.message, 'alert', 'error'); }
      return;
    }
    const del = e.target.closest('[data-del-log]');
    if (del) {
      try { await api.del(`logs/${del.dataset.delLog}`); logs = logs.filter((l) => l.id !== del.dataset.delLog); draw(); toast('Entry removed'); } catch (err) { toast(err.message, 'alert', 'error'); }
      return;
    }
    if (e.target.closest('#add-food')) openAddFood();
  });
  view.addEventListener('change', (e) => { if (e.target.id === 'pick-date' && e.target.value) { date = e.target.value > today() ? today() : e.target.value; draw(); } });
  view.addEventListener('submit', async (e) => {
    if (e.target.id !== 'weight-form') return;
    e.preventDefault();
    const form = e.target;
    await busy(form.querySelector('button'), async () => {
      try {
        await addLog({ type: 'weight', date, value: Number(formData(form).value) });
        toast('Weight logged', 'scale');
        draw();
      } catch (err) { showErrors(form, err); }
    });
  });

  function openAddFood() {
    const m = modal({
      title: 'Add food',
      wide: true,
      body: `<div class="seg" role="tablist" style="margin-bottom:14px"><button role="tab" type="button" aria-selected="true" data-mode="recipe">From recipes</button><button role="tab" type="button" aria-selected="false" data-mode="custom">Custom food</button></div>
      <div data-pane="recipe"><label class="sr-only" for="af-q">Search recipes</label><input class="input" id="af-q" type="search" placeholder="Search recipes…"><div class="mini-list" id="af-list" style="margin-top:12px;max-height:50vh;overflow:auto"></div></div>
      <form data-pane="custom" hidden class="stack" novalidate>
        <div class="form-grid">
          ${field({ id: 'recipeName', label: 'Food name', full: true, attrs: 'required' })}
          ${field({ id: 'slot', label: 'Meal time', type: 'select', value: 'evening', options: SLOTS.map((s) => [s.id, `${s.time} · ${s.label}`]) })}
          ${field({ id: 'calories', label: 'Calories (kcal)', type: 'number', attrs: 'min="0" required' })}
          ${field({ id: 'protein', label: 'Protein (g)', type: 'number', attrs: 'min="0" step="0.1"' })}
          ${field({ id: 'carbs', label: 'Carbs (g)', type: 'number', attrs: 'min="0" step="0.1"' })}
          ${field({ id: 'fat', label: 'Fat (g)', type: 'number', attrs: 'min="0" step="0.1"' })}
        </div>
        <button class="btn btn-primary" type="submit">Add to ${esc(dayLabel(date))}</button>
      </form>`,
    });
    const list = $('#af-list', m.el);
    const drawList = (q = '') => {
      const words = q.toLowerCase().split(/\s+/).filter(Boolean);
      const found = state.recipes.filter((r) => words.every((w) => `${r.name} ${r.tags.join(' ')}`.toLowerCase().includes(w))).slice(0, 30);
      list.innerHTML = found.map((r) => `<button class="mini-item" type="button" data-add="${esc(r.id)}"><span class="tl-thumb">${dishSvg(r)}</span><span style="text-align:left"><b>${esc(r.name)}</b><br><span class="muted small">${r.nutrition.calories} kcal · ${r.nutrition.protein} g protein · ${esc(r.serving)}</span></span>${icon('plus')}</button>`).join('') || '<p class="muted">No recipes match.</p>';
    };
    drawList();
    $('#af-q', m.el).addEventListener('input', (e) => drawList(e.target.value));
    m.el.addEventListener('click', async (e) => {
      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) { $$('[data-mode]', m.el).forEach((b) => b.setAttribute('aria-selected', String(b === modeBtn))); $$('[data-pane]', m.el).forEach((p) => { p.hidden = p.dataset.pane !== modeBtn.dataset.mode; }); return; }
      const add = e.target.closest('[data-add]');
      if (add) {
        const r = state.recipeMap[add.dataset.add];
        try { await addLog({ type: 'meal', date, slot: r.slot === 'all-day' ? 'evening' : r.slot, recipeId: r.id, servings: 1 }); toast(`Logged ${r.name}`); m.close(); draw(); } catch (err) { toast(err.message, 'alert', 'error'); }
      }
    });
    m.el.querySelector('form[data-pane="custom"]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const d = formData(form);
      await busy(form.querySelector('button[type="submit"]'), async () => {
        try { await addLog({ type: 'meal', date, slot: d.slot, recipeName: d.recipeName, calories: d.calories, protein: d.protein || 0, carbs: d.carbs || 0, fat: d.fat || 0, servings: 1 }); m.close(); toast(`Logged ${d.recipeName}`); draw(); } catch (err) { showErrors(form, err); }
      });
    });
  }
  return undefined;
}

