// Production build: copies ./public to ./dist, injects environment settings, prerenders
// every recipe, category and plan page for search engines (title, meta, Open Graph,
// schema.org JSON-LD and readable HTML), writes sitemap.xml and the photo manifest.
//   npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './env.js';
import { RECIPES, CATEGORIES } from '../public/js/data/recipes/index.js';
import { MEAL_PLANS, SLOTS } from '../public/js/data/plans.js';
import { DEFAULT_CONTENT } from '../public/js/data/seed.js';
import { recipeJsonLd } from '../public/js/shared/structured-data.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(root);
const SRC = path.join(root, 'public');
const OUT = path.join(root, 'dist');

const siteUrl = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`)
  || 'http://localhost:3000').replace(/\/$/, '');
const gaId = process.env.GA_MEASUREMENT_ID || '';
const verification = process.env.GOOGLE_SITE_VERIFICATION || '';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 1. Copy
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(SRC, OUT, { recursive: true });

// 2. Photo manifest: drop <id>.jpg|png|webp into public/images/recipes or /ingredients
const photoManifest = { recipes: {}, ingredients: {} };
for (const kind of ['recipes', 'ingredients']) {
  const dir = path.join(OUT, 'images', kind);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^([\w-]+)\.(jpe?g|png|webp|avif)$/i);
    if (m) photoManifest[kind][m[1]] = f;
  }
}
fs.writeFileSync(path.join(OUT, 'images', 'manifest.json'), JSON.stringify(photoManifest, null, 2));

// 3. Template with environment values
let template = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8')
  .replaceAll('%SITE_URL%', siteUrl)
  .replaceAll('%GA_MEASUREMENT_ID%', gaId)
  .replaceAll('%GOOGLE_SITE_VERIFICATION%', verification);
if (!gaId) template = template.replace(/\s*<meta name="ga-measurement-id"[^>]*>/, '');
if (!verification) template = template.replace(/\s*<meta name="google-site-verification"[^>]*>/, '');
fs.writeFileSync(path.join(OUT, 'index.html'), template.replace('<!--PRERENDER_HEAD-->', '').replace('<!--PRERENDER_BODY-->', ''));

function page({ urlPath, title, description, body, jsonld, type = 'website' }) {
  const full = `${title} | ${DEFAULT_CONTENT.siteName}`;
  const url = `${siteUrl}${urlPath}`;
  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(full)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${esc(url)}">`)
    .replace(/<meta property="og:type" content="[^"]*">/, `<meta property="og:type" content="${type}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(full)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(url)}">`);
  const head = jsonld ? `<script type="application/ld+json" id="page-ld">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : '';
  html = html.replace('<!--PRERENDER_HEAD-->', head).replace('<!--PRERENDER_BODY-->', `<div class="prerender" style="max-width:860px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">${body}</div>`);
  const file = path.join(OUT, `${urlPath.replace(/^\//, '')}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// 4. Recipe pages
for (const r of RECIPES) {
  const n = r.nutrition;
  const body = `<article><h1>${esc(r.name)}</h1><p>${esc(r.summary)}</p>
    <p><strong>Meal:</strong> ${esc(r.mealType)} &middot; <strong>Serving:</strong> ${esc(r.serving)} &middot; <strong>Prep:</strong> ${r.prep ?? 'Not Specified'} min &middot; <strong>Cook:</strong> ${r.cook ?? 'Not Specified'} min</p>
    <p><strong>Approximate nutrition per serving:</strong> ${n.calories} kcal, ${n.protein} g protein, ${n.carbs} g carbohydrates, ${n.fat} g fat.</p>
    <h2>Ingredients</h2><ul>${r.ingredients.map((i) => `<li>${esc(i.qty)} ${esc(i.name)}${i.note ? ` (${esc(i.note)})` : ''}</li>`).join('')}</ul>
    <h2>Steps</h2><ol>${r.steps.map((s) => `<li><strong>${esc(s.title)}.</strong> ${esc(s.text)}</li>`).join('')}</ol>
    <h2>Storage</h2><p>${esc(r.storage)}</p>
    <h2>Tips</h2><ul>${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    <h2>Mistakes to avoid</h2><ul>${r.mistakes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></article>`;
  page({ urlPath: `/recipe/${r.id}`, title: r.name, description: `${r.summary} ${n.calories} kcal and ${n.protein} g protein per serving.`, body, jsonld: recipeJsonLd(r, `${siteUrl}/recipe/${r.id}`), type: 'article' });
}

// 5. Category and listing pages
for (const c of [...CATEGORIES, { id: 'all', label: 'All recipes', path: '/recipes', blurb: 'Every recipe in the plan.' }]) {
  const list = c.id === 'all' ? RECIPES : RECIPES.filter((r) => r.category === c.id);
  const body = `<h1>${esc(c.label)}</h1><p>${esc(c.blurb)}</p><ul>${list.map((r) => `<li><a href="/recipe/${r.id}">${esc(r.name)}</a> &middot; ${r.nutrition.calories} kcal, ${r.nutrition.protein} g protein</li>`).join('')}</ul>`;
  page({
    urlPath: c.path,
    title: c.label,
    description: `${c.blurb} ${list.length} South Indian recipes with ingredients, steps and nutrition.`,
    body,
    jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: c.label, itemListElement: list.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${siteUrl}/recipe/${r.id}`, name: r.name })) },
  });
}

// 6. Meal plan pages
page({ urlPath: '/meal-plans', title: 'Meal Plans', description: 'A 7-day low-carb, high-protein South Indian week and the trainer\u2019s original daily plan.', body: `<h1>Meal plans</h1><ul>${MEAL_PLANS.map((p) => `<li><a href="/meal-plans/${p.id}">${esc(p.name)}</a>: ${esc(p.summary)}</li>`).join('')}</ul>` });
for (const p of MEAL_PLANS) {
  const body = `<h1>${esc(p.name)}</h1><p>${esc(p.summary)}</p>${p.days.map((d) => `<h2>${esc(d.label)}</h2><ul>${SLOTS.filter((s) => d.slots[s.id]?.length).map((s) => `<li><strong>${esc(s.time)} ${esc(s.label)}:</strong> ${d.slots[s.id].map((it) => { const r = RECIPES.find((x) => x.id === it.id); return r ? `<a href="/recipe/${r.id}">${esc(r.name)}</a>` : ''; }).join(', ')}</li>`).join('')}</ul>`).join('')}`;
  page({ urlPath: `/meal-plans/${p.id}`, title: p.name, description: p.summary, body });
}

// 7. Sitemap and robots
const today = new Date().toISOString().slice(0, 10);
const urls = ['/', '/recipes', ...CATEGORIES.map((c) => c.path), '/meal-plans', ...MEAL_PLANS.map((p) => `/meal-plans/${p.id}`), ...RECIPES.map((r) => `/recipe/${r.id}`)];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${siteUrl}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod><changefreq>${u.startsWith('/recipe/') ? 'monthly' : 'weekly'}</changefreq><priority>${u === '/' ? '1.0' : u.startsWith('/recipe/') ? '0.7' : '0.8'}</priority></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

const photos = Object.keys(photoManifest.recipes).length + Object.keys(photoManifest.ingredients).length;
console.log(`Built dist/ for ${siteUrl}: ${RECIPES.length} recipe pages, ${CATEGORIES.length + 1} category pages, ${MEAL_PLANS.length + 1} plan pages, ${urls.length} sitemap URLs, ${photos} photos.${gaId ? ' GA4 on.' : ''}`);
