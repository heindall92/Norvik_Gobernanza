/* Theme engine — glass mode switcher + DASDE glass transitions */

window.NorvikTheme = (function () {
  const ACCENTS = [
    { name: 'Blue', c: '#2f7bff' },
    { name: 'Green', c: '#22c55e' },
    { name: 'Yellow', c: '#eab308' },
    { name: 'Orange', c: '#f97316' },
    { name: 'Red', c: '#ef4444' },
    { name: 'Magenta', c: '#d946ef' },
    { name: 'Violet', c: '#8b5cf6' },
    { name: 'Cyan', c: '#22d3ee' },
    { name: 'Coral', c: '#ff6a4d' },
  ];

  const MODE_META = {
    Auto: { label: 'Sistema', icon: 'auto' },
    Light: { label: 'Claro', icon: 'sun' },
    Dark: { label: 'Oscuro', icon: 'moon' },
  };

  const state = {
    mode: 'Dark',
    accent: 8,
    radius: 12,
    fontMono: false,
    bgImage: '',
  };

  function softer(hex) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + 38;
    let g = ((n >> 8) & 255) + 30;
    let b = (n & 255) + 30;
    r = Math.min(255, r);
    g = Math.min(255, g);
    b = Math.min(255, b);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function resolveLightMode() {
    if (state.mode === 'Light') return true;
    if (state.mode === 'Dark') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function normalizeBgUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    if (/^(https?:|file:|data:|qrc:)/i.test(trimmed)) return trimmed;
    if (/^[a-zA-Z]:[\\/]/.test(trimmed)) {
      return 'file:///' + trimmed.replace(/\\/g, '/');
    }
    return trimmed;
  }

  function applyBackgroundImage(url) {
    const layer = document.getElementById('scene-bg-image');
    const veil = document.getElementById('scene-bg-veil');
    if (!layer) return;
    const normalized = normalizeBgUrl(url);
    if (normalized) {
      layer.style.backgroundImage = `url("${normalized}")`;
      document.body.classList.add('has-bg-image');
      if (veil) veil.setAttribute('aria-hidden', 'false');
    } else {
      layer.style.backgroundImage = '';
      document.body.classList.remove('has-bg-image');
      if (veil) veil.setAttribute('aria-hidden', 'true');
    }
  }

  function initThemeModeSeg(container) {
    const seg = container.querySelector('#theme-mode-seg');
    if (!seg) return;
    injectNorvikIcons(seg);
    if (window.NorvikMotion) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => NorvikMotion.animateSegThumb(seg));
      });
    }
    seg.querySelectorAll('button[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('on')) return;
        state.mode = btn.dataset.mode;
        seg.querySelectorAll('button[data-mode]').forEach((b) => {
          b.classList.toggle('on', b.dataset.mode === state.mode);
        });
        apply();
        if (window.NorvikMotion) {
          requestAnimationFrame(() => NorvikMotion.animateSegThumb(seg));
        }
      });
    });
    window.addEventListener(
      'resize',
      () => {
        if (window.NorvikMotion) NorvikMotion.animateSegThumb(seg);
      },
      { passive: true }
    );
  }

  function apply() {
    const a = ACCENTS[state.accent].c;
    const root = document.documentElement;
    const light = resolveLightMode();

    document.body.classList.add('theme-morph');
    root.dataset.themeMode = state.mode.toLowerCase();
    root.style.setProperty('--accent', a);
    root.style.setProperty('--accent-soft', softer(a));
    root.style.setProperty('--accent2', softer(a));
    root.style.setProperty('--radius', state.radius + 'px');

    document.body.classList.toggle('light', light);
    document.body.classList.toggle('font-mono', state.fontMono);

    /* Botones — gradiente idéntico en claro y oscuro (inviolable) */
    const btnPrimary = `linear-gradient(180deg, color-mix(in srgb, ${a} 95%, #000), ${a})`;
    root.style.setProperty('--btn-primary-bg', btnPrimary);
    root.style.setProperty(
      '--btn-hover-shadow',
      `0 4px 16px -4px color-mix(in srgb, ${a} 80%, transparent)`
    );

    const glowMix = light ? 38 : 26;
    root.style.setProperty(
      '--hero-glow',
      `radial-gradient(circle, color-mix(in srgb, ${a} ${glowMix}%, transparent) 0%, transparent 70%)`
    );
    root.style.setProperty(
      '--scene-radial-1',
      light
        ? `radial-gradient(120% 80% at 30% 0%, color-mix(in srgb, ${a} 24%, transparent) 0%, transparent 55%)`
        : `radial-gradient(120% 80% at 30% 0%, color-mix(in srgb, ${a} 34%, #2a3340) 0%, transparent 55%)`
    );
    root.style.setProperty(
      '--scene-radial-2',
      light
        ? `radial-gradient(120% 90% at 80% 100%, color-mix(in srgb, ${a} 14%, transparent) 0%, transparent 55%)`
        : `radial-gradient(120% 90% at 80% 100%, color-mix(in srgb, ${a} 16%, rgba(34, 43, 55, 0.9)) 0%, transparent 55%)`
    );
    root.style.setProperty(
      '--step-active-bg',
      `linear-gradient(90deg, color-mix(in srgb, ${a} 32%, transparent), color-mix(in srgb, ${a} 10%, transparent))`
    );
    root.style.setProperty(
      '--step-active-shadow',
      `0 0 26px -5px color-mix(in srgb, ${a} 65%, transparent)`
    );

    /* Glass — oscuro sólido-cristal / claro ultra-transparente sobre fondo */
    if (light) {
      root.style.setProperty('--glass-border-accent', `color-mix(in srgb, ${a} 42%, rgba(255,255,255,0.55))`);
      root.style.setProperty('--glass-border-soft', `rgba(255, 255, 255, 0.45)`);
      root.style.setProperty(
        '--glass-shell-bg',
        `linear-gradient(145deg, rgba(255,255,255,0.38), rgba(255,255,255,0.22))`
      );
      root.style.setProperty(
        '--glass-rail-bg',
        `linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.24))`
      );
      root.style.setProperty(
        '--glass-box-bg',
        `linear-gradient(145deg, rgba(255,255,255,0.44), rgba(255,255,255,0.26))`
      );
      root.style.setProperty(
        '--glass-topbar-bg',
        `linear-gradient(180deg, rgba(255,255,255,0.36), transparent)`
      );
      root.style.setProperty(
        '--shell-glow',
        `0 24px 70px rgba(30,41,70,.22), 0 0 56px color-mix(in srgb, ${a} 28%, transparent)`
      );
      root.style.setProperty('--glass-blur', '18px');
      root.style.setProperty('--glass-blur-strong', '24px');
      root.style.setProperty('--scene-veil', 'rgba(255,255,255,0.12)');
    } else {
      root.style.setProperty('--glass-border-accent', `color-mix(in srgb, ${a} 44%, transparent)`);
      root.style.setProperty('--glass-border-soft', `color-mix(in srgb, ${a} 24%, transparent)`);
      root.style.setProperty(
        '--glass-shell-bg',
        `linear-gradient(145deg, color-mix(in srgb, ${a} 24%, rgba(40,50,66,.52)), color-mix(in srgb, ${a} 11%, rgba(18,23,32,.68)))`
      );
      root.style.setProperty(
        '--glass-rail-bg',
        `linear-gradient(180deg, color-mix(in srgb, ${a} 14%, rgba(14,19,28,.72)), color-mix(in srgb, ${a} 5%, rgba(10,14,21,.88)))`
      );
      root.style.setProperty(
        '--glass-box-bg',
        `linear-gradient(145deg, color-mix(in srgb, ${a} 16%, rgba(22,10,38,.78)), color-mix(in srgb, ${a} 7%, rgba(14,6,26,.84)))`
      );
      root.style.setProperty(
        '--glass-topbar-bg',
        `linear-gradient(180deg, color-mix(in srgb, ${a} 8%, rgba(14,19,28,.4)), transparent)`
      );
      root.style.setProperty(
        '--shell-glow',
        `0 24px 80px rgba(0,0,0,.42), 0 0 56px color-mix(in srgb, ${a} 20%, transparent)`
      );
      root.style.setProperty('--glass-blur', '14px');
      root.style.setProperty('--glass-blur-strong', '18px');
      root.style.setProperty('--scene-veil', 'rgba(5, 8, 16, 0.35)');
    }

    applyBackgroundImage(state.bgImage);

    setTimeout(() => document.body.classList.remove('theme-morph'), 520);

    if (window.NorvikMotion) {
      requestAnimationFrame(() => {
        const seg = document.getElementById('theme-settings-panel')?.querySelector('#theme-mode-seg');
        if (seg) NorvikMotion.animateSegThumb(seg);
        NorvikMotion.pulseAccent();
      });
    }
  }

  function loadFromSettings(s) {
    if (s.theme_mode) state.mode = s.theme_mode;
    if (s.accent_index !== undefined && s.accent_index !== '') {
      state.accent = Math.max(0, Math.min(ACCENTS.length - 1, parseInt(s.accent_index, 10) || 0));
    } else if (s.accent_color) {
      const idx = ACCENTS.findIndex((x) => x.c.toLowerCase() === String(s.accent_color).toLowerCase());
      if (idx >= 0) state.accent = idx;
    }
    if (s.corner_radius) state.radius = parseInt(s.corner_radius, 10) || 12;
    if (s.font_mono === '1' || s.font_mono === 'true') state.fontMono = true;
    if (s.bg_image) state.bgImage = s.bg_image;
    apply();
  }

  function toSettingsPayload() {
    return {
      theme_mode: state.mode,
      accent_index: String(state.accent),
      accent_color: ACCENTS[state.accent].c,
      corner_radius: String(state.radius),
      font_mono: state.fontMono ? '1' : '0',
      bg_image: state.bgImage || '',
      theme: 'workspace',
    };
  }

  function renderSettingsPanel(container) {
    container.innerHTML = `
      <div class="label">Modo de apariencia</div>
      <div class="seg seg--theme" role="tablist" id="theme-mode-seg" aria-label="Modo de apariencia">
        <span class="seg-thumb" aria-hidden="true"></span>
        ${['Auto', 'Light', 'Dark'].map((m) => {
          const meta = MODE_META[m];
          return `<button type="button" class="${m === state.mode ? 'on' : ''}" data-mode="${m}" role="tab" aria-selected="${m === state.mode}">
            <span class="seg-icon" data-icon="${meta.icon}"></span>${meta.label}
          </button>`;
        }).join('')}
      </div>

      <div class="label">Imagen de fondo</div>
      <div class="setting-field">
        <input type="text" id="set-bg-image" placeholder="Ruta o URL (ej. ../../assets/wallpaper.jpg)" value="${state.bgImage || ''}" />
      </div>

      <div class="label">Color de acento</div>
      <div class="swatches" id="accent-swatches">
        ${ACCENTS.map((s, i) => `
          <div class="sw-wrap">
            <button type="button" class="sw ${i === state.accent ? 'active' : ''}" style="--c:${s.c};background:radial-gradient(circle at 35% 30%, ${softer(s.c)}, ${s.c})" data-acc="${i}" aria-label="${s.name}"></button>
            <span class="sw-name">${i === state.accent ? s.name : ''}</span>
          </div>`).join('')}
      </div>
      <div class="label">Radio de esquinas</div>
      <div class="slider-row">
        <input type="range" min="4" max="16" step="1" value="${state.radius}" id="theme-radius" style="--fill:${((state.radius - 4) / 12) * 100}%">
        <div class="ticks num"><span>4</span><span>8</span><span>12</span><span>16</span></div>
      </div>`;

    initThemeModeSeg(container);

    container.querySelectorAll('[data-acc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.accent = +btn.dataset.acc;
        apply();
        container.querySelectorAll('.sw').forEach((sw, i) => {
          sw.classList.toggle('active', i === state.accent);
        });
        container.querySelectorAll('.sw-name').forEach((el, i) => {
          el.textContent = i === state.accent ? ACCENTS[i].name : '';
        });
      });
    });

    const bgInput = container.querySelector('#set-bg-image');
    if (bgInput) {
      bgInput.addEventListener('change', () => {
        state.bgImage = bgInput.value.trim();
        apply();
      });
      bgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          state.bgImage = bgInput.value.trim();
          apply();
        }
      });
    }

    const rad = container.querySelector('#theme-radius');
    rad.addEventListener('input', () => {
      state.radius = +rad.value;
      rad.style.setProperty('--fill', ((rad.value - 4) / 12) * 100 + '%');
      apply();
    });
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (state.mode === 'Auto') apply();
    });
  }

  return {
    ACCENTS,
    state,
    apply,
    loadFromSettings,
    toSettingsPayload,
    renderSettingsPanel,
    softer,
  };
})();
