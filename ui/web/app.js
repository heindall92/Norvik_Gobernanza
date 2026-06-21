/* Norvik dashboard — QWebChannel client (optimized) */

let bridge = null;
let dashboardData = null;
let currentPanel = 'dashboard';
let settingsPanelReady = false;
const fwPages = { NIST_CSF2: 1, ISO27001: 1, CIS_V8: 1, RGPD: 1 };
const questionnaireCache = new Map();
const loadedPanels = new Set(['dashboard']);

const PANEL_TITLES = {
  dashboard: 'Governance & Compliance',
  nist: 'NIST CSF 2.0 — Cuestionario de madurez',
  iso: 'ISO 27001:2022 — Anexo A',
  cis: 'CIS Controls v8',
  rgpd: 'RGPD — Evaluación de cumplimiento',
  reports: 'Informes y análisis de brechas',
  ai: 'Asistente IA',
  settings: 'Configuración',
};

const FW_PANEL = {
  nist: 'NIST_CSF2',
  iso: 'ISO27001',
  cis: 'CIS_V8',
  rgpd: 'RGPD',
};

const PANEL_FOR_FW = Object.fromEntries(Object.entries(FW_PANEL).map(([panel, code]) => [code, panel]));

let drillDownPending = null;
let drillDrawerState = { items: [], metric: 'Hallazgos', filters: null };

function panelForFramework(code) {
  return PANEL_FOR_FW[code] || null;
}

function alertsMatching(criteria = {}) {
  const alerts = dashboardData?.alerts || [];
  const { frameworks, risks, domain, frameworkCode, maxPercent } = criteria;
  return alerts.filter((a) => {
    if (frameworks?.length && !frameworks.includes(a.framework)) return false;
    if (frameworkCode && a.framework !== frameworkCode) return false;
    if (risks?.length && !risks.includes(a.severity)) return false;
    if (domain) {
      const d = (a.domain || '').trim().toLowerCase();
      if (d !== domain.trim().toLowerCase()) return false;
    }
    if (typeof maxPercent === 'number') {
      const pct = maturityPct(a.current_level);
      if (pct > maxPercent) return false;
    }
    return true;
  });
}

function scrollToFilteredTable() {
  setPanel('dashboard');
  document.getElementById('filtered-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openDrillDrawer(title, subtitle, items, options = {}) {
  const drawer = document.getElementById('drill-drawer');
  const backdrop = document.getElementById('drill-backdrop');
  const body = document.getElementById('drill-drawer-body');
  const empty = document.getElementById('drill-empty');
  const countBadge = document.getElementById('drill-count-badge');
  const summary = document.getElementById('drill-summary-text');
  const crumb = document.getElementById('drill-crumb-metric');
  const aiBtn = document.getElementById('drill-ai-first');
  if (!drawer || !body) return;

  drillDrawerState = {
    items: items || [],
    metric: options.metric || 'Hallazgos',
    filters: options.filters || null,
  };

  if (crumb) crumb.textContent = drillDrawerState.metric;
  document.getElementById('drill-drawer-title').textContent = title;
  document.getElementById('drill-drawer-sub').textContent = subtitle;
  if (countBadge) countBadge.textContent = String(items.length);
  if (summary) {
    summary.textContent = items.length === 1
      ? 'control afectado — clic para abrir y mitigar'
      : 'controles afectados — clic para abrir y mitigar';
  }

  if (!items.length) {
    body.innerHTML = '';
    if (empty) empty.hidden = false;
    if (aiBtn) aiBtn.hidden = true;
  } else {
    if (empty) empty.hidden = true;
    if (aiBtn) aiBtn.hidden = false;
    body.innerHTML = items.map((a) => {
      const pct = maturityPct(a.current_level);
      const rt = riskTag(a.severity);
      return `
      <tr data-gap='${JSON.stringify(a).replace(/'/g, '&#39;')}'>
        <td class="cell-id">${a.control_id}</td>
        <td>
          <div class="drill-cell-main">${a.title}</div>
          <div class="drill-cell-sub">${FW_FILTER_LABELS[a.framework] || a.framework}${a.domain ? ` · ${a.domain}` : ''}</div>
        </td>
        <td><span class="risk-tag ${rt.cls}">${rt.label}</span></td>
        <td class="cell-maturity"><span class="cell-maturity__pct">${pct}%</span></td>
        <td class="cell-action"><span class="drill-action" data-icon="chevronRight"></span></td>
      </tr>`;
    }).join('');
    injectNorvikIcons(body);
    body.querySelectorAll('tr[data-gap]').forEach((row) => {
      row.addEventListener('click', () => {
        drillDownToControl(JSON.parse(row.dataset.gap));
      });
    });
  }

  backdrop?.removeAttribute('hidden');
  requestAnimationFrame(() => {
    drawer.removeAttribute('hidden');
    drawer.classList.add('is-open');
    backdrop?.classList.add('is-visible');
    injectNorvikIcons(drawer);
  });
}

function closeDrillDrawer() {
  const drawer = document.getElementById('drill-drawer');
  const backdrop = document.getElementById('drill-backdrop');
  drawer?.classList.remove('is-open');
  backdrop?.classList.remove('is-visible');
  setTimeout(() => {
    drawer?.setAttribute('hidden', '');
    backdrop?.setAttribute('hidden', '');
  }, 280);
}

async function drillDownToControl(gap) {
  const fw = gap.framework;
  const panel = panelForFramework(fw);
  if (!panel) {
    closeDrillDrawer();
    navigateTo('ai');
    askAiForGap(gap);
    return;
  }

  closeDrillDrawer();
  let page = 1;
  let controlDbId = gap.id || null;
  if (gap.control_id && (!controlDbId || !panel)) {
    try {
      const loc = await callBridge('get_control_page', fw, gap.control_id);
      if (loc?.ok) {
        page = loc.page || 1;
        controlDbId = loc.id || controlDbId;
      }
    } catch { /* modo demo sin bridge */ }
  }

  drillDownPending = { frameworkCode: fw, controlDbId, controlCode: gap.control_id };
  fwPages[fw] = page;
  setPanel(panel);
  showToast(`Abriendo ${gap.control_id} para mitigación`);
  await loadQuestionnaire(panel, fw, page, true);
}

function drillDownCriticalList(metricLabel) {
  const items = alertsMatching({ risks: ['critical'] });
  openDrillDrawer(
    'Hallazgos críticos sin mitigar',
    items.length
      ? `${items.length} controles requieren acción inmediata antes de la próxima auditoría.`
      : 'No hay controles críticos pendientes en el alcance actual.',
    items,
    { metric: metricLabel || 'Vulnerabilidades críticas', filters: { risks: ['critical'] } },
  );
}

function drillDownFrameworkGaps(frameworkCode, metricLabel) {
  const items = alertsMatching({ frameworkCode, risks: ['critical', 'warning'] });
  openDrillDrawer(
    `Brechas · ${FW_FILTER_LABELS[frameworkCode] || frameworkCode}`,
    items.length
      ? `${items.length} controles por debajo del objetivo de madurez (nivel 3).`
      : 'Sin brechas registradas en este marco.',
    items,
    { metric: metricLabel || FW_FILTER_LABELS[frameworkCode], filters: { frameworkCode } },
  );
}

function drillDownDomainMatrix(domain, frameworkCode) {
  const fwLabel = FW_FILTER_LABELS[frameworkCode] || frameworkCode;
  const items = alertsMatching({ domain, frameworkCode, risks: ['critical', 'warning', 'info'] });
  openDrillDrawer(
    `${domain} · ${fwLabel}`,
    items.length
      ? `Controles del dominio «${domain}» con brecha de cumplimiento.`
      : `Sin brechas en ${domain} para ${fwLabel}.`,
    items,
    { metric: `${domain} / ${fwLabel}`, filters: { domain, frameworkCode } },
  );
}

function applyDrillFiltersToDashboard(filters) {
  if (!filters) {
    scrollToFilteredTable();
    return;
  }
  if (filters.frameworkCode) dashFilterState.frameworks = [filters.frameworkCode];
  if (filters.risks) dashFilterState.risks = filters.risks;
  syncFilterDrawerFromState();
  applyDashFilters();
  closeDrillDrawer();
  scrollToFilteredTable();
}

function bindDrillDashboard() {
  document.querySelectorAll('#maturity-list .maturity-row[data-drill-fw]').forEach((row) => {
    if (row.dataset.drillBound) return;
    row.dataset.drillBound = '1';
    const go = () => drillDownFrameworkGaps(row.dataset.drillFw, row.querySelector('.maturity-row__label')?.textContent);
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  document.querySelectorAll('#gap-matrix .matrix-cell[data-drill-domain], #rpt-gap-matrix .matrix-cell[data-drill-domain]').forEach((cell) => {
    if (cell.dataset.drillBound) return;
    cell.dataset.drillBound = '1';
    const go = () => drillDownDomainMatrix(cell.dataset.drillDomain, cell.dataset.drillFw);
    cell.addEventListener('click', go);
    cell.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  document.querySelectorAll('.remediation-row[data-drill-fw]').forEach((row) => {
    if (row.dataset.drillBound) return;
    row.dataset.drillBound = '1';
    const go = () => drillDownFrameworkGaps(row.dataset.drillFw, row.querySelector('.remediation-row__label')?.textContent);
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
}

function initDrillDown() {
  if (initDrillDown.ready) return;
  initDrillDown.ready = true;

  const bindCard = (id, fn) => {
    const el = document.getElementById(id);
    if (!el || el.dataset.drillBound) return;
    el.dataset.drillBound = '1';
    el.addEventListener('click', (e) => fn(e));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
    });
  };

  bindCard('kpi-risk-card', () => drillDownCriticalList('Vulnerabilidades críticas'));
  bindCard('risk-incidents-stat', (e) => {
    e.stopPropagation();
    drillDownCriticalList('Incidencias');
  });
  bindCard('risk-index-card', () => drillDownCriticalList('Índice de riesgo'));
  bindCard('kpi-fw-card', () => {
    const fw = dashFilterState.frameworks[0] || 'ISO27001';
    drillDownFrameworkGaps(fw, `Cumplimiento ${FW_FILTER_LABELS[fw] || fw}`);
  });

  document.getElementById('drill-drawer-close')?.addEventListener('click', closeDrillDrawer);
  document.getElementById('drill-backdrop')?.addEventListener('click', closeDrillDrawer);
  document.getElementById('drill-scroll-table')?.addEventListener('click', () => {
    applyDrillFiltersToDashboard(drillDrawerState.filters);
  });
  document.getElementById('drill-ai-first')?.addEventListener('click', () => {
    const first = drillDrawerState.items[0];
    if (!first) return;
    closeDrillDrawer();
    navigateTo('ai');
    askAiForGap(first);
  });
}

initDrillDown.ready = false;

const FW_FILTER_LABELS = {
  ISO27001: 'ISO 27001:2022',
  NIST_CSF2: 'NIST CSF 2.0',
  CIS_V8: 'CIS Controls v8',
  RGPD: 'RGPD',
};
const RISK_UI = { critical: 'Crítico', warning: 'Alto', info: 'Medio', ok: 'Bajo' };
const DATE_RANGE_LABELS = { 1: 'Hoy', 7: 'Últimos 7 días', 30: 'Últimos 30 días', 90: 'Últimos 90 días' };

let dashFilterState = {
  frameworks: ['ISO27001'],
  risks: ['critical', 'warning'],
  dateRange: 90,
  unit: 'all',
};
let filteredTableLimit = 8;
let dashFiltersReady = false;

function countDashFilters() {
  let n = 0;
  if (dashFilterState.frameworks.length) n += 1;
  if (dashFilterState.risks.length) n += 1;
  if (dashFilterState.dateRange !== 90) n += 1;
  else if (dashFilterState.frameworks.length || dashFilterState.risks.length) n += 1;
  if (dashFilterState.unit !== 'all') n += 1;
  return Math.max(n, dashFilterState.frameworks.length ? 1 : 0);
}

function getFilteredAlerts() {
  const alerts = dashboardData?.alerts || [];
  return alerts.filter((a) => {
    if (dashFilterState.frameworks.length && !dashFilterState.frameworks.includes(a.framework)) return false;
    if (dashFilterState.risks.length && !dashFilterState.risks.includes(a.severity)) return false;
    return true;
  });
}

function maturityPct(level) {
  return Math.round((Math.max(0, Math.min(5, level)) / 5) * 100);
}

function riskTag(severity) {
  if (severity === 'critical') return { cls: 'risk-tag--crit', label: 'CRÍTICO' };
  if (severity === 'warning') return { cls: 'risk-tag--high', label: 'ALTO' };
  return { cls: 'risk-tag--med', label: 'MEDIO' };
}

function renderFilterChips() {
  const bar = document.getElementById('dash-filters-bar');
  const chips = document.getElementById('dash-filter-chips');
  const btn = document.getElementById('dash-btn-filter');
  const label = document.getElementById('dash-filter-btn-label');
  if (!bar || !chips) return;

  const items = [];
  dashFilterState.frameworks.forEach((code) => {
    items.push({ type: 'fw', key: code, text: `Marco: ${FW_FILTER_LABELS[code] || code}` });
  });
  if (dashFilterState.risks.length) {
    const riskTxt = dashFilterState.risks.map((r) => RISK_UI[r] || r).join(', ');
    items.push({ type: 'risk', key: 'risks', text: `Riesgo: ${riskTxt}` });
  }
  if (dashFilterState.dateRange) {
    items.push({ type: 'date', key: 'date', text: DATE_RANGE_LABELS[dashFilterState.dateRange] || `Últimos ${dashFilterState.dateRange} días` });
  }

  const active = items.length > 0;
  bar.hidden = !active;
  if (btn) btn.classList.toggle('has-filters', active);
  if (label) label.textContent = active ? `Filtros activos (${items.length})` : 'Filtros';

  chips.innerHTML = items.map((it) => `
    <span class="dash-filter-chip">
      ${it.text}
      <button type="button" data-remove="${it.type}" data-key="${it.key}" aria-label="Quitar filtro">
        <span data-icon="close"></span>
      </button>
    </span>`).join('');
  injectNorvikIcons(chips);
  chips.querySelectorAll('[data-remove]').forEach((b) => {
    b.addEventListener('click', () => {
      const t = b.dataset.remove;
      const k = b.dataset.key;
      if (t === 'fw') dashFilterState.frameworks = dashFilterState.frameworks.filter((c) => c !== k);
      else if (t === 'risk') dashFilterState.risks = [];
      else if (t === 'date') dashFilterState.dateRange = 90;
      syncFilterDrawerFromState();
      applyDashFilters();
    });
  });
}

function renderDashKpis(data) {
  const primaryFw = dashFilterState.frameworks[0] || 'ISO27001';
  const fwScore = data.framework_scores?.[primaryFw]?.score ?? 0;
  const fwLabel = document.getElementById('kpi-fw-label');
  const fwPct = document.getElementById('kpi-fw-pct');
  const fwBar = document.getElementById('kpi-fw-bar');
  const tableTitle = document.getElementById('filtered-table-title');
  if (fwLabel) fwLabel.textContent = `Cumplimiento ${FW_FILTER_LABELS[primaryFw] || primaryFw}`;
  if (fwPct) fwPct.textContent = `${fwScore.toFixed(1)}%`;
  if (fwBar) fwBar.style.width = `${Math.min(100, fwScore)}%`;
  if (tableTitle) tableTitle.textContent = `Controles filtrados: ${FW_FILTER_LABELS[primaryFw] || primaryFw}`;

  const filtered = getFilteredAlerts();
  const critInFilter = filtered.filter((a) => a.severity === 'critical').length;
  const riskCount = document.getElementById('kpi-risk-count');
  const riskSub = document.getElementById('kpi-risk-sub');
  if (riskCount) riskCount.textContent = String(critInFilter || data.critical_count || 0);
  if (riskSub) {
    riskSub.textContent = critInFilter
      ? `${critInFilter} críticos · clic para listado técnico`
      : `${filtered.length} controles · clic para explorar`;
  }

  const ring = document.getElementById('kpi-risk-ring');
  if (ring) {
    const riskScore = Math.min(100, Math.round((critInFilter / Math.max(filtered.length, 1)) * 100));
    NorvikCharts.renderScoreDonut(ring, 100 - riskScore, '');
    ring.querySelector('.donut-pct')?.remove();
    ring.querySelector('.donut-sub')?.remove();
  }

  const auditList = document.getElementById('kpi-audit-list');
  if (auditList) {
    const rem = (data.remediation || []).slice(0, 3);
    const badges = ['audit-badge--prog', 'audit-badge--queue', 'audit-badge--review'];
    const states = ['En progreso', 'En cola', 'Revisión'];
    if (!rem.length) {
      auditList.innerHTML = '<li><span>Sin auditorías activas</span><span class="audit-badge audit-badge--queue">—</span></li>';
    } else {
      auditList.innerHTML = rem.map((r, i) => `
        <li><span>${r.label}</span><span class="audit-badge ${badges[i % 3]}">${states[i % 3]}</span></li>`).join('');
    }
  }
}

function renderFilteredTable() {
  const body = document.getElementById('filtered-controls-body');
  const foot = document.getElementById('filtered-table-foot');
  const moreBtn = document.getElementById('filtered-show-more');
  if (!body) return;

  const all = getFilteredAlerts();
  const shown = all.slice(0, filteredTableLimit);
  if (!shown.length) {
    body.innerHTML = '<tr><td colspan="5" class="data-table__empty">Ningún control coincide con los filtros actuales.</td></tr>';
    if (foot) foot.hidden = true;
    return;
  }

  body.innerHTML = shown.map((a) => {
    const pct = maturityPct(a.current_level);
    const rt = riskTag(a.severity);
    const sliderCls = pct < 40 ? '' : (pct < 60 ? ' is-warn' : ' is-ok');
    const st = a.severity === 'critical' ? 'No conforme' : (a.severity === 'warning' ? 'Parcial' : 'En revisión');
    return `
    <tr data-gap='${JSON.stringify(a).replace(/'/g, '&#39;')}'>
      <td class="cell-id">${a.control_id}</td>
      <td>${a.domain || a.title}</td>
      <td><span class="risk-tag ${rt.cls}">${rt.label}</span></td>
      <td>
        <div class="maturity-cell">
          <input type="range" class="maturity-slider${sliderCls}" min="0" max="100" value="${pct}" disabled aria-label="Madurez ${pct}%" />
          <span class="maturity-cell__pct">${pct}%</span>
        </div>
      </td>
      <td class="text-caption">${st}</td>
    </tr>`;
  }).join('');

  if (foot && moreBtn) {
    const hidden = all.length - shown.length;
    foot.hidden = hidden <= 0;
    moreBtn.textContent = hidden > 0 ? `Ver ${hidden} resultados adicionales` : '';
  }

  body.querySelectorAll('tr[data-gap]').forEach((row) => {
    row.addEventListener('click', () => {
      drillDownToControl(JSON.parse(row.dataset.gap));
    });
  });
}

function applyDashFilters() {
  renderFilterChips();
  if (dashboardData) {
    renderDashKpis(dashboardData);
    renderFilteredTable();
  }
}

function syncFilterDrawerFromState() {
  document.querySelectorAll('#filter-fw-list .filter-fw-item').forEach((el) => {
    const code = el.dataset.fw;
    const checked = dashFilterState.frameworks.includes(code);
    el.classList.toggle('is-checked', checked);
    el.querySelector('input').checked = checked;
  });
  document.querySelectorAll('#filter-risk-grid .filter-risk').forEach((btn) => {
    btn.classList.toggle('is-active', dashFilterState.risks.includes(btn.dataset.risk));
  });
  document.querySelectorAll('.filter-date-chip').forEach((btn) => {
    btn.classList.toggle('is-active', parseInt(btn.dataset.days, 10) === dashFilterState.dateRange);
  });
  const dateLabel = document.getElementById('filter-date-label');
  if (dateLabel) dateLabel.textContent = DATE_RANGE_LABELS[dashFilterState.dateRange] || `Últimos ${dashFilterState.dateRange} días`;
  const unit = document.getElementById('filter-unit');
  if (unit) unit.value = dashFilterState.unit;
}

function readFilterDrawerToState() {
  dashFilterState.frameworks = [];
  document.querySelectorAll('#filter-fw-list .filter-fw-item input:checked').forEach((inp) => {
    dashFilterState.frameworks.push(inp.closest('.filter-fw-item').dataset.fw);
  });
  dashFilterState.risks = [];
  document.querySelectorAll('#filter-risk-grid .filter-risk.is-active').forEach((btn) => {
    dashFilterState.risks.push(btn.dataset.risk);
  });
  const activeDate = document.querySelector('.filter-date-chip.is-active');
  dashFilterState.dateRange = activeDate ? parseInt(activeDate.dataset.days, 10) : 90;
  dashFilterState.unit = document.getElementById('filter-unit')?.value || 'all';
}

function openFilterDrawer() {
  syncFilterDrawerFromState();
  document.getElementById('filter-backdrop')?.removeAttribute('hidden');
  const drawer = document.getElementById('filter-drawer');
  const backdrop = document.getElementById('filter-backdrop');
  requestAnimationFrame(() => {
    drawer?.removeAttribute('hidden');
    drawer?.classList.add('is-open');
    backdrop?.classList.add('is-visible');
  });
}

function closeFilterDrawer() {
  const drawer = document.getElementById('filter-drawer');
  const backdrop = document.getElementById('filter-backdrop');
  drawer?.classList.remove('is-open');
  backdrop?.classList.remove('is-visible');
  setTimeout(() => {
    drawer?.setAttribute('hidden', '');
    backdrop?.setAttribute('hidden', '');
  }, 280);
}

function resetDashFilters() {
  dashFilterState = { frameworks: ['ISO27001'], risks: ['critical', 'warning'], dateRange: 90, unit: 'all' };
  filteredTableLimit = 8;
  syncFilterDrawerFromState();
  applyDashFilters();
}

function initDashFilters() {
  if (dashFiltersReady) return;
  dashFiltersReady = true;

  const fwList = document.getElementById('filter-fw-list');
  if (fwList) {
    fwList.innerHTML = Object.entries(FW_FILTER_LABELS).map(([code, label]) => `
      <label class="filter-fw-item${dashFilterState.frameworks.includes(code) ? ' is-checked' : ''}" data-fw="${code}">
        <input type="checkbox"${dashFilterState.frameworks.includes(code) ? ' checked' : ''} />
        <span>${label}</span>
        <span class="fw-verified" data-icon="verified"></span>
      </label>`).join('');
    injectNorvikIcons(fwList);
  }

  document.getElementById('dash-btn-filter')?.addEventListener('click', openFilterDrawer);
  document.getElementById('filter-drawer-close')?.addEventListener('click', closeFilterDrawer);
  document.getElementById('filter-backdrop')?.addEventListener('click', closeFilterDrawer);
  document.getElementById('filter-apply')?.addEventListener('click', () => {
    readFilterDrawerToState();
    filteredTableLimit = 8;
    applyDashFilters();
    closeFilterDrawer();
  });
  document.getElementById('filter-reset')?.addEventListener('click', resetDashFilters);
  document.getElementById('dash-clear-filters')?.addEventListener('click', resetDashFilters);
  document.getElementById('dash-btn-export')?.addEventListener('click', exportPdf);
  document.getElementById('filtered-show-more')?.addEventListener('click', () => {
    filteredTableLimit += 12;
    renderFilteredTable();
  });
  document.getElementById('empty-import')?.addEventListener('click', () => navigateTo('reports'));

  document.querySelectorAll('#filter-risk-grid .filter-risk').forEach((btn) => {
    btn.addEventListener('click', () => btn.classList.toggle('is-active'));
  });
  document.querySelectorAll('.filter-date-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-date-chip').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const lbl = document.getElementById('filter-date-label');
      if (lbl) lbl.textContent = DATE_RANGE_LABELS[btn.dataset.days] || lbl.textContent;
    });
  });

  document.getElementById('dash-fab')?.addEventListener('click', () => navigateTo('iso'));
  applyDashFilters();
}

function showToast(msg) {
  const el = document.getElementById('toast');
  const text = document.getElementById('toast-text');
  if (text) text.textContent = msg;
  else el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

function callBridge(method, ...args) {
  return new Promise((resolve, reject) => {
    if (!bridge || typeof bridge[method] !== 'function') {
      reject(new Error('Bridge no disponible'));
      return;
    }
    const result = bridge[method](...args);
    Promise.resolve(result).then((raw) => {
      try {
        resolve(typeof raw === 'string' ? JSON.parse(raw) : raw);
      } catch {
        resolve(raw);
      }
    }).catch(reject);
  });
}

function defer(fn) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => setTimeout(fn, 0));
  } else {
    setTimeout(fn, 0);
  }
}

function setPanel(panelId) {
  currentPanel = panelId;

  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.panel === panelId);
  });
  document.querySelectorAll('.norvik-panel').forEach((el) => {
    const active = el.dataset.panel === panelId;
    if (active && !el.classList.contains('is-active')) {
      if (window.NorvikMotion) NorvikMotion.enterPanel(el);
    }
    el.classList.toggle('is-active', active);
  });
  document.getElementById('page-title').textContent = PANEL_TITLES[panelId] || 'Norvik';
  if (window.NorvikMotion) NorvikMotion.onNavChange(panelId);
}

function ensureSettingsPanel() {
  if (settingsPanelReady) return;
  initOllamaSettings();
  const panel = document.getElementById('theme-settings-panel');
  if (panel) {
    NorvikTheme.renderSettingsPanel(panel);
    settingsPanelReady = true;
    requestAnimationFrame(() => {
      if (window.NorvikMotion) NorvikMotion.initSegThumbs(panel);
    });
  }
}

function updateOllamaStatus(status) {
  const dot = document.getElementById('ollama-dot');
  const label = document.getElementById('ollama-label');
  const offline = document.getElementById('ai-offline');
  const aiSend = document.getElementById('ai-send');
  const connected = status && status.connected;
  dot.classList.toggle('online', connected);
  const prov = status?.provider === 'cloud' ? 'Cloud' : 'Local';
  label.textContent = connected
    ? `Ollama: ON (${prov} · ${status.model || 'modelo'})`
    : 'Ollama: OFF';
  if (offline) offline.hidden = connected;
  if (aiSend) aiSend.disabled = !connected;
}

function syncOllamaProviderFields() {
  const provider = document.getElementById('set-ollama-provider')?.value || 'local';
  const hostField = document.getElementById('field-ollama-host');
  const cloudField = document.getElementById('field-ollama-cloud-key');
  if (hostField) hostField.hidden = provider === 'cloud';
  if (cloudField) cloudField.hidden = provider !== 'cloud';
}

function fillOllamaModelSelect(models, selected) {
  const sel = document.getElementById('set-ollama-model');
  const hintEl = document.getElementById('ollama-models-hint');
  if (!sel) return;
  const provider = document.getElementById('set-ollama-provider')?.value || 'local';
  const list = Array.isArray(models) && models.length
    ? models
    : (provider === 'cloud' ? ['gpt-oss:120b'] : ['llama3.2']);
  sel.innerHTML = list.map((m) => `<option value="${m}">${m}</option>`).join('');
  if (selected && list.includes(selected)) sel.value = selected;
  else if (list.length) sel.value = list[0];
  if (hintEl && !hintEl.dataset.locked) hintEl.hidden = true;
}

function showOllamaModelsHint(text) {
  const hintEl = document.getElementById('ollama-models-hint');
  if (!hintEl) return;
  if (text) {
    hintEl.textContent = text;
    hintEl.hidden = false;
    hintEl.dataset.locked = '1';
  } else {
    hintEl.hidden = true;
    delete hintEl.dataset.locked;
  }
}

function collectSettingsPayload() {
  const provider = document.getElementById('set-ollama-provider')?.value || 'local';
  const customModel = document.getElementById('set-ollama-model-custom')?.value.trim();
  const selectedModel = document.getElementById('set-ollama-model')?.value || 'llama3.2';
  const model = customModel || selectedModel;
  return {
    org_name: document.getElementById('set-org')?.value || '',
    ollama_provider: provider,
    ollama_host: document.getElementById('set-ollama-host')?.value.trim() || 'http://localhost:11434',
    ollama_cloud_key: document.getElementById('set-ollama-cloud-key')?.value.trim() || '',
    ollama_model: provider === 'local' ? model : (document.getElementById('set-ollama-model')?.value || model),
    ollama_cloud_model: provider === 'cloud' ? model : (document.getElementById('set-ollama-model')?.value || 'gpt-oss:120b'),
    ai_system_prompt: document.getElementById('set-ai-prompt')?.value.trim() || '',
    ...NorvikTheme.toSettingsPayload(),
  };
}

async function saveSettingsFromForm(showMsg = true) {
  const result = await callBridge('save_settings', JSON.stringify(collectSettingsPayload()));
  if (result.ok) {
    if (showMsg) showToast('Configuración guardada');
    defer(() => refreshDashboard());
    defer(checkOllamaLater);
  } else if (showMsg) {
    showToast('Error: ' + (result.error || 'desconocido'));
  }
  return result;
}

async function testOllamaConnection() {
  const statusEl = document.getElementById('ollama-test-status');
  if (statusEl) {
    statusEl.textContent = 'Comprobando…';
    statusEl.className = 'ollama-test-status';
  }
  await saveSettingsFromForm(false);
  try {
    const result = await callBridge('test_ollama_connection');
    if (result.connected) {
      if (statusEl) {
        statusEl.textContent = `✓ Conexión exitosa (${result.provider === 'cloud' ? 'Cloud' : 'Local'} · ${result.model})`;
        statusEl.className = 'ollama-test-status ok';
      }
      fillOllamaModelSelect(result.available_models || [], result.model);
      showOllamaModelsHint(result.hint || '');
      updateOllamaStatus(result);
      showToast('Conexión Ollama OK');
    } else {
      if (statusEl) {
        statusEl.textContent = '✗ ' + (result.error || 'Sin conexión');
        statusEl.className = 'ollama-test-status err';
      }
      updateOllamaStatus(result);
    }
    return result;
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = '✗ ' + err.message;
      statusEl.className = 'ollama-test-status err';
    }
    return { connected: false, error: err.message };
  }
}

async function loadOllamaModels() {
  const statusEl = document.getElementById('ollama-test-status');
  if (statusEl) statusEl.textContent = 'Cargando modelos…';
  await saveSettingsFromForm(false);
  try {
    const result = await callBridge('get_ollama_models');
    const current = document.getElementById('set-ollama-model-custom')?.value.trim()
      || document.getElementById('set-ollama-model')?.value;
    fillOllamaModelSelect(result.models || [], current);
    showOllamaModelsHint(result.hint || (result.error && !result.ok ? result.error : ''));
    if (statusEl) {
      statusEl.textContent = result.ok
        ? `✓ ${(result.models || []).length} modelos disponibles`
        : '✗ ' + (result.error || 'No se pudieron cargar');
      statusEl.className = result.ok ? 'ollama-test-status ok' : 'ollama-test-status err';
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = '✗ ' + err.message;
      statusEl.className = 'ollama-test-status err';
    }
  }
}

function initOllamaSettings() {
  if (window.__ollamaSettingsReady) return;
  window.__ollamaSettingsReady = true;
  injectNorvikIcons(document.getElementById('ollama-settings'));

  document.getElementById('set-ollama-provider')?.addEventListener('change', () => {
    syncOllamaProviderFields();
    showOllamaModelsHint('');
    loadOllamaModels();
  });
  document.getElementById('btn-test-ollama')?.addEventListener('click', testOllamaConnection);
  document.getElementById('btn-load-models')?.addEventListener('click', loadOllamaModels);
}

const RISK_LABELS = { critical: 'Crítico', warning: 'Alto', info: 'Medio' };
const STATUS_LABELS = { critical: 'No conforme', warning: 'En revisión', info: 'Conforme' };

function riskExposureLabel(score) {
  const s = Math.round(score || 0);
  if (s >= 75) return 'Riesgo bajo';
  if (s >= 50) return 'Riesgo moderado';
  return 'Riesgo alto';
}

function severityMaturityPct(severity) {
  if (severity === 'critical') return 28;
  if (severity === 'warning') return 58;
  return 82;
}

function renderDashboard(data) {
  dashboardData = data;

  const banner = document.getElementById('sync-banner');
  if (banner) banner.hidden = true;
  const empty = document.getElementById('dash-empty');
  const content = document.getElementById('dash-content');
  const isEmpty = (data.total_controls ?? 0) === 0;
  if (empty) empty.hidden = !isEmpty;
  if (content) content.hidden = isEmpty;
  if (isEmpty) {
    document.getElementById('page-subtitle').textContent = `${data.org_name || ''}`;
    document.getElementById('dash-fab')?.setAttribute('hidden', '');
    injectNorvikIcons(document.getElementById('dash-empty'));
    return;
  }

  document.getElementById('dash-fab')?.removeAttribute('hidden');
  const sub = document.getElementById('dash-header-sub');
  if (sub) sub.textContent = `Monitoreo de cumplimiento en ${data.org_name || 'su organización'}.`;

  const score = Math.round(data.global_score || 0);
  const gradeEl = document.getElementById('score-grade');
  if (gradeEl) gradeEl.textContent = data.grade || '—';

  const riskLabel = document.getElementById('risk-label');
  if (riskLabel) riskLabel.textContent = riskExposureLabel(score);
  const compPct = document.getElementById('risk-compliance-pct');
  if (compPct) compPct.textContent = `${score}%`;
  const incidents = document.getElementById('risk-incidents');
  if (incidents) incidents.textContent = data.critical_count ?? data.non_compliant ?? 0;

  const lastUp = document.getElementById('dash-last-update');
  if (lastUp) lastUp.textContent = `Última actualización: ${data.last_review || 'ahora'}`;
  const connLabel = document.getElementById('dash-conn-label');
  if (connLabel) connLabel.textContent = 'Motor de cumplimiento activo';

  document.getElementById('page-subtitle').textContent = `${data.org_name || 'Organización'} · Score ${score}%`;

  NorvikCharts.renderScoreDonut(document.getElementById('score-donut'), score, data.grade || '');
  NorvikCharts.renderMaturityOverview(document.getElementById('maturity-list'), data.bars || []);
  NorvikCharts.renderGapMatrix(document.getElementById('gap-matrix'), data.gap_matrix || null);

  renderCriticalGaps(data.alerts || []);
  renderRecentActivity(data.recent_activity || []);
  renderRemediation(data.remediation || []);
  renderHealthCard(data);
  syncReportsPanel(data);
  renderDashKpis(data);
  renderFilteredTable();
  renderFilterChips();
  bindDrillDashboard();

  const nistBadge = document.getElementById('badge-nist');
  const cisBadge = document.getElementById('badge-cis');
  const bc = data.badge_counts || {};
  nistBadge.hidden = !(bc.NIST_CSF2 > 0);
  if (!nistBadge.hidden) nistBadge.textContent = bc.NIST_CSF2;
  cisBadge.hidden = !(bc.CIS_V8 > 0);
  if (!cisBadge.hidden) cisBadge.textContent = bc.CIS_V8;
}

function renderCriticalGaps(alerts) {
  const body = document.getElementById('critical-gaps-body');
  if (!body) return;
  const critical = alerts.filter((a) => a.severity === 'critical');
  const list = (critical.length ? critical : alerts).slice(0, 8);
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="6" class="data-table__empty">Sin controles críticos pendientes. Buen trabajo.</td></tr>';
    return;
  }
  body.innerHTML = list.map((a) => {
    const pct = severityMaturityPct(a.severity);
    const status = STATUS_LABELS[a.severity] || 'En revisión';
    const statusCls = a.severity === 'info' ? 'status-pill is-ok' : (a.severity === 'warning' ? 'status-pill is-partial' : 'status-pill is-non');
    return `
    <tr data-gap='${JSON.stringify(a).replace(/'/g, '&#39;')}'>
      <td class="cell-fw">${a.framework || '—'}</td>
      <td class="cell-area">${a.domain || '—'}</td>
      <td class="cell-desc"><span class="cell-id">${a.control_id}</span> ${a.title}</td>
      <td class="cell-maturity">
        <div class="cell-maturity__bar"><span style="width:${pct}%"></span></div>
        <span class="cell-maturity__pct">${pct}%</span>
      </td>
      <td><span class="${statusCls}"><i></i>${status}</span></td>
      <td class="cell-action"><span class="row-action" data-icon="export"></span></td>
    </tr>`;
  }).join('');
  injectNorvikIcons(body);
  body.querySelectorAll('tr[data-gap]').forEach((row) => {
    row.addEventListener('click', () => {
      drillDownToControl(JSON.parse(row.dataset.gap));
    });
  });
}

function streamIcon(kind) {
  if (kind === 'ok') return 'check';
  if (kind === 'warning') return 'warning';
  return 'sync';
}

function streamIconClass(kind) {
  if (kind === 'ok') return 'stream-icon--ok';
  if (kind === 'warning') return 'stream-icon--warn';
  return 'stream-icon--info';
}

function renderRecentActivity(activity) {
  const list = document.getElementById('activity-list');
  if (!list) return;
  if (!activity.length) {
    list.innerHTML = '<li class="stream-empty">Sin actividad registrada todavía.</li>';
    return;
  }
  list.innerHTML = activity.map((a, i) => `
    <li class="stream-item">
      <div class="stream-rail">
        <span class="stream-icon ${streamIconClass(a.kind)}"><span data-icon="${streamIcon(a.kind)}"></span></span>
        ${i < activity.length - 1 ? '<span class="stream-line" aria-hidden="true"></span>' : ''}
      </div>
      <div class="stream-body">
        <p class="stream-title"><strong>${a.title}</strong>${a.detail ? ` — ${a.detail}` : ''}</p>
        <p class="stream-meta">${a.framework || 'Norvik'}${a.when ? ' · ' + a.when : ''}</p>
      </div>
    </li>`).join('');
  injectNorvikIcons(list);
}

function renderRemediation(list, prefix = '') {
  const el = document.getElementById(`${prefix}remediation-list`);
  const hint = document.getElementById(`${prefix}remediation-hint`);
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p class="empty-hint">Sin iniciativas de remediación. Evalúa controles para generar el plan.</p>';
    if (hint) hint.textContent = '';
    return;
  }
  const avg = Math.round(list.reduce((s, r) => s + r.percent, 0) / list.length);
  if (hint) hint.textContent = `${avg}% medio`;
  el.innerHTML = list.map((r) => `
    <div class="remediation-row" data-drill-fw="${r.code}" role="button" tabindex="0" title="Ver controles pendientes de remediación">
      <div class="remediation-row__head">
        <span class="remediation-row__label">${r.label}</span>
        <span class="remediation-row__count">${r.percent}% (${r.done}/${r.total})</span>
      </div>
      <div class="remediation-row__track"><div class="remediation-row__fill" style="width:${r.percent}%"></div></div>
    </div>`).join('');
}

function renderHealthCard(data, prefix = '') {
  const grade = document.getElementById(`${prefix}health-grade`);
  const status = document.getElementById(`${prefix}health-status`);
  const trendText = document.getElementById(`${prefix}health-trend-text`);
  const ring = document.getElementById(`${prefix}health-ring`);
  if (grade) grade.textContent = data.grade || '—';
  const score = Math.round(data.global_score || 0);
  let label = 'Estable';
  if (score >= 75) label = 'Sólido';
  else if (score < 50) label = 'En riesgo';
  if (status) {
    status.textContent = label;
    status.className = 'health-card__badge' + (score < 50 ? ' health-card__badge--risk' : (score >= 75 ? ' health-card__badge--good' : ''));
  }
  if (trendText) trendText.textContent = `${score}% de madurez global · objetivo 60%`;
  if (ring) NorvikCharts.renderScoreDonut(ring, score, data.grade || '');
}

function syncReportsPanel(data) {
  const period = document.getElementById('rpt-period');
  if (period) {
    period.textContent = `Revisión de cumplimiento · ${data.org_name || 'Organización'} · Score ${Math.round(data.global_score || 0)}%`;
  }
  NorvikCharts.renderGapMatrix(document.getElementById('rpt-gap-matrix'), data.gap_matrix || null);
  renderRemediation(data.remediation || [], 'rpt-');
  renderHealthCard(data, 'rpt-');
  bindDrillDashboard();
}

let lastSummaryText = '';

async function generateExecSummary(source = 'dashboard') {
  const ids = source === 'reports'
    ? { body: 'rpt-ai-summary-body', state: 'rpt-ai-summary-state', btn: 'rpt-btn-ai-summary', regen: 'rpt-btn-ai-regen', copy: 'rpt-btn-ai-copy' }
    : { body: 'ai-summary-body', state: 'ai-summary-state', btn: 'btn-ai-summary', regen: 'btn-ai-regen', copy: 'btn-ai-copy' };
  const body = document.getElementById(ids.body);
  const state = document.getElementById(ids.state);
  const btn = document.getElementById(ids.btn);
  if (!body || !dashboardData) return;
  if (state) { state.textContent = 'Analizando…'; state.classList.add('live-chip--busy'); }
  if (btn) btn.disabled = true;
  body.innerHTML = '<p class="ai-summary__placeholder">Generando análisis con Ollama…</p>';
  try {
    const gap = {
      control_id: 'RESUMEN-GLOBAL',
      title: 'Resumen ejecutivo de gobernanza',
      framework: 'GLOBAL',
      domain: 'Gobernanza',
      current_level: Math.round((dashboardData.global_score || 0) / 20),
      target_level: 3,
      notes: `Score global ${Math.round(dashboardData.global_score || 0)}% (nota ${dashboardData.grade}). `
        + `Controles cumplidos: ${dashboardData.controls_met}. No conformes: ${dashboardData.non_compliant}. `
        + `Críticas: ${dashboardData.critical_count}, advertencias: ${dashboardData.warning_count}.`,
    };
    const result = await callBridge('get_recommendations', JSON.stringify(gap));
    if (result.ok && result.content) {
      lastSummaryText = result.content;
      const html = `<div class="ai-summary__text">${formatAiText(result.content)}</div>`;
      body.innerHTML = html;
      const dashBody = document.getElementById('ai-summary-body');
      const rptBody = document.getElementById('rpt-ai-summary-body');
      if (dashBody && dashBody !== body) dashBody.innerHTML = html;
      if (rptBody && rptBody !== body) rptBody.innerHTML = html;
      if (state) state.textContent = 'Generado';
      document.getElementById(ids.regen)?.removeAttribute('hidden');
      document.getElementById(ids.copy)?.removeAttribute('hidden');
      if (source === 'dashboard') {
        document.getElementById('rpt-btn-ai-regen')?.removeAttribute('hidden');
        document.getElementById('rpt-btn-ai-copy')?.removeAttribute('hidden');
      } else {
        document.getElementById('btn-ai-regen')?.removeAttribute('hidden');
        document.getElementById('btn-ai-copy')?.removeAttribute('hidden');
      }
    } else {
      const err = `<p class="ai-summary__placeholder">${result.error || 'No se pudo generar el análisis. Revisa la conexión Ollama en Configuración.'}</p>`;
      body.innerHTML = err;
      if (state) state.textContent = 'Sin conexión';
    }
  } catch (err) {
    body.innerHTML = `<p class="ai-summary__placeholder">Error: ${err.message}</p>`;
    if (state) state.textContent = 'Error';
  } finally {
    if (state) state.classList.remove('live-chip--busy');
    if (btn) btn.disabled = false;
  }
}

function formatAiText(text) {
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

window.rerenderDashboardCharts = function rerenderDashboardCharts() {
  if (!dashboardData) return;
  const donut = document.getElementById('score-donut');
  const maturity = document.getElementById('maturity-list');
  const matrix = document.getElementById('gap-matrix');
  if (donut) NorvikCharts.renderScoreDonut(donut, dashboardData.global_score || 0, dashboardData.grade || '');
  if (maturity) NorvikCharts.renderMaturityOverview(maturity, dashboardData.bars || []);
  if (matrix) NorvikCharts.renderGapMatrix(matrix, dashboardData.gap_matrix || null);
};

async function refreshDashboard(showMsg = false) {
  try {
    const data = await Promise.race([
      callBridge('get_dashboard_data', 'ALL'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado')), 12000)),
    ]);
    if (data.error) throw new Error(data.error);
    renderDashboard(data);
    if (showMsg) showToast('Dashboard actualizado');
  } catch (err) {
    showSyncError(err.message);
  }
}

function showSyncError(msg) {
  const banner = document.getElementById('sync-banner');
  const msgEl = document.getElementById('sync-banner-msg');
  if (msgEl) msgEl.textContent = msg || 'No se pudo conectar con el motor de cumplimiento.';
  if (banner) banner.hidden = false;
  const conn = document.getElementById('dash-conn-status');
  const connLabel = document.getElementById('dash-conn-label');
  if (conn) conn.classList.add('is-offline');
  if (connLabel) connLabel.textContent = 'Motor desconectado';
  const content = document.getElementById('dash-content');
  if (content && !dashboardData) content.hidden = true;
}

function invalidateQuestionnaireCache() {
  questionnaireCache.clear();
  loadedPanels.forEach((id) => {
    if (FW_PANEL[id]) loadedPanels.delete(id);
  });
}

function cacheKey(frameworkCode, page) {
  return `${frameworkCode}:${page}`;
}

async function loadQuestionnaire(panelId, frameworkCode, page, force = false) {
  const container = document.getElementById(`panel-${panelId}`);
  if (!container) return;

  const key = cacheKey(frameworkCode, page);
  if (!force && questionnaireCache.has(key)) {
    renderQuestionnaire(container, frameworkCode, questionnaireCache.get(key), panelId);
    loadedPanels.add(panelId);
    return;
  }

  if (!loadedPanels.has(panelId) || force) {
    container.innerHTML = '<div class="glass-box"><p style="color:var(--ink-3);font-size:13px">Cargando controles…</p></div>';
  }

  try {
    const data = await callBridge('get_framework_controls', frameworkCode, page);
    if (data.error) throw new Error(data.error);
    fwPages[frameworkCode] = page;
    questionnaireCache.set(key, data);
    renderQuestionnaire(container, frameworkCode, data, panelId);
    loadedPanels.add(panelId);
  } catch (err) {
    container.innerHTML = `<div class="glass-box"><p style="color:var(--red)">${err.message}</p></div>`;
  }
}

const FRAMEWORK_META = {
  NIST_CSF2: { name: 'NIST CSF 2.0', desc: 'Marco de ciberseguridad: Govern, Identify, Protect, Detect, Respond, Recover.' },
  ISO27001: { name: 'ISO 27001:2022', desc: 'Seguridad de la información, ciberseguridad y protección de la privacidad.' },
  CIS_V8: { name: 'CIS Controls v8', desc: 'Controles de seguridad priorizados y accionables.' },
  RGPD: { name: 'RGPD', desc: 'Reglamento General de Protección de Datos de la UE.' },
};

function frameworkHeaderCard(frameworkCode, data) {
  const meta = FRAMEWORK_META[frameworkCode] || { name: frameworkCode, desc: '' };
  const score = dashboardData?.framework_scores?.[frameworkCode];
  const pct = score ? Math.round(score.score) : 0;
  const items = data.items || [];
  const compliant = items.filter((i) => i.maturity_level >= 3).length;
  const partial = items.filter((i) => i.maturity_level === 2).length;
  const nonComp = items.filter((i) => i.maturity_level <= 1).length;
  const auditDate = dashboardData?.next_audit?.date || '—';
  return `
    <div class="fw-header-grid">
      <div class="glass-box fw-header">
        <div class="fw-header__main">
          <div class="fw-header__title">${meta.name}</div>
          <p class="fw-header__desc">${meta.desc}</p>
          <div class="fw-header__progress">
            <div class="fw-progress-row">
              <span>Progreso</span>
              <span class="fw-progress-count">${data.total} controles</span>
            </div>
            <div class="framework-bar__track"><div class="framework-bar__fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <div class="fw-header__side">
          <div class="fw-score-chip"><span class="fw-score-chip__pct">${pct}%</span><span class="fw-score-chip__lbl">Cumplimiento</span></div>
          <div class="fw-stats">
            <span class="fw-stat fw-stat--ok">${compliant}<small>Conformes</small></span>
            <span class="fw-stat fw-stat--warn">${partial}<small>Parcial</small></span>
            <span class="fw-stat fw-stat--crit">${nonComp}<small>No conf.</small></span>
          </div>
        </div>
      </div>
      <div class="glass-box audit-card audit-card--brand">
        <div class="audit-card__icon" data-icon="calendar"></div>
        <div class="audit-card__label">Próxima auditoría</div>
        <div class="audit-card__date">${auditDate}</div>
        <p class="audit-card__desc">Revisión de cumplimiento sugerida para ${meta.name}.</p>
        <button type="button" class="ws-btn audit-card__btn" data-goto-reports>
          <span data-icon="doc"></span><span>Ver hoja de ruta</span>
        </button>
        <div class="audit-card__watermark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M8 2v3M16 2v3M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>
        </div>
      </div>
    </div>`;
}

function controlStatus(level) {
  if (level >= 3) return { key: 'ok', label: 'Conforme', cls: 'is-ok' };
  if (level === 2) return { key: 'partial', label: 'Parcial', cls: 'is-partial' };
  return { key: 'non', label: 'No conforme', cls: 'is-non' };
}

function controlRisk(level) {
  if (level >= 3) return { label: 'Bajo', cls: 'is-low' };
  if (level === 2) return { label: 'Medio', cls: 'is-med' };
  return { label: 'Alto', cls: 'is-high' };
}

const CMM_NAMES = ['Inicial', 'Ad-hoc', 'Repetible', 'Definido', 'Gestionado', 'Optimizado'];

function renderQuestionnaire(container, frameworkCode, data, panelId) {
  const items = data.items || [];
  const meta = FRAMEWORK_META[frameworkCode] || { name: frameworkCode, desc: '' };
  const edits = new Map();
  items.forEach((it) => edits.set(it.id, { level: it.maturity_level ?? 0, notes: it.notes || '' }));

  const counts = () => {
    let ok = 0, partial = 0, non = 0;
    edits.forEach((e) => {
      const k = controlStatus(e.level).key;
      if (k === 'ok') ok++; else if (k === 'partial') partial++; else non++;
    });
    return { ok, partial, non, all: edits.size };
  };

  const rowHtml = (item) => {
    const e = edits.get(item.id);
    const st = controlStatus(e.level);
    const rk = controlRisk(e.level);
    const desc = (item.description || '').slice(0, 64);
    return `
      <button type="button" class="fw-row" data-id="${item.id}" data-status="${st.key}">
        <span class="fw-row__id">${item.control_id}</span>
        <span class="fw-row__name">
          <span class="fw-row__title">${item.title}</span>
          ${desc ? `<span class="fw-row__sub">${desc}${item.description.length > 64 ? '…' : ''}</span>` : ''}
        </span>
        <span class="status-pill ${st.cls}"><i></i>${st.label}</span>
        <span class="risk-pill ${rk.cls}">${rk.label}</span>
      </button>`;
  };

  container.innerHTML = `
    ${frameworkHeaderCard(frameworkCode, data)}
    <div class="fw-toolbar">
      <div class="fw-filters" id="fw-filters">
        <button type="button" class="fw-filter is-active" data-filter="all">Todos <b>${counts().all}</b></button>
        <button type="button" class="fw-filter" data-filter="ok">Conformes <b class="c-ok">${counts().ok}</b></button>
        <button type="button" class="fw-filter" data-filter="partial">Parcial <b class="c-warn">${counts().partial}</b></button>
        <button type="button" class="fw-filter" data-filter="non">No conf. <b class="c-crit">${counts().non}</b></button>
      </div>
      <button type="button" class="ws-btn primary" id="q-save-all">
        <span data-icon="check"></span><span>Guardar cambios</span>
      </button>
    </div>
    <div class="fw-board">
      <div class="glass-box fw-master">
        <div class="fw-master__head">
          <span class="fw-master__count">${data.total} controles</span>
          <span class="fw-master__page">Página ${data.page}/${data.pages}</span>
        </div>
        <div class="fw-table-wrap grid-table-wrap">
          <div class="fw-thead">
            <span>ID</span><span>Control</span><span>Estado</span><span>Riesgo</span>
          </div>
          <div class="fw-tbody" id="fw-tbody">${items.map(rowHtml).join('')}</div>
        </div>
        <div class="fw-pagination">
          <button type="button" class="ws-btn" id="q-prev" ${data.page <= 1 ? 'disabled' : ''}>
            <span data-icon="chevronLeft"></span><span>Anterior</span>
          </button>
          <button type="button" class="ws-btn" id="q-next" ${data.page >= data.pages ? 'disabled' : ''}>
            <span>Siguiente</span><span data-icon="chevronRight"></span>
          </button>
        </div>
      </div>
      <div class="glass-box fw-detail" id="fw-detail"></div>
    </div>`;
  injectNorvikIcons(container);

  container.querySelector('[data-goto-reports]')?.addEventListener('click', () => navigateTo('reports'));

  const tbody = container.querySelector('#fw-tbody');
  const detailEl = container.querySelector('#fw-detail');
  let selectedId = items.length ? items[0].id : null;

  const refreshCounts = () => {
    const c = counts();
    const set = (f, v) => {
      const b = container.querySelector(`.fw-filter[data-filter="${f}"] b`);
      if (b) b.textContent = v;
    };
    set('all', c.all); set('ok', c.ok); set('partial', c.partial); set('non', c.non);
  };

  const refreshRow = (id) => {
    const item = items.find((i) => i.id === id);
    const row = tbody.querySelector(`.fw-row[data-id="${id}"]`);
    if (!item || !row) return;
    const e = edits.get(id);
    const st = controlStatus(e.level);
    const rk = controlRisk(e.level);
    row.dataset.status = st.key;
    row.querySelector('.status-pill').className = `status-pill ${st.cls}`;
    row.querySelector('.status-pill').innerHTML = `<i></i>${st.label}`;
    row.querySelector('.risk-pill').className = `risk-pill ${rk.cls}`;
    row.querySelector('.risk-pill').textContent = rk.label;
  };

  const renderDetail = (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) {
      detailEl.innerHTML = `<div class="fw-detail__empty"><span data-icon="brand"></span><p>Selecciona un control para ver su detalle y evaluarlo.</p></div>`;
      injectNorvikIcons(detailEl);
      return;
    }
    const e = edits.get(id);
    const st = controlStatus(e.level);
    const rk = controlRisk(e.level);
    const levels = [0, 1, 2, 3, 4, 5].map((lv) =>
      `<button type="button" class="q-level ${e.level === lv ? 'is-selected' : ''}" data-level="${lv}" title="${CMM_NAMES[lv]}">L${lv}</button>`
    ).join('');
    detailEl.innerHTML = `
      <div class="fw-detail__crumb">${meta.name} · CONTROL ${item.control_id}</div>
      <div class="fw-detail__title">${item.title}</div>
      <div class="fw-detail__label">Descripción</div>
      <p class="fw-detail__desc">${item.description || 'Sin descripción disponible.'}</p>
      <div class="fw-detail__meta">
        <div class="fw-meta-box">
          <span class="fw-meta-box__lbl">Estado</span>
          <span class="status-pill ${st.cls}" id="fw-detail-status"><i></i>${st.label}</span>
        </div>
        <div class="fw-meta-box">
          <span class="fw-meta-box__lbl">Nivel de riesgo</span>
          <span class="risk-pill ${rk.cls}" id="fw-detail-risk">${rk.label}</span>
        </div>
      </div>
      <div class="fw-detail__label">Evaluación de madurez (CMM)</div>
      <div class="fw-detail__cmm">
        <div class="q-levels" id="fw-detail-levels">${levels}</div>
        <span class="fw-detail__cmm-name" id="fw-detail-cmm">Nivel ${e.level} — ${CMM_NAMES[e.level]}</span>
      </div>
      <div class="fw-detail__label">Notas de evaluación</div>
      <textarea class="fw-notes" id="fw-detail-notes" placeholder="Registra evidencias, hallazgos o justificación del nivel asignado...">${e.notes}</textarea>
      <div class="fw-evidence">
        <div class="fw-evidence__meta">
          <div class="fw-evidence__icon"><span data-icon="upload"></span></div>
          <div>
            <p class="fw-evidence__title">Biblioteca de evidencias</p>
            <p class="fw-evidence__sub">Adjunta artefactos desde Informes</p>
          </div>
        </div>
        <button type="button" class="ws-btn" data-goto-reports-evidence>
          <span data-icon="doc"></span><span>Gestionar</span>
        </button>
      </div>`;
    injectNorvikIcons(detailEl);
    detailEl.querySelector('[data-goto-reports-evidence]')?.addEventListener('click', () => navigateTo('reports'));

    detailEl.querySelectorAll('#fw-detail-levels .q-level').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lv = parseInt(btn.dataset.level, 10);
        e.level = lv;
        detailEl.querySelectorAll('#fw-detail-levels .q-level').forEach((b) => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        const ns = controlStatus(lv), nr = controlRisk(lv);
        const sEl = detailEl.querySelector('#fw-detail-status');
        const rEl = detailEl.querySelector('#fw-detail-risk');
        sEl.className = `status-pill ${ns.cls}`; sEl.innerHTML = `<i></i>${ns.label}`;
        rEl.className = `risk-pill ${nr.cls}`; rEl.textContent = nr.label;
        detailEl.querySelector('#fw-detail-cmm').textContent = `Nivel ${lv} — ${CMM_NAMES[lv]}`;
        refreshRow(id);
        refreshCounts();
      });
    });
    detailEl.querySelector('#fw-detail-notes')?.addEventListener('input', (ev) => {
      e.notes = ev.target.value;
    });
  };

  const selectControl = (id) => {
    selectedId = id;
    tbody.querySelectorAll('.fw-row').forEach((r) => r.classList.toggle('is-active', r.dataset.id == id));
    detailEl.classList.add('is-entering');
    renderDetail(id);
    requestAnimationFrame(() => {
      detailEl.classList.remove('is-entering');
    });
  };

  tbody.querySelectorAll('.fw-row').forEach((row) => {
    row.addEventListener('click', () => selectControl(parseInt(row.dataset.id, 10)));
  });

  container.querySelectorAll('.fw-filter').forEach((chip) => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.fw-filter').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      const f = chip.dataset.filter;
      tbody.querySelectorAll('.fw-row').forEach((r) => {
        r.style.display = (f === 'all' || r.dataset.status === f) ? '' : 'none';
      });
    });
  });

  container.querySelector('#q-prev')?.addEventListener('click', () => loadQuestionnaire(panelId, frameworkCode, data.page - 1));
  container.querySelector('#q-next')?.addEventListener('click', () => loadQuestionnaire(panelId, frameworkCode, data.page + 1));

  container.querySelector('#q-save-all')?.addEventListener('click', async () => {
    const btn = container.querySelector('#q-save-all');
    btn.disabled = true;
    const batch = items.map((item) => {
      const e = edits.get(item.id);
      return { control_id: item.id, maturity_level: e.level, notes: e.notes };
    });
    try {
      const result = await callBridge('save_assessments_batch', JSON.stringify(batch));
      if (!result.ok) throw new Error(result.error || 'Error al guardar');
      invalidateQuestionnaireCache();
      showToast('Evaluaciones guardadas');
      defer(() => refreshDashboard());
    } catch (err) {
      showToast('Error: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });

  if (drillDownPending?.frameworkCode === frameworkCode) {
    const { controlDbId, controlCode } = drillDownPending;
    let targetId = null;
    if (controlDbId) {
      const hit = items.find((i) => i.id === controlDbId);
      if (hit) targetId = hit.id;
    }
    if (targetId == null && controlCode) {
      const hit = items.find((i) => i.control_id === controlCode);
      if (hit) targetId = hit.id;
    }
    drillDownPending = null;
    if (targetId != null) {
      selectControl(targetId);
      tbody.querySelector(`.fw-row[data-id="${targetId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      renderDetail(null);
    }
  } else if (selectedId != null) {
    selectControl(selectedId);
  } else {
    renderDetail(null);
  }
}

function navigateTo(panelId) {
  setPanel(panelId);
  if (panelId === 'settings') {
    defer(ensureSettingsPanel);
  }
  if (FW_PANEL[panelId] && !loadedPanels.has(panelId)) {
    defer(() => loadQuestionnaire(panelId, FW_PANEL[panelId], fwPages[FW_PANEL[panelId]] || 1));
  }
}

async function exportPdf() {
  try {
    const result = await callBridge('export_pdf', '{}');
    if (!result.ok) throw new Error(result.error || 'Error al exportar');
    const out = document.getElementById('report-result');
    if (out) out.textContent = result.message || result.path;
    showToast('Informe PDF generado');
  } catch (err) {
    showToast('Error PDF: ' + err.message);
  }
}

function appendAiMessage(text, role) {
  const box = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function askAiForGap(gap) {
  appendAiMessage(`Gap: ${gap.control_id} — ${gap.title} (L${gap.current_level}→L${gap.target_level})`, 'user');
  appendAiMessage('Analizando gap...', 'bot');
  try {
    let result;
    if (gap.control_id === 'MANUAL') {
      result = await callBridge('ai_chat', gap.notes || gap.title || '');
    } else {
      result = await callBridge('get_recommendations', JSON.stringify(gap));
    }
    const msgs = document.getElementById('ai-messages');
    msgs.removeChild(msgs.lastChild);
    if (!result.ok) {
      appendAiMessage(result.error || 'Error al obtener recomendaciones. Verifica Ollama en Configuración.', 'bot');
      return;
    }
    appendAiMessage(result.content || 'Sin respuesta', 'bot');
  } catch (err) {
    const msgs = document.getElementById('ai-messages');
    if (msgs.lastChild) msgs.removeChild(msgs.lastChild);
    appendAiMessage('Error: ' + err.message, 'bot');
  }
}

async function loadSettings() {
  try {
    const s = await callBridge('get_settings');
    document.getElementById('set-org').value = s.org_name || '';
    document.getElementById('set-ollama-provider').value = s.ollama_provider || 'local';
    document.getElementById('set-ollama-host').value = s.ollama_host || 'http://localhost:11434';
    document.getElementById('set-ollama-cloud-key').value = s.ollama_cloud_key || '';
    document.getElementById('set-ai-prompt').value = s.ai_system_prompt || '';
    const model = s.ollama_provider === 'cloud'
      ? (s.ollama_cloud_model || s.ollama_model || 'gpt-oss:120b')
      : (s.ollama_model || 'llama3.2');
    fillOllamaModelSelect([model], model);
    syncOllamaProviderFields();
    NorvikTheme.loadFromSettings(s);
    applyUserProfile(s);
    defer(() => loadOllamaModels());
  } catch (_) { /* ignore */ }
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'NV';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderAvatarElement(el, url, ini) {
  if (!el) return;
  if (url) {
    el.innerHTML = `<img src="${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}" alt="" />`;
    el.classList.add('has-photo');
  } else {
    el.textContent = ini;
    el.classList.remove('has-photo');
  }
}

function setProfileAvatarPreview(url, ini) {
  const preview = document.getElementById('profile-avatar-preview');
  const initialsEl = document.getElementById('profile-avatar-initials');
  const picker = document.getElementById('profile-avatar-picker');
  const removeBtn = document.getElementById('profile-avatar-remove');
  if (initialsEl) initialsEl.textContent = ini;
  if (url && preview) {
    preview.src = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    preview.hidden = false;
    picker?.classList.add('has-photo');
    removeBtn?.removeAttribute('hidden');
  } else {
    if (preview) { preview.hidden = true; preview.removeAttribute('src'); }
    picker?.classList.remove('has-photo');
    removeBtn?.setAttribute('hidden', '');
  }
}

function applyUserProfile(s) {
  const name = s.user_name || 'Responsable de Cumplimiento';
  const role = s.user_role || 'Administrador';
  const edition = s.edition || 'Enterprise Edition';
  const ini = initials(name);
  const avatarUrl = s.user_avatar_url || '';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('user-name', name);
  set('user-role', role);
  set('sidebar-user-name', name);
  set('sidebar-user-role', role);
  set('brand-edition', edition);
  renderAvatarElement(document.getElementById('user-avatar'), avatarUrl, ini);
  renderAvatarElement(document.getElementById('sidebar-avatar'), avatarUrl, ini);
}

function fillProfileForm(s) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('profile-user-name', s.user_name);
  setVal('profile-user-role', s.user_role);
  setVal('profile-bio', s.user_bio);
  setVal('profile-org', s.org_name);
  setVal('profile-department', s.user_department);
  setVal('profile-edition', s.edition);
  setVal('profile-next-audit', s.next_audit);
  setVal('profile-email', s.user_email);
  setVal('profile-phone', s.user_phone);
  setVal('profile-location', s.user_location);
  setVal('profile-linkedin', s.user_linkedin);
  setVal('profile-github', s.user_github);
  setVal('profile-twitter', s.user_twitter);
  setVal('profile-website', s.user_website);
  setProfileAvatarPreview(s.user_avatar_url, initials(s.user_name));
  injectNorvikIcons(document.getElementById('user-profile-modal'));
}

function openUserProfile() {
  const modal = document.getElementById('user-profile-modal');
  if (!modal) return;
  callBridge('get_settings').then((s) => {
    fillProfileForm(s);
    modal.hidden = false;
    document.getElementById('profile-user-name')?.focus();
  }).catch(() => { modal.hidden = false; });
}

function closeUserProfile() {
  const modal = document.getElementById('user-profile-modal');
  if (modal) modal.hidden = true;
}

function collectProfilePayload() {
  return {
    user_name: document.getElementById('profile-user-name')?.value.trim() || '',
    user_role: document.getElementById('profile-user-role')?.value.trim() || '',
    user_bio: document.getElementById('profile-bio')?.value.trim() || '',
    org_name: document.getElementById('profile-org')?.value.trim() || '',
    user_department: document.getElementById('profile-department')?.value.trim() || '',
    next_audit: document.getElementById('profile-next-audit')?.value.trim() || '',
    edition: document.getElementById('profile-edition')?.value.trim() || 'Enterprise Edition',
    user_email: document.getElementById('profile-email')?.value.trim() || '',
    user_phone: document.getElementById('profile-phone')?.value.trim() || '',
    user_location: document.getElementById('profile-location')?.value.trim() || '',
    user_linkedin: document.getElementById('profile-linkedin')?.value.trim() || '',
    user_github: document.getElementById('profile-github')?.value.trim() || '',
    user_twitter: document.getElementById('profile-twitter')?.value.trim() || '',
    user_website: document.getElementById('profile-website')?.value.trim() || '',
  };
}

async function saveUserProfile() {
  const payload = collectProfilePayload();
  if (!payload.user_name) {
    showToast('El nombre completo es obligatorio');
    document.getElementById('profile-user-name')?.focus();
    return;
  }
  if (!payload.user_role) {
    showToast('El rol / cargo es obligatorio');
    document.getElementById('profile-user-role')?.focus();
    return;
  }
  const orgField = document.getElementById('set-org');
  if (orgField) orgField.value = payload.org_name;
  const result = await callBridge('save_settings', JSON.stringify(payload));
  if (result.ok) {
    const settings = result.settings || payload;
    settings.user_avatar_url = settings.user_avatar_url || (await callBridge('get_settings')).user_avatar_url;
    applyUserProfile(settings);
    closeUserProfile();
    showToast('Perfil guardado');
    defer(() => refreshDashboard());
  } else {
    showToast('Error: ' + (result.error || 'desconocido'));
  }
}

async function uploadProfileAvatar(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Selecciona una imagen PNG, JPG o WebP');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('La imagen no puede superar 2 MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const result = await callBridge('save_user_avatar', reader.result);
      if (!result.ok) throw new Error(result.error || 'No se pudo guardar la foto');
      const ini = initials(document.getElementById('profile-user-name')?.value);
      setProfileAvatarPreview(result.url, ini);
      const settings = await callBridge('get_settings');
      applyUserProfile(settings);
      showToast('Foto de perfil actualizada');
    } catch (err) {
      showToast(err.message || 'Error al subir la foto');
    }
  };
  reader.readAsDataURL(file);
}

async function removeProfileAvatar() {
  const result = await callBridge('remove_user_avatar');
  if (!result.ok) {
    showToast('Error: ' + (result.error || 'desconocido'));
    return;
  }
  const ini = initials(document.getElementById('profile-user-name')?.value);
  setProfileAvatarPreview('', ini);
  const settings = await callBridge('get_settings');
  applyUserProfile(settings);
  showToast('Foto eliminada');
}

function initUserProfile() {
  const open = () => openUserProfile();
  document.getElementById('user-chip')?.addEventListener('click', open);
  document.getElementById('user-chip')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  document.getElementById('sidebar-user')?.addEventListener('click', open);
  document.getElementById('sidebar-user')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  document.getElementById('profile-close')?.addEventListener('click', closeUserProfile);
  document.getElementById('profile-cancel')?.addEventListener('click', closeUserProfile);
  document.getElementById('profile-save')?.addEventListener('click', saveUserProfile);
  document.getElementById('user-profile-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'user-profile-modal') closeUserProfile();
  });

  const avatarInput = document.getElementById('profile-avatar-input');
  const triggerAvatarPick = () => avatarInput?.click();
  document.getElementById('profile-avatar-upload')?.addEventListener('click', triggerAvatarPick);
  document.getElementById('profile-avatar-picker')?.addEventListener('click', triggerAvatarPick);
  avatarInput?.addEventListener('change', () => {
    const file = avatarInput.files?.[0];
    uploadProfileAvatar(file);
    avatarInput.value = '';
  });
  document.getElementById('profile-avatar-remove')?.addEventListener('click', (e) => {
    e.stopPropagation();
    removeProfileAvatar();
  });
}

async function checkOllamaLater() {
  try {
    updateOllamaStatus(await callBridge('get_ollama_status'));
  } catch (_) { /* ignore */ }
}

function prefetchQuestionnaires() {
  Object.entries(FW_PANEL).forEach(([panelId, code]) => {
    const key = cacheKey(code, 1);
    if (questionnaireCache.has(key)) return;
    callBridge('get_framework_controls', code, 1)
      .then((data) => {
        if (data && !data.error) questionnaireCache.set(key, data);
      })
      .catch(() => {});
  });
}

function initNavigation() {
  try {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigateTo(btn.dataset.panel);
      });
    });

    document.getElementById('btn-sync')?.addEventListener('click', () => refreshDashboard(true));
    document.getElementById('btn-export')?.addEventListener('click', exportPdf);
    document.getElementById('btn-export-rpt')?.addEventListener('click', exportPdf);

    document.getElementById('ai-send')?.addEventListener('click', async () => {
      const input = document.getElementById('ai-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await askAiForGap({
        control_id: 'MANUAL',
        title: text,
        framework: 'GRC',
        domain: 'General',
        current_level: 1,
        target_level: 3,
        notes: text,
      });
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', () => saveSettingsFromForm(true));

    document.getElementById('btn-ai-summary')?.addEventListener('click', () => generateExecSummary('dashboard'));
    document.getElementById('btn-ai-regen')?.addEventListener('click', () => generateExecSummary('dashboard'));
    document.getElementById('rpt-btn-ai-summary')?.addEventListener('click', () => generateExecSummary('reports'));
    document.getElementById('rpt-btn-ai-regen')?.addEventListener('click', () => generateExecSummary('reports'));
    document.getElementById('btn-ai-copy')?.addEventListener('click', () => {
      if (!lastSummaryText) return;
      navigator.clipboard?.writeText(lastSummaryText)
        .then(() => showToast('Análisis copiado'))
        .catch(() => showToast('No se pudo copiar'));
    });
    document.getElementById('rpt-btn-ai-copy')?.addEventListener('click', () => {
      if (!lastSummaryText) return;
      navigator.clipboard?.writeText(lastSummaryText)
        .then(() => showToast('Análisis copiado'))
        .catch(() => showToast('No se pudo copiar'));
    });
    document.querySelector('[data-goto-gaps]')?.addEventListener('click', () => navigateTo('nist'));
    document.getElementById('sync-retry')?.addEventListener('click', () => refreshDashboard(true));
    document.getElementById('empty-start')?.addEventListener('click', () => navigateTo('nist'));

    initGlobalSearch();
    initSupportModal();
    initUserProfile();
    initDashFilters();
    initDrillDown();
    initUpload();
    document.getElementById('btn-support')?.addEventListener('click', openSupport);
    document.getElementById('btn-notifs')?.addEventListener('click', () => navigateTo('nist'));
  } catch (err) {
    console.error('initNavigation', err);
    showToast('Error al inicializar la interfaz');
  }
}

function initGlobalSearch() {
  const input = document.getElementById('global-search');
  const box = document.getElementById('search-results');
  if (!input || !box) return;
  let timer = 0;
  const close = () => { box.hidden = true; box.innerHTML = ''; };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { close(); return; }
    timer = setTimeout(async () => {
      try {
        const res = await callBridge('search_controls', q);
        const list = res.results || [];
        if (!list.length) {
          box.innerHTML = '<div class="search-empty">Sin resultados</div>';
        } else {
          box.innerHTML = list.map((r) => `
            <button type="button" class="search-row" data-fw="${r.framework_code}">
              <span class="search-row__id">${r.control_id}</span>
              <span class="search-row__title">${r.title}</span>
              <span class="search-row__fw">${r.framework}</span>
            </button>`).join('');
          box.querySelectorAll('.search-row').forEach((row) => {
            row.addEventListener('click', async () => {
              const fw = row.dataset.fw;
              const controlId = row.querySelector('.search-row__id')?.textContent?.trim();
              close();
              input.value = '';
              if (controlId && fw) {
                await drillDownToControl({ framework: fw, control_id: controlId, title: row.querySelector('.search-row__title')?.textContent || controlId });
              } else {
                const panel = panelForFramework(fw);
                if (panel) navigateTo(panel);
              }
            });
          });
        }
        box.hidden = false;
      } catch (_) { close(); }
    }, 220);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-search')) close();
  });
}

function openSupport() {
  const modal = document.getElementById('support-modal');
  if (modal) { modal.hidden = false; injectNorvikIcons(modal); }
}

function initSupportModal() {
  const modal = document.getElementById('support-modal');
  if (!modal) return;
  const close = () => { modal.hidden = true; };
  document.getElementById('support-close')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}

const pendingEvidence = [];

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function renderUploadList() {
  const list = document.getElementById('upload-list');
  if (!list) return;
  list.innerHTML = pendingEvidence.map((f, i) => `
    <li class="upload-item">
      <span class="upload-item__icon" data-icon="doc"></span>
      <div class="upload-item__meta">
        <span class="upload-item__name">${f.name}</span>
        <span class="upload-item__sub">${f.type || 'archivo'} · ${fmtSize(f.size)}</span>
      </div>
      <button type="button" class="icon-btn upload-item__del" data-idx="${i}" aria-label="Quitar"><span data-icon="close"></span></button>
    </li>`).join('');
  injectNorvikIcons(list);
  list.querySelectorAll('.upload-item__del').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingEvidence.splice(parseInt(btn.dataset.idx, 10), 1);
      renderUploadList();
    });
  });
}

function addEvidenceFiles(files) {
  Array.from(files || []).forEach((f) => pendingEvidence.push({ name: f.name, size: f.size, type: (f.name.split('.').pop() || '').toUpperCase() }));
  renderUploadList();
  if (files && files.length) showToast(`${files.length} evidencia(s) añadida(s)`);
}

function initUpload() {
  const drop = document.getElementById('dropzone');
  const input = document.getElementById('evidence-input');
  if (!drop || !input) return;
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  input.addEventListener('change', (e) => addEvidenceFiles(e.target.files));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === 'dragleave' && drop.contains(e.relatedTarget)) return;
    drop.classList.remove('drag');
  }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer.files) addEvidenceFiles(e.dataTransfer.files); });
}

function initBridge() {
  NorvikTheme.apply();

  if (typeof qt === 'undefined' || !qt.webChannelTransport) {
    renderDashboard({
      global_score: 78,
      grade: 'B+',
      total_controls: 168,
      controls_met: 124,
      non_compliant: 18,
      critical_count: 12,
      warning_count: 6,
      ok_count: 124,
      last_review: new Date().toLocaleString('es-ES'),
      org_name: 'Demo',
      bars: [
        { label: 'NIST CSF 2.0', percent: 65, level_label: 'Nivel 3 — Definido' },
        { label: 'ISO 27001:2022', percent: 82, level_label: 'Nivel 4 — Gestionado' },
        { label: 'CIS Controls v8', percent: 91, level_label: 'Nivel 5 — Optimizado' },
        { label: 'RGPD', percent: 74, level_label: 'Nivel 3.5 — Definido' },
        { label: 'CMM Global', percent: 78, level_label: 'Nivel 3.9 — Gestionado' },
      ],
      gap_matrix: {
        domains: ['Govern', 'Identify', 'Protect', 'Detect', 'Respond'],
        frameworks: [
          { code: 'NIST_CSF2', label: 'NIST CSF' },
          { code: 'ISO27001', label: 'ISO 27001' },
          { code: 'CIS_V8', label: 'CIS v8' },
          { code: 'RGPD', label: 'RGPD' },
        ],
        cells: {
          'Govern|NIST_CSF2': { percent: 95 }, 'Govern|ISO27001': { percent: 72 }, 'Govern|CIS_V8': { percent: 88 }, 'Govern|RGPD': { percent: 45 },
          'Identify|NIST_CSF2': { percent: 82 }, 'Identify|ISO27001': { percent: 65 }, 'Identify|CIS_V8': { percent: 32 }, 'Identify|RGPD': { percent: 60 },
          'Protect|NIST_CSF2': { percent: 70 }, 'Protect|ISO27001': { percent: 80 }, 'Protect|CIS_V8': { percent: 68 }, 'Protect|RGPD': { percent: 24 },
          'Detect|NIST_CSF2': { percent: 90 }, 'Detect|ISO27001': { percent: 76 }, 'Detect|CIS_V8': { percent: 82 }, 'Detect|RGPD': { percent: 41 },
          'Respond|NIST_CSF2': { percent: 55 }, 'Respond|ISO27001': { percent: 48 },
        },
      },
      alerts: [
        { control_id: 'A.12.6.1', title: 'Gestión de vulnerabilidades técnicas', severity: 'critical', domain: 'IT Security', framework: 'ISO 27001' },
        { control_id: 'ID.AM-2', title: 'Inventario de plataformas y aplicaciones', severity: 'warning', domain: 'Asset Mgmt', framework: 'NIST CSF' },
        { control_id: 'Art.30', title: 'Registro de actividades de tratamiento', severity: 'info', domain: 'Legal', framework: 'RGPD' },
      ],
      recent_activity: [
        { title: 'A.5.1 evaluado', detail: 'Políticas de seguridad · Nivel 4/5', framework: 'ISO 27001', kind: 'ok', when: '2026-06-21 12:30' },
        { title: 'ID.AM-2 evaluado', detail: 'Inventario de activos · Nivel 2/5', framework: 'NIST CSF', kind: 'warning', when: '2026-06-20 16:40' },
      ],
      remediation: [
        { label: 'Remediación RGPD', code: 'RGPD', done: 12, total: 28, percent: 42 },
        { label: 'Remediación NIST CSF 2.0', code: 'NIST_CSF2', done: 40, total: 62, percent: 65 },
        { label: 'Remediación ISO 27001:2022', code: 'ISO27001', done: 78, total: 95, percent: 82 },
      ],
      next_audit: { date: '12/09/2026', source: 'auto' },
      badge_counts: { NIST_CSF2: 5, CIS_V8: 3 },
    });
    initNavigation();
    window.NorvikLoader?.hide();
    return;
  }

  new QWebChannel(qt.webChannelTransport, (channel) => {
    bridge = channel.objects.bridge;
    try {
      initNavigation();
    } catch (err) {
      console.error('initNavigation', err);
    }
    window.NorvikLoader?.hide();
    defer(() => {
      loadSettings();
      refreshDashboard().finally(() => prefetchQuestionnaires());
      checkOllamaLater();
    });
    setInterval(checkOllamaLater, 30000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  injectNorvikIcons();
  initOllamaSettings();
  if (window.NorvikResponsive) NorvikResponsive.init();
  if (window.NorvikMotion) NorvikMotion.init();
  initBridge();
});
