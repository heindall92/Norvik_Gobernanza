/* Norvik — responsive layout system */

window.NorvikResponsive = (function () {
  const BP = { xs: 640, sm: 900, md: 1200, lg: 1600 };

  const SIDEBAR = {
    xl: 220,
    lg: 200,
    md: 72,
    sm: 280,
    xs: 280,
  };

  let lastBp = '';
  let resizeTimer = 0;
  let userCollapsed = false;

  function breakpoint(width) {
    if (width < BP.xs) return 'xs';
    if (width < BP.sm) return 'sm';
    if (width < BP.md) return 'md';
    if (width < BP.lg) return 'lg';
    return 'xl';
  }

  function isDrawerMode(bp) {
    return bp === 'xs' || bp === 'sm';
  }

  function applyLayoutVars(w, h, bp) {
    const root = document.documentElement;
    root.dataset.viewport = bp;
    root.style.setProperty('--vp-w', `${w}px`);
    root.style.setProperty('--vp-h', `${h}px`);
    root.style.setProperty('--sidebar-width', `${SIDEBAR[bp]}px`);
    root.style.setProperty('--app-pad', bp === 'xs' ? '8px' : bp === 'sm' ? '12px' : '18px');
    root.style.setProperty('--work-pad', bp === 'xs' ? '12px' : bp === 'sm' ? '14px' : '18px');
    root.style.setProperty('--shell-radius', bp === 'xs' ? '12px' : 'calc(var(--radius) + 6px)');
  }

  function applySidebarState(layout, bp) {
    if (!layout) return;
    const drawer = isDrawerMode(bp);

    layout.classList.toggle('is-drawer-mode', drawer);
    layout.classList.toggle('is-compact-view', bp === 'md' || drawer);

    if (drawer) {
      layout.classList.remove('is-collapsed');
      layout.classList.remove('sidebar-open');
    } else if (bp === 'md') {
      layout.classList.add('is-collapsed');
    } else if (!userCollapsed) {
      layout.classList.remove('is-collapsed');
    }

    const collapseBtn = document.getElementById('btn-collapse');
    if (collapseBtn) collapseBtn.hidden = drawer;
  }

  function closeDrawer() {
    document.getElementById('layout')?.classList.remove('sidebar-open');
    document.body.classList.remove('sidebar-open');
  }

  function openDrawer() {
    document.getElementById('layout')?.classList.add('sidebar-open');
    document.body.classList.add('sidebar-open');
  }

  function toggleDrawer() {
    const layout = document.getElementById('layout');
    if (!layout) return;
    if (layout.classList.contains('sidebar-open')) closeDrawer();
    else openDrawer();
  }

  function apply() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const bp = breakpoint(w);
    const layout = document.getElementById('layout');

    applyLayoutVars(w, h, bp);
    applySidebarState(layout, bp);

    if (!isDrawerMode(bp)) closeDrawer();

    if (bp !== lastBp) {
      lastBp = bp;
      if (window.NorvikMotion) {
        requestAnimationFrame(() => {
          const panel = document.querySelector('.nav-item.is-active')?.dataset.panel;
          if (panel) NorvikMotion.onNavChange(panel);
        });
      }
    }

    if (typeof window.rerenderDashboardCharts === 'function') {
      window.rerenderDashboardCharts();
    }
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 100);
  }

  function initMobileNav() {
    const toggle = document.getElementById('btn-nav-toggle');
    const backdrop = document.getElementById('sidebar-backdrop');
    const layout = document.getElementById('layout');

    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDrawer();
    });

    backdrop?.addEventListener('click', closeDrawer);

    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (layout?.classList.contains('is-drawer-mode')) closeDrawer();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  function initCollapseTracking() {
    const btn = document.getElementById('btn-collapse');
    btn?.addEventListener('click', () => {
      const layout = document.getElementById('layout');
      if (!layout || layout.classList.contains('is-drawer-mode')) return;
      userCollapsed = layout.classList.contains('is-collapsed');
    });
  }

  function init() {
    apply();
    initMobileNav();
    initCollapseTracking();
    window.addEventListener('resize', onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize, { passive: true });
    }
  }

  return { init, apply, openDrawer, closeDrawer, toggleDrawer, breakpoint, BP };
})();
