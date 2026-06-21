/* Norvik i18n — Español / English */
(function () {
  const STRINGS = {
    es: {
      'app.tagline': 'Gobernanza, Riesgo y Cumplimiento empresarial',
      'nav.dashboard': 'Dashboard',
      'nav.framework': 'Framework',
      'nav.reports': 'Informes PDF',
      'nav.ai': 'Asistente IA',
      'nav.settings': 'Configuración',
      'nav.support': 'Soporte',
      'nav.collapse': 'Colapsar',
      'panel.dashboard': 'Governance & Compliance',
      'panel.frameworks': 'Framework',
      'panel.reports': 'Informes y análisis de brechas',
      'panel.ai': 'Asistente IA',
      'panel.settings': 'Configuración',
      'search.placeholder': 'Buscar controles, marcos o dominios...',
      'notif.title': 'Notificaciones',
      'notif.markRead': 'Marcar todo como leído',
      'notif.viewAll': 'Ver todas las notificaciones',
      'demo.badge': 'DEMO',
      'demo.banner': 'Datos de demostración — no válidos para auditoría',
      'demo.remove': 'Quitar demo',
      'demo.loaded': 'Datos de demostración cargados',
      'demo.removed': 'Datos demo eliminados',
      'demo.confirmClear': '¿Eliminar todos los datos de demostración? Las evaluaciones reales no se borran.',
      'dash.emptyTitle': 'No hay datos de cumplimiento todavía',
      'dash.emptyBody': 'Comience configurando su primer marco normativo o cargue datos de demostración para explorar el dashboard sin evaluaciones reales.',
      'dash.startEval': 'Comenzar evaluación',
      'dash.loadDemo': 'Cargar datos de demostración',
      'dash.compliancePanel': 'Panel de cumplimiento',
      'dash.complianceSub': 'Monitoreo de cumplimiento en {org}.',
      'dash.complianceSubDefault': 'Monitoreo de cumplimiento entre marcos y vectores de riesgo.',
      'dash.engineActive': 'Motor de cumplimiento activo',
      'dash.lastUpdate': 'Última actualización: {date}',
      'dash.sync': 'Sincronizar',
      'dash.filters': 'Filtros',
      'dash.exportPdf': 'Exportar PDF',
      'dash.filtersActive': 'Filtros activos:',
      'dash.clearFilters': 'Limpiar todo',
      'dash.updated': 'Dashboard actualizado',
      'settings.title': 'Configuración',
      'settings.language': 'Idioma',
      'settings.languageHint': 'Interfaz, informes PDF y asistente IA',
      'settings.saved': 'Configuración guardada',
      'settings.org': 'Organización',
      'settings.provider': 'Proveedor',
      'settings.providerLocal': 'Local (Ollama en este equipo)',
      'settings.providerCloud': 'Cloud (ollama.com)',
      'settings.ollamaHost': 'URL local',
      'settings.cloudKey': 'API Key Cloud',
      'settings.model': 'Modelo',
      'settings.aiPrompt': 'Rol del asistente (system prompt)',
      'ollama.checking': 'Ollama: comprobando...',
      'ollama.on': 'Ollama: ON ({prov} · {model})',
      'ollama.off': 'Ollama: OFF',
      'ai.analyzing': 'Analizando…',
      'ai.generating': 'Generando análisis con Ollama…',
      'ai.live': 'ANÁLISIS EN VIVO',
      'ai.noConnection': 'Sin conexión',
      'ai.analyzingGap': 'Analizando gap...',
      'pdf.generating': 'Generando análisis IA para el informe…',
      'pdf.done': 'Informe PDF generado',
      'pdf.doneAi': 'Informe PDF generado con análisis IA',
      'breadcrumb.home': 'Inicio',
      'breadcrumb.dashboard': 'Dashboard',
      'support.title': 'Soporte',
      'support.body1': 'Norvik es tu plataforma de gobernanza, riesgo y cumplimiento (GRC) para evaluar madurez, priorizar brechas y documentar evidencias bajo NIST CSF 2.0, ISO 27001, CIS Controls v8 y RGPD.',
      'support.body2': 'Si necesitas ayuda con la configuración, la interpretación de controles o soporte técnico, contacta al administrador de tu organización o consulta la documentación de licencia del producto.',
      'support.license': 'Licencia comercial · Norvik GRC',
      'support.docs': 'Documentación · GitHub',
      'support.meta': 'Norvik · Enterprise Edition · Documentación en línea',
      'common.error': 'Error',
      'common.cancel': 'Cancelar',
      'common.save': 'Guardar',
      'common.org': 'Organización',
      'common.lastReview': 'Última revisión: —',
      'loader.init': 'Inicializando núcleo seguro',
    },
    en: {
      'app.tagline': 'Enterprise Governance, Risk & Compliance',
      'nav.dashboard': 'Dashboard',
      'nav.framework': 'Framework',
      'nav.reports': 'PDF Reports',
      'nav.ai': 'AI Assistant',
      'nav.settings': 'Settings',
      'nav.support': 'Support',
      'nav.collapse': 'Collapse',
      'panel.dashboard': 'Governance & Compliance',
      'panel.frameworks': 'Framework',
      'panel.reports': 'Reports & gap analysis',
      'panel.ai': 'AI Assistant',
      'panel.settings': 'Settings',
      'search.placeholder': 'Search controls, frameworks or domains...',
      'notif.title': 'Notifications',
      'notif.markRead': 'Mark all as read',
      'notif.viewAll': 'View all notifications',
      'demo.badge': 'DEMO',
      'demo.banner': 'Demo data — not valid for audit',
      'demo.remove': 'Remove demo',
      'demo.loaded': 'Demo data loaded',
      'demo.removed': 'Demo data removed',
      'demo.confirmClear': 'Remove all demo data? Real assessments will not be deleted.',
      'dash.emptyTitle': 'No compliance data yet',
      'dash.emptyBody': 'Configure your first framework or load demo data to explore the dashboard without real assessments.',
      'dash.startEval': 'Start assessment',
      'dash.loadDemo': 'Load demo data',
      'dash.compliancePanel': 'Compliance dashboard',
      'dash.complianceSub': 'Compliance monitoring for {org}.',
      'dash.complianceSubDefault': 'Compliance monitoring across frameworks and risk vectors.',
      'dash.engineActive': 'Compliance engine active',
      'dash.lastUpdate': 'Last update: {date}',
      'dash.sync': 'Sync',
      'dash.filters': 'Filters',
      'dash.exportPdf': 'Export PDF',
      'dash.filtersActive': 'Active filters:',
      'dash.clearFilters': 'Clear all',
      'dash.updated': 'Dashboard updated',
      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.languageHint': 'UI, PDF reports and AI assistant',
      'settings.saved': 'Settings saved',
      'settings.org': 'Organization',
      'settings.provider': 'Provider',
      'settings.providerLocal': 'Local (Ollama on this machine)',
      'settings.providerCloud': 'Cloud (ollama.com)',
      'settings.ollamaHost': 'Local URL',
      'settings.cloudKey': 'Cloud API Key',
      'settings.model': 'Model',
      'settings.aiPrompt': 'Assistant role (system prompt)',
      'ollama.checking': 'Ollama: checking...',
      'ollama.on': 'Ollama: ON ({prov} · {model})',
      'ollama.off': 'Ollama: OFF',
      'ai.analyzing': 'Analyzing…',
      'ai.generating': 'Generating analysis with Ollama…',
      'ai.live': 'LIVE ANALYSIS',
      'ai.noConnection': 'No connection',
      'ai.analyzingGap': 'Analyzing gap...',
      'pdf.generating': 'Generating AI analysis for report…',
      'pdf.done': 'PDF report generated',
      'pdf.doneAi': 'PDF report generated with AI analysis',
      'breadcrumb.home': 'Home',
      'breadcrumb.dashboard': 'Dashboard',
      'support.title': 'Support',
      'support.body1': 'Norvik is your governance, risk and compliance (GRC) platform to assess maturity, prioritize gaps and document evidence under NIST CSF 2.0, ISO 27001, CIS Controls v8 and GDPR.',
      'support.body2': 'For help with setup, control interpretation or technical support, contact your organization administrator or see the product license documentation.',
      'support.license': 'Commercial license · Norvik GRC',
      'support.docs': 'Documentation · GitHub',
      'support.meta': 'Norvik · Enterprise Edition · Online documentation',
      'common.error': 'Error',
      'common.cancel': 'Cancel',
      'common.save': 'Save',
      'common.org': 'Organization',
      'common.lastReview': 'Last review: —',
      'loader.init': 'Initializing secure core',
    },
  };

  let locale = 'es';

  function t(key, params) {
    const bag = STRINGS[locale] || STRINGS.es;
    let text = bag[key] || STRINGS.es[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''));
      });
    }
    return text;
  }

  function panelTitles() {
    return {
      dashboard: t('panel.dashboard'),
      frameworks: t('panel.frameworks'),
      reports: t('panel.reports'),
      ai: t('panel.ai'),
      settings: t('panel.settings'),
    };
  }

  function setLocale(next) {
    locale = next === 'en' ? 'en' : 'es';
    document.documentElement.lang = locale;
    applyDom();
    if (typeof window.onNorvikLocaleChange === 'function') {
      window.onNorvikLocaleChange(locale);
    }
  }

  function getLocale() {
    return locale;
  }

  function applyDom() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    const tagline = document.querySelector('.nl-tagline');
    if (tagline) tagline.textContent = t('app.tagline');
    const phase = document.getElementById('nl-phase-text');
    if (phase) phase.textContent = t('loader.init');
    const subtitle = document.getElementById('page-subtitle');
    if (subtitle && subtitle.dataset.i18nStatic) subtitle.textContent = t('common.lastReview');
  }

  window.NorvikI18n = { t, setLocale, getLocale, applyDom, panelTitles, STRINGS };
})();
