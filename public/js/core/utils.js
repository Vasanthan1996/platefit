// Small helpers used everywhere.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export const storage = {
  get(key, fallback = null) { try { const v = localStorage.getItem(`pf:${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`pf:${key}`, JSON.stringify(value)); } catch { /* blocked or full */ } },
  remove(key) { try { localStorage.removeItem(`pf:${key}`); } catch { /* ignore */ } },
};

export const fmt = {
  n(v, d = 0) { if (v === null || v === undefined || Number.isNaN(v)) return '–'; return Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 }); },
  g(v) { return v === null || v === undefined ? 'Not Specified' : `${fmt.n(v, 1)} g`; },
  kcal(v) { return v === null || v === undefined ? 'Not Specified' : `${fmt.n(v)} kcal`; },
  mins(m) { if (m === null || m === undefined) return 'Not Specified'; if (m < 60) return `${m} min`; const h = Math.floor(m / 60); const r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; },
  date(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) { return new Date(d).toLocaleDateString('en-IN', opts); },
  dateTime(d) { return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); },
  ago(d) {
    const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  },
};

// Local calendar date as YYYY-MM-DD (the user's day, not UTC)
export function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return isoDate(d);
}
export function isoDate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function addDays(dateStr, n) { const [y, m, d] = dateStr.split('-').map(Number); return isoDate(new Date(y, m - 1, d + n)); }
export function weekdayKey(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(y, m - 1, d).getDay()]; }

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';

// Seeded random for stable illustration layouts
export function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Scales the numbers in a quantity string ("1½ tsp (7 ml)") by a factor.
const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
function toNumber(whole, frac) { return (whole ? Number(whole) : 0) + (frac ? FRACTIONS[frac] : 0); }
function prettyNumber(n) {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  const pick = Object.entries(FRACTIONS).find(([, v]) => Math.abs(v - rest) < 0.04);
  if (rest < 0.04) return String(whole);
  if (pick) return `${whole || ''}${pick[0]}`;
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}
export function scaleQty(qty, factor) {
  if (!qty || factor === 1 || /^(a pinch|not specified)/i.test(qty)) return qty;
  return qty.replace(/(\d+(?:\.\d+)?)?([½¼¾⅓⅔])?(?!\s*(?:cm|°C|%|min|minutes?|h\b|hours?|whistles?|times?|days?))/g, (m, whole, frac) => {
    if (!whole && !frac) return m;
    return prettyNumber(toNumber(whole, frac) * factor);
  });
}

export function highlight(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return q ? safe.replace(new RegExp(`(${q})`, 'ig'), '<mark>$1</mark>') : safe;
}

export function downloadFile(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = resolve; s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
  });
}

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
