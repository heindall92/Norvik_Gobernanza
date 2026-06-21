/* Norvik — Hyperframe de arranque (controlador) */

window.NorvikLoader = (function () {
  const PHASES = [
    { p: 12, t: 'Inicializando núcleo seguro' },
    { p: 32, t: 'Cargando marcos: NIST · ISO · CIS · RGPD' },
    { p: 54, t: 'Calibrando motor de madurez CMM' },
    { p: 74, t: 'Sincronizando panel de cumplimiento' },
    { p: 90, t: 'Preparando interfaz' },
  ];

  const MIN_VISIBLE_MS = 3500;
  const FORCE_HIDE_MS = MIN_VISIBLE_MS + 1500;

  let el, fillEl, pctEl, phaseEl;
  let progress = 0;
  let target = 0;
  let raf = 0;
  let phaseIdx = -1;
  let done = false;
  let creepTimer = 0;
  let forceTimer = 0;
  let startTs = 0;
  let pendingHide = 0;

  function $(id) { return document.getElementById(id); }

  function setPhase(text) {
    if (!phaseEl || phaseEl.textContent === text) return;
    phaseEl.style.opacity = '0';
    setTimeout(() => {
      phaseEl.textContent = text;
      phaseEl.style.opacity = '1';
    }, 180);
  }

  function syncPhaseFor(value) {
    let next = -1;
    for (let i = 0; i < PHASES.length; i++) {
      if (value >= PHASES[i].p - 12) next = i;
    }
    if (next !== phaseIdx && next >= 0) {
      phaseIdx = next;
      setPhase(PHASES[next].t);
    }
  }

  function tick() {
    progress += (target - progress) * 0.1;
    if (target - progress < 0.35) progress = target;
    const shown = Math.round(progress);
    if (fillEl) fillEl.style.width = shown + '%';
    if (pctEl) pctEl.textContent = shown + '%';
    syncPhaseFor(shown);
    if (!done || progress < 99.5) raf = requestAnimationFrame(tick);
  }

  function autoCreep() {
    if (done) return;
    const elapsed = Date.now() - startTs;
    if (elapsed >= MIN_VISIBLE_MS) {
      hide();
      return;
    }
    const k = elapsed / MIN_VISIBLE_MS;
    const eased = 1 - Math.pow(1 - k, 2.2);
    target = Math.max(target, Math.min(96, 8 + eased * 88));
    creepTimer = setTimeout(autoCreep, 100);
  }

  function init() {
    el = $('norvik-loader');
    if (!el) return;
    fillEl = $('nl-fill');
    pctEl = $('nl-pct');
    phaseEl = $('nl-phase-text');
    startTs = Date.now();
    target = 8;
    raf = requestAnimationFrame(tick);
    autoCreep();
    forceTimer = setTimeout(hide, FORCE_HIDE_MS);
  }

  function set(value) {
    target = Math.max(target, Math.min(96, value));
  }

  function hide() {
    if (done || !el) return;
    const elapsed = Date.now() - startTs;
    if (elapsed < MIN_VISIBLE_MS) {
      if (!pendingHide) pendingHide = setTimeout(hide, MIN_VISIBLE_MS - elapsed + 40);
      return;
    }
    done = true;
    clearTimeout(creepTimer);
    clearTimeout(forceTimer);
    clearTimeout(pendingHide);
    target = 100;
    progress = 100;
    setPhase('Listo');
    if (pctEl) pctEl.textContent = '100%';
    if (fillEl) fillEl.style.width = '100%';
    el.classList.add('is-done');
    cancelAnimationFrame(raf);
    setTimeout(() => {
      if (el) {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    }, 520);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  return { set, hide };
})();
