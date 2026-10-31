// Reusable UI pieces: cards, toasts, modals, confirm dialogs, forms, confetti.
import { esc, fmt, $$ } from '../core/utils.js';
import { link } from '../core/router.js';
import { icon } from './icons.js';
import { recipeMedia } from './art.js';
import { isFav, toggleFavourite, state } from '../core/state.js';
import { track } from '../core/analytics.js';
import { CATEGORY_MAP } from '../data/recipes/index.js';

export function macroPills(n, { compact = false } = {}) {
  if (!n) return '';
  const p = (cls, v, short, label, unit) => (v === null || v === undefined ? '' : `<span class="pill ${cls}" title="${label}"><span class="dot"></span>${compact && short ? `<b>${short}</b>` : ''}${fmt.n(v, unit === 'kcal' ? 0 : 1)} ${unit}${compact ? '' : unit === 'kcal' ? '' : ` ${label.toLowerCase()}`}</span>`);
  return `<div class="macro-pills">${p('kcal', n.calories, '', 'Calories', 'kcal')}${p('protein', n.protein, 'P', 'Protein', 'g')}${p('carbs', n.carbs, 'C', 'Carbs', 'g')}${p('fat', n.fat, 'F', 'Fat', 'g')}</div>`;
}

export function favButton(id, name) {
  const on = isFav(id);
  return `<button type="button" class="fav-btn" data-fav="${esc(id)}" aria-pressed="${on}" aria-label="${on ? 'Remove' : 'Save'} ${esc(name)} ${on ? 'from' : 'to'} favourites">${icon('heart')}</button>`;
}

export function recipeCard(r, { showCategory = true } = {}) {
  const total = (r.prep || 0) + (r.cook || 0);
  return `<article class="recipe-card" style="--art:${esc(r.art.colors[0])}">
    ${favButton(r.id, r.name)}
    <a href="${link(`/recipe/${r.id}`)}" class="card-link" style="color:inherit;text-decoration:none;display:flex;flex-direction:column;flex:1">
      <div class="art">${recipeMedia(r)}</div>
      ${showCategory ? `<span class="card-tag">${esc(CATEGORY_MAP[r.category]?.label || r.mealType)}</span>` : ''}
      <div class="body">
        <h3>${esc(r.name)}</h3>
        ${macroPills(r.nutrition, { compact: true })}
        <div class="meta"><span>${icon('clock')}${fmt.mins(total)}</span><span>${icon('chef')}${esc(r.difficulty)}</span><span title="Serving">${icon('bowl')}${esc(r.serving.split('(')[0].trim())}</span></div>
      </div>
    </a>
  </article>`;
}

// Favourite buttons anywhere inside root
export function bindFavourites(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-fav]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.fav;
    try {
      const on = await toggleFavourite(id);
      $$(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => { b.setAttribute('aria-pressed', on); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
      const name = state.recipeMap[id]?.name || 'Recipe';
      toast(on ? `Saved ${name} to favourites` : `Removed ${name} from favourites`, on ? 'heart' : 'check');
      track(on ? 'favourite_add' : 'favourite_remove', { recipeId: id });
    } catch (err) { toast(err.message, 'alert', 'error'); }
  });
}

// ---------- toasts ----------
export function toast(message, iconName = 'check', kind = '') {
  let root = document.querySelector('.toasts');
  if (!root) { root = document.createElement('div'); root.className = 'toasts'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite'); document.body.appendChild(root); }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 320); }, 3200);
}

// ---------- modal ----------
export function modal({ title, body = '', wide = false, onClose = null, labelledBy = 'modal-title' }) {
  const root = document.createElement('div');
  root.className = 'modal-root';
  root.innerHTML = `<div class="modal-backdrop" data-close></div><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}">
    <div class="modal-head"><h2 id="${labelledBy}" style="font-size:var(--step-2)">${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Close">${icon('x')}</button></div>
    <div class="modal-body">${body}</div></div>`;
  const prev = document.activeElement;
  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';
  const close = () => {
    root.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (prev && prev.focus) prev.focus();
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', root).filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', onKey);
  root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  setTimeout(() => (root.querySelector('input, select, textarea, .modal [data-autofocus], .modal button:not([data-close])') || root.querySelector('[data-close]'))?.focus(), 30);
  return { root, el: root.querySelector('.modal-body'), close };
}

// In-page confirmation (native confirm() is not used so it works everywhere)
export function confirmDialog(message, { title = 'Are you sure?', confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal({
      title,
      body: `<p class="muted" style="margin-bottom:20px">${esc(message)}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-no type="button">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes type="button">${esc(confirmLabel)}</button></div>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    m.el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; m.close(); resolve(true); });
    m.el.querySelector('[data-no]').addEventListener('click', () => { answered = true; m.close(); resolve(false); });
  });
}

// ---------- forms ----------
export function field({ id, label, type = 'text', value = '', hint = '', attrs = '', options = null, full = false }) {
  const v = esc(value ?? '');
  let control;
  if (type === 'select') control = `<select class="select" id="${id}" name="${id}" ${attrs}>${options.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
  else if (type === 'textarea') control = `<textarea class="textarea" id="${id}" name="${id}" ${attrs}>${v}</textarea>`;
  else control = `<input class="input" id="${id}" name="${id}" type="${type}" value="${v}" ${attrs}>`;
  return `<div class="field ${full ? 'full' : ''}" data-field="${id}"><label for="${id}">${esc(label)}</label>${control}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}<span class="error" hidden></span></div>`;
}

export function formData(form) {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
}

export function showErrors(form, err) {
  $$('.field', form).forEach((f) => { f.classList.remove('invalid'); const e = f.querySelector('.error'); if (e) { e.hidden = true; e.textContent = ''; } });
  let alertBox = form.querySelector('.form-alert');
  if (!alertBox) { alertBox = document.createElement('div'); alertBox.className = 'alert error form-alert'; alertBox.setAttribute('role', 'alert'); form.prepend(alertBox); }
  if (!err) { alertBox.remove(); return; }
  alertBox.textContent = err.message;
  if (err.fields) {
    let first = null;
    for (const [k, msg] of Object.entries(err.fields)) {
      const f = form.querySelector(`[data-field="${CSS.escape(k)}"]`) || form.querySelector(`[data-field="${CSS.escape(k.split('.').pop())}"]`);
      if (!f) continue;
      f.classList.add('invalid');
      const e = f.querySelector('.error');
      if (e) { e.hidden = false; e.textContent = msg; }
      if (!first) first = f.querySelector('input, select, textarea');
    }
    first?.focus();
  }
}

export async function busy(btn, fn) {
  btn.setAttribute('aria-busy', 'true');
  btn.disabled = true;
  try { return await fn(); } finally { btn.removeAttribute('aria-busy'); btn.disabled = false; }
}

// ---------- little extras ----------
export function emptyState({ title, text = '', action = '' , art = '' }) {
  return `<div class="empty">${art}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

export function confetti(count = 70) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#E8A317', '#1F6B45', '#B8381F', '#2B62A8', '#8DBE5A'];
  const root = document.createElement('div');
  root.className = 'confetti';
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`);
    p.style.setProperty('--rot', `${Math.random() * 720}deg`);
    p.style.setProperty('--dur', `${1.6 + Math.random() * 1.4}s`);
    p.style.animationDelay = `${Math.random() * 0.3}s`;
    root.appendChild(p);
  }
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 3500);
}

export function ripple(e) {
  const btn = e.target.closest('.btn');
  if (!btn || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const rect = btn.getBoundingClientRect();
  const s = Math.max(rect.width, rect.height);
  const r = document.createElement('span');
  r.className = 'ripple';
  r.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - rect.left - s / 2}px;top:${e.clientY - rect.top - s / 2}px`;
  btn.appendChild(r);
  setTimeout(() => r.remove(), 650);
}

export function skeletonCards(n = 6) {
  return `<div class="grid-cards">${Array.from({ length: n }, () => '<div class="recipe-card"><div class="art skeleton" style="border-radius:0"></div><div class="body"><div class="skeleton" style="height:20px;width:80%"></div><div class="skeleton" style="height:16px;width:60%"></div></div></div>').join('')}</div>`;
}

export function sectionHead(eyebrow, title, extra = '') {
  return `<div class="section-head"><div class="stack" style="gap:6px"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>${extra}</div>`;
}

export function toCsv(columns, rows) {
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(cell).join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n');
}
