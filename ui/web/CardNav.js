/* CardNav — React Bits vanilla port (GSAP) */

window.CardNav = (function () {
  const ARROW_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M17 7H9M17 7v8"/></svg>';

  const THEME_PRESETS = {
    light: {
      baseColor: 'rgba(255, 255, 255, 0.88)',
      menuColor: '#1b2230',
      buttonBgColor: null,
      buttonTextColor: '#fff',
    },
    dark: {
      baseColor: 'rgba(16, 21, 30, 0.82)',
      menuColor: '#eef2f8',
      buttonBgColor: null,
      buttonTextColor: '#fff',
    },
  };

  let instance = null;

  function gsapReady() {
    return typeof window.gsap !== 'undefined';
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function mount(container, options) {
    if (!container) return null;
    if (instance) destroy();

    const opts = { ...options };
    instance = createInstance(container, opts);
    return instance;
  }

  function destroy() {
    if (!instance) return;
    instance.teardown();
    instance = null;
  }

  function setTheme(theme) {
    if (!instance) return;
    instance.setTheme(theme);
  }

  function close() {
    if (!instance) return;
    instance.close();
  }

  function createInstance(container, opts) {
    const state = {
      isHamburgerOpen: false,
      isExpanded: false,
      theme: opts.theme || 'dark',
      ease: opts.ease || 'power3.out',
    };

    let navEl = null;
    let cardsRef = [];
    let tlRef = null;

    function themeColors() {
      const preset = THEME_PRESETS[state.theme] || THEME_PRESETS.dark;
      return {
        baseColor: opts.baseColor || preset.baseColor,
        menuColor: opts.menuColor || preset.menuColor,
        buttonBgColor: opts.buttonBgColor || preset.buttonBgColor || 'var(--btn-primary-bg)',
        buttonTextColor: opts.buttonTextColor || preset.buttonTextColor,
      };
    }

    function render() {
      const colors = themeColors();
      const logoHtml =
        opts.logo ||
        (window.NorvikIcons && window.NorvikIcons.brand) ||
        '<span>N</span>';
      const ctaLabel = opts.ctaLabel || 'Get Started';

      container.innerHTML = `
        <div class="card-nav-container ${escapeHtml(opts.className || '')}">
          <nav class="card-nav card-nav--${state.theme}" style="background-color:${colors.baseColor}">
            <div class="card-nav-top">
              <button type="button" class="hamburger-menu" aria-label="Abrir menú" aria-expanded="false" style="color:${colors.menuColor}">
                <span class="hamburger-line"></span>
                <span class="hamburger-line"></span>
              </button>
              <div class="logo-container">
                <span class="logo-mark">${logoHtml}</span>
                <span class="logo-text">${escapeHtml(opts.logoAlt || 'Norvik')}</span>
              </div>
              <button type="button" class="card-nav-cta-button" style="background:${colors.buttonBgColor};color:${colors.buttonTextColor}">
                ${escapeHtml(ctaLabel)}
              </button>
            </div>
            <div class="card-nav-content" aria-hidden="true">
              ${(opts.items || [])
                .slice(0, 3)
                .map(
                  (item, idx) => `
                <div class="nav-card" data-card-idx="${idx}" style="background-color:${item.bgColor};color:${item.textColor}">
                  <div class="nav-card-label">${escapeHtml(item.label)}</div>
                  <div class="nav-card-links">
                    ${(item.links || [])
                      .map(
                        (lnk, i) => `
                      <button type="button" class="nav-card-link" data-panel="${escapeHtml(lnk.panel || '')}" aria-label="${escapeHtml(lnk.ariaLabel || lnk.label)}">
                        <span class="nav-card-link-icon">${ARROW_ICON}</span>
                        ${escapeHtml(lnk.label)}
                      </button>`
                      )
                      .join('')}
                  </div>
                </div>`
                )
                .join('')}
            </div>
          </nav>
        </div>`;

      navEl = container.querySelector('.card-nav');
      cardsRef = Array.from(container.querySelectorAll('.nav-card'));
      bindEvents();
      buildTimeline();
    }

    function calculateHeight() {
      if (!navEl) return 260;
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        const contentEl = navEl.querySelector('.card-nav-content');
        if (contentEl) {
          const wasVisible = contentEl.style.visibility;
          const wasPointerEvents = contentEl.style.pointerEvents;
          const wasPosition = contentEl.style.position;
          const wasHeight = contentEl.style.height;

          contentEl.style.visibility = 'visible';
          contentEl.style.pointerEvents = 'auto';
          contentEl.style.position = 'static';
          contentEl.style.height = 'auto';
          contentEl.offsetHeight;

          const topBar = 60;
          const padding = 16;
          const contentHeight = contentEl.scrollHeight;

          contentEl.style.visibility = wasVisible;
          contentEl.style.pointerEvents = wasPointerEvents;
          contentEl.style.position = wasPosition;
          contentEl.style.height = wasHeight;

          return topBar + contentHeight + padding;
        }
      }
      return 260;
    }

    function buildTimeline() {
      if (!navEl || !gsapReady()) return;

      if (tlRef) tlRef.kill();

      gsap.set(navEl, { height: 60, overflow: 'hidden' });
      gsap.set(cardsRef, { y: 50, opacity: 0 });

      const tl = gsap.timeline({ paused: true });
      tl.to(navEl, {
        height: calculateHeight,
        duration: prefersReducedMotion() ? 0.01 : 0.4,
        ease: state.ease,
      });
      tl.to(
        cardsRef,
        {
          y: 0,
          opacity: 1,
          duration: prefersReducedMotion() ? 0.01 : 0.4,
          ease: state.ease,
          stagger: 0.08,
        },
        '-=0.1'
      );

      tlRef = tl;
    }

    function bindEvents() {
      const hamburger = container.querySelector('.hamburger-menu');
      const cta = container.querySelector('.card-nav-cta-button');
      const content = container.querySelector('.card-nav-content');

      hamburger?.addEventListener('click', toggleMenu);
      hamburger?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMenu();
        }
      });

      cta?.addEventListener('click', () => {
        if (typeof opts.onCtaClick === 'function') opts.onCtaClick();
        closeMenu();
      });

      container.querySelectorAll('.nav-card-link').forEach((btn) => {
        btn.addEventListener('click', () => {
          const panel = btn.dataset.panel;
          if (panel && typeof opts.onLinkClick === 'function') {
            opts.onLinkClick({ panel, label: btn.textContent.trim() });
          } else if (panel && typeof window.NorvikNavigate === 'function') {
            window.NorvikNavigate(panel);
          }
          closeMenu();
        });
      });

      const onResize = () => {
        if (!tlRef) return;
        if (state.isExpanded) {
          const newHeight = calculateHeight();
          gsap.set(navEl, { height: newHeight });
          tlRef.kill();
          buildTimeline();
          if (tlRef) tlRef.progress(1);
        } else {
          tlRef.kill();
          buildTimeline();
        }
      };

      window.addEventListener('resize', onResize);
      api._onResize = onResize;

      if (content) {
        content.setAttribute('aria-hidden', state.isExpanded ? 'false' : 'true');
      }
    }

    const api = { _onResize: null };

    function teardown() {
      if (tlRef) tlRef.kill();
      if (api._onResize) {
        window.removeEventListener('resize', api._onResize);
      }
      container.innerHTML = '';
    }

    function setTheme(theme) {
      state.theme = theme === 'light' ? 'light' : 'dark';
      if (!navEl) return;
      const colors = themeColors();
      navEl.classList.remove('card-nav--light', 'card-nav--dark');
      navEl.classList.add(`card-nav--${state.theme}`);
      navEl.style.backgroundColor = colors.baseColor;
      const hamburger = container.querySelector('.hamburger-menu');
      const cta = container.querySelector('.card-nav-cta-button');
      if (hamburger) hamburger.style.color = colors.menuColor;
      if (cta) {
        cta.style.background = colors.buttonBgColor;
        cta.style.color = colors.buttonTextColor;
      }
    }

    function closeMenu() {
      const tl = tlRef;
      const hamburger = container.querySelector('.hamburger-menu');
      const content = container.querySelector('.card-nav-content');
      if (!tl || !state.isExpanded) return;

      state.isHamburgerOpen = false;
      hamburger?.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
      hamburger?.setAttribute('aria-label', 'Abrir menú');

      tl.eventCallback('onReverseComplete', () => {
        state.isExpanded = false;
        navEl?.classList.remove('open');
        content?.setAttribute('aria-hidden', 'true');
      });
      tl.reverse();
    }

    function toggleMenu() {
      const tl = tlRef;
      const hamburger = container.querySelector('.hamburger-menu');
      const content = container.querySelector('.card-nav-content');
      if (!tl || !navEl) return;

      if (!state.isExpanded) {
        state.isHamburgerOpen = true;
        state.isExpanded = true;
        navEl.classList.add('open');
        hamburger?.classList.add('open');
        hamburger?.setAttribute('aria-expanded', 'true');
        hamburger?.setAttribute('aria-label', 'Cerrar menú');
        content?.setAttribute('aria-hidden', 'false');
        tl.play(0);
      } else {
        closeMenu();
      }
    }

    render();

    api.setTheme = setTheme;
    api.close = closeMenu;
    api.toggle = toggleMenu;
    api.teardown = teardown;

    return api;
  }

  return { mount, destroy, setTheme, close };
})();
