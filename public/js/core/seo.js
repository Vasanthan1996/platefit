// Per-page title, description, Open Graph tags, canonical URL and JSON-LD.
import { state } from './state.js';

function meta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}

export function setSeo({ title, description, path = '/', image = '', type = 'website', jsonld = null }) {
  const site = state.content.siteName || 'PlateFit';
  const full = title ? `${title} | ${site}` : `${site}: Low-Carb, High-Protein South Indian Meal Planner`;
  document.title = full;
  const desc = description || state.content.heroSubtitle;
  const origin = (state.config.siteUrl || location.origin).replace(/\/$/, '');
  const url = `${origin}${path}`;
  meta('name', 'description', desc);
  meta('property', 'og:title', full);
  meta('property', 'og:description', desc);
  meta('property', 'og:type', type);
  meta('property', 'og:url', url);
  meta('property', 'og:site_name', site);
  meta('property', 'og:image', image || `${origin}/og-image.svg`);
  meta('name', 'twitter:card', 'summary_large_image');
  meta('name', 'twitter:title', full);
  meta('name', 'twitter:description', desc);
  let canon = document.head.querySelector('link[rel="canonical"]');
  if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
  canon.href = url;
  let ld = document.getElementById('page-ld');
  if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'page-ld'; document.head.appendChild(ld); }
  ld.textContent = jsonld ? JSON.stringify(jsonld) : '{}';
}

export { recipeJsonLd } from '../shared/structured-data.js';
