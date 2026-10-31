// Lightweight animated SVG charts. Colours come from CSS tokens so both themes work.
import { esc, fmt } from '../core/utils.js';

// Progress ring
export function ring({ value = 0, max = 100, size = 120, stroke = 11, color = 'var(--leaf)', label = '', sub = '', unit = '' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max * 1.05;
  return `<div class="ring" style="--size:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}: ${fmt.n(value)} of ${fmt.n(max)} ${esc(unit)}">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
      <circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${over ? 'var(--chilli)' : color}" stroke-width="${stroke}"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" style="--len:${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-center"><b class="num" data-count="${value}">${fmt.n(value)}</b><span>${esc(sub || `of ${fmt.n(max)}${unit ? ` ${unit}` : ''}`)}</span></div>
  </div>`;
}

// Donut of macro calories
export function macroDonut({ protein = 0, carbs = 0, fat = 0, size = 150, label = 'Calories by macro' }) {
  const parts = [
    { k: 'Protein', v: protein * 4, g: protein, c: 'var(--protein)' },
    { k: 'Carbs', v: carbs * 4, g: carbs, c: 'var(--carbs)' },
    { k: 'Fat', v: fat * 9, g: fat, c: 'var(--fat)' },
  ];
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const arcs = parts.map((p) => {
    const len = (p.v / total) * C;
    const gap = len > 4 ? 2.5 : 0;
    const el = `<circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-width="${stroke}" stroke-linecap="butt"
      stroke-dasharray="${Math.max(len - gap, 0).toFixed(1)} ${C.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" style="--len:${C.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    offset += len;
    return el;
  }).join('');
  const legend = parts.map((p) => `<li><i style="background:${p.c}"></i><span>${p.k}</span><b class="num">${fmt.n(p.g, 1)} g</b><em class="num">${Math.round((p.v / total) * 100)}%</em></li>`).join('');
  return `<div class="donut"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>${arcs}</svg>
    <ul class="legend">${legend}</ul></div>`;
}

// Vertical bars with optional target line and secondary line series
export function barChart({ data, width = 640, valueKey = 'value', labelKey = 'label', target = null, height = 220, color = 'var(--leaf)', unit = '', line = null, lineColor = 'var(--protein)', lineUnit = '' }) {
  const W = Math.max(280, Math.round(width));
  const H = height;
  const pad = { l: 44, r: line ? 44 : 12, t: 16, b: 34 };
  const values = data.map((d) => d[valueKey] || 0);
  const max = Math.max(...values, target || 0, 1) * 1.12;
  const niceMax = niceCeil(max);
  const bw = (W - pad.l - pad.r) / Math.max(data.length, 1);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / niceMax);
  const ticks = [0, niceMax / 2, niceMax];
  let s = ticks.map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid-line"/><text x="${pad.l - 8}" y="${y(t) + 4}" class="axis" text-anchor="end">${fmt.n(t)}</text>`).join('');
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor((W - pad.l - pad.r) / 46))));
  data.forEach((d, i) => {
    const v = d[valueKey] || 0;
    const x = pad.l + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const over = target && v > target * 1.05;
    s += `<rect class="chart-bar" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(H - pad.b - y(v), 0).toFixed(1)}" rx="${Math.min(6, w / 3).toFixed(1)}" fill="${over ? 'var(--chilli)' : color}" style="animation-delay:${(i * 0.03).toFixed(2)}s"><title>${esc(d[labelKey])}: ${fmt.n(v)} ${esc(unit)}</title></rect>`;
    if (i % labelEvery === 0) s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 12}" class="axis" text-anchor="middle">${esc(d.short || d[labelKey])}</text>`;
  });
  if (target) s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(target)}" y2="${y(target)}" class="target-line"/><text x="${W - pad.r - 4}" y="${y(target) - 6}" class="axis target-label" text-anchor="end">Target ${fmt.n(target)}</text>`;
  if (line) {
    const lv = data.map((d) => d[line] || 0);
    const lmax = niceCeil(Math.max(...lv, 1) * 1.15);
    const ly = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / lmax);
    const pts = data.map((d, i) => [pad.l + i * bw + bw / 2, ly(d[line] || 0)]);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    s += `<path d="${path}" fill="none" stroke="${lineColor}" stroke-width="2.5" class="chart-line" style="--len:2000" stroke-dasharray="2000"/>`;
    s += pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${lineColor}"><title>${esc(data[i][labelKey])}: ${fmt.n(data[i][line], 1)} ${esc(lineUnit)}</title></circle>`).join('');
    s += [0, lmax].map((t) => `<text x="${W - pad.r + 8}" y="${ly(t) + 4}" class="axis" fill="${lineColor}">${fmt.n(t)}</text>`).join('');
  }
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart">${s}</svg></div>`;
}

// Line chart with area fill (e.g. weight trend)
export function lineChart({ points, width = 640, height = 200, color = 'var(--leaf)', unit = '', target = null }) {
  const W = Math.max(280, Math.round(width));
  const H = height;
  const pad = { l: 44, r: 16, t: 16, b: 30 };
  if (!points.length) return '<p class="muted">No data yet.</p>';
  const vals = points.map((p) => p.value).concat(target ? [target] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 2) { hi += 1; lo -= 1; }
  const span = hi - lo;
  lo -= span * 0.12; hi += span * 0.12;
  const x = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const ticks = [lo, (lo + hi) / 2, hi];
  let s = ticks.map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid-line"/><text x="${pad.l - 8}" y="${y(t) + 4}" class="axis" text-anchor="end">${fmt.n(t, 1)}</text>`).join('');
  s += `<path d="${area}" fill="${color}" opacity=".12"/><path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" class="chart-line" style="--len:2000" stroke-dasharray="2000"/>`;
  if (target) s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(target)}" y2="${y(target)}" class="target-line"/><text x="${W - pad.r}" y="${y(target) - 6}" class="axis target-label" text-anchor="end">Goal ${fmt.n(target, 1)} ${esc(unit)}</text>`;
  const step = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor((W - pad.l - pad.r) / 56))));
  points.forEach((p, i) => {
    const last = i === points.length - 1;
    s += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${last ? 5.5 : 3}" fill="${last ? color : 'var(--surface)'}" stroke="${color}" stroke-width="2"><title>${esc(p.label)}: ${fmt.n(p.value, 1)} ${esc(unit)}</title></circle>`;
    if (i % step === 0 || last) s += `<text x="${x(i).toFixed(1)}" y="${H - 10}" class="axis" text-anchor="middle">${esc(p.short || p.label)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${s}</svg></div>`;
}

// Calendar heatmap (month) of adherence 0..1
export function heatmap({ days, label = 'Daily protein target reached' }) {
  // days: [{date:'YYYY-MM-DD', value:0..1|null}]
  const first = days[0] ? new Date(`${days[0].date}T00:00:00`) : new Date();
  const lead = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<i class="hm-empty"></i>');
  for (const d of days) {
    const level = d.value === null ? 'none' : d.value >= 0.95 ? 4 : d.value >= 0.75 ? 3 : d.value >= 0.5 ? 2 : d.value > 0 ? 1 : 0;
    const day = Number(d.date.slice(8));
    cells.push(`<i class="hm l${level}" title="${esc(d.date)}: ${d.value === null ? 'no entries' : `${Math.round(d.value * 100)}%`}"><span>${day}</span></i>`);
  }
  return `<div class="heatmap" role="img" aria-label="${esc(label)}">
    <div class="hm-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => `<b>${x}</b>`).join('')}</div>
    <div class="hm-grid">${cells.join('')}</div>
    <div class="hm-legend"><span>Less</span><i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><i class="hm l4"></i><span>More</span></div></div>`;
}

// Horizontal bar list (top recipes, searches)
export function barList(items, { valueLabel = '', color = 'var(--leaf)' } = {}) {
  if (!items.length) return '<p class="muted">No data for this period yet.</p>';
  const max = Math.max(...items.map((i) => i.count), 1);
  return `<ol class="barlist">${items.map((i) => `<li><span class="bl-name">${esc(i.name || i.key || '(empty)')}</span><span class="bl-bar"><i style="--to:${((i.count / max) * 100).toFixed(1)}%;--bar:${color}"></i></span><b class="num">${fmt.n(i.count)}${valueLabel}</b></li>`).join('')}</ol>`;
}

function niceCeil(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// Count-up animation for elements with data-count
export function animateCounters(root) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    if (!Number.isFinite(end) || end === 0) return;
    const decimals = String(el.dataset.count).includes('.') ? 1 : 0;
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const dur = 1100;
    const tick = (t) => {
      const k = Math.min((t - start) / dur, 1);
      const eased = 1 - (1 - k) ** 3;
      el.textContent = `${fmt.n(end * eased, decimals)}${suffix}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Renders a chart at the container's real width (so text stays readable) and re-renders on resize.
export function mountChart(el, render) {
  if (!el) return;
  let last = 0;
  const draw = () => { const w = el.clientWidth || 640; if (Math.abs(w - last) < 8) return; last = w; el.innerHTML = render(w); };
  draw();
  if ('ResizeObserver' in window) {
    let t;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(draw, 120); });
    ro.observe(el);
  }
}
