import { state, setUser, targets, activePlan, savedPlans } from '../core/state.js';
import { api } from '../core/api.js';
import { link, navigate } from '../core/router.js';
import { esc, fmt, storage, today, addDays, downloadFile, initials, $ } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { field, formData, showErrors, busy, toast, toCsv } from '../ui/components.js';
import { planAverages } from '../core/nutrition.js';
import { setSeo } from '../core/seo.js';

export default async function render(view, { path }) {
  setSeo({ path, title: 'Profile', description: 'Your details, daily targets and saved plans.' });
  if (!state.user) { storage.set('next', '/profile'); navigate('/login', { replace: true }); return; }

  const draw = () => {
    const u = state.user;
    const t = targets();
    const bmi = u.heightCm && u.weightKg ? u.weightKg / ((u.heightCm / 100) ** 2) : null;
    const bmiNote = bmi === null ? '' : bmi < 18.5 ? 'below the healthy range' : bmi < 23 ? 'in the healthy range for Asian adults' : bmi < 25 ? 'slightly above the healthy range for Asian adults' : 'above the healthy range';
    const plans = savedPlans();
    const active = activePlan();
    view.innerHTML = `
    <div class="profile-head panel">
      <span class="avatar avatar-lg">${esc(initials(u.name))}</span>
      <div class="stack" style="gap:4px;min-width:0"><h1 style="font-size:var(--step-3)">${esc(u.name)}</h1><p class="muted">${esc(u.email)}</p><div class="row"><span class="badge ${u.role === 'admin' ? 'warn' : 'info'}">${u.role === 'admin' ? 'Admin' : 'Member'}</span>${u.createdAt ? `<span class="badge">Joined ${fmt.date(u.createdAt)}</span>` : ''}<span class="badge ok">Following: ${esc(active.name)}</span></div></div>
      <button class="btn" type="button" id="logout">${icon('logout')}Log out</button>
    </div>
    <div class="grid-2" style="margin-top:var(--gap)">
      <form class="panel stack" id="profile-form" novalidate>
        <h2>Your details</h2>
        <div class="form-grid">
          ${field({ id: 'name', label: 'Name', value: u.name, full: true })}
          ${field({ id: 'goal', label: 'Goal', type: 'select', value: u.goal || 'Fat loss and muscle gain', options: ['Fat loss and muscle gain', 'Fat loss', 'Muscle gain', 'Maintain weight', 'Eat healthier', 'Run the platform'], full: true })}
          ${field({ id: 'heightCm', label: 'Height (cm)', type: 'number', value: u.heightCm ?? '', attrs: 'min="100" max="250" step="0.5"' })}
          ${field({ id: 'weightKg', label: 'Current weight (kg)', type: 'number', value: u.weightKg ?? '', attrs: 'min="25" max="300" step="0.1"' })}
          ${field({ id: 'targetWeightKg', label: 'Target weight (kg)', type: 'number', value: u.targetWeightKg ?? '', attrs: 'min="25" max="300" step="0.1"' })}
          <div class="field"><span class="label-text">BMI</span><p class="bmi"><b class="num">${bmi ? fmt.n(bmi, 1) : '–'}</b> <span class="muted small">${esc(bmiNote || 'Add height and weight')}</span></p></div>
        </div>
        <button class="btn btn-primary" type="submit" style="align-self:flex-start">Save details</button>
      </form>
      <form class="panel stack" id="targets-form" novalidate>
        <div class="panel-head" style="margin:0"><h2>Daily targets</h2><button class="btn btn-sm" type="button" id="use-plan">Use plan average</button></div>
        <p class="muted small">The dashboard rings and goals use these numbers. Agree them with your trainer.</p>
        <div class="form-grid">
          ${field({ id: 'targets.calories', label: 'Calories (kcal)', type: 'number', value: t.calories, attrs: 'min="800" max="6000"' })}
          ${field({ id: 'targets.protein', label: 'Protein (g)', type: 'number', value: t.protein, attrs: 'min="20" max="400"' })}
          ${field({ id: 'targets.carbs', label: 'Carbs (g)', type: 'number', value: t.carbs, attrs: 'min="20" max="800"' })}
          ${field({ id: 'targets.fat', label: 'Fat (g)', type: 'number', value: t.fat, attrs: 'min="10" max="300"' })}
          ${field({ id: 'targets.water', label: 'Water (litres)', type: 'number', value: t.water, attrs: 'min="0.5" max="10" step="0.25"' })}
        </div>
        <button class="btn btn-primary" type="submit" style="align-self:flex-start">Save targets</button>
      </form>
      ${u.passwordHash === undefined && u.id === 'admin' ? `<section class="panel stack"><h2>Password</h2><p class="muted">The admin password is managed through the <code>ADMIN_PASSWORD_HASH</code> environment variable on the server.</p></section>` : `<form class="panel stack" id="pw-form" novalidate><h2>Change password</h2>
        ${field({ id: 'current', label: 'Current password', type: 'password', attrs: 'autocomplete="current-password"' })}
        ${field({ id: 'next', label: 'New password', type: 'password', attrs: 'autocomplete="new-password"', hint: 'At least 8 characters with a letter and a number.' })}
        <button class="btn" type="submit" style="align-self:flex-start">Update password</button></form>`}
      <section class="panel stack">
        <h2>Saved plans</h2>
        ${plans.length ? `<ul class="saved-list">${plans.map((p) => `<li><a href="${link(`/meal-plans/${p.id}`)}">${esc(p.name)}</a>${p.active ? '<span class="badge ok">Following</span>' : ''}<span class="muted small">${fmt.date(p.savedAt)}</span></li>`).join('')}</ul>` : `<p class="muted">No saved plans. <a href="${link('/meal-plans')}">Pick one to follow</a>.</p>`}
        <h2 style="margin-top:8px">Your data</h2>
        <p class="muted small">Download every meal, water and weight entry from the last 12 months.</p>
        <button class="btn" type="button" id="export-logs" style="align-self:flex-start">${icon('download')}Download my log (CSV)</button>
      </section>
    </div>`;
  };
  draw();

  view.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    await busy(btn, async () => {
      try {
        const d = formData(form);
        if (form.id === 'profile-form') {
          const { user } = await api.put('auth/me', { name: d.name, goal: d.goal, heightCm: d.heightCm || null, weightKg: d.weightKg || null, targetWeightKg: d.targetWeightKg || null });
          setUser(user); toast('Details saved'); draw();
        } else if (form.id === 'targets-form') {
          const { user } = await api.put('auth/me', { targets: { calories: d['targets.calories'], protein: d['targets.protein'], carbs: d['targets.carbs'], fat: d['targets.fat'], water: d['targets.water'] } });
          setUser(user); toast('Targets saved', 'target'); draw();
        } else if (form.id === 'pw-form') {
          await api.post('auth/password', { current: d.current, next: d.next });
          form.reset(); showErrors(form, null); toast('Password updated', 'shield');
        }
      } catch (err) { showErrors(form, err); }
    });
  });
  view.addEventListener('click', async (e) => {
    if (e.target.closest('#logout')) {
      try { await api.post('auth/logout'); } catch { /* ignore */ }
      setUser(null); toast('You are logged out.'); navigate('/');
    }
    if (e.target.closest('#use-plan')) {
      const avg = planAverages(activePlan(), state.recipeMap);
      const form = $('#targets-form', view);
      form.querySelector('[name="targets.calories"]').value = Math.round(avg.calories / 50) * 50;
      form.querySelector('[name="targets.protein"]').value = Math.round(avg.protein / 5) * 5;
      form.querySelector('[name="targets.carbs"]').value = Math.round(avg.carbs / 10) * 10;
      form.querySelector('[name="targets.fat"]').value = Math.round(avg.fat / 5) * 5;
      toast('Filled from your plan. Save to apply.', 'info');
    }
    const ex = e.target.closest('#export-logs');
    if (ex) {
      await busy(ex, async () => {
        try {
          const { logs } = await api.get('logs', { from: addDays(today(), -365), to: today() });
          const cols = ['date', 'type', 'slot', 'recipeName', 'servings', 'calories', 'protein', 'carbs', 'fat', 'value'];
          downloadFile(`platefit-log-${today()}.csv`, toCsv(cols, logs), 'text/csv');
          toast(`Prepared ${logs.length} entries`, 'download');
        } catch (err) { toast(err.message, 'alert', 'error'); }
      });
    }
  });
}
