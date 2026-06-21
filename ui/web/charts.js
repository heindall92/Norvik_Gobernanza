/* SVG radar chart + heatmap rendering */

function renderRadar(container, data) {
  if (!container) return;
  const axes = data && data.length ? data : [];
  const n = axes.length || 6;
  const cx = 170, cy = 170, maxR = 120;
  const levels = 5;

  let grid = '';
  for (let l = 1; l <= levels; l++) {
    const r = (maxR / levels) * l;
    let pts = '';
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      pts += `${x},${y} `;
    }
    grid += `<polygon points="${pts.trim()}" fill="none" stroke="rgba(169,107,255,0.18)" stroke-width="1"/>`;
  }

  let spokes = '';
  let labels = '';
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + maxR * Math.cos(angle);
    const y = cy + maxR * Math.sin(angle);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(169,107,255,0.15)" stroke-width="1"/>`;
    const lx = cx + (maxR + 22) * Math.cos(angle);
    const ly = cy + (maxR + 22) * Math.sin(angle);
    const label = axes[i] ? axes[i].axis : '';
    labels += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="var(--ink-dim)" font-family="var(--font-mono)" font-size="10">${label}</text>`;
  }

  let poly = '';
  let dots = '';
  if (axes.length) {
    let pts = '';
    axes.forEach((item, i) => {
      const val = Math.max(0, Math.min(100, item.value || 0));
      const r = (val / 100) * maxR;
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      pts += `${x},${y} `;
      dots += `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)" stroke="#fff" stroke-width="1" opacity="0.9"><animate attributeName="r" values="3;5;3" dur="2.5s" repeatCount="indefinite"/></circle>`;
    });
    poly = `<polygon points="${pts.trim()}" fill="rgba(136,192,208,0.15)" stroke="var(--accent)" stroke-width="2"/>`;
  }

  container.innerHTML = `
    <svg viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg" aria-label="Radar de madurez">
      ${grid}${spokes}${poly}${dots}${labels}
    </svg>`;
}

function heatmapLevelClass(level) {
  const n = Math.round(Math.max(0, Math.min(5, level)));
  return `level-${n}`;
}

function renderHeatmap(container, heatmapData) {
  if (!container) return;
  const domains = ['Govern', 'Identify', 'Protect', 'Detect', 'Respond', 'Recover'];
  const dataMap = {};
  (heatmapData || []).forEach((d) => { dataMap[d.domain] = d.level; });

  const cols = domains.map((d) =>
    `<div class="heatmap-col-label">${d.slice(0, 3)}</div>`
  ).join('');

  const rows = 4;
  let cells = '';
  for (let r = 0; r < rows; r++) {
    domains.forEach((domain) => {
      const base = dataMap[domain] || 0;
      const jitter = ((r * 1.3 + domain.length * 0.2) % 1.2) - 0.6;
      const level = Math.max(0, Math.min(5, Math.round(base + jitter)));
      cells += `<div class="heatmap-cell ${heatmapLevelClass(level)}" title="${domain} — L${level}">${level}</div>`;
    });
  }

  const legend = [0, 1, 2, 3, 4, 5].map((l) =>
    `<span><i class="${heatmapLevelClass(l)}"></i>L${l}</span>`
  ).join('');

  container.innerHTML = `
    <div class="heatmap-cols">${cols}</div>
    <div class="heatmap-grid">${cells}</div>
    <div class="heatmap-legend">${legend}</div>`;
}

function renderFrameworkBars(container, bars) {
  if (!container) return;
  container.innerHTML = (bars || []).map((b) => `
    <div class="framework-bar">
      <div class="framework-bar__head">
        <span class="framework-bar__label">${b.label}</span>
        <span class="framework-bar__pct">${Math.round(b.percent)}%</span>
      </div>
      <div class="framework-bar__track">
        <div class="framework-bar__fill" style="width:${Math.max(0, Math.min(100, b.percent))}%"></div>
      </div>
    </div>`).join('');
}

function renderHealthDonut(container, score, size = 132) {
  if (!container) return;
  const pct = Math.max(0, Math.min(100, Math.round(score || 0)));
  const stroke = Math.max(10, Math.round(size * 0.106));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const gradId = `healthDonutGrad-${Math.random().toString(36).slice(2, 9)}`;
  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" class="health-donut-svg" aria-label="Salud ${pct}%">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="url(#${gradId})"
        stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${dash} ${circ - dash}"
        transform="rotate(-90 ${cx} ${cx})"/>
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="color-mix(in srgb, var(--accent) 82%, #fff)"/>
          <stop offset="100%" stop-color="var(--accent)"/>
        </linearGradient>
      </defs>
      <text x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central" class="health-donut-pct">${pct}<tspan class="health-donut-pct-sym">%</tspan></text>
    </svg>`;
}

function renderScoreDonut(container, score, grade, size = 168) {
  if (!container) return;
  const pct = Math.max(0, Math.min(100, Math.round(score || 0)));
  const stroke = Math.max(10, Math.round(size * 0.095));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const gradId = `donutGrad-${Math.random().toString(36).slice(2, 9)}`;
  const fontMain = size <= 120 ? 22 : 26;
  const fontSym = size <= 120 ? 13 : 15;
  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" class="donut-svg" aria-label="Score ${pct}%">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="url(#${gradId})"
        stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${dash} ${circ - dash}"
        transform="rotate(-90 ${cx} ${cx})">
        <animate attributeName="stroke-dasharray" from="0 ${circ}" to="${dash} ${circ - dash}" dur="0.9s" fill="freeze" calcMode="spline" keySplines="0.22 1 0.36 1"/>
      </circle>
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="color-mix(in srgb, var(--accent) 70%, #000)"/>
          <stop offset="100%" stop-color="var(--accent)"/>
        </linearGradient>
      </defs>
      <text x="${cx}" y="${cx}" text-anchor="middle" dominant-baseline="central" class="donut-pct" font-size="${fontMain}">${pct}<tspan class="donut-pct-sym" font-size="${fontSym}">%</tspan></text>
    </svg>`;
}

function renderMaturityOverview(container, bars) {
  if (!container) return;
  container.innerHTML = (bars || []).map((b) => {
    const pct = Math.max(0, Math.min(100, Math.round(b.percent || 0)));
    const target = 60; // objetivo CMM nivel 3 = 60%
    const fw = b.code && b.code !== 'CMM' ? ` data-drill-fw="${b.code}"` : '';
    const role = fw ? ' role="button" tabindex="0"' : '';
    const title = fw ? ` title="Ver brechas de ${b.label}"` : '';
    return `
    <div class="maturity-row"${fw}${role}${title}>
      <div class="maturity-row__head">
        <span class="maturity-row__label">${b.label}</span>
        <span class="maturity-row__meta">${pct}% · ${b.level_label || ''}</span>
      </div>
      <div class="maturity-row__track">
        <div class="maturity-row__target" style="left:${target}%"></div>
        <div class="maturity-row__fill" style="width:${pct}%"></div>
      </div>
    </div>`;
  }).join('');
}

function matrixCellClass(percent) {
  if (percent >= 80) return 'cell-ok';
  if (percent >= 60) return 'cell-part';
  return 'cell-crit';
}

function renderGapMatrix(container, matrix) {
  if (!container) return;
  const data = matrix || { domains: [], frameworks: [], cells: {} };
  if (!data.domains.length || !data.frameworks.length) {
    container.innerHTML = '<p class="empty-hint">Sin datos suficientes para el mapa de brechas. Completa evaluaciones de madurez.</p>';
    return;
  }
  const esc = (s) => String(s).replace(/"/g, '&quot;');
  const head = `<div class="matrix-row matrix-row--head">
      <div class="matrix-cell matrix-cell--rowlabel">Dominio</div>
      ${data.frameworks.map((f) => `<div class="matrix-cell matrix-cell--collabel">${f.label}</div>`).join('')}
    </div>`;
  const body = data.domains.map((domain) => {
    const cols = data.frameworks.map((f) => {
      const cell = data.cells[`${domain}|${f.code}`];
      if (!cell) {
        return '<div class="matrix-cell matrix-cell--data"><span class="matrix-pill matrix-pill--na">N/A</span></div>';
      }
      const pct = Math.round(cell.percent);
      const cls = matrixCellClass(cell.percent);
      return `<div class="matrix-cell matrix-cell--data">
        <span class="matrix-pill ${cls}" data-drill-domain="${esc(domain)}" data-drill-fw="${f.code}" role="button" tabindex="0" title="${esc(domain)} · ${esc(f.label)}: ${pct}%">${pct}%</span>
      </div>`;
    }).join('');
    return `<div class="matrix-row">
        <div class="matrix-cell matrix-cell--rowlabel">${domain}</div>${cols}
      </div>`;
  }).join('');
  const cols = data.frameworks.length;
  container.style.setProperty('--matrix-cols', cols);
  container.innerHTML = head + body;
}

window.NorvikCharts = {
  renderRadar,
  renderHeatmap,
  renderFrameworkBars,
  renderHealthDonut,
  renderScoreDonut,
  renderMaturityOverview,
  renderGapMatrix,
};
