import { state, subscribe } from '../core/state.js';
import { link } from '../core/router.js';
import { recipeCard, emptyState } from '../ui/components.js';
import { dishSvg } from '../ui/art.js';
import { setSeo } from '../core/seo.js';
import { esc } from '../core/utils.js';

export default async function render(view, { path }) {
  setSeo({ path, title: 'Favourites', description: 'Recipes you saved.' });
  const draw = () => {
    const list = [...state.favourites].map((id) => state.recipeMap[id]).filter(Boolean);
    const suggestion = state.recipeMap['grilled-chicken'];
    view.innerHTML = `
      <div class="page-head"><div class="stack"><span class="eyebrow">Saved recipes</span><h1>Favourites</h1><p class="lede">${list.length ? `${list.length} recipe${list.length === 1 ? '' : 's'} saved${state.user ? ' to your account' : ' in this browser. Log in to keep them on every device'}.` : 'Tap the heart on any recipe to keep it here.'}</p></div>${list.length ? `<a class="btn" href="${link('/recipes')}">Browse more</a>` : ''}</div>
      ${list.length ? `<div class="grid-cards stagger">${list.map((r) => recipeCard(r)).join('')}</div>` : emptyState({
        art: `<svg class="empty-art" viewBox="0 0 200 200" aria-hidden="true">${dishSvg(suggestion).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`,
        title: 'Nothing saved yet',
        text: 'Start with the most-cooked recipe in the plan.',
        action: `<a class="btn btn-primary" href="${link(`/recipe/${suggestion.id}`)}">Open ${esc(suggestion.name)}</a>`,
      })}`;
  };
  draw();
  const off = subscribe((what) => { if (what === 'favourites' || what === 'user') draw(); });
  return off;
}
