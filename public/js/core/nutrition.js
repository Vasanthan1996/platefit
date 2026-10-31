// Nutrition maths for plans, days and logs.
import { weekdayKey } from './utils.js';
import { SLOTS } from '../data/plans.js';

const add = (a, n, k = 1) => {
  a.calories += (n.calories || 0) * k; a.protein += (n.protein || 0) * k; a.carbs += (n.carbs || 0) * k; a.fat += (n.fat || 0) * k; a.fibre += (n.fibre || 0) * k;
  return a;
};
export const zero = () => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

export function dayTotals(day, recipeMap, { includeOptional = false } = {}) {
  const t = zero();
  for (const slot of SLOTS) for (const it of day.slots?.[slot.id] || []) {
    if (it.optional && !includeOptional) continue;
    const r = recipeMap[it.id];
    if (r) add(t, r.nutrition, it.portion ?? 1);
  }
  return t;
}

export function planAverages(plan, recipeMap) {
  const t = zero();
  const days = plan.days || [];
  for (const d of days) add(t, dayTotals(d, recipeMap));
  const n = Math.max(days.length, 1);
  return { calories: t.calories / n, protein: t.protein / n, carbs: t.carbs / n, fat: t.fat / n, fibre: t.fibre / n };
}

export function planDayFor(plan, date) {
  if (!plan?.days?.length) return null;
  return plan.days.find((d) => d.key === weekdayKey(date)) || plan.days[0];
}

export function logTotals(logs) {
  const t = zero();
  let water = 0;
  for (const l of logs) {
    if (l.type === 'meal') add(t, l);
    if (l.type === 'water') water += Number(l.value) || 0;
  }
  return { ...t, water };
}

// Ingredients across a plan, grouped by ingredient type, with the days they are needed
export function shoppingList(plan, recipeMap, ingredientMap) {
  const out = new Map();
  for (const d of plan.days || []) for (const items of Object.values(d.slots || {})) for (const it of items) {
    const r = recipeMap[it.id];
    if (!r) continue;
    for (const ing of r.ingredients) {
      if (!ing.id || ing.id === 'water') continue;
      const meta = ingredientMap[ing.id];
      const key = ing.id;
      if (!out.has(key)) out.set(key, { id: key, name: ing.name, type: meta?.type || 'other', days: new Set(), recipes: new Set(), uses: [] });
      const e = out.get(key);
      e.days.add(d.label.slice(0, 3));
      e.recipes.add(r.name);
      if (e.uses.length < 4 && !e.uses.includes(ing.qty)) e.uses.push(ing.qty);
    }
  }
  return [...out.values()].map((e) => ({ ...e, days: [...e.days], recipes: [...e.recipes] }));
}
