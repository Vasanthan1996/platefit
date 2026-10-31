// Built-in illustrations: every recipe and ingredient gets a drawn picture.
// A photo placed in /images/recipes/<id>.jpg (listed in images/manifest.json by the build)
// replaces the drawing automatically.
import { seeded, esc } from '../core/utils.js';

let photos = { recipes: {}, ingredients: {} };
export function setPhotoManifest(m) { if (m && typeof m === 'object') photos = { recipes: m.recipes || {}, ingredients: m.ingredients || {} }; }
let assetBase = '';
export function setAssetBase(b) { assetBase = b; }

const r1 = (n) => Math.round(n * 10) / 10;

function blob(cx, cy, r, rnd, points = 7, wobble = 0.28) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (1 - wobble / 2 + rnd() * wobble);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const n = pts[(i + 1) % pts.length];
    const mx = (p[0] + n[0]) / 2;
    const my = (p[1] + n[1]) / 2;
    d += i === 0 ? `M${r1((pts[pts.length - 1][0] + p[0]) / 2)},${r1((pts[pts.length - 1][1] + p[1]) / 2)}` : '';
    d += ` Q${r1(p[0])},${r1(p[1])} ${r1(mx)},${r1(my)}`;
  }
  return `${d} Z`;
}

// Random point inside a circle
function inCircle(rnd, cx, cy, r) {
  const a = rnd() * Math.PI * 2;
  const d = Math.sqrt(rnd()) * r;
  return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
}

function leafPath(x, y, s, rot) {
  return `<path d="M0,0 C${s * 0.5},${-s * 0.45} ${s * 1.1},${-s * 0.3} ${s * 1.3},0 C${s * 1.1},${s * 0.3} ${s * 0.5},${s * 0.45} 0,0 Z" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)})"/>`;
}

const shadow = '<ellipse cx="100" cy="186" rx="70" ry="8" fill="#000" opacity=".10"/>';
const plateBase = (rim = '#F3F0E8', inner = '#FBFAF6', edge = '#DDD7CA') => `${shadow}<circle cx="100" cy="100" r="88" fill="${rim}" stroke="${edge}" stroke-width="1.5"/><circle cx="100" cy="100" r="70" fill="${inner}"/>`;
const bananaLeaf = '<path d="M14 120 C40 60 120 36 190 52 C176 112 110 160 20 150 Z" fill="#3E8E3A"/><path d="M18 140 C70 110 130 76 186 56" stroke="#6CB55A" stroke-width="2.5" fill="none"/><path d="M60 118 l-14 18 M90 100 l-12 22 M120 84 l-8 22 M150 70 l-4 20" stroke="#5AA24C" stroke-width="1.2"/>';
const steelBowl = (r = 84) => `${shadow}<circle cx="100" cy="100" r="${r}" fill="url(#steel)"/><circle cx="100" cy="100" r="${r - 10}" fill="#B9C3C7"/>`;
const defs = (id) => `<defs><linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EEF2F3"/><stop offset=".5" stop-color="#B8C2C6"/><stop offset="1" stop-color="#E4E9EA"/></linearGradient><radialGradient id="g-${id}" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;

function pieces(rnd, cx, cy, r, colors, n, size = 7) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = inCircle(rnd, cx, cy, r);
    const c = colors[i % colors.length];
    const w = size * (0.7 + rnd() * 0.6);
    s += `<rect x="${r1(x - w / 2)}" y="${r1(y - w / 2)}" width="${r1(w)}" height="${r1(w * (0.75 + rnd() * 0.4))}" rx="${r1(w * 0.25)}" fill="${c}" transform="rotate(${r1(rnd() * 90)} ${r1(x)} ${r1(y)})"/>`;
  }
  return s;
}
function dots(rnd, cx, cy, r, color, n, size = 1.4) {
  let s = '';
  for (let i = 0; i < n; i++) { const [x, y] = inCircle(rnd, cx, cy, r); s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(size * (0.6 + rnd() * 0.8))}" fill="${color}"/>`; }
  return s;
}
function leaves(rnd, cx, cy, r, colors, n, size = 10) {
  let s = '';
  for (let i = 0; i < n; i++) { const [x, y] = inCircle(rnd, cx, cy, r); s += `<g fill="${colors[i % colors.length]}">${leafPath(x, y, size * (0.7 + rnd() * 0.6), rnd() * 360)}</g>`; }
  return s;
}
function chunks(rnd, cx, cy, r, colors, n, size = 13, char = '') {
  let s = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = inCircle(rnd, cx, cy, r);
    const sz = size * (0.8 + rnd() * 0.4);
    s += `<path d="${blob(x, y, sz, rnd, 6, 0.4)}" fill="${colors[i % colors.length]}"/>`;
    if (char) s += `<path d="M${r1(x - sz * 0.5)},${r1(y - sz * 0.2)} l${r1(sz)},${r1(-sz * 0.3)} M${r1(x - sz * 0.5)},${r1(y + sz * 0.3)} l${r1(sz)},${r1(-sz * 0.3)}" stroke="${char}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`;
  }
  return s;
}

// ---------------- dish drawings ----------------
function drawPlate(r, rnd) {
  const [c1, c2, c3] = r.art.colors;
  const it = r.art.items || '';
  let s = plateBase();
  if (it === 'chicken') {
    s += chunks(rnd, 100, 100, 42, [c1, c2], 7, 15, '#3A1A0C');
    s += `<g fill="#F2D94E"><path d="M128 66 a18 18 0 0 1 22 22 Z"/></g>`;
    s += leaves(rnd, 100, 100, 50, [c3], 5, 9);
    s += `<g fill="none" stroke="#C88AA6" stroke-width="2.5" opacity=".85"><circle cx="70" cy="132" r="9"/><circle cx="78" cy="140" r="6"/></g>`;
  } else if (it.startsWith('egg-halves')) {
    const yolk = it.endsWith('yolk');
    [[72, 82, -20], [124, 78, 25], [80, 128, 15], [128, 124, -30]].forEach(([x, y, a]) => {
      s += `<g transform="rotate(${a} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="24" ry="17" fill="#FFFFFF" stroke="#E8E1D2"/>${yolk ? `<circle cx="${x}" cy="${y}" r="10" fill="#F2B630"/><circle cx="${x - 3}" cy="${y - 3}" r="3" fill="#FAD776"/>` : `<ellipse cx="${x}" cy="${y}" rx="11" ry="8" fill="#F1ECE2"/>`}</g>`;
    });
    s += dots(rnd, 100, 100, 50, c3, 26, 1.1);
  } else if (it === 'rice-plate') {
    s += `<path d="M100 100 L100 32 A68 68 0 0 1 164.7 121 Z" fill="#FFFFFF" stroke="#ECE7DB"/>`;
    for (let i = 0; i < 70; i++) { const a = -Math.PI / 2 + rnd() * (Math.PI * 0.6); const d = 12 + rnd() * 52; const x = 100 + Math.cos(a) * d; const y = 100 + Math.sin(a) * d; s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="3" ry="1.3" fill="#EFE9DC" transform="rotate(${r1(rnd() * 180)} ${r1(x)} ${r1(y)})"/>`; }
    s += `<g>${pieces(rnd, 78, 112, 40, ['#4F9A3B', '#2F7D32', '#E8771E', '#8DBE5A'], 40, 7)}</g>`;
    s += `<text x="132" y="78" font-family="DM Mono, monospace" font-size="11" fill="#8A7F6A" text-anchor="middle">30%</text><text x="76" y="166" font-family="DM Mono, monospace" font-size="11" fill="#4F7A45" text-anchor="middle">70%</text>`;
  } else {
    s += `<path d="${blob(100, 100, 52, rnd, 9, 0.18)}" fill="${c1}"/>` + pieces(rnd, 100, 100, 44, [c2, c3], 20, 8);
  }
  return s;
}

function drawBowl(r, rnd) {
  const [c1, c2, c3] = r.art.colors;
  const it = r.art.items || 'salad';
  let s = steelBowl();
  const cx = 100, cy = 100, R = 66;
  const fill = (color) => `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${color}"/>`;
  switch (it) {
    case 'curry':
      s += fill(c1) + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#g-${r.id})"/>` + chunks(rnd, cx, cy, 44, [c2, c1], 7, 12, '') + dots(rnd, cx, cy, 56, '#F6C25B', 10, 2.6) + leaves(rnd, cx, cy, 50, [c3], 6, 8);
      break;
    case 'sambar':
      s += fill(c1) + `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#g-${r.id})"/>`;
      for (let i = 0; i < 4; i++) { const [x, y] = inCircle(rnd, cx, cy, 36); s += `<rect x="${r1(x - 18)}" y="${r1(y - 4)}" width="36" height="8" rx="4" fill="${c3}" transform="rotate(${r1(rnd() * 180)} ${r1(x)} ${r1(y)})"/>`; }
      s += chunks(rnd, cx, cy, 44, ['#B5577A', '#D9772E'], 6, 6) + leaves(rnd, cx, cy, 50, ['#2C6E2A'], 5, 7) + dots(rnd, cx, cy, 55, '#3B2A20', 14, 1.4);
      break;
    case 'poriyal':
      s += fill(c2) + pieces(rnd, cx, cy, 56, [c1, c1, c2], 110, 5.5) + dots(rnd, cx, cy, 56, c3, 50, 1.6) + dots(rnd, cx, cy, 56, '#3B2A20', 18, 1.2) + leaves(rnd, cx, cy, 50, ['#2C6E2A'], 4, 8);
      break;
    case 'greens':
      s += fill(c1) + leaves(rnd, cx, cy, 54, [c1, c2, '#2A5E2A'], 46, 11) + dots(rnd, cx, cy, 55, c3, 22, 1.8);
      break;
    case 'sundal':
      for (let i = 0; i < 95; i++) { const [x, y] = inCircle(rnd, cx, cy, 60); s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(5 + rnd() * 2)}" fill="${i % 7 === 0 ? c2 : c1}" stroke="#00000018"/>`; if (it === 'sundal' && c2 === '#2C2C2C' && i % 3 === 0) s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="1.6" fill="#2C2C2C"/>`; }
      s += leaves(rnd, cx, cy, 50, [c3], 5, 9) + dots(rnd, cx, cy, 56, '#F4F0E6', 18, 2.2);
      break;
    case 'dal':
      s += fill(c1) + `<path d="M70 98 c10 -18 40 -18 50 0 s30 18 40 0" stroke="${c2}" stroke-width="5" fill="none" opacity=".7"/>` + dots(rnd, cx, cy, 30, '#7A4E25', 14, 1.6) + dots(rnd, cx, cy, 34, '#C8402A', 3, 3) + leaves(rnd, cx, cy, 40, [c3], 4, 8);
      break;
    case 'rice':
      s += fill(c1);
      for (let i = 0; i < 140; i++) { const [x, y] = inCircle(rnd, cx, cy, 60); s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="3.4" ry="1.5" fill="${i % 3 ? c2 : c3}" transform="rotate(${r1(rnd() * 180)} ${r1(x)} ${r1(y)})"/>`; }
      break;
    default: // salad
      s += fill('#EAF2DC') + leaves(rnd, cx, cy, 56, ['#8DBE5A', '#5E9B3A'], 10, 14) + pieces(rnd, cx, cy, 52, [c1, c2, c3], 46, 9) + dots(rnd, cx, cy, 54, '#2E2A27', 14, 1.1);
  }
  return s;
}

function drawCup(r, rnd) {
  const [c1, c2, c3] = r.art.colors;
  if (r.art.items === 'chutney') {
    return `${shadow}<ellipse cx="100" cy="110" rx="80" ry="64" fill="url(#steel)"/><ellipse cx="100" cy="106" rx="66" ry="50" fill="${c1}"/><ellipse cx="88" cy="96" rx="28" ry="12" fill="${c2}" opacity=".55"/>${dots(rnd, 100, 106, 40, c3, 16, 2)}${dots(rnd, 100, 106, 40, '#3B2A20', 10, 1.4)}`;
  }
  return `${shadow}<ellipse cx="100" cy="168" rx="70" ry="14" fill="#E9E4D8" stroke="#D6CFBF"/>
    <path d="M52 82 h96 v40 a48 48 0 0 1 -96 0 Z" fill="#FFFFFF" stroke="#DCD5C6" stroke-width="2"/>
    <path d="M148 94 c26 0 26 34 0 34" fill="none" stroke="#DCD5C6" stroke-width="8"/>
    <ellipse cx="100" cy="84" rx="46" ry="9" fill="${c1}"/><ellipse cx="92" cy="83" rx="18" ry="3" fill="${c2}" opacity=".6"/>
    <g class="steam" stroke="${c3}" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"><path d="M84 66 c-8 -10 8 -16 0 -28"/><path d="M100 64 c-8 -10 8 -16 0 -30"/><path d="M116 66 c-8 -10 8 -16 0 -28"/></g>`;
}

function drawGlass(r, rnd) {
  const [c1, c2, c3] = r.art.colors;
  let bubbles = '';
  for (let i = 0; i < 8; i++) bubbles += `<circle cx="${r1(76 + rnd() * 48)}" cy="${r1(90 + rnd() * 70)}" r="${r1(1.5 + rnd() * 2.5)}" fill="#fff" opacity=".6"/>`;
  return `${shadow}<path d="M62 30 h76 l-8 146 a8 8 0 0 1 -8 7 h-44 a8 8 0 0 1 -8 -7 Z" fill="#FFFFFF" fill-opacity=".55" stroke="#CDD6D9" stroke-width="2.5"/>
    <path d="M67 70 h66 l-5.5 104 a6 6 0 0 1 -6 5 h-43 a6 6 0 0 1 -6 -5 Z" fill="${c1}" stroke="${c2}"/>
    <path d="M67 70 h66" stroke="${c2}" stroke-width="3"/>${bubbles}
    <path d="M74 40 l6 130" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <circle cx="138" cy="60" r="14" fill="${c3}" opacity=".85"/><circle cx="138" cy="60" r="9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>`;
}

function drawStack(r, rnd) {
  const [c1, c2, c3] = r.art.colors;
  let s = `${shadow}${bananaLeaf}`;
  [[64, 108], [104, 96], [144, 110], [104, 128]].forEach(([x, y]) => {
    s += `<ellipse cx="${x}" cy="${y + 8}" rx="30" ry="12" fill="${c2}"/><path d="M${x - 30} ${y + 8} q30 -34 60 0 q-30 10 -60 0 Z" fill="${c1}"/><ellipse cx="${x - 6}" cy="${y - 4}" rx="9" ry="3" fill="#fff" opacity=".7"/>`;
    s += dots(rnd, x, y + 2, 16, '#E5DCC8', 6, 1.2);
  });
  s += `<ellipse cx="160" cy="150" rx="22" ry="10" fill="url(#steel)"/><ellipse cx="160" cy="148" rx="17" ry="7" fill="${c3}"/>`;
  return s;
}

function drawFlat(r, rnd) {
  const [c1, c2, c3] = r.art.colors;
  let s = plateBase('#EEF2F3', '#E2E8EA', '#C5CED2');
  if (r.art.items === 'dosa') {
    s += `<path d="M30 112 Q100 28 172 92 Q132 150 30 112 Z" fill="${c1}"/><path d="M30 112 Q100 28 172 92" fill="none" stroke="${c3}" stroke-width="3" opacity=".6"/>`;
    for (let i = 0; i < 26; i++) { const x = 50 + rnd() * 110; const y = 78 + rnd() * 40; s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(2 + rnd() * 4)}" ry="${r1(1 + rnd() * 2)}" fill="${c3}" opacity=".45"/>`; }
    s += `<path d="M44 108 Q100 46 160 92" fill="none" stroke="${c2}" stroke-width="6" opacity=".6"/>`;
  } else {
    [[0, 0], [6, -8], [12, -16]].forEach(([dx, dy], i) => {
      s += `<circle cx="${100 + dx}" cy="${104 + dy}" r="56" fill="${i === 2 ? c1 : c2}" stroke="${c3}" stroke-opacity=".25"/>`;
    });
    for (let i = 0; i < 26; i++) { const [x, y] = inCircle(rnd, 112, 88, 46); s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(2 + rnd() * 5)}" ry="${r1(1.5 + rnd() * 3)}" fill="${c3}" opacity="${r1(0.25 + rnd() * 0.35)}"/>`; }
  }
  return s;
}

function drawFruit(r, rnd) {
  const [c1, c2, c3] = r.art.colors;
  const leaf = (x, y, rot = -30) => `<g fill="#5E8A2E">${leafPath(x, y, 22, rot)}</g>`;
  switch (r.art.items) {
    case 'apple':
      return `${shadow}<path d="M100 62 C70 40 34 58 40 104 C46 150 76 176 100 166 C124 176 154 150 160 104 C166 58 130 40 100 62 Z" fill="${c1}"/><path d="M62 82 C58 100 62 122 72 138" stroke="#fff" stroke-opacity=".35" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M100 64 C100 50 104 40 112 32" stroke="#6B4423" stroke-width="5" fill="none" stroke-linecap="round"/>${leaf(110, 40)}`;
    case 'guava':
      return `${shadow}<circle cx="78" cy="108" r="54" fill="${c1}"/>${dots(rnd, 78, 108, 46, '#6E9A2E', 18, 1.8)}<circle cx="138" cy="122" r="40" fill="#E9F2D6"/><circle cx="138" cy="122" r="32" fill="${c2}"/>${dots(rnd, 138, 122, 22, '#F7E7C9', 22, 2)}${leaf(70, 56, -60)}`;
    case 'papaya':
      return `${shadow}<path d="M28 108 C28 64 70 44 112 52 C162 60 182 98 168 130 C152 166 60 170 28 108 Z" fill="#7FA23B"/><path d="M40 108 C42 72 76 58 112 64 C152 72 166 100 156 124 C142 154 66 156 40 108 Z" fill="${c1}"/><path d="M70 100 C76 86 104 80 126 90 C140 98 134 120 112 124 C90 128 66 118 70 100 Z" fill="${c2}"/>${dots(rnd, 102, 104, 18, c3, 26, 3)}`;
    case 'orange':
      return `${shadow}<circle cx="76" cy="104" r="54" fill="${c1}"/>${dots(rnd, 76, 104, 48, '#E07A10', 30, 1.2)}<circle cx="142" cy="128" r="38" fill="#FFE3B5"/><circle cx="142" cy="128" r="32" fill="${c2}"/>${Array.from({ length: 8 }, (_, i) => `<path d="M142 128 L${r1(142 + Math.cos(i * Math.PI / 4) * 30)} ${r1(128 + Math.sin(i * Math.PI / 4) * 30)}" stroke="#FFE3B5" stroke-width="2.5"/>`).join('')}${leaf(80, 52, -50)}`;
    case 'pomegranate':
      return `${shadow}<circle cx="80" cy="106" r="54" fill="${c1}"/><path d="M68 54 l6 -16 l6 10 l6 -10 l6 16 Z" fill="${c3}"/><path d="M50 86 C48 104 54 124 68 136" stroke="#fff" stroke-opacity=".3" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="142" cy="128" r="38" fill="#F6E4D2"/>${Array.from({ length: 40 }, () => { const [x, y] = inCircle(rnd, 142, 128, 30); return `<circle cx="${r1(x)}" cy="${r1(y)}" r="3.6" fill="${c2}" stroke="${c1}" stroke-width="1"/>`; }).join('')}`;
    case 'watermelon':
      return `${shadow}${[[40, 0], [96, 10]].map(([x, d]) => `<g transform="translate(${x} ${30 + d})"><path d="M0 40 L70 40 L35 130 Z" fill="${c1}" transform="rotate(180 35 85)"/><path d="M-4 130 h78" stroke="${c2}" stroke-width="10" stroke-linecap="round" transform="translate(0 -88)"/>${Array.from({ length: 6 }, () => `<ellipse cx="${r1(20 + rnd() * 30)}" cy="${r1(70 + rnd() * 50)}" rx="2" ry="3.4" fill="${c3}"/>`).join('')}</g>`).join('')}`;
    case 'grapes':
      return `${shadow}<path d="M100 40 C100 30 108 24 116 22" stroke="#6B4423" stroke-width="5" fill="none" stroke-linecap="round"/>${leaf(112, 30, -10)}${[[100, 56], [84, 70], [116, 70], [70, 88], [100, 86], [130, 88], [84, 104], [116, 104], [100, 120], [90, 138], [112, 138], [100, 156]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="${c1}"/><circle cx="${x - 5}" cy="${y - 5}" r="5" fill="${c2}" opacity=".7"/>`).join('')}`;
    case 'pineapple':
      return `${shadow}<path d="M100 20 l-10 34 l10 -10 l10 10 Z M82 30 l8 26 M118 30 l-8 26" fill="${c3}" stroke="${c3}" stroke-width="5" stroke-linejoin="round"/>${[[56, 110], [100, 96], [144, 112], [78, 146], [124, 146]].map(([x, y]) => `<path d="M${x - 22} ${y - 14} h44 l-6 32 h-32 Z" fill="${c1}" stroke="#C99212" stroke-width="2"/><rect x="${x - 6}" y="${y - 14}" width="12" height="8" fill="${c2}" opacity=".8"/>`).join('')}`;
    default:
      return `${shadow}<circle cx="100" cy="104" r="62" fill="${c1}"/>${leaf(100, 46)}`;
  }
}

const DRAW = { plate: drawPlate, bowl: drawBowl, cup: drawCup, glass: drawGlass, stack: drawStack, flat: drawFlat, fruit: drawFruit };

export function dishSvg(recipe, { cls = '' } = {}) {
  const rnd = seeded(recipe.id || 'x');
  const art = recipe.art && recipe.art.colors && recipe.art.colors.length >= 3 ? recipe.art : { dish: 'plate', colors: ['#1F6B45', '#E8A317', '#C8402A'] };
  const r = { ...recipe, art };
  const body = (DRAW[art.dish] || drawPlate)(r, rnd);
  return `<svg class="${cls}" viewBox="0 0 200 200" role="img" aria-label="Illustration of ${esc(recipe.name)}" xmlns="http://www.w3.org/2000/svg">${defs(recipe.id)}${body}</svg>`;
}

// Photo if one exists in the manifest, otherwise the drawing
export function recipeMedia(recipe, { cls = '', eager = false } = {}) {
  const file = photos.recipes[recipe.id];
  if (file) return `<img class="${cls}" src="${assetBase}images/recipes/${esc(file)}" alt="${esc(recipe.name)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" width="800" height="600">`;
  return dishSvg(recipe, { cls });
}

// ---------------- ingredient icons ----------------
export function ingredientSvg(ing, { size = 64 } = {}) {
  if (!ing) return '';
  const file = photos.ingredients[ing.id];
  if (file) return `<img src="${assetBase}images/ingredients/${esc(file)}" alt="${esc(ing.name)}" loading="lazy" decoding="async" width="${size}" height="${size}">`;
  const rnd = seeded(ing.id);
  const c1 = ing.color || '#4F9A3B';
  const c2 = ing.color2 || '#A9D88A';
  let s = '';
  switch (ing.shape) {
    case 'round': s = `<circle cx="32" cy="35" r="20" fill="${c1}"/><ellipse cx="25" cy="28" rx="6" ry="4" fill="#fff" opacity=".35"/><path d="M32 15 q2 -6 8 -7" stroke="#6B4423" stroke-width="2.5" fill="none" stroke-linecap="round"/><g fill="#5E8A2E">${leafPath(34, 14, 10, -20)}</g>`; break;
    case 'long': s = `<g transform="rotate(-35 32 32)"><rect x="8" y="24" width="48" height="16" rx="8" fill="${c1}"/><rect x="12" y="28" width="36" height="3" rx="1.5" fill="${c2}" opacity=".7"/><path d="M56 32 l6 -4 M56 32 l6 4" stroke="#5E8A2E" stroke-width="2.5" stroke-linecap="round"/></g>`; break;
    case 'leaf': s = `<g fill="${c1}">${leafPath(12, 40, 26, -40)}${leafPath(22, 48, 24, -70)}${leafPath(16, 30, 22, -10)}</g><path d="M14 42 l18 -16" stroke="${c2}" stroke-width="1.5"/>`; break;
    case 'head': s = `<circle cx="32" cy="34" r="22" fill="${c1}"/><circle cx="32" cy="34" r="15" fill="${c2}"/><path d="M32 18 C40 26 40 42 32 52 M24 22 C30 30 30 40 24 48" stroke="${c1}" stroke-width="2" fill="none"/>`; break;
    case 'bulb': s = `<path d="M32 10 C26 22 12 28 14 42 C16 54 48 54 50 42 C52 28 38 22 32 10 Z" fill="${c1}"/><path d="M32 12 C30 26 26 34 28 50 M32 12 C36 26 38 36 36 50" stroke="${c2}" stroke-width="1.5" fill="none"/><path d="M26 54 l-2 5 M32 54 v6 M38 54 l2 5" stroke="#9A8A6E" stroke-width="1.6" stroke-linecap="round"/>`; break;
    case 'pod': s = `<path d="M8 40 C18 18 46 14 58 22 C50 40 26 50 8 40 Z" fill="${c1}"/>${[16, 26, 36, 46].map((x, i) => `<circle cx="${x}" cy="${36 - i * 2.5}" r="5" fill="${c2}"/>`).join('')}`; break;
    case 'grain': for (let i = 0; i < 26; i++) { const [x, y] = inCircle(rnd, 32, 38, 18); s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="4.4" ry="3" fill="${i % 5 === 0 ? c2 : c1}" stroke="#00000014" transform="rotate(${r1(rnd() * 180)} ${r1(x)} ${r1(y)})"/>`; } break;
    case 'powder': s = `<ellipse cx="32" cy="46" rx="24" ry="8" fill="url(#steel)"/><path d="M12 44 C16 26 48 26 52 44 Z" fill="${c1}"/><ellipse cx="26" cy="36" rx="7" ry="3" fill="${c2}" opacity=".7"/>`; break;
    case 'liquid': s = `<path d="M20 16 h24 l-3 38 a4 4 0 0 1 -4 3 h-10 a4 4 0 0 1 -4 -3 Z" fill="#fff" fill-opacity=".5" stroke="#B8C2C6" stroke-width="2"/><path d="M22 30 h20 l-2 23 a3 3 0 0 1 -3 2 h-10 a3 3 0 0 1 -3 -2 Z" fill="${c1}"/><path d="M22 30 h20" stroke="${c2}" stroke-width="2"/>`; break;
    case 'egg': s = `<path d="M32 8 C18 8 12 30 12 40 C12 52 22 58 32 58 C42 58 52 52 52 40 C52 30 46 8 32 8 Z" fill="${c1}" stroke="#E3DACA"/><ellipse cx="25" cy="24" rx="5" ry="8" fill="#fff" opacity=".6"/>`; break;
    case 'meat': s = `<path d="${blob(32, 34, 21, rnd, 7, 0.25)}" fill="${c1}"/><path d="M20 30 C28 26 38 28 46 34" stroke="${c2}" stroke-width="4" fill="none" stroke-linecap="round"/>`; break;
    case 'cluster': s = [[32, 18], [24, 28], [40, 28], [18, 40], [32, 40], [46, 40], [26, 52], [38, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" fill="${c1}"/><circle cx="${x - 2}" cy="${y - 2}" r="2.3" fill="${c2}"/>`).join(''); break;
    case 'wedge': s = `<path d="M8 48 A28 28 0 0 1 56 48 Z" fill="${c2}"/><path d="M12 48 A24 24 0 0 1 52 48 Z" fill="${c1}"/>${dots(rnd, 32, 40, 10, '#2E2A27', 6, 1.4)}`; break;
    case 'seed': for (let i = 0; i < 34; i++) { const [x, y] = inCircle(rnd, 32, 34, 20); s += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="2.6" ry="1.8" fill="${i % 4 ? c1 : c2}" transform="rotate(${r1(rnd() * 180)} ${r1(x)} ${r1(y)})"/>`; } break;
    case 'root': s = `<path d="M10 38 C10 26 22 24 28 28 C32 18 44 18 46 28 C56 28 58 40 50 44 C44 52 18 52 10 38 Z" fill="${c1}"/><path d="M18 36 c6 2 12 2 18 -2 M34 30 c4 2 8 6 10 10" stroke="${c2}" stroke-width="2" fill="none"/>`; break;
    default: s = `<circle cx="32" cy="32" r="20" fill="${c1}"/>`;
  }
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${esc(ing.name)}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EEF2F3"/><stop offset=".5" stop-color="#B8C2C6"/><stop offset="1" stop-color="#E4E9EA"/></linearGradient></defs>${s}</svg>`;
}

// Logo mark: a thali plate with a leaf
export function logoSvg(cls = 'brand-mark') {
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#E8A317"/><circle cx="24" cy="24" r="15.5" fill="#FBF6EA"/><path d="M15 30 C16 20 23 14 33 14 C32 24 26 30 15 30 Z" fill="#1F6B45"/><path d="M15 30 L27 19" stroke="#FBF6EA" stroke-width="1.6" stroke-linecap="round"/><circle cx="30" cy="30" r="3.2" fill="#B8381F"/></svg>`;
}
