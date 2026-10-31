import { state, savedPlans, saveSavedPlans, activePlan } from '../core/state.js';
import { link, navigate } from '../core/router.js';
import { esc, fmt, today, weekdayKey, $, $$ } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { dishSvg, ingredientSvg } from '../ui/art.js';
import { barChart, mountChart } from '../ui/charts.js';
import { toast, modal, macroPills } from '../ui/components.js';
import { SLOTS } from '../data/plans.js';
import { INGREDIENT_TYPES } from '../data/ingredients.js';
import { dayTotals, planAverages, shoppingList } from '../core/nutrition.js';
import { followPlan } from './plans.js';
import { setSeo } from '../core/seo.js';
import { track } from '../core/analytics.js';

export default async function render(view, { params, path }) {
  const saved = savedPlans().find((s) => s.id === params.id);
  let plan = saved?.custom ? { ...saved.custom, id: saved.id, name: saved.name } : state.planMap[params.id] || state.planMap[saved?.basePlanId];
  if (!plan) { const m = await import('./notfound.js'); return m.default(view, { path, message: 'That meal plan does not exist.' }); }
  plan = JSON.parse(JSON.stringify(plan));
  setSeo({ path, title: plan.name, description: plan.summary });
  track('plan_view', { planId: plan.id });

  const todayKey = weekdayKey(today());
  let dayIdx = Math.max(0, plan.days.findIndex((d) => d.key === todayKey));
  let dirty = false;

  const draw = () => {
    const avg = planAverages(plan, state.recipeMap);
    const day = plan.days[dayIdx];
    const tot = dayTotals(day, state.recipeMap);
    const isActive = activePlan().id === plan.id;
    view.innerHTML = `
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${link('/meal-plans')}">Meal plans</a>${icon('right')}<span aria-current="page">${esc(plan.name)}</span></nav>
    <div class="page-head">
      <div class="stack"><span class="eyebrow">${esc(plan.goal || 'Meal plan')} · ${esc(plan.duration || `${plan.days.length} days`)}</span><h1>${esc(plan.name)}</h1><p class="lede">${esc(plan.summary || '')}</p></div>
      <div class="row">${isActive ? '<span class="badge ok">You follow this plan</span>' : `<button class="btn btn-primary" type="button" id="follow">${icon('check')}Follow this plan</button>`}<button class="btn" type="button" id="shop">${icon('cart')}Shopping list</button>${dirty ? `<button class="btn btn-accent" type="button" id="save-copy">${icon('download')}Save my version</button>` : ''}</div>
    </div>
    <div class="grid-4 stagger">
      <div class="stat"><span class="label">Average calories</span><span class="value num" data-count="${Math.round(avg.calories)}">${fmt.n(avg.calories)}</span><span class="delta muted">kcal per day</span></div>
      <div class="stat"><span class="label">Average protein</span><span class="value num" data-count="${Math.round(avg.protein)}">${fmt.n(avg.protein)}</span><span class="delta muted">g per day</span></div>
      <div class="stat"><span class="label">Average carbs</span><span class="value num">${fmt.n(avg.carbs)}</span><span class="delta muted">g per day</span></div>
      <div class="stat"><span class="label">Average fat</span><span class="value num">${fmt.n(avg.fat)}</span><span class="delta muted">g per day</span></div>
    </div>
    ${plan.days.length > 1 ? `<section class="panel" style="margin-top:var(--gap)"><div class="panel-head"><h2>Calories and protein by day</h2><div class="legend-row" style="margin:0"><span><i style="background:var(--leaf)"></i>Calories</span><span><i style="background:var(--protein)"></i>Protein (g)</span></div></div><div id="week-chart" class="chart-box"></div></section>` : ''}
    <section class="section">
      <div class="day-tabs" role="tablist" aria-label="Days">${plan.days.map((d, i) => `<button role="tab" type="button" aria-selected="${i === dayIdx}" data-dayidx="${i}"><b>${esc(d.label.slice(0, 3))}</b>${d.chicken ? `<span>${esc(d.chicken)}</span>` : ''}${d.key === todayKey ? '<em>Today</em>' : ''}</button>`).join('')}</div>
      <div class="day-panel panel" role="tabpanel">
        <div class="panel-head"><h2>${esc(day.label)}</h2>${macroPills(tot)}</div>
        <ol class="plan-timeline">${SLOTS.map((s) => {
          const items = day.slots?.[s.id] || [];
          if (!items.length) return '';
          return `<li><div class="pt-time"><b class="num">${s.time}</b><span>${s.label}</span></div><div class="pt-items">${items.map((it, k) => {
            const r = state.recipeMap[it.id];
            if (!r) return '';
            const alts = (it.alternatives || []).map((a) => state.recipeMap[a]).filter(Boolean);
            return `<div class="pt-item"><a class="pt-art" href="${link(`/recipe/${r.id}`)}" aria-hidden="true" tabindex="-1">${dishSvg(r)}</a><div class="pt-text"><a href="${link(`/recipe/${r.id}`)}"><b>${esc(r.name)}</b></a>${it.portion && it.portion !== 1 ? `<span class="badge">× ${it.portion}</span>` : ''}${it.optional ? `<span class="badge warn">${esc(it.note || 'Optional')}</span>` : it.note ? `<span class="muted small">${esc(it.note)}</span>` : ''}
              <span class="muted small">${fmt.n(r.nutrition.calories * (it.portion ?? 1))} kcal · ${fmt.n(r.nutrition.protein * (it.portion ?? 1), 1)} g protein</span>
              ${alts.length ? `<span class="small">or ${alts.map((a) => `<a href="${link(`/recipe/${a.id}`)}">${esc(a.name)}</a>`).join(', ')}</span>` : ''}</div>
              <button class="btn btn-sm btn-ghost" type="button" data-swap="${s.id}:${k}" aria-label="Swap ${esc(r.name)}">${icon('swap')}Swap</button></div>`;
          }).join('')}</div></li>`;
        }).join('')}</ol>
      </div>
    </section>`;
    const wc = $('#week-chart', view);
    if (wc) mountChart(wc, (w) => barChart({ width: w, data: plan.days.map((d) => { const t = dayTotals(d, state.recipeMap); return { label: d.label, short: d.label.slice(0, 3), value: Math.round(t.calories), protein: Math.round(t.protein) }; }), unit: 'kcal', line: 'protein', lineUnit: 'g', height: 200 }));
  };
  draw();

  view.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-dayidx]');
    if (tab) { dayIdx = Number(tab.dataset.dayidx); draw(); view.querySelector(`[data-dayidx="${dayIdx}"]`)?.focus(); return; }
    if (e.target.closest('#follow')) {
      try { await followPlan(plan.id); toast('Your dashboard now follows this plan.', 'calendar'); draw(); } catch (err) { toast(err.message, 'alert', 'error'); }
      return;
    }
    if (e.target.closest('#shop')) return openShopping();
    if (e.target.closest('#save-copy')) return saveCopy();
    const sw = e.target.closest('[data-swap]');
    if (sw) {
      const [slotId, k] = sw.dataset.swap.split(':');
      const item = plan.days[dayIdx].slots[slotId][Number(k)];
      const cur = state.recipeMap[item.id];
      const options = state.recipes.filter((r) => r.category === cur.category && r.id !== cur.id);
      const m = modal({
        title: `Swap ${cur.name}`,
        body: `<p class="muted" style="margin-bottom:12px">Choose another ${esc(cur.category)} recipe for ${esc(plan.days[dayIdx].label)}.</p><div class="mini-list">${options.map((r) => `<button class="mini-item" type="button" data-pick="${esc(r.id)}"><span class="tl-thumb">${dishSvg(r)}</span><span style="text-align:left"><b>${esc(r.name)}</b><br><span class="muted small">${r.nutrition.calories} kcal · ${r.nutrition.protein} g protein</span></span></button>`).join('')}</div>`,
      });
      m.el.addEventListener('click', (ev) => {
        const p = ev.target.closest('[data-pick]');
        if (!p) return;
        plan.days[dayIdx].slots[slotId][Number(k)] = { ...item, id: p.dataset.pick, alternatives: [] };
        dirty = true;
        m.close();
        draw();
        toast('Swapped. Save your version to keep it.', 'swap');
      });
    }
  });

  async function saveCopy() {
    const list = savedPlans();
    const id = saved?.custom ? saved.id : `my-${plan.id}-${Date.now().toString(36)}`;
    const name = saved?.custom ? saved.name : `My ${plan.name}`;
    const entry = { id, name, basePlanId: saved?.basePlanId || plan.id, custom: { name, summary: plan.summary, goal: plan.goal, level: plan.level, duration: plan.duration, days: plan.days }, active: true, savedAt: new Date().toISOString() };
    try {
      await saveSavedPlans([...list.filter((p) => p.id !== id).map((p) => ({ ...p, active: false })), entry]);
      dirty = false;
      track('plan_save', { planId: plan.id });
      toast('Saved. Your dashboard follows your version now.', 'check');
      navigate(`/meal-plans/${id}`, { replace: true });
    } catch (err) { toast(err.message, 'alert', 'error'); }
  }

  function openShopping() {
    const items = shoppingList(plan, state.recipeMap, state.ingredientMap);
    const groups = Object.entries(INGREDIENT_TYPES).map(([k, label]) => [label, items.filter((i) => i.type === k)]).filter(([, list]) => list.length);
    const m = modal({
      title: 'Shopping list for the week',
      wide: true,
      body: `<p class="muted" style="margin-bottom:14px">Everything this plan uses, grouped by aisle. Tick items as you shop. Quantities are per recipe; buy enough for the days listed.</p>
      <div class="shop-groups">${groups.map(([label, list]) => `<section><h3>${esc(label)}</h3><ul>${list.map((i) => `<li><label class="check"><input type="checkbox"><span class="ing-icon">${ingredientSvg(state.ingredientMap[i.id], { size: 32 })}</span><span><b>${esc(i.name)}</b><br><span class="muted small">${esc(i.days.join(', '))} · ${esc(i.uses.join('; '))}</span></span></label></li>`).join('')}</ul></section>`).join('')}</div>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" type="button" id="copy-list">${icon('copy')}Copy as text</button></div>`,
    });
    $('#copy-list', m.el).addEventListener('click', async () => {
      const text = groups.map(([label, list]) => `${label}\n${list.map((i) => `- ${i.name} (${i.days.join(', ')})`).join('\n')}`).join('\n\n');
      try { await navigator.clipboard.writeText(text); toast('Shopping list copied'); } catch { toast('Copy is blocked here. Select the list and copy it manually.', 'alert'); }
    });
    $$('.shop-groups input', m.el).forEach((c) => c.addEventListener('change', () => c.closest('li').classList.toggle('done', c.checked)));
  }
}
