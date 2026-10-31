import beverages from './beverages.js';
import breakfast from './breakfast.js';
import salads from './salads.js';
import chicken from './chicken.js';
import lunch from './lunch.js';
import dinner from './dinner.js';
import snacks from './snacks.js';
import fruits from './fruits.js';
import { INGREDIENT_MAP } from '../ingredients.js';

export const CATEGORIES = [
  { id: 'breakfast', label: 'Breakfast', path: '/breakfast', blurb: 'Idli, wheat dosa and egg whites for 8:30 AM.' },
  { id: 'lunch', label: 'Lunch', path: '/lunch', blurb: 'Measured rice, poriyal, keerai and 250 g chicken.' },
  { id: 'dinner', label: 'Dinner', path: '/dinner', blurb: 'Chapati or dosa with a light side.' },
  { id: 'snacks', label: 'Snacks', path: '/snacks', blurb: 'One cup of sundal at 4:30 PM.' },
  { id: 'salads', label: 'Salads', path: '/salads', blurb: 'The 250 g bowl at 11 AM, all seven days.' },
  { id: 'fruits', label: 'Fruits', path: '/fruits', blurb: 'Every fruit in the plan, with portions.' },
  { id: 'beverages', label: 'Beverages', path: '/beverages', blurb: 'Wake-up teas, bedtime milk and water.' },
];
export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const NUTRITION_NOTE = 'Approximate values per serving, estimated from standard food-composition data (IFCT 2017 / USDA) for the quantities listed. Not lab-tested; actual values vary with brands and portion sizes.';

const NS = 'Not Specified';

// Turns the compact source format into the full recipe object every page uses.
export function normalizeRecipe(r) {
  const nutrition = r.nutrition || {};
  return {
    id: r.id,
    name: r.name,
    local: r.local || '',
    category: r.category,
    mealType: r.mealType || NS,
    slot: r.slot || '',
    summary: r.summary || '',
    planNote: r.planNote || '',
    serving: r.serving || NS,
    yield: r.yield || 1,
    prep: Number.isFinite(r.prep) ? r.prep : null,
    cook: Number.isFinite(r.cook) ? r.cook : null,
    wait: r.wait || '',
    difficulty: r.difficulty || 'Easy',
    nutrition: {
      calories: nutrition.calories ?? null,
      protein: nutrition.protein ?? null,
      carbs: nutrition.carbs ?? null,
      fat: nutrition.fat ?? null,
      fibre: nutrition.fibre ?? null,
      approximate: nutrition.approximate !== false,
    },
    ingredients: (r.ingredients || []).map((row) => {
      if (!Array.isArray(row)) return { id: row.id || null, name: row.name || INGREDIENT_MAP[row.id]?.name || row.id, qty: row.qty || NS, note: row.note || '' };
      const [id, qty, note] = row;
      const ing = INGREDIENT_MAP[id];
      return { id: ing ? id : null, name: ing ? ing.name : id, qty: qty || NS, note: note || '' };
    }),
    steps: (r.steps || []).map((s, i) => Array.isArray(s)
      ? { n: i + 1, title: s[0], text: s[1], minutes: s[2] || 0 }
      : { n: i + 1, title: s.title, text: s.text, minutes: s.minutes || 0 }),
    storage: r.storage || NS,
    benefits: r.benefits || [],
    tips: r.tips || [],
    mistakes: r.mistakes || [],
    tags: r.tags || [],
    art: r.art || { dish: 'plate', colors: ['#1F6B45', '#E8A317', '#C8402A'] },
    published: r.published !== false,
    updatedAt: r.updatedAt || null,
  };
}

export const RECIPES = [...breakfast, ...salads, ...chicken, ...lunch, ...dinner, ...snacks, ...fruits, ...beverages].map(normalizeRecipe);
export const RECIPE_MAP = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
