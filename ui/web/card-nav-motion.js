/* CardNav-inspired motion (React Bits) — vanilla + GSAP, no React */

window.NorvikCardNavMotion = (function () {
  const EASE = 'power3.out';
  const STAGGER = 0.08;
  const DURATION = 0.4;

  let drawerTl = null;
  let settingsTl = null;

  function gsapReady() {
    return typeof window.gsap !== 'undefined';
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function killTimeline(tl) {
    if (tl) tl.kill();
    return null;
  }

  function resetTargets(targets) {
    if (!gsapReady() || !targets.length) return;
    gsap.set(targets, { clearProps: 'transform,opacity' });
  }

  function initHamburger() {
    const btn = document.getElementById('btn-nav-toggle');
    if (!btn || btn.dataset.cardNavHamburger === '1') return;

    btn.dataset.cardNavHamburger = '1';
    btn.innerHTML = `
      <span class="card-nav-hamburger" aria-hidden="true">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </span>`;

    const sync = () => {
      const open = document.body.classList.contains('sidebar-open');
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-label', open ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    sync();
    new MutationObserver(sync).observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  function getDrawerNavItems() {
    const sidebar = document.querySelector('.norvik-sidebar');
    if (!sidebar) return [];
    return Array.from(sidebar.querySelectorAll('.norvik-nav .nav-item'));
  }

  function openDrawer() {
    if (prefersReducedMotion() || !gsapReady()) return;

    const sidebar = document.querySelector('.norvik-sidebar');
    const items = getDrawerNavItems();
    if (!sidebar || !items.length) return;

    drawerTl = killTimeline(drawerTl);
    gsap.set(items, { y: 50, opacity: 0 });

    drawerTl = gsap.timeline({ defaults: { ease: EASE } });
    drawerTl.to(
      items,
      {
        y: 0,
        opacity: 1,
        duration: DURATION,
        stagger: STAGGER,
      },
      0.12
    );
  }

  function closeDrawer(onComplete) {
    if (prefersReducedMotion() || !gsapReady()) {
      if (onComplete) onComplete();
      return;
    }

    const items = getDrawerNavItems();
    if (!items.length) {
      if (onComplete) onComplete();
      return;
    }

    drawerTl = killTimeline(drawerTl);
    drawerTl = gsap.timeline({
      defaults: { ease: EASE },
      onComplete: () => {
        resetTargets(items);
        if (onComplete) onComplete();
      },
    });

    drawerTl.to(
      items,
      {
        y: 28,
        opacity: 0,
        duration: 0.28,
        stagger: 0.04,
      },
      0
    );
  }

  function revealThemeSegment(seg) {
    if (!seg || prefersReducedMotion() || !gsapReady()) return;

    const opts = seg.querySelectorAll('.theme-glass-opt');
    const bubble = seg.querySelector('.theme-glass-bubble');
    if (!opts.length) return;

    gsap.fromTo(
      opts,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: DURATION,
        ease: EASE,
        stagger: STAGGER,
        clearProps: 'opacity',
      }
    );

    if (bubble && window.NorvikTheme) {
      NorvikTheme.animateThemeBubble(seg, { fluid: false });
    }
  }

  function pulseThemeSwitch(seg) {
    if (!seg || prefersReducedMotion() || !gsapReady()) return;
    const glass = seg.querySelector('.theme-glass-bubble__glass');
    if (!glass) return;
    gsap.fromTo(
      glass,
      { filter: 'brightness(1)' },
      { filter: 'brightness(1.2) saturate(1.1)', duration: 0.24, yoyo: true, repeat: 1, ease: EASE }
    );
  }

  function revealSettingsPanel(root) {
    if (!root || prefersReducedMotion() || !gsapReady()) return;

    settingsTl = killTimeline(settingsTl);

    const cards = root.querySelectorAll(
      '.label, .theme-glass-hint, .theme-glass-seg, .setting-field, .swatches, .slider-row'
    );
    if (!cards.length) return;

    gsap.set(cards, { y: 36, opacity: 0 });
    settingsTl = gsap.timeline({ defaults: { ease: EASE } });
    settingsTl.to(cards, {
      y: 0,
      opacity: 1,
      duration: DURATION,
      stagger: 0.06,
      clearProps: 'opacity',
    });

    const seg = root.querySelector('#theme-mode-seg');
    if (seg) revealThemeSegment(seg);
  }

  function init() {
    if (!document.getElementById('card-nav-root')?.querySelector('.card-nav')) {
      initHamburger();
    }
  }

  return {
    init,
    openDrawer,
    closeDrawer,
    revealThemeSegment,
    pulseThemeSwitch,
    revealSettingsPanel,
    EASE,
  };
})();
