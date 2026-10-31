// API tests against the in-memory store. Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../public/js/shared/api-core.js';
import { createMemoryStore } from '../public/js/shared/memory-store.js';
import { SEED } from '../public/js/data/seed.js';
import { createNodeCrypto } from '../api/_lib/node-crypto.js';

function setup() {
  const store = createMemoryStore();
  const api = createApi({
    store, crypto: createNodeCrypto('t'.repeat(40)), seed: SEED, mode: 'memory',
    env: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin@123', DEV_RESET_LINKS: true },
  });
  const call = (method, path, body = {}, token = '', query = {}) => api.handle({ method, path, body, token, query, ip: '1.2.3.4' });
  return { api, store, call };
}

test('catalogue is served from seed data before the sheet is seeded', async () => {
  const { call } = setup();
  const r = await call('GET', 'recipes');
  assert.equal(r.status, 200);
  assert.equal(r.body.recipes.length, SEED.recipes.length);
  const one = await call('GET', 'recipes/grilled-chicken');
  assert.equal(one.body.recipe.nutrition.protein, 58);
  assert.equal((await call('GET', 'recipes/nope')).status, 404);
});

test('register, login, profile, favourites and tracking', async () => {
  const { call } = setup();
  const bad = await call('POST', 'auth/register', { name: 'V', email: 'bad', password: 'short' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.fields.email && bad.body.fields.password && bad.body.fields.name);

  const reg = await call('POST', 'auth/register', { name: 'Vasanthan', email: 'v@example.com', password: 'gymday2026' });
  assert.equal(reg.status, 201);
  assert.ok(reg.session.token);
  assert.equal(reg.body.user.passwordHash, undefined);
  const dup = await call('POST', 'auth/register', { name: 'Vasanthan', email: 'V@example.com', password: 'gymday2026' });
  assert.equal(dup.status, 409);

  const wrong = await call('POST', 'auth/login', { identifier: 'v@example.com', password: 'nope12345' });
  assert.equal(wrong.status, 401);
  const login = await call('POST', 'auth/login', { identifier: 'v@example.com', password: 'gymday2026' });
  assert.equal(login.status, 200);
  const token = login.session.token;

  const me = await call('PUT', 'auth/me', { weightKg: 82, targets: { calories: 2200, protein: 140, carbs: 280, fat: 60, water: 3.5 } }, token);
  assert.equal(me.body.user.weightKg, 82);
  const fav = await call('PUT', 'me/favourites', { ids: ['grilled-chicken', 'idli', 'grilled-chicken'] }, token);
  assert.deepEqual(fav.body.favourites, ['grilled-chicken', 'idli']);

  const log = await call('POST', 'logs', { type: 'meal', date: '2026-10-31', slot: 'lunch', recipeId: 'grilled-chicken', servings: 1 }, token);
  assert.equal(log.status, 201);
  assert.equal(log.body.log.protein, 58);
  const w = await call('POST', 'logs', { type: 'weight', date: '2026-10-31', value: 81.6 }, token);
  assert.equal(w.body.log.value, 81.6);
  const list = await call('GET', 'logs', {}, token, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(list.body.logs.length, 2);
  const del = await call('DELETE', `logs/${log.body.log.id}`, {}, token);
  assert.equal(del.status, 200);
  assert.equal((await call('GET', 'logs', {}, '')).status, 401);
});

test('forgot and reset password', async () => {
  const { call } = setup();
  await call('POST', 'auth/register', { name: 'Asha', email: 'asha@example.com', password: 'firstpass1' });
  const f = await call('POST', 'auth/forgot', { email: 'asha@example.com' });
  assert.ok(f.body.devResetToken);
  const r = await call('POST', 'auth/reset', { token: f.body.devResetToken, password: 'secondpass2' });
  assert.equal(r.status, 200);
  assert.equal((await call('POST', 'auth/login', { identifier: 'asha@example.com', password: 'secondpass2' })).status, 200);
  assert.equal((await call('POST', 'auth/reset', { token: f.body.devResetToken, password: 'thirdpass3' })).status, 400);
  const unknown = await call('POST', 'auth/forgot', { email: 'ghost@example.com' });
  assert.equal(unknown.body.devResetToken, undefined);
});

test('admin login from env, analytics, CRUD, seed and export', async () => {
  const { call, store } = setup();
  assert.equal((await call('POST', 'auth/login', { identifier: 'admin', password: 'wrong' })).status, 401);
  const a = await call('POST', 'auth/login', { identifier: 'admin', password: 'admin@123' });
  assert.equal(a.status, 200);
  assert.equal(a.body.user.role, 'admin');
  const t = a.session.token;

  await call('POST', 'analytics/events', { events: [
    { event: 'page_view', path: '/', visitorId: 'v1', sessionId: 's1', device: 'mobile' },
    { event: 'recipe_view', recipeId: 'idli', visitorId: 'v1', sessionId: 's1' },
    { event: 'search', query: 'chicken', results: 6, visitorId: 'v2', returning: true },
    { event: 'bogus' },
  ] });
  const s = await call('GET', 'admin/summary', {}, t, { days: '30' });
  assert.equal(s.status, 200);
  assert.equal(s.body.summary.totals.pageViews, 1);
  assert.equal(s.body.summary.topRecipes[0].name, 'Soft Idli (4 pieces)');

  const user = await call('POST', 'auth/register', { name: 'Ravi', email: 'ravi@example.com', password: 'ravipass1' });
  assert.equal((await call('GET', 'admin/summary', {}, user.session.token)).status, 403);

  const seed = await call('POST', 'admin/seed', {}, t);
  assert.equal(seed.body.inserted.recipes, SEED.recipes.length);
  assert.equal((await call('POST', 'admin/seed', {}, t)).body.inserted.recipes, 0);

  const created = await call('POST', 'admin/recipes', { name: 'Egg Bhurji', category: 'breakfast', mealType: 'Breakfast', nutrition: { calories: 180, protein: 14, carbs: 4, fat: 12 }, steps: [{ title: 'Scramble', text: 'Cook eggs.' }] }, t);
  assert.equal(created.status, 201);
  assert.equal(created.body.item.id, 'egg-bhurji');
  const upd = await call('PUT', 'admin/recipes/egg-bhurji', { name: 'Egg Bhurji (2 eggs)' }, t);
  assert.equal(upd.body.item.name, 'Egg Bhurji (2 eggs)');
  assert.equal(upd.body.item.nutrition.protein, 14);
  const badRecipe = await call('POST', 'admin/recipes', { name: 'X', category: 'pizza' }, t);
  assert.equal(badRecipe.status, 400);
  assert.equal((await call('DELETE', 'admin/recipes/egg-bhurji', {}, t)).status, 200);

  const ex = await call('GET', 'admin/export/users', {}, t);
  assert.ok(!ex.body.columns.includes('passwordHash'));
  assert.ok(ex.body.rows.every((r) => r.passwordHash === undefined));
  const act = await call('GET', 'admin/activity', {}, t);
  assert.ok(act.body.items.some((x) => x.action === 'admin_seed'));
  assert.ok((await store.count('activity')) > 3);
});

test('content and contact', async () => {
  const { call } = setup();
  const c = await call('GET', 'content');
  assert.equal(c.body.content.siteName, 'PlateFit');
  const bad = await call('POST', 'contact', { name: 'A', email: 'x', message: 'hi' });
  assert.equal(bad.status, 400);
  const ok = await call('POST', 'contact', { name: 'Arun', email: 'arun@example.com', message: 'Can I swap chicken for fish?' });
  assert.equal(ok.status, 201);
});
