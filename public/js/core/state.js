// App-wide state: catalogue, signed-in user, favourites and the plan being followed.
import { api } from './api.js';
import { storage } from './utils.js';
import { RECIPES, normalizeRecipe } from '../data/recipes/index.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { MEAL_PLANS, DEFAULT_TARGETS } from '../data/plans.js';
import { DEFAULT_CONTENT } from '../data/seed.js';

const listeners = new Set();
export const state = {
  mode: 'demo',
  ready: false,
  user: null,
  recipes: RECIPES,
  recipeMap: Object.fromEntries(RECIPES.map((r) => [r.id, r])),
  ingredients: INGREDIENTS,
  ingredientMap: Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])),
  plans: MEAL_PLANS,
  planMap: Object.fromEntries(MEAL_PLANS.map((p) => [p.id, p])),
  content: { ...DEFAULT_CONTENT },
  config: {},
  favourites: new Set(storage.get('favs', [])),
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(what) { for (const fn of listeners) { try { fn(what); } catch (e) { console.error(e); } } }

export async function loadCatalogue() {
  const [r, i, p, c, cfg] = await Promise.allSettled([api.get('recipes'), api.get('ingredients'), api.get('meal-plans'), api.get('content'), api.get('config')]);
  if (r.status === 'fulfilled' && r.value.recipes?.length) {
    state.recipes = r.value.recipes.map(normalizeRecipe);
    state.recipeMap = Object.fromEntries(state.recipes.map((x) => [x.id, x]));
  }
  if (i.status === 'fulfilled' && i.value.ingredients?.length) {
    state.ingredients = i.value.ingredients;
    state.ingredientMap = Object.fromEntries(state.ingredients.map((x) => [x.id, x]));
  }
  if (p.status === 'fulfilled' && p.value.mealPlans?.length) {
    state.plans = p.value.mealPlans;
    state.planMap = Object.fromEntries(state.plans.map((x) => [x.id, x]));
  }
  if (c.status === 'fulfilled') state.content = { ...DEFAULT_CONTENT, ...c.value.content };
  if (cfg.status === 'fulfilled') state.config = cfg.value;
  emit('catalogue');
}

export async function refreshUser() {
  try {
    const { user } = await api.get('auth/session');
    setUser(user);
  } catch { setUser(null); }
}

export function setUser(user) {
  state.user = user;
  if (user) {
    const merged = new Set([...(user.favourites || []), ...state.favourites]);
    const changed = merged.size !== (user.favourites || []).length;
    state.favourites = merged;
    storage.set('favs', []);
    if (changed) api.put('me/favourites', { ids: [...merged] }).catch(() => {});
  } else {
    state.favourites = new Set(storage.get('favs', []));
  }
  emit('user');
}

export const isFav = (id) => state.favourites.has(id);
export async function toggleFavourite(id) {
  const on = !state.favourites.has(id);
  if (on) state.favourites.add(id); else state.favourites.delete(id);
  if (state.user) {
    try { await api.put('me/favourites', { ids: [...state.favourites] }); } catch (e) {
      if (on) state.favourites.delete(id); else state.favourites.add(id);
      throw e;
    }
  } else storage.set('favs', [...state.favourites]);
  emit('favourites');
  return on;
}

export function targets() { return { ...DEFAULT_TARGETS, ...(state.user?.targets || {}) }; }

export function savedPlans() { return state.user?.savedPlans || storage.get('saved-plans', []); }
export function activePlan() {
  const saved = savedPlans().find((p) => p.active);
  if (saved?.custom) return { ...saved.custom, id: saved.id, name: saved.name, custom: true };
  return state.planMap[saved?.basePlanId || saved?.id] || state.plans.find((p) => p.featured) || state.plans[0];
}
export async function saveSavedPlans(list) {
  if (state.user) {
    const { savedPlans: out } = await api.put('me/plans', { plans: list });
    state.user = { ...state.user, savedPlans: out };
  } else storage.set('saved-plans', list);
  emit('plans');
}
