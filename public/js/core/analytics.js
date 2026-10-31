// Analytics: Google Analytics 4 (when a measurement ID is configured) plus first-party
// events stored in the Analytics sheet for the admin dashboard.
import { api } from './api.js';
import { storage, loadScript } from './utils.js';

let queue = [];
let timer = null;
let gaId = '';
const ctx = { visitorId: '', sessionId: '', returning: false, device: 'desktop' };

function sessionStore(key, value) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    sessionStorage.setItem(key, value);
  } catch { /* storage blocked */ }
  return value;
}
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function initAnalytics(config = {}) {
  const existing = storage.get('visitor');
  ctx.visitorId = existing || rid();
  ctx.returning = Boolean(existing);
  if (!existing) storage.set('visitor', ctx.visitorId);
  const lastSeen = Number(sessionStore('pf-last') || 0);
  ctx.sessionId = (Date.now() - lastSeen < 30 * 60000 && sessionStore('pf-session')) || rid();
  sessionStore('pf-session', ctx.sessionId);
  sessionStore('pf-last', String(Date.now()));
  ctx.device = window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1025 ? 'tablet' : 'desktop';

  gaId = config.gaMeasurementId || document.querySelector('meta[name="ga-measurement-id"]')?.content || '';
  if (gaId && /^G-[A-Z0-9]+$/.test(gaId) && storage.get('analytics-consent', true) !== false) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag('js', new Date());
    window.gtag('config', gaId, { send_page_view: false, anonymize_ip: true });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${gaId}`).catch(() => {});
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('pagehide', flush);
}

const GA_NAMES = { recipe_view: 'view_item', favourite_add: 'add_to_wishlist', plan_save: 'select_promotion', signup: 'sign_up', login: 'login', search: 'search' };

export function track(event, props = {}) {
  sessionStore('pf-last', String(Date.now()));
  const ref = document.referrer && !document.referrer.includes(location.host) ? new URL(document.referrer).hostname : '';
  queue.push({ event, ...props, sessionId: ctx.sessionId, visitorId: ctx.visitorId, returning: ctx.returning, device: ctx.device, referrer: event === 'page_view' ? ref : '' });
  if (window.gtag && gaId) {
    if (event === 'page_view') window.gtag('event', 'page_view', { page_path: props.path, page_title: document.title });
    else window.gtag('event', GA_NAMES[event] || event, { search_term: props.query, item_id: props.recipeId, plan_id: props.planId });
  }
  if (queue.length >= 15) flush();
  else { clearTimeout(timer); timer = setTimeout(flush, 8000); }
}

export function flush() {
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  api.post('analytics/events', { events }).catch(() => { /* analytics never blocks the app */ });
}
