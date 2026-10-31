// Login, registration, forgot-password and reset-password pages.
import { api, apiMode } from '../core/api.js';
import { setUser, state } from '../core/state.js';
import { link, navigate } from '../core/router.js';
import { esc, storage } from '../core/utils.js';
import { icon } from '../ui/icons.js';
import { logoSvg } from '../ui/art.js';
import { field, formData, showErrors, busy, toast } from '../ui/components.js';
import { setSeo } from '../core/seo.js';
import { track } from '../core/analytics.js';

const TITLES = { login: 'Log in', register: 'Create your account', forgot: 'Reset your password', reset: 'Choose a new password' };

export default async function render(view, { route, params, query, path }) {
  const form = route.form;
  setSeo({ path, title: TITLES[form], description: 'Sign in to track meals, save favourites and follow your meal plan.' });
  if (state.user && (form === 'login' || form === 'register')) { navigate(storage.get('next') || '/dashboard', { replace: true }); storage.remove('next'); return; }
  const token = params.token || query.token || '';
  let demoHint = '';
  if (apiMode() === 'demo' && form === 'login') {
    const { DEMO_ACCOUNTS } = await import('../core/demo.js');
    demoHint = `<div class="alert info small"><b>Preview sign-ins.</b> Admin: <code>${esc(DEMO_ACCOUNTS.admin.username)}</code> / <code>${esc(DEMO_ACCOUNTS.admin.password)}</code>. Sample member: <code>${esc(DEMO_ACCOUNTS.member.email)}</code> / <code>${esc(DEMO_ACCOUNTS.member.password)}</code>. On the live site the admin password comes from server environment variables.</div>`;
  }

  const bodies = {
    login: `${field({ id: 'identifier', label: 'Email or admin username', attrs: 'autocomplete="username" required autofocus' })}
      <div class="field" data-field="password"><div class="row" style="justify-content:space-between"><label for="password">Password</label><a class="small" href="${link('/forgot-password')}">Forgot password?</a></div><div class="pw-wrap"><input class="input" id="password" name="password" type="password" autocomplete="current-password" required><button class="pw-toggle" type="button" aria-label="Show password">${icon('eye')}</button></div><span class="error" hidden></span></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Log in</button>
      <p class="center small">New here? <a href="${link('/register')}">Create an account</a></p>`,
    register: `${field({ id: 'name', label: 'Full name', attrs: 'autocomplete="name" required autofocus' })}
      ${field({ id: 'email', label: 'Email', type: 'email', attrs: 'autocomplete="email" required' })}
      <div class="field" data-field="password"><label for="password">Password</label><div class="pw-wrap"><input class="input" id="password" name="password" type="password" autocomplete="new-password" required minlength="8"><button class="pw-toggle" type="button" aria-label="Show password">${icon('eye')}</button></div><span class="hint">At least 8 characters with a letter and a number.</span><div class="pw-meter" aria-hidden="true"><i></i></div><span class="error" hidden></span></div>
      ${field({ id: 'goal', label: 'Main goal', type: 'select', value: 'Fat loss and muscle gain', options: ['Fat loss and muscle gain', 'Fat loss', 'Muscle gain', 'Maintain weight', 'Eat healthier'] })}
      <button class="btn btn-primary btn-lg btn-block" type="submit">Create account</button>
      <p class="center small">Already have an account? <a href="${link('/login')}">Log in</a></p>`,
    forgot: `<p class="muted">Enter the email you registered with. We will send a link to set a new password.</p>
      ${field({ id: 'email', label: 'Email', type: 'email', attrs: 'autocomplete="email" required autofocus' })}
      <button class="btn btn-primary btn-lg btn-block" type="submit">Send reset link</button>
      <p class="center small"><a href="${link('/login')}">Back to log in</a></p>`,
    reset: token ? `<input type="hidden" name="token" value="${esc(token)}">
      <div class="field" data-field="password"><label for="password">New password</label><div class="pw-wrap"><input class="input" id="password" name="password" type="password" autocomplete="new-password" required minlength="8" autofocus><button class="pw-toggle" type="button" aria-label="Show password">${icon('eye')}</button></div><span class="hint">At least 8 characters with a letter and a number.</span><div class="pw-meter" aria-hidden="true"><i></i></div><span class="error" hidden></span></div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">Save new password</button>`
      : `<div class="alert error">This reset link is incomplete. <a href="${link('/forgot-password')}">Request a new one</a>.</div>`,
  };

  view.innerHTML = `<div class="auth-wrap">
    <div class="auth-side" aria-hidden="true">
      ${logoSvg('auth-logo')}
      <p class="auth-quote">“Eat to the plan. Train to the plan.”</p>
      <ul><li>${icon('check')}55 recipes with steps and timers</li><li>${icon('check')}One-tap meal tracking</li><li>${icon('check')}Weekly and monthly progress</li></ul>
    </div>
    <form class="auth-card stack" id="auth-form" novalidate>
      <h1>${TITLES[form]}</h1>
      ${demoHint}
      ${bodies[form]}
    </form>
  </div>`;

  const f = view.querySelector('#auth-form');
  f.addEventListener('click', (e) => {
    const t = e.target.closest('.pw-toggle');
    if (!t) return;
    const input = t.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
    t.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
  });
  const meter = f.querySelector('.pw-meter i');
  if (meter) f.querySelector('#password').addEventListener('input', (e) => {
    const v = e.target.value;
    const score = [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v), v.length >= 12].filter(Boolean).length;
    meter.style.width = `${(score / 5) * 100}%`;
    meter.dataset.level = score <= 2 ? 'weak' : score <= 3 ? 'ok' : 'strong';
  });

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    if (!btn) return;
    await busy(btn, async () => {
      try {
        const data = formData(f);
        if (form === 'login') {
          const { user } = await api.post('auth/login', data);
          setUser(user);
          track('login');
          toast(`Welcome back, ${user.name.split(' ')[0]}`);
          const next = storage.get('next');
          storage.remove('next');
          navigate(next || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
        } else if (form === 'register') {
          const { user } = await api.post('auth/register', data);
          setUser(user);
          track('signup');
          toast('Account created. Your dashboard is ready.');
          navigate('/dashboard', { replace: true });
        } else if (form === 'forgot') {
          const res = await api.post('auth/forgot', data);
          showErrors(f, null);
          f.innerHTML = `<h1>Check your email</h1><div class="alert success">${esc(res.message)}</div>${res.devResetToken ? `<div class="alert info small"><b>Preview mode:</b> no email is sent here. <a href="${link(`/reset-password?token=${res.devResetToken}`)}">Open your reset link</a>.</div>` : ''}<p class="center small"><a href="${link('/login')}">Back to log in</a></p>`;
        } else if (form === 'reset') {
          const res = await api.post('auth/reset', data);
          toast(res.message);
          navigate('/login', { replace: true });
        }
      } catch (err) { showErrors(f, err); }
    });
  });
}
