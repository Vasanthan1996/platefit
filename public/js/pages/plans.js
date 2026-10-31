import { state, savedPlans, saveSavedPlans, activePlan } from '../core/state.js';
import { link } from '../core/router.js';
import { esc, fmt } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { dishSvg } from '../ui/art.js';
import { toast, confirmDialog, emptyState } from '../ui/components.js';
import { planAverages } from '../core/nutrition.js';
import { setSeo } from '../core/seo.js';
import { track } from '../core/analytics.js';

export function planCard(p, { active = false, saved = null } = {}) {
  const avg = planAverages(p, state.recipeMap);
  const days = p.days || [];
  return `<article class="plan-card">
    <div class="plan-week" aria-hidden="true">${days.slice(0, 7).map((d) => {
      const lunch = (d.slots?.lunch || []).map((it) => state.recipeMap[it.id]).find((r) => r && r.tags.includes('high-protein')) || state.recipeMap[d.slots?.breakfast?.[0]?.id];
      return `<span class="pw-day"><span class="pw-art">${lunch ? dishSvg(lunch) : ''}</span><b>${esc(d.label.slice(0, 3))}</b></span>`;
    }).join('')}</div>
    <div class="stack" style="gap:10px;padding:20px">
      <div class="row">${active ? '<span class="badge ok">Following</span>' : ''}${p.featured ? '<span class="badge warn">Recommended</span>' : ''}${saved?.custom ? '<span class="badge info">Your version</span>' : ''}</div>
      <h2 style="font-size:var(--step-2)">${esc(saved?.name || p.name)}</h2>
      <p class="muted">${esc(p.summary)}</p>
      <dl class="plan-facts"><div><dt>Goal</dt><dd>${esc(p.goal || 'Not Specified')}</dd></div><div><dt>Length</dt><dd>${esc(p.duration || `${days.length} days`)}</dd></div></dl>
      <div class="macro-pills"><span class="pill kcal"><span class="dot"></span>${fmt.n(avg.calories)} kcal/day</span><span class="pill protein"><span class="dot"></span>${fmt.n(avg.protein)} g protein</span><span class="pill carbs"><span class="dot"></span>${fmt.n(avg.carbs)} g carbs</span><span class="pill fat"><span class="dot"></span>${fmt.n(avg.fat)} g fat</span></div>
      <div class="row" style="margin-top:6px"><a class="btn btn-primary" href="${link(`/meal-plans/${saved?.id || p.id}`)}">${icon('eye')}View plan</a>${active ? '' : `<button class="btn" type="button" data-follow="${esc(saved?.id || p.id)}">${icon('check')}Follow</button>`}${saved && saved.custom ? `<button class="icon-btn" type="button" data-remove-saved="${esc(saved.id)}" aria-label="Delete ${esc(saved.name)}">${icon('trash')}</button>` : ''}</div>
    </div>
  </article>`;
}

export async function followPlan(id) {
  const list = savedPlans().map((p) => ({ ...p, active: p.id === id }));
  if (!list.some((p) => p.id === id)) {
    const base = state.planMap[id];
    if (!base) return;
    list.push({ id, name: base.name, basePlanId: id, custom: null, active: true, savedAt: new Date().toISOString() });
  }
  await saveSavedPlans(list);
  track('plan_save', { planId: id });
}

export default async function render(view, { path }) {
  setSeo({ path, title: 'Meal Plans', description: 'The 7-day low-carb, high-protein week and your trainer’s original daily plan, with daily calories and protein.' });
  const draw = () => {
    const active = activePlan();
    const mine = savedPlans().filter((s) => s.custom);
    view.innerHTML = `
      <div class="page-head"><div class="stack"><span class="eyebrow">Planning</span><h1>Meal plans</h1><p class="lede">Follow a plan and the dashboard lists each day’s meals for you to tick off. Swap any dish to make your own version.</p></div></div>
      <div class="plan-grid stagger">${state.plans.map((p) => planCard(p, { active: active.id === p.id && !active.custom })).join('')}</div>
      <section class="section"><div class="section-head"><div class="stack" style="gap:6px"><span class="eyebrow">Saved</span><h2>Your versions</h2></div></div>
        ${mine.length ? `<div class="plan-grid">${mine.map((s) => planCard({ ...s.custom, id: s.id }, { active: active.id === s.id, saved: s })).join('')}</div>` : emptyState({ title: 'No custom plans yet', text: 'Open a plan and use Swap on any dish to save your own version.' })}
      </section>`;
  };
  draw();
  view.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-follow]');
    if (f) {
      try { await followPlan(f.dataset.follow); toast('Plan set. Your dashboard now follows it.', 'calendar'); draw(); } catch (err) { toast(err.message, 'alert', 'error'); }
    }
    const rm = e.target.closest('[data-remove-saved]');
    if (rm) {
      if (!await confirmDialog('This deletes your custom version of the plan. The original plan stays.', { title: 'Delete this plan?', confirmLabel: 'Delete', danger: true })) return;
      await saveSavedPlans(savedPlans().filter((p) => p.id !== rm.dataset.removeSaved));
      toast('Plan deleted');
      draw();
    }
  });
}
