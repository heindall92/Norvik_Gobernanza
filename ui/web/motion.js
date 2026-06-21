/* Norvik — premium motion (GPU-only transforms, no layout thrash) */

window.NorvikMotion = (function () {
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  let parallaxEnabled = true;
  let collapseBusy = false;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initParallax() {
    if (prefersReducedMotion()) return;
    const back = document.querySelector('.hero-glow--back');
    const front = document.querySelector('.hero-glow--front');
    const shell = document.querySelector('.norvik-shell');
    if (!back || !front) return;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;

    function tick() {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      back.style.transform = `translate(calc(-50% + ${cx * 0.4}px), calc(-50% + ${cy * 0.35}px))`;
      front.style.transform = `translate(calc(-50% + ${cx * 0.75}px), calc(-50% + ${cy * 0.6}px)) scale(1.02)`;
      if (shell) {
        shell.style.transform = `translate(${cx * 0.015}px, ${cy * 0.012}px)`;
      }
      raf = requestAnimationFrame(tick);
    }

    document.addEventListener('mousemove', (e) => {
      const vp = document.documentElement.dataset.viewport;
      if (!parallaxEnabled || vp === 'xs' || vp === 'sm') return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      tx = (e.clientX / w - 0.5) * 28;
      ty = (e.clientY / h - 0.5) * 22;
    }, { passive: true });

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }

  function moveNavIndicator(target) {
    const indicator = document.getElementById('nav-indicator');
    const nav = document.querySelector('.norvik-nav');
    const layout = document.getElementById('layout');
    if (!indicator || !nav || !target) return;

    if (layout?.classList.contains('is-drawer-mode') || layout?.classList.contains('is-collapsed')) {
      indicator.style.opacity = '0';
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    if (navRect.height < 40 || rect.width > navRect.width * 0.95) {
      indicator.style.opacity = '0';
      return;
    }

    indicator.style.opacity = '1';
    indicator.style.transform = `translateY(${rect.top - navRect.top + nav.scrollTop}px)`;
    indicator.style.height = `${rect.height}px`;
  }

  function initNavIndicator() {
    const nav = document.querySelector('.norvik-nav');
    if (!nav) return;

    const active = nav.querySelector('.nav-item.is-active');
    if (active) requestAnimationFrame(() => moveNavIndicator(active));

    nav.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        if (!btn.classList.contains('is-active')) {
          btn.style.transform = 'translateX(2px)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  function onNavChange(panelId) {
    const btn = document.querySelector(`.nav-item[data-panel="${panelId}"]`);
    if (btn) moveNavIndicator(btn);
  }

  function initSidebarCollapse() {
    const layout = document.getElementById('layout');
    const btn = document.getElementById('btn-collapse');
    if (!layout || !btn) return;

    btn.addEventListener('click', () => {
      if (collapseBusy) return;
      collapseBusy = true;
      parallaxEnabled = false;

      layout.classList.add('is-collapsing');
      const collapsed = layout.classList.toggle('is-collapsed');

      const label = btn.querySelector('.collapse-label');
      if (label) {
        label.style.opacity = collapsed ? '0' : '1';
        label.style.maxWidth = collapsed ? '0' : '80px';
      }

      setTimeout(() => {
        layout.classList.remove('is-collapsing');
        collapseBusy = false;
        parallaxEnabled = true;
        const active = document.querySelector('.nav-item.is-active');
        if (active) moveNavIndicator(active);
      }, 280);
    });
  }

  function initMicroInteractions() {
    document.addEventListener('click', (e) => {
      const t = e.target.closest('.ws-btn, .nav-item, .q-level, .sw, .seg button');
      if (!t || t.disabled) return;
      t.classList.remove('is-pressed');
      void t.offsetWidth;
      t.classList.add('is-pressed');
      setTimeout(() => t.classList.remove('is-pressed'), 220);
    });

    document.querySelectorAll('.ws-btn.primary, #btn-save-settings').forEach((btn) => {
      btn.addEventListener('click', () => pulseAccent());
    });
  }

  function pulseAccent() {
    document.body.classList.add('accent-pulse');
    setTimeout(() => document.body.classList.remove('accent-pulse'), 420);
  }

  function initPanelTransitions() {
    const work = document.querySelector('.norvik-work');
    if (!work) return;
    work.addEventListener('click', (e) => {
      const panel = e.target.closest('.norvik-panel');
      if (panel && panel.classList.contains('is-entering')) {
        panel.classList.remove('is-entering');
      }
    });
  }

  function enterPanel(panelEl) {
    if (!panelEl || prefersReducedMotion()) return;
    panelEl.classList.remove('is-entering');
    void panelEl.offsetWidth;
    panelEl.classList.add('is-entering');
  }

  function animateSegThumb(seg) {
    if (!seg) return;
    const on = seg.querySelector('button.on');
    if (!on) return;
    let thumb = seg.querySelector('.seg-thumb');
    if (!thumb) {
      thumb = document.createElement('span');
      thumb.className = 'seg-thumb';
      seg.insertBefore(thumb, seg.firstChild);
    }
    const pad = 4;
    thumb.style.width = `${on.offsetWidth}px`;
    thumb.style.height = `${on.offsetHeight || on.getBoundingClientRect().height}px`;
    thumb.style.transform = `translate(${on.offsetLeft - pad}px, ${on.offsetTop - pad}px)`;
  }

  function initSegThumbs(root) {
    (root || document).querySelectorAll('.seg').forEach((seg) => {
      animateSegThumb(seg);
      seg.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => requestAnimationFrame(() => animateSegThumb(seg)));
      });
    });
  }

  function init() {
    if (prefersReducedMotion()) {
      document.documentElement.classList.add('reduce-motion');
    }
    initParallax();
    initNavIndicator();
    initSidebarCollapse();
    initMicroInteractions();
    initPanelTransitions();
    initSegThumbs();
    window.addEventListener('resize', () => {
      const active = document.querySelector('.nav-item.is-active');
      if (active) moveNavIndicator(active);
    });
  }

  return { init, onNavChange, enterPanel, animateSegThumb, initSegThumbs, pulseAccent, EASE };
})();
