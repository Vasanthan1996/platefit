import { link } from '../core/router.js';
import { esc } from '../core/utils.js';
import { setSeo } from '../core/seo.js';

export default async function render(view, { path, message = '' }) {
  setSeo({ path, title: 'Page not found', description: 'This page does not exist.' });
  view.innerHTML = `<div class="empty" style="min-height:60vh;justify-content:center">
    <svg class="empty-art" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="80" fill="#EEF2F3" stroke="#C5CED2" stroke-width="2"/><circle cx="100" cy="100" r="62" fill="#F7F9F9"/><text x="100" y="114" text-anchor="middle" font-family="DM Mono, monospace" font-size="40" fill="#8A9A90">404</text></svg>
    <h1 style="font-size:var(--step-3)">Empty plate</h1>
    <p>${esc(message || `Nothing is served at ${path}.`)}</p>
    <div class="row" style="justify-content:center"><a class="btn btn-primary" href="${link('/')}">Go home</a><a class="btn" href="${link('/recipes')}">Browse recipes</a></div>
  </div>`;
}
