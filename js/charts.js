/**
 * ============================================================
 * charts.js — SVG Chart Renderers (zero dependencies)
 * ============================================================
 *
 * Pure SVG chart generators.  Each returns an HTML string that
 * can be inserted via innerHTML.
 *
 *   renderBarChart(data, opts)    — vertical bar chart
 *   renderDonutChart(data, opts)  — donut / ring chart
 *   renderSparkline(data, opts)   — tiny inline trend line
 *
 * Developer: no charting library is needed. If you want to swap
 * to Chart.js later, replace these functions and keep the same
 * API signatures so pages.js doesn't need changes.
 */

/**
 * renderBarChart
 * @param {Array<{label:string, value:number, color?:string}>} data
 * @param {Object} opts — { width, height, barColor, label }
 * @returns {string} HTML string
 */
function renderBarChart(data, opts = {}) {
  const w      = opts.width    || 500;
  const h      = opts.height   || 220;
  const color  = opts.barColor || 'var(--accent)';
  const label  = opts.label    || '';
  const max    = Math.max(...data.map(d => d.value), 1);
  const barW   = Math.min(40, (w - 60) / data.length - 8);
  const startX = 50;

  // Y-axis grid lines
  let gridLines = '';
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const y = 10 + (h - 40) * (1 - f);
    gridLines += `
      <line x1="${startX}" y1="${y}" x2="${w - 10}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3"/>
      <text x="${startX - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-muted)">${Math.round(max * f).toLocaleString()}</text>
    `;
  });

  // Bars
  let bars = '';
  data.forEach((d, i) => {
    const bh = (d.value / max) * (h - 40);
    const x  = startX + i * ((w - 60) / data.length) + 4;
    const y  = h - 30 - bh;
    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="3" fill="${d.color || color}" opacity="0.85">
        <title>${d.label}: ${d.value.toLocaleString()}</title>
      </rect>
      <text x="${x + barW / 2}" y="${h - 14}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${d.label}</text>
    `;
  });

  return `
    <div class="chart-wrap">
      ${label ? `<div class="chart-label">${label}</div>` : ''}
      <svg viewBox="0 0 ${w} ${h}" class="chart-svg">
        ${gridLines}
        ${bars}
      </svg>
    </div>
  `;
}


/**
 * renderDonutChart
 * @param {Array<{label:string, value:number}>} data
 * @param {Object} opts — { size, label }
 * @returns {string} HTML string
 */
function renderDonutChart(data, opts = {}) {
  const size  = opts.size  || 180;
  const label = opts.label || '';
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r     = size * 0.35;
  const c     = Math.PI * 2 * r;
  const colors = ['#f97316','#3b82f6','#10b981','#8b5cf6','#ef4444','#eab308','#ec4899','#14b8a6'];

  let circles = '';
  let offset  = 0;
  data.forEach((d, i) => {
    const pct  = d.value / total;
    const dash = pct * c;
    const gap  = c - dash;
    circles += `
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="${colors[i % colors.length]}" stroke-width="${size * 0.15}"
        stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}"
        style="transition:stroke-dasharray .6s">
        <title>${d.label}: ${d.value}</title>
      </circle>
    `;
    offset += dash;
  });

  let legend = data.map((d, i) =>
    `<span class="legend-item"><span class="legend-dot" style="background:${colors[i % colors.length]}"></span>${d.label} (${d.value})</span>`
  ).join('');

  return `
    <div class="chart-wrap">
      ${label ? `<div class="chart-label">${label}</div>` : ''}
      <svg viewBox="0 0 ${size} ${size}" class="chart-svg" style="max-width:${size}px">
        ${circles}
        <text x="${size / 2}" y="${size / 2 - 6}" text-anchor="middle" font-size="18" font-weight="700" fill="var(--text)">${total}</text>
        <text x="${size / 2}" y="${size / 2 + 12}" text-anchor="middle" font-size="10" fill="var(--text-muted)">total</text>
      </svg>
      <div class="chart-legend">${legend}</div>
    </div>
  `;
}


/**
 * renderSparkline
 * @param {number[]} data — array of numeric values
 * @param {Object} opts — { width, height, color }
 * @returns {string} inline SVG string
 */
function renderSparkline(data, opts = {}) {
  if (!data.length) return '';
  const w   = opts.width  || 100;
  const h   = opts.height || 32;
  const col = opts.color  || 'var(--accent)';
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`
  ).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2"/></svg>`;
}
