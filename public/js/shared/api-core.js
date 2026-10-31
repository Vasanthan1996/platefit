// PlateFit API core. Transport-agnostic: the Vercel function, the local Node server and
// the in-browser demo all call `handle()` with the same request shape. Storage, crypto
// and e-mail are injected so the same rules apply everywhere.
import { SHEETS, publicRow, recipeToRow, rowToRecipe } from './schema.js';
import { summarize } from './analytics-summary.js';

export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

const ROLES = ['user', 'admin'];
const STATUSES = ['active', 'disabled'];
const CATEGORY_IDS = ['breakfast', 'lunch', 'dinner', 'snacks', 'salads', 'fruits', 'beverages'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Beverage'];
const TICKET_STATUSES = ['new', 'reviewed', 'resolved'];
const EVENTS = ['page_view', 'recipe_view', 'search', 'plan_view', 'plan_save', 'favourite_add', 'favourite_remove', 'meal_log', 'cook_mode_start', 'cook_mode_finish', 'signup', 'login', 'contact', 'feedback', 'theme_toggle', 'export'];
const LOG_TYPES = ['meal', 'weight', 'water'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 60);
const round1 = (n) => Math.round(n * 10) / 10;

// ---------- validation ----------
function validator() {
  const errors = {};
  const fail = (f, m) => { errors[f] = m; return undefined; };
  const v = {
    errors,
    str(value, field, { min = 0, max = 500, required = false, label = field } = {}) {
      const s = value === undefined || value === null ? '' : String(value).trim();
      if (!s) return required ? fail(field, `${label} is required.`) : '';
      if (s.length < min) return fail(field, `${label} must be at least ${min} characters.`);
      if (s.length > max) return fail(field, `${label} must be ${max} characters or fewer.`);
      return s;
    },
    email(value, field = 'email', { required = true } = {}) {
      const s = String(value || '').trim().toLowerCase();
      if (!s) return required ? fail(field, 'Email is required.') : '';
      if (!EMAIL_RE.test(s) || s.length > 160) return fail(field, 'Enter a valid email address, like name@example.com.');
      return s;
    },
    num(value, field, { min = -Infinity, max = Infinity, int = false, required = false, label = field } = {}) {
      if (value === undefined || value === null || value === '') return required ? fail(field, `${label} is required.`) : null;
      const n = Number(value);
      if (!Number.isFinite(n)) return fail(field, `${label} must be a number.`);
      if (int && !Number.isInteger(n)) return fail(field, `${label} must be a whole number.`);
      if (n < min || n > max) return fail(field, `${label} must be between ${min} and ${max}.`);
      return n;
    },
    oneOf(value, field, list, { required = false, label = field } = {}) {
      if (value === undefined || value === null || value === '') return required ? fail(field, `${label} is required.`) : undefined;
      if (!list.includes(value)) return fail(field, `${label} must be one of: ${list.join(', ')}.`);
      return value;
    },
    date(value, field = 'date', { required = true } = {}) {
      if (!value) return required ? fail(field, 'Date is required.') : undefined;
      if (!DATE_RE.test(value) || Number.isNaN(Date.parse(value))) return fail(field, 'Use the date format YYYY-MM-DD.');
      return value;
    },
    password(value, field = 'password') {
      const s = String(value || '');
      if (s.length < 8) return fail(field, 'Use at least 8 characters.');
      if (s.length > 128) return fail(field, 'Use 128 characters or fewer.');
      if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return fail(field, 'Use at least one letter and one number.');
      return s;
    },
    array(value, field, { max = 500 } = {}) {
      if (value === undefined || value === null) return [];
      if (!Array.isArray(value)) return fail(field, `${field} must be a list.`);
      if (value.length > max) return fail(field, `${field} can hold at most ${max} items.`);
      return value;
    },
    done() { if (Object.keys(errors).length) throw new HttpError(400, 'Please fix the highlighted fields.', { fields: errors }); },
  };
  return v;
}

export function createApi({ store, crypto, env = {}, seed = {}, mail = null, mode = 'memory', now = () => Date.now() }) {
  const routes = [];
  const add = (method, pattern, handler, auth = null) => routes.push({ method, parts: pattern.split('/'), handler, auth });
  const iso = () => new Date(now()).toISOString();
  const reply = (body, extra = {}) => ({ __reply: true, body, ...extra });

  // ---------- rate limiting (per instance) ----------
  const buckets = new Map();
  function limit(key, max, windowMs) {
    const t = now();
    const b = buckets.get(key);
    if (!b || b.reset < t) { buckets.set(key, { count: 1, reset: t + windowMs }); return; }
    b.count++;
    if (b.count > max) throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil((b.reset - t) / 60000)} minute(s).`);
  }

  // ---------- audit log ----------
  async function audit(ctx, action, entity = '', entityId = '', details = '') {
    try {
      await store.insert('activity', {
        id: crypto.uuid(), timestamp: iso(), userId: ctx.session?.sub || '', email: ctx.session?.email || '',
        action, entity, entityId: String(entityId || ''), details: typeof details === 'string' ? details.slice(0, 500) : JSON.stringify(details).slice(0, 500),
        ip: ctx.ip || '', userAgent: (ctx.userAgent || '').slice(0, 200),
      });
    } catch { /* never block the request on logging */ }
  }

  // ---------- data loaders (fall back to bundled seed data until the sheet is seeded) ----------
  async function loadRecipes({ all = false } = {}) {
    const rows = await store.list('recipes');
    const list = rows.length ? rows.map(rowToRecipe) : (seed.recipes || []);
    return all ? list : list.filter((r) => r.published !== false);
  }
  async function loadIngredients() { const rows = await store.list('ingredients'); return rows.length ? rows : (seed.ingredients || []); }
  async function loadPlans() { const rows = await store.list('mealPlans'); return rows.length ? rows : (seed.mealPlans || []); }
  async function loadContent() {
    const rows = await store.list('content');
    const map = { ...(seed.content || {}) };
    for (const r of rows) map[r.id] = r.value;
    return map;
  }

  const userView = (u) => {
    const p = publicRow('users', u);
    return { ...p, favourites: u.favourites || [], savedPlans: u.savedPlans || [], targets: u.targets || null };
  };
  async function findUserByEmail(email) { return (await store.list('users')).find((u) => u.email === email) || null; }
  async function currentUser(ctx) {
    const u = await store.get('users', ctx.session.sub);
    if (!u) throw new HttpError(401, 'Your session has ended. Please log in again.');
    if (u.status === 'disabled') throw new HttpError(403, 'This account has been disabled. Contact the site admin.');
    return u;
  }
  async function sessionFor(u) {
    const token = await crypto.signToken({ sub: u.id, role: u.role, name: u.name, email: u.email }, 7 * DAY);
    return { token, maxAge: 7 * 86400 };
  }

  // ================= public =================
  add('GET', 'health', async () => ({ ok: true, mode, version: '1.0.0', time: iso(), adminConfigured: Boolean(env.ADMIN_PASSWORD || env.ADMIN_PASSWORD_HASH), sheets: Object.values(SHEETS).map((s) => s.title) }));
  add('GET', 'config', async () => ({
    gaMeasurementId: env.GA_MEASUREMENT_ID || '',
    siteUrl: env.SITE_URL || '',
    emailEnabled: Boolean(mail),
    mode,
  }));

  // ---------- auth ----------
  add('POST', 'auth/register', async (ctx) => {
    limit(`register:${ctx.ip}`, 8, 60 * 60000);
    const v = validator();
    const name = v.str(ctx.body.name, 'name', { min: 2, max: 60, required: true, label: 'Name' });
    const email = v.email(ctx.body.email);
    const password = v.password(ctx.body.password);
    const goal = v.str(ctx.body.goal, 'goal', { max: 80 });
    v.done();
    if (email === String(env.ADMIN_USERNAME || '').toLowerCase()) throw new HttpError(409, 'That name is reserved. Use a different email.');
    if (await findUserByEmail(email)) throw new HttpError(409, 'An account with this email already exists. Log in or reset your password.', { fields: { email: 'Already registered.' } });
    const t = iso();
    const user = {
      id: crypto.uuid(), name, email, username: email, passwordHash: await crypto.hashPassword(password), role: 'user', status: 'active',
      goal: goal || 'Fat loss and muscle gain', heightCm: null, weightKg: null, targetWeightKg: null,
      targets: seed.targets || null, favourites: [], savedPlans: [], resetTokenHash: '', resetExpires: '',
      lastLoginAt: t, loginCount: 1, createdAt: t, updatedAt: t,
    };
    await store.insert('users', user);
    const s = await sessionFor(user);
    await audit({ ...ctx, session: { sub: user.id, email } }, 'register', 'user', user.id);
    return reply({ user: userView(user), token: s.token }, { status: 201, session: s });
  });

  add('POST', 'auth/login', async (ctx) => {
    limit(`login:${ctx.ip}`, 10, 15 * 60000);
    const v = validator();
    const identifier = v.str(ctx.body.identifier ?? ctx.body.email ?? ctx.body.username, 'identifier', { required: true, max: 160, label: 'Email or username' });
    const password = v.str(ctx.body.password, 'password', { required: true, max: 128, label: 'Password' });
    v.done();
    const id = identifier.toLowerCase();
    const adminName = String(env.ADMIN_USERNAME || '').toLowerCase();

    if (adminName && id === adminName) {
      if (!env.ADMIN_PASSWORD && !env.ADMIN_PASSWORD_HASH) throw new HttpError(503, 'Admin sign-in is not set up yet. Add ADMIN_PASSWORD in Vercel > Settings > Environment Variables, then redeploy.');
      const ok = env.ADMIN_PASSWORD_HASH
        ? await crypto.verifyPassword(password, env.ADMIN_PASSWORD_HASH)
        : Boolean(env.ADMIN_PASSWORD) && crypto.safeEqual(password, env.ADMIN_PASSWORD);
      if (!ok) { await audit(ctx, 'login_failed', 'admin', 'admin'); throw new HttpError(401, 'Wrong username or password.'); }
      const t = iso();
      let admin = await store.get('users', 'admin');
      if (!admin) {
        admin = { id: 'admin', name: 'Administrator', email: adminName, username: adminName, passwordHash: 'env', role: 'admin', status: 'active', goal: 'Run the platform', targets: seed.targets || null, favourites: [], savedPlans: [], loginCount: 0, createdAt: t, updatedAt: t };
        await store.insert('users', admin);
      }
      admin = await store.update('users', 'admin', { lastLoginAt: t, loginCount: (admin.loginCount || 0) + 1, role: 'admin', status: 'active' });
      const s = await sessionFor(admin);
      await audit({ ...ctx, session: { sub: 'admin', email: adminName } }, 'login', 'admin', 'admin');
      return reply({ user: userView(admin), token: s.token }, { session: s });
    }

    const user = await findUserByEmail(id);
    const ok = user && user.passwordHash && user.passwordHash !== 'env' && await crypto.verifyPassword(password, user.passwordHash);
    if (!ok) { await audit(ctx, 'login_failed', 'user', user?.id || '', id); throw new HttpError(401, 'Wrong email or password.'); }
    if (user.status === 'disabled') throw new HttpError(403, 'This account has been disabled. Contact the site admin.');
    const updated = await store.update('users', user.id, { lastLoginAt: iso(), loginCount: (user.loginCount || 0) + 1 });
    const s = await sessionFor(updated);
    await audit({ ...ctx, session: { sub: user.id, email: user.email } }, 'login', 'user', user.id);
    return reply({ user: userView(updated), token: s.token }, { session: s });
  });

  add('POST', 'auth/logout', async (ctx) => { if (ctx.session) await audit(ctx, 'logout', 'user', ctx.session.sub); return reply({ ok: true }, { session: { clear: true } }); });

  add('GET', 'auth/me', async (ctx) => ({ user: userView(await currentUser(ctx)) }), 'user');
  // Session check that never errors: returns the signed-in user or null.
  add('GET', 'auth/session', async (ctx) => {
    if (!ctx.session) return { user: null };
    const u = await store.get('users', ctx.session.sub);
    return { user: u && u.status !== 'disabled' ? userView(u) : null };
  });

  add('PUT', 'auth/me', async (ctx) => {
    const u = await currentUser(ctx);
    const v = validator();
    const patch = {};
    if ('name' in ctx.body) patch.name = v.str(ctx.body.name, 'name', { min: 2, max: 60, required: true, label: 'Name' });
    if ('goal' in ctx.body) patch.goal = v.str(ctx.body.goal, 'goal', { max: 80 });
    if ('heightCm' in ctx.body) patch.heightCm = v.num(ctx.body.heightCm, 'heightCm', { min: 100, max: 250, label: 'Height' });
    if ('weightKg' in ctx.body) patch.weightKg = v.num(ctx.body.weightKg, 'weightKg', { min: 25, max: 300, label: 'Weight' });
    if ('targetWeightKg' in ctx.body) patch.targetWeightKg = v.num(ctx.body.targetWeightKg, 'targetWeightKg', { min: 25, max: 300, label: 'Target weight' });
    if ('targets' in ctx.body) {
      const t = ctx.body.targets || {};
      patch.targets = {
        calories: v.num(t.calories, 'targets.calories', { min: 800, max: 6000, required: true, label: 'Calorie target' }),
        protein: v.num(t.protein, 'targets.protein', { min: 20, max: 400, required: true, label: 'Protein target' }),
        carbs: v.num(t.carbs, 'targets.carbs', { min: 20, max: 800, required: true, label: 'Carb target' }),
        fat: v.num(t.fat, 'targets.fat', { min: 10, max: 300, required: true, label: 'Fat target' }),
        water: v.num(t.water, 'targets.water', { min: 0.5, max: 10, required: true, label: 'Water target' }),
      };
    }
    v.done();
    const updated = await store.update('users', u.id, { ...patch, updatedAt: iso() });
    await audit(ctx, 'profile_update', 'user', u.id, Object.keys(patch).join(','));
    return { user: userView(updated) };
  }, 'user');

  add('POST', 'auth/password', async (ctx) => {
    const u = await currentUser(ctx);
    if (u.passwordHash === 'env') throw new HttpError(400, 'The admin password is set in the server environment variables. Change ADMIN_PASSWORD_HASH there.');
    const v = validator();
    const current = v.str(ctx.body.current, 'current', { required: true, label: 'Current password' });
    const next = v.password(ctx.body.next, 'next');
    v.done();
    if (!await crypto.verifyPassword(current, u.passwordHash)) throw new HttpError(400, 'Your current password is not correct.', { fields: { current: 'Not correct.' } });
    await store.update('users', u.id, { passwordHash: await crypto.hashPassword(next), updatedAt: iso() });
    await audit(ctx, 'password_change', 'user', u.id);
    return { ok: true };
  }, 'user');

  add('POST', 'auth/forgot', async (ctx) => {
    limit(`forgot:${ctx.ip}`, 5, 60 * 60000);
    const v = validator();
    const email = v.email(ctx.body.email);
    v.done();
    const generic = { ok: true, message: 'If an account exists for that email, we have sent a password reset link. It expires in 1 hour.' };
    const user = await findUserByEmail(email);
    if (!user || user.passwordHash === 'env') return generic;
    const token = crypto.randomToken(32);
    await store.update('users', user.id, { resetTokenHash: await crypto.sha256(token), resetExpires: new Date(now() + 60 * 60000).toISOString(), updatedAt: iso() });
    await audit({ ...ctx, session: { sub: user.id, email } }, 'password_reset_requested', 'user', user.id);
    const link = `${(env.SITE_URL || '').replace(/\/$/, '')}/reset-password?token=${token}`;
    if (mail) {
      try {
        await mail.send({
          to: email,
          subject: 'Reset your PlateFit password',
          text: `Hi ${user.name},\n\nUse this link to set a new password. It expires in 1 hour.\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
          html: `<p>Hi ${user.name.replace(/[<>&]/g, '')},</p><p>Use this link to set a new password. It expires in 1 hour.</p><p><a href="${link}">Reset my password</a></p><p>If you did not ask for this, ignore this email.</p>`,
        });
      } catch { /* do not reveal mail errors to the requester */ }
    }
    return env.DEV_RESET_LINKS ? { ...generic, devResetToken: token } : generic;
  });

  add('POST', 'auth/reset', async (ctx) => {
    limit(`reset:${ctx.ip}`, 10, 60 * 60000);
    const v = validator();
    const token = v.str(ctx.body.token, 'token', { required: true, max: 200, label: 'Reset link' });
    const password = v.password(ctx.body.password);
    v.done();
    const hash = await crypto.sha256(token);
    const user = (await store.list('users')).find((u) => u.resetTokenHash && u.resetTokenHash === hash);
    if (!user || !user.resetExpires || Date.parse(user.resetExpires) < now()) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
    await store.update('users', user.id, { passwordHash: await crypto.hashPassword(password), resetTokenHash: '', resetExpires: '', updatedAt: iso() });
    await audit({ ...ctx, session: { sub: user.id, email: user.email } }, 'password_reset', 'user', user.id);
    return { ok: true, message: 'Your password has been changed. You can log in now.' };
  });

  // ---------- catalogue ----------
  add('GET', 'recipes', async () => ({ recipes: await loadRecipes() }));
  add('GET', 'recipes/:id', async (ctx) => {
    const r = (await loadRecipes()).find((x) => x.id === ctx.params.id);
    if (!r) throw new HttpError(404, 'Recipe not found.');
    return { recipe: r };
  });
  add('GET', 'ingredients', async () => ({ ingredients: await loadIngredients() }));
  add('GET', 'meal-plans', async () => ({ mealPlans: await loadPlans() }));
  add('GET', 'content', async () => ({ content: await loadContent() }));

  // ---------- personal data ----------
  add('PUT', 'me/favourites', async (ctx) => {
    const u = await currentUser(ctx);
    const v = validator();
    const ids = v.array(ctx.body.ids, 'ids', { max: 200 });
    v.done();
    const clean = [...new Set(ids.map(String).filter((s) => /^[\w-]{1,80}$/.test(s)))];
    await store.update('users', u.id, { favourites: clean, updatedAt: iso() });
    await audit(ctx, 'favourites_update', 'user', u.id, `${clean.length} saved`);
    return { favourites: clean };
  }, 'user');

  add('PUT', 'me/plans', async (ctx) => {
    const u = await currentUser(ctx);
    const v = validator();
    const plans = v.array(ctx.body.plans, 'plans', { max: 30 });
    v.done();
    const clean = plans.map((p) => ({
      id: String(p.id || crypto.uuid()).slice(0, 80),
      name: String(p.name || 'My plan').slice(0, 80),
      basePlanId: p.basePlanId ? String(p.basePlanId).slice(0, 80) : '',
      custom: p.custom || null,
      active: Boolean(p.active),
      savedAt: p.savedAt || iso(),
    }));
    if (JSON.stringify(clean).length > 45000) throw new HttpError(400, 'Saved plans are too large. Remove a few and try again.');
    await store.update('users', u.id, { savedPlans: clean, updatedAt: iso() });
    await audit(ctx, 'plans_update', 'user', u.id, `${clean.length} saved`);
    return { savedPlans: clean };
  }, 'user');

  // ---------- meal, weight and water tracking ----------
  add('GET', 'logs', async (ctx) => {
    const v = validator();
    const from = v.date(ctx.query.from, 'from', { required: false }) || new Date(now() - 30 * DAY).toISOString().slice(0, 10);
    const to = v.date(ctx.query.to, 'to', { required: false }) || new Date(now()).toISOString().slice(0, 10);
    v.done();
    const logs = (await store.list('mealLogs')).filter((l) => l.userId === ctx.session.sub && l.date >= from && l.date <= to);
    return { logs: logs.sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt)) };
  }, 'user');

  async function buildLog(ctx, input, existing = {}) {
    const v = validator();
    const type = v.oneOf(input.type ?? existing.type ?? 'meal', 'type', LOG_TYPES, { required: true });
    const date = v.date(input.date ?? existing.date);
    const log = { type, date };
    if (type === 'meal') {
      const servings = v.num(input.servings ?? existing.servings ?? 1, 'servings', { min: 0.25, max: 10, label: 'Servings' });
      log.slot = v.str(input.slot ?? existing.slot, 'slot', { max: 30 });
      const recipeId = v.str(input.recipeId ?? existing.recipeId, 'recipeId', { max: 80 });
      v.done();
      if (recipeId) {
        const r = (await loadRecipes({ all: true })).find((x) => x.id === recipeId);
        if (!r) throw new HttpError(400, 'That recipe no longer exists.');
        Object.assign(log, { recipeId, recipeName: r.name, servings, calories: round1((r.nutrition.calories || 0) * servings), protein: round1((r.nutrition.protein || 0) * servings), carbs: round1((r.nutrition.carbs || 0) * servings), fat: round1((r.nutrition.fat || 0) * servings) });
      } else {
        const v2 = validator();
        const recipeName = v2.str(input.recipeName ?? existing.recipeName, 'recipeName', { required: true, max: 80, label: 'Food name' });
        const cal = v2.num(input.calories ?? existing.calories, 'calories', { min: 0, max: 5000, required: true, label: 'Calories' });
        const pr = v2.num(input.protein ?? existing.protein ?? 0, 'protein', { min: 0, max: 500, label: 'Protein' });
        const cb = v2.num(input.carbs ?? existing.carbs ?? 0, 'carbs', { min: 0, max: 1000, label: 'Carbs' });
        const ft = v2.num(input.fat ?? existing.fat ?? 0, 'fat', { min: 0, max: 500, label: 'Fat' });
        v2.done();
        Object.assign(log, { recipeId: '', recipeName, servings, calories: cal, protein: pr || 0, carbs: cb || 0, fat: ft || 0 });
      }
    } else {
      const value = type === 'weight'
        ? v.num(input.value ?? existing.value, 'value', { min: 25, max: 300, required: true, label: 'Weight (kg)' })
        : v.num(input.value ?? existing.value, 'value', { min: 0.05, max: 10, required: true, label: 'Water (litres)' });
      v.done();
      Object.assign(log, { value, recipeName: type === 'weight' ? 'Body weight' : 'Water', slot: '' });
    }
    return log;
  }

  add('POST', 'logs', async (ctx) => {
    limit(`logs:${ctx.session.sub}`, 300, 60 * 60000);
    const log = await buildLog(ctx, ctx.body);
    const t = iso();
    const row = { id: crypto.uuid(), userId: ctx.session.sub, ...log, createdAt: t, updatedAt: t };
    await store.insert('mealLogs', row);
    await audit(ctx, 'log_create', 'mealLog', row.id, `${row.type}: ${row.recipeName}`);
    return reply({ log: row }, { status: 201 });
  }, 'user');

  add('PUT', 'logs/:id', async (ctx) => {
    const existing = await store.get('mealLogs', ctx.params.id);
    if (!existing || existing.userId !== ctx.session.sub) throw new HttpError(404, 'Log entry not found.');
    const log = await buildLog(ctx, ctx.body, existing);
    const updated = await store.update('mealLogs', existing.id, { ...log, updatedAt: iso() });
    await audit(ctx, 'log_update', 'mealLog', existing.id);
    return { log: updated };
  }, 'user');

  add('DELETE', 'logs/:id', async (ctx) => {
    const existing = await store.get('mealLogs', ctx.params.id);
    if (!existing || existing.userId !== ctx.session.sub) throw new HttpError(404, 'Log entry not found.');
    await store.remove('mealLogs', existing.id);
    await audit(ctx, 'log_delete', 'mealLog', existing.id);
    return { ok: true };
  }, 'user');

  // ---------- feedback, contact, analytics ----------
  add('POST', 'feedback', async (ctx) => {
    limit(`feedback:${ctx.ip}`, 15, 60 * 60000);
    const v = validator();
    const rating = v.num(ctx.body.rating, 'rating', { min: 1, max: 5, int: true, required: true, label: 'Rating' });
    const message = v.str(ctx.body.message, 'message', { max: 1500, label: 'Message' });
    const recipeId = v.str(ctx.body.recipeId, 'recipeId', { max: 80 });
    const name = ctx.session ? ctx.session.name : v.str(ctx.body.name, 'name', { max: 60 });
    const email = ctx.session ? ctx.session.email : v.email(ctx.body.email, 'email', { required: false });
    v.done();
    const t = iso();
    const row = { id: crypto.uuid(), userId: ctx.session?.sub || '', userName: name || 'Guest', email: email || '', recipeId, rating, message, status: 'new', createdAt: t, updatedAt: t };
    await store.insert('feedback', row);
    await audit(ctx, 'feedback_create', 'feedback', row.id, recipeId);
    return reply({ ok: true, message: 'Thanks! Your feedback has been sent.' }, { status: 201 });
  });

  add('POST', 'contact', async (ctx) => {
    limit(`contact:${ctx.ip}`, 10, 60 * 60000);
    const v = validator();
    const name = v.str(ctx.body.name, 'name', { min: 2, max: 60, required: true, label: 'Name' });
    const email = v.email(ctx.body.email);
    const subject = v.str(ctx.body.subject, 'subject', { max: 120, label: 'Subject' });
    const message = v.str(ctx.body.message, 'message', { min: 10, max: 3000, required: true, label: 'Message' });
    v.done();
    const t = iso();
    const row = { id: crypto.uuid(), name, email, subject: subject || 'General question', message, status: 'new', createdAt: t, updatedAt: t };
    await store.insert('contact', row);
    await audit(ctx, 'contact_create', 'contact', row.id);
    return reply({ ok: true, message: 'Message sent. We usually reply within 2 working days.' }, { status: 201 });
  });

  add('POST', 'analytics/events', async (ctx) => {
    limit(`analytics:${ctx.ip}`, 120, 60000);
    const list = Array.isArray(ctx.body.events) ? ctx.body.events.slice(0, 50) : [];
    const t = iso();
    const s = (x, n) => (x === undefined || x === null ? '' : String(x).slice(0, n));
    const rows = list.filter((e) => EVENTS.includes(e.event)).map((e) => ({
      id: crypto.uuid(), timestamp: t, event: e.event, path: s(e.path, 160), recipeId: s(e.recipeId, 80), planId: s(e.planId, 80),
      query: s(e.query, 80), results: Number.isFinite(Number(e.results)) ? Number(e.results) : null, userId: ctx.session?.sub || '',
      sessionId: s(e.sessionId, 64), visitorId: s(e.visitorId, 64), returning: Boolean(e.returning), referrer: s(e.referrer, 120), device: s(e.device, 20),
    }));
    if (rows.length) await store.insertMany('analytics', rows);
    return { accepted: rows.length };
  });

  // ================= admin =================
  add('GET', 'admin/summary', async (ctx) => {
    const days = Math.min(365, Math.max(1, Number(ctx.query.days) || 30));
    const [events, users, logs, feedback, contact, recipes, plans] = await Promise.all([
      store.list('analytics'), store.list('users'), store.list('mealLogs'), store.list('feedback'), store.list('contact'), loadRecipes({ all: true }), loadPlans(),
    ]);
    return {
      summary: summarize({
        events, users: users.filter((u) => u.id !== 'admin'), logs, feedback, contact,
        recipeNames: Object.fromEntries(recipes.map((r) => [r.id, r.name])),
        planNames: Object.fromEntries(plans.map((p) => [p.id, p.name])),
      }, { days, now: now() }),
      counts: { recipes: recipes.length, plans: plans.length, ingredients: (await loadIngredients()).length },
      mode,
    };
  }, 'admin');

  add('GET', 'admin/users', async () => ({ users: (await store.list('users')).map(userView) }), 'admin');
  add('PUT', 'admin/users/:id', async (ctx) => {
    const u = await store.get('users', ctx.params.id);
    if (!u) throw new HttpError(404, 'User not found.');
    const v = validator();
    const patch = {};
    if ('name' in ctx.body) patch.name = v.str(ctx.body.name, 'name', { min: 2, max: 60, required: true, label: 'Name' });
    if ('role' in ctx.body) patch.role = v.oneOf(ctx.body.role, 'role', ROLES, { required: true, label: 'Role' });
    if ('status' in ctx.body) patch.status = v.oneOf(ctx.body.status, 'status', STATUSES, { required: true, label: 'Status' });
    v.done();
    if (u.id === 'admin' && (patch.role === 'user' || patch.status === 'disabled')) throw new HttpError(400, 'The main admin account cannot be demoted or disabled.');
    const updated = await store.update('users', u.id, { ...patch, updatedAt: iso() });
    await audit(ctx, 'admin_user_update', 'user', u.id, patch);
    return { user: userView(updated) };
  }, 'admin');
  add('DELETE', 'admin/users/:id', async (ctx) => {
    if (ctx.params.id === 'admin') throw new HttpError(400, 'The main admin account cannot be deleted.');
    if (!await store.remove('users', ctx.params.id)) throw new HttpError(404, 'User not found.');
    await audit(ctx, 'admin_user_delete', 'user', ctx.params.id);
    return { ok: true };
  }, 'admin');
  add('POST', 'admin/users/:id/password', async (ctx) => {
    const u = await store.get('users', ctx.params.id);
    if (!u || u.passwordHash === 'env') throw new HttpError(404, 'User not found or password is managed by environment variables.');
    const v = validator();
    const password = v.password(ctx.body.password);
    v.done();
    await store.update('users', u.id, { passwordHash: await crypto.hashPassword(password), resetTokenHash: '', resetExpires: '', updatedAt: iso() });
    await audit(ctx, 'admin_password_set', 'user', u.id);
    return { ok: true, message: `New password set for ${u.email}. Share it with them privately.` };
  }, 'admin');

  // Generic CRUD for catalogue sheets
  function crud(path, key, { load, validate, toRow = (x) => x, fromRow = (x) => x, label }) {
    add('GET', `admin/${path}`, async () => ({ items: await load() }), 'admin');
    add('POST', `admin/${path}`, async (ctx) => {
      const item = validate(ctx.body, true);
      item.id = slugify(ctx.body.id || item.name) || crypto.uuid();
      if (await store.get(key, item.id)) throw new HttpError(409, `A ${label} with the id "${item.id}" already exists. Change the name or id.`);
      const t = iso();
      const row = { ...toRow(item), createdAt: t, updatedAt: t };
      await store.insert(key, row);
      await audit(ctx, `admin_${key}_create`, key, item.id, item.name);
      return reply({ item: fromRow(row) }, { status: 201 });
    }, 'admin');
    add('PUT', `admin/${path}/:id`, async (ctx) => {
      let existing = await store.get(key, ctx.params.id);
      if (!existing) {
        const seeded = (await load()).find((x) => x.id === ctx.params.id);
        if (!seeded) throw new HttpError(404, `${label} not found.`);
        existing = { ...toRow(seeded), createdAt: iso() };
        await store.insert(key, existing);
      }
      const item = validate({ ...fromRow(existing), ...ctx.body }, false);
      const updated = await store.update(key, ctx.params.id, { ...toRow({ ...item, id: ctx.params.id }), updatedAt: iso() });
      await audit(ctx, `admin_${key}_update`, key, ctx.params.id, item.name);
      return { item: fromRow(updated) };
    }, 'admin');
    add('DELETE', `admin/${path}/:id`, async (ctx) => {
      if (!await store.remove(key, ctx.params.id)) throw new HttpError(404, `${label} not found. If it comes from the built-in data, seed the sheet first.`);
      await audit(ctx, `admin_${key}_delete`, key, ctx.params.id);
      return { ok: true };
    }, 'admin');
  }

  const validateRecipe = (b) => {
    const v = validator();
    const n = b.nutrition || b;
    const item = {
      name: v.str(b.name, 'name', { min: 2, max: 120, required: true, label: 'Name' }),
      local: v.str(b.local, 'local', { max: 120 }),
      category: v.oneOf(b.category, 'category', CATEGORY_IDS, { required: true, label: 'Category' }),
      mealType: v.oneOf(b.mealType, 'mealType', MEAL_TYPES, { required: true, label: 'Meal type' }),
      slot: v.str(b.slot, 'slot', { max: 30 }),
      summary: v.str(b.summary, 'summary', { max: 300 }),
      planNote: v.str(b.planNote, 'planNote', { max: 300 }),
      serving: v.str(b.serving, 'serving', { max: 120 }) || 'Not Specified',
      yield: v.num(b.yield ?? 1, 'yield', { min: 1, max: 50, label: 'Yield' }),
      prep: v.num(b.prep, 'prep', { min: 0, max: 2000, label: 'Prep time' }),
      cook: v.num(b.cook, 'cook', { min: 0, max: 2000, label: 'Cook time' }),
      wait: v.str(b.wait, 'wait', { max: 160 }),
      difficulty: v.oneOf(b.difficulty || 'Easy', 'difficulty', ['Easy', 'Medium', 'Hard']),
      nutrition: {
        calories: v.num(n.calories, 'calories', { min: 0, max: 5000, label: 'Calories' }),
        protein: v.num(n.protein, 'protein', { min: 0, max: 500, label: 'Protein' }),
        carbs: v.num(n.carbs, 'carbs', { min: 0, max: 1000, label: 'Carbs' }),
        fat: v.num(n.fat, 'fat', { min: 0, max: 500, label: 'Fat' }),
        fibre: v.num(n.fibre, 'fibre', { min: 0, max: 200, label: 'Fibre' }),
      },
      ingredients: v.array(b.ingredients, 'ingredients', { max: 60 }).map((i) => ({ id: i.id || null, name: String(i.name || '').slice(0, 120), qty: String(i.qty || 'Not Specified').slice(0, 160), note: String(i.note || '').slice(0, 160) })),
      steps: v.array(b.steps, 'steps', { max: 40 }).map((s, i) => ({ n: i + 1, title: String(s.title || `Step ${i + 1}`).slice(0, 120), text: String(s.text || '').slice(0, 1200), minutes: Number(s.minutes) || 0 })),
      storage: v.str(b.storage, 'storage', { max: 600 }),
      benefits: v.array(b.benefits, 'benefits', { max: 20 }).map((x) => String(x).slice(0, 200)),
      tips: v.array(b.tips, 'tips', { max: 20 }).map((x) => String(x).slice(0, 300)),
      mistakes: v.array(b.mistakes, 'mistakes', { max: 20 }).map((x) => String(x).slice(0, 300)),
      tags: v.array(b.tags, 'tags', { max: 20 }).map((x) => slugify(x)).filter(Boolean),
      art: b.art && typeof b.art === 'object' ? { dish: String(b.art.dish || 'plate').slice(0, 20), colors: (b.art.colors || []).slice(0, 4).map(String), items: b.art.items ? String(b.art.items).slice(0, 30) : undefined } : { dish: 'plate', colors: ['#1F6B45', '#E8A317', '#C8402A'] },
      published: b.published !== false && b.published !== 'false',
    };
    v.done();
    return item;
  };
  crud('recipes', 'recipes', { load: () => loadRecipes({ all: true }), validate: validateRecipe, toRow: recipeToRow, fromRow: (r) => (r.nutrition ? r : rowToRecipe(r)), label: 'Recipe' });

  const validateIngredient = (b) => {
    const v = validator();
    const item = {
      name: v.str(b.name, 'name', { min: 2, max: 80, required: true, label: 'Name' }),
      local: v.str(b.local, 'local', { max: 80 }),
      type: v.oneOf(b.type || 'vegetable', 'type', ['vegetable', 'greens', 'fruit', 'pulse', 'grain', 'protein', 'dairy', 'spice', 'oil', 'seed-nut', 'beverage'], { required: true, label: 'Type' }),
      shape: v.oneOf(b.shape || 'round', 'shape', ['round', 'long', 'leaf', 'head', 'bulb', 'pod', 'grain', 'powder', 'liquid', 'egg', 'meat', 'cluster', 'wedge', 'seed', 'root'], { label: 'Shape' }),
      color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#4F9A3B',
      color2: /^#[0-9a-f]{6}$/i.test(b.color2 || '') ? b.color2 : '#A9D88A',
      benefit: v.str(b.benefit, 'benefit', { max: 300 }),
    };
    v.done();
    return item;
  };
  crud('ingredients', 'ingredients', { load: loadIngredients, validate: validateIngredient, label: 'Ingredient' });

  const validatePlan = (b) => {
    const v = validator();
    const item = {
      name: v.str(b.name, 'name', { min: 2, max: 120, required: true, label: 'Name' }),
      summary: v.str(b.summary, 'summary', { max: 400 }),
      goal: v.str(b.goal, 'goal', { max: 80 }),
      level: v.str(b.level, 'level', { max: 80 }),
      duration: v.str(b.duration, 'duration', { max: 80 }),
      color: /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#1F6B45',
      featured: Boolean(b.featured) && b.featured !== 'false',
      days: v.array(b.days, 'days', { max: 31 }),
    };
    v.done();
    if (JSON.stringify(item.days).length > 45000) throw new HttpError(400, 'This plan is too large for one sheet cell. Split it into two plans.');
    return item;
  };
  crud('meal-plans', 'mealPlans', { load: loadPlans, validate: validatePlan, label: 'Meal plan' });

  add('GET', 'admin/content', async () => ({ content: await loadContent() }), 'admin');
  add('PUT', 'admin/content', async (ctx) => {
    const entries = Object.entries(ctx.body.content || {}).filter(([k]) => /^[a-zA-Z][\w]{0,40}$/.test(k)).slice(0, 40);
    const t = iso();
    for (const [k, val] of entries) {
      const value = String(val ?? '').slice(0, 2000);
      if (await store.get('content', k)) await store.update('content', k, { value, updatedAt: t });
      else await store.insert('content', { id: k, value, updatedAt: t });
    }
    await audit(ctx, 'admin_content_update', 'content', '', entries.map(([k]) => k).join(','));
    return { content: await loadContent() };
  }, 'admin');

  for (const [path, key, label] of [['feedback', 'feedback', 'Feedback'], ['contact', 'contact', 'Message']]) {
    add('GET', `admin/${path}`, async () => ({ items: (await store.list(key)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }), 'admin');
    add('PUT', `admin/${path}/:id`, async (ctx) => {
      const v = validator();
      const status = v.oneOf(ctx.body.status, 'status', TICKET_STATUSES, { required: true, label: 'Status' });
      v.done();
      const updated = await store.update(key, ctx.params.id, { status, updatedAt: iso() });
      if (!updated) throw new HttpError(404, `${label} not found.`);
      await audit(ctx, `admin_${key}_status`, key, ctx.params.id, status);
      return { item: updated };
    }, 'admin');
    add('DELETE', `admin/${path}/:id`, async (ctx) => {
      if (!await store.remove(key, ctx.params.id)) throw new HttpError(404, `${label} not found.`);
      await audit(ctx, `admin_${key}_delete`, key, ctx.params.id);
      return { ok: true };
    }, 'admin');
  }

  add('GET', 'admin/activity', async (ctx) => {
    const lim = Math.min(2000, Math.max(10, Number(ctx.query.limit) || 300));
    const rows = (await store.list('activity')).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, lim);
    return { items: rows };
  }, 'admin');

  add('GET', 'admin/export/:sheet', async (ctx) => {
    const key = ctx.params.sheet;
    if (!SHEETS[key]) throw new HttpError(404, 'Unknown data set.');
    let rows;
    if (key === 'recipes') rows = (await loadRecipes({ all: true })).map(recipeToRow);
    else if (key === 'ingredients') rows = await loadIngredients();
    else if (key === 'mealPlans') rows = await loadPlans();
    else rows = await store.list(key);
    rows = rows.map((r) => publicRow(key, r));
    const columns = SHEETS[key].columns.map((c) => c.name).filter((c) => !(SHEETS[key].private || []).includes(c));
    await audit(ctx, 'admin_export', key, '', `${rows.length} rows`);
    return { title: SHEETS[key].title, columns, rows };
  }, 'admin');

  add('POST', 'admin/seed', async (ctx) => {
    const result = {};
    const t = iso();
    let tabsCreated = [];
    if (typeof store.setup === 'function') tabsCreated = (await store.setup()).created || [];
    const plan = [['recipes', (seed.recipes || []).map(recipeToRow)], ['ingredients', seed.ingredients || []], ['mealPlans', seed.mealPlans || []]];
    for (const [key, rows] of plan) {
      const have = new Set((await store.list(key)).map((r) => r.id));
      const missing = rows.filter((r) => !have.has(r.id)).map((r) => ({ ...r, createdAt: t, updatedAt: t }));
      if (missing.length) await store.insertMany(key, missing);
      result[key] = missing.length;
    }
    const haveContent = new Set((await store.list('content')).map((r) => r.id));
    const contentRows = Object.entries(seed.content || {}).filter(([k]) => !haveContent.has(k)).map(([id, value]) => ({ id, value, updatedAt: t }));
    if (contentRows.length) await store.insertMany('content', contentRows);
    result.content = contentRows.length;
    await audit(ctx, 'admin_seed', 'all', '', { ...result, tabsCreated: tabsCreated.length });
    return { inserted: result, tabsCreated };
  }, 'admin');

  // ---------- dispatcher ----------
  function match(method, segments) {
    for (const r of routes) {
      if (r.method !== method || r.parts.length !== segments.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < r.parts.length; i++) {
        const p = r.parts[i];
        if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segments[i]);
        else if (p !== segments[i]) { ok = false; break; }
      }
      if (ok) return { route: r, params };
    }
    return null;
  }

  async function handle({ method = 'GET', path = '', query = {}, body = {}, token = '', ip = '', userAgent = '' }) {
    const segments = String(path).replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const m = match(method.toUpperCase(), segments);
    if (!m) return { status: 404, body: { error: 'Not found.' } };
    let session = null;
    if (token) { try { session = await crypto.verifyToken(token); } catch { session = null; } }
    const ctx = { method, params: m.params, query: query || {}, body: body && typeof body === 'object' ? body : {}, session, ip, userAgent };
    try {
      if (m.route.auth && !session) throw new HttpError(401, 'Please log in to continue.');
      if (m.route.auth === 'admin' && session.role !== 'admin') throw new HttpError(403, 'Only admins can do that.');
      const out = await m.route.handler(ctx);
      if (out && out.__reply) return { status: out.status || 200, body: out.body, session: out.session };
      return { status: 200, body: out };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, body: { error: e.message, ...(e.details || {}) } };
      if (typeof console !== 'undefined') console.error('[api]', method, path, e);
      return { status: 500, body: { error: 'Something went wrong on our side. Please try again in a minute.' } };
    }
  }

  return { handle, routes: routes.map((r) => `${r.method} ${r.parts.join('/')}${r.auth ? ` [${r.auth}]` : ''}`) };
}
