// Browser demo backend. When the site runs without its API (a static preview, or before
// Google Sheets is configured) the same API core runs in the page, stored in localStorage.
// It never runs when the live API answers /api/v1/health.
import { createApi } from '../shared/api-core.js';
import { createMemoryStore } from '../shared/memory-store.js';
import { SEED } from '../data/seed.js';
import { RECIPE_MAP } from '../data/recipes/index.js';
import { PLAN_MAP } from '../data/plans.js';
import { seeded, isoDate, weekdayKey } from './utils.js';

const STORE_KEY = 'pf:demo-db:v1';
const SECRET_KEY = 'pf:demo-secret';

// Demo-only sign-in details, shown on the login page while in demo mode.
// Production admin credentials come only from server environment variables.
export const DEMO_ACCOUNTS = {
  admin: { username: 'admin', password: 'admin@123' },
  member: { email: 'demo@platefit.app', password: 'demo1234' },
};
const DEMO_ADMIN_HASH = 'pbkdf2$100000$e9cc981ef311c0f9fffb301868798b20$19c5f4fcdbc468a2aa0cf6c099b54c613ab8c8d2ca6844e0abfbe95d6836a3cb';
const DEMO_MEMBER_HASH = 'pbkdf2$100000$b843346a2bf539c8ae46c09c7c2ac08a$038ccde2af9764d71dd0a6b903a0e67395d77d401d945457f4edcb043e18f0ab';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/.{2}/g).map((x) => parseInt(x, 16)));
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlText = (s) => b64url(enc.encode(s));
const fromB64url = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

function webCrypto(secret) {
  const subtle = globalThis.crypto.subtle;
  const hmacKey = subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const pbkdf2 = async (password, salt, iterations) => {
    const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    return subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  };
  const safeEqual = (a, b) => { a = String(a); b = String(b); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
  const sign = async (data) => b64url(await subtle.sign('HMAC', await hmacKey, enc.encode(data)));
  return {
    uuid: () => (globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : hex(globalThis.crypto.getRandomValues(new Uint8Array(16)))),
    randomToken: (n = 32) => hex(globalThis.crypto.getRandomValues(new Uint8Array(n))),
    sha256: async (s) => hex(await subtle.digest('SHA-256', enc.encode(String(s)))),
    safeEqual,
    async hashPassword(pw) {
      const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
      return `pbkdf2$100000$${hex(salt)}$${hex(await pbkdf2(String(pw), salt, 100000))}`;
    },
    async verifyPassword(pw, stored) {
      const p = String(stored || '').split('$');
      if (p[0] !== 'pbkdf2' || p.length !== 4) return false;
      return safeEqual(hex(await pbkdf2(String(pw), unhex(p[2]), Number(p[1]))), p[3]);
    },
    async signToken(payload, ttlMs) {
      const now = Math.floor(Date.now() / 1000);
      const head = b64urlText(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = b64urlText(JSON.stringify({ ...payload, iat: now, exp: now + Math.floor(ttlMs / 1000) }));
      return `${head}.${body}.${await sign(`${head}.${body}`)}`;
    },
    async verifyToken(token) {
      const [head, body, sig] = String(token).split('.');
      if (!sig || !safeEqual(sig, await sign(`${head}.${body}`))) return null;
      const payload = JSON.parse(fromB64url(body));
      return payload.exp > Date.now() / 1000 ? payload : null;
    },
  };
}

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function writeJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }

// Realistic sample history so the dashboard and admin panel open with something to look at.
async function seedSample(store) {
  if ((await store.count('users')) > 0) return;
  const rnd = seeded('platefit-demo');
  const now = Date.now();
  const DAY = 86400000;
  const iso = (t) => new Date(t).toISOString();
  const plan = PLAN_MAP['high-protein-week'];

  const member = {
    id: 'demo-member', name: 'Demo Member', email: DEMO_ACCOUNTS.member.email, username: DEMO_ACCOUNTS.member.email, passwordHash: DEMO_MEMBER_HASH,
    role: 'user', status: 'active', goal: 'Lose fat, keep muscle', heightCm: 175, weightKg: 82.4, targetWeightKg: 76,
    targets: SEED.targets, favourites: ['grilled-chicken', 'salad-sprouts', 'idli', 'pepper-chicken', 'chana-sundal'],
    savedPlans: [{ id: 'high-protein-week', name: plan.name, basePlanId: 'high-protein-week', custom: null, active: true, savedAt: iso(now - 20 * DAY) }],
    resetTokenHash: '', resetExpires: '', lastLoginAt: iso(now - 3600000), loginCount: 23, createdAt: iso(now - 24 * DAY), updatedAt: iso(now - DAY),
  };
  const names = ['Priya S', 'Karthik R', 'Meena V', 'Arun K', 'Divya P', 'Suresh M', 'Lakshmi N', 'Vignesh T', 'Anitha J'];
  const users = [member, ...names.map((n, i) => ({
    id: `sample-${i}`, name: n, email: `${n.toLowerCase().replace(/\s+/g, '.')}@example.com`, username: '', passwordHash: '', role: 'user', status: i === 7 ? 'disabled' : 'active',
    goal: i % 2 ? 'Muscle gain' : 'Fat loss', targets: SEED.targets, favourites: [], savedPlans: [], loginCount: 1 + Math.floor(rnd() * 20),
    createdAt: iso(now - Math.floor(rnd() * 60) * DAY), lastLoginAt: iso(now - Math.floor(rnd() * 5) * DAY), updatedAt: iso(now),
  }))];
  await store.insertMany('users', users);

  // 21 days of tracked meals, water and weight for the demo member (today is left partly done)
  const logs = [];
  let weight = 84.6;
  for (let d = 21; d >= 0; d--) {
    const date = isoDate(now - d * DAY);
    const day = plan.days.find((x) => x.key === weekdayKey(date)) || plan.days[0];
    const order = ['early-morning', 'breakfast', 'mid-morning', 'lunch', 'after-lunch', 'evening', 'dinner', 'night'];
    const doneSlots = d === 0 ? order.slice(0, 4) : order;
    for (const slot of doneSlots) {
      for (const it of day.slots[slot] || []) {
        if (it.optional && rnd() < 0.5) continue;
        if (rnd() < (d === 0 ? 0 : 0.08)) continue; // a few skipped items
        const r = RECIPE_MAP[it.id];
        const t = iso(now - d * DAY);
        logs.push({ id: `log-${date}-${slot}-${it.id}`, userId: member.id, date, type: 'meal', slot, recipeId: r.id, recipeName: r.name, servings: it.portion, calories: r.nutrition.calories * it.portion, protein: r.nutrition.protein * it.portion, carbs: r.nutrition.carbs * it.portion, fat: r.nutrition.fat * it.portion, value: null, createdAt: t, updatedAt: t });
      }
    }
    logs.push({ id: `water-${date}`, userId: member.id, date, type: 'water', slot: '', recipeId: '', recipeName: 'Water', servings: null, value: d === 0 ? 1.25 : Math.round((2.6 + rnd() * 1) * 4) / 4, createdAt: iso(now - d * DAY), updatedAt: iso(now - d * DAY) });
    if (d % 3 === 0) {
      weight -= 0.25 + rnd() * 0.35;
      logs.push({ id: `weight-${date}`, userId: member.id, date, type: 'weight', slot: '', recipeId: '', recipeName: 'Body weight', servings: null, value: Math.round(weight * 10) / 10, createdAt: iso(now - d * DAY), updatedAt: iso(now - d * DAY) });
    }
  }
  await store.insertMany('mealLogs', logs);

  // 60 days of site analytics
  const events = [];
  const recipeIds = Object.keys(RECIPE_MAP);
  const popular = ['grilled-chicken', 'idli', 'salad-sprouts', 'pepper-chicken', 'chana-sundal', 'tandoori-chicken', 'wheat-dosa', 'chicken-curry'];
  const searches = [['chicken', 6], ['salad', 8], ['sundal', 5], ['egg', 3], ['dosa', 3], ['protein', 12], ['paneer', 0], ['keerai', 4], ['oats', 0]];
  const paths = ['/', '/dashboard', '/lunch', '/breakfast', '/salads', '/meal-plans', '/snacks', '/dinner', '/fruits', '/beverages'];
  for (let d = 59; d >= 0; d--) {
    const visitors = 6 + Math.floor(rnd() * 10) + Math.floor((60 - d) / 6);
    for (let v = 0; v < visitors; v++) {
      const visitorId = `v${Math.floor(rnd() * 140)}`;
      const sessionId = `s${d}-${v}`;
      const ts = iso(now - d * DAY - Math.floor(rnd() * DAY));
      const device = rnd() < 0.68 ? 'mobile' : rnd() < 0.8 ? 'desktop' : 'tablet';
      const returning = rnd() < 0.45;
      const pv = 1 + Math.floor(rnd() * 5);
      for (let p = 0; p < pv; p++) events.push({ id: `e${events.length}`, timestamp: ts, event: 'page_view', path: paths[Math.floor(rnd() * paths.length)], recipeId: '', planId: '', query: '', results: null, userId: '', sessionId, visitorId, returning, referrer: p === 0 && rnd() < 0.4 ? (rnd() < 0.6 ? 'google.com' : 'instagram.com') : '', device });
      const rv = Math.floor(rnd() * 3);
      for (let k = 0; k < rv; k++) events.push({ id: `e${events.length}`, timestamp: ts, event: 'recipe_view', path: '', recipeId: rnd() < 0.6 ? popular[Math.floor(rnd() * popular.length)] : recipeIds[Math.floor(rnd() * recipeIds.length)], planId: '', query: '', results: null, userId: '', sessionId, visitorId, returning, referrer: '', device });
      if (rnd() < 0.25) { const [q, n] = searches[Math.floor(rnd() * searches.length)]; events.push({ id: `e${events.length}`, timestamp: ts, event: 'search', path: '', recipeId: '', planId: '', query: q, results: n, userId: '', sessionId, visitorId, returning, referrer: '', device }); }
      if (rnd() < 0.12) events.push({ id: `e${events.length}`, timestamp: ts, event: 'plan_view', path: '', recipeId: '', planId: rnd() < 0.75 ? 'high-protein-week' : 'trainer-original', query: '', results: null, userId: '', sessionId, visitorId, returning, referrer: '', device });
      if (rnd() < 0.05) events.push({ id: `e${events.length}`, timestamp: ts, event: 'cook_mode_start', path: '', recipeId: popular[0], planId: '', query: '', results: null, userId: '', sessionId, visitorId, returning, referrer: '', device });
    }
  }
  await store.insertMany('analytics', events);

  await store.insertMany('feedback', [
    { id: 'fb1', userId: 'sample-0', userName: 'Priya S', email: 'priya.s@example.com', recipeId: 'tandoori-chicken', rating: 5, message: 'Air fryer timing was spot on. Kids loved it too.', status: 'new', createdAt: iso(now - 2 * DAY), updatedAt: iso(now - 2 * DAY) },
    { id: 'fb2', userId: 'sample-3', userName: 'Arun K', email: 'arun.k@example.com', recipeId: 'murungai-keerai-poriyal', rating: 4, message: 'Stripping the leaves takes time, the tip helped.', status: 'reviewed', createdAt: iso(now - 6 * DAY), updatedAt: iso(now - 5 * DAY) },
    { id: 'fb3', userId: '', userName: 'Guest', email: '', recipeId: 'wheat-dosa', rating: 3, message: 'Mine stuck to the tawa. Maybe add a non-stick note?', status: 'new', createdAt: iso(now - DAY), updatedAt: iso(now - DAY) },
  ]);
  await store.insertMany('contact', [
    { id: 'c1', name: 'Ramesh', email: 'ramesh@example.com', subject: 'Vegetarian swap', message: 'What can I eat instead of chicken on fasting days?', status: 'new', createdAt: iso(now - 3 * DAY), updatedAt: iso(now - 3 * DAY) },
    { id: 'c2', name: 'Fathima', email: 'fathima@example.com', subject: 'Gym partnership', message: 'We run a gym in Puducherry and would like to share this plan with members.', status: 'resolved', createdAt: iso(now - 12 * DAY), updatedAt: iso(now - 10 * DAY) },
  ]);
  await store.insertMany('activity', [
    { id: 'a1', timestamp: iso(now - 3600000), userId: 'demo-member', email: member.email, action: 'login', entity: 'user', entityId: 'demo-member', details: '', ip: '127.0.0.1', userAgent: 'Sample data' },
    { id: 'a2', timestamp: iso(now - 2 * DAY), userId: 'sample-0', email: 'priya.s@example.com', action: 'feedback_create', entity: 'feedback', entityId: 'fb1', details: 'tandoori-chicken', ip: '127.0.0.1', userAgent: 'Sample data' },
    { id: 'a3', timestamp: iso(now - 3 * DAY), userId: '', email: '', action: 'contact_create', entity: 'contact', entityId: 'c1', details: '', ip: '127.0.0.1', userAgent: 'Sample data' },
  ]);
}

export async function createDemoBackend() {
  let secret = readJSON(SECRET_KEY);
  if (!secret) { secret = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join(''); writeJSON(SECRET_KEY, secret); }
  const store = createMemoryStore({ label: 'demo', load: () => readJSON(STORE_KEY), persist: (t) => writeJSON(STORE_KEY, t) });
  await seedSample(store);
  const api = createApi({
    store,
    crypto: webCrypto(secret),
    env: { ADMIN_USERNAME: DEMO_ACCOUNTS.admin.username, ADMIN_PASSWORD_HASH: DEMO_ADMIN_HASH, DEV_RESET_LINKS: true },
    seed: SEED,
    mode: 'demo',
  });
  return {
    api,
    reset() { try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ } },
  };
}
