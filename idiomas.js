/* Idioma escolhido na página principal e aplicado em todas as páginas do site. */
(function () {
  'use strict';
  var KEY = 'sanba_language';
  var BASE_PATH = '/Conversor-de-moedas/';

  function detectLanguage() {
    var languages = navigator.languages || [navigator.language || 'pt'];
    var language = String(languages[0] || 'pt').toLowerCase();
    if (language.indexOf('es') === 0) return 'es';
    if (language.indexOf('en') === 0) return 'en';
    return 'pt';
  }

  function getSavedLanguage() {
    try {
      var value = localStorage.getItem(KEY) || 'auto';
      return ['auto', 'pt', 'en', 'es'].indexOf(value) >= 0 ? value : 'auto';
    } catch (error) {
      return 'auto';
    }
  }

  function getTargetLanguage() {
    var value = getSavedLanguage();
    return value === 'auto' ? detectLanguage() : value;
  }

  function setTranslationCookie(language) {
    try {
      var value = '/pt/' + language;
      document.cookie = 'googtrans=' + value + ';path=/;max-age=31536000;SameSite=Lax';
      document.cookie = 'googtrans=' + value + ';path=' + BASE_PATH + ';max-age=31536000;SameSite=Lax';
    } catch (error) {}
  }

  function clearTranslationCookies() {
    try {
      document.cookie = 'googtrans=;path=/;max-age=0;SameSite=Lax';
      document.cookie = 'googtrans=;path=' + BASE_PATH + ';max-age=0;SameSite=Lax';
    } catch (error) {}
  }

  function isHomePage() {
    var path = location.pathname;
    return path === BASE_PATH || path === BASE_PATH + 'index.html' ||
      path === '/' || path === '/index.html';
  }

  function addStyles() {
    if (document.getElementById('sanbaLanguageStyles')) return;
    var style = document.createElement('style');
    style.id = 'sanbaLanguageStyles';
    style.textContent =
      '#sanbaLanguageWrap{position:fixed;top:14px;left:14px;z-index:99999;display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid #d5deeb;border-radius:12px;background:#fff;color:#19365f;box-shadow:0 5px 18px rgba(0,0,0,.18);font:14px Arial,sans-serif}' +
      '#sanbaLanguageWrap .language-icon{font-size:18px;line-height:1}' +
      '#sanbaLanguageWrap select{max-width:150px;border:0;background:transparent;color:#19365f;font-weight:700;font-size:13px;padding:4px 2px;cursor:pointer;outline-offset:3px}' +
      '#google_translate_element{position:absolute!important;left:-10000px!important;top:0!important;width:1px!important;height:1px!important;overflow:hidden!important}' +
      '@media(max-width:520px){#sanbaLanguageWrap{top:8px;left:8px;padding:5px 7px}#sanbaLanguageWrap select{max-width:125px;font-size:12px}}';
    document.head.appendChild(style);
  }

  function ensureTranslatorHost() {
    if (!document.getElementById('google_translate_element')) {
      var host = document.createElement('div');
      host.id = 'google_translate_element';
      document.body.appendChild(host);
    }
  }

  function addHomePageSelector() {
    if (!isHomePage() || document.getElementById('sanbaLanguagePicker')) return;
    var wrap = document.createElement('div');
    wrap.id = 'sanbaLanguageWrap';
    wrap.innerHTML = '<span class="language-icon" aria-hidden="true">🌐</span>' +
      '<select id="sanbaLanguagePicker" aria-label="Idioma do site">' +
      '<option value="auto">Automático</option>' +
      '<option value="pt">🇧🇷 Português</option>' +
      '<option value="en">🇺🇸 English</option>' +
      '<option value="es">🇪🇸 Español</option></select>';
    document.body.appendChild(wrap);
    var picker = wrap.querySelector('select');
    picker.value = getSavedLanguage();
    picker.addEventListener('change', function () {
      var selected = picker.value;
      try { localStorage.setItem(KEY, selected); } catch (error) {}
      var language = selected === 'auto' ? detectLanguage() : selected;
      if (language === 'pt') clearTranslationCookies();
      else setTranslationCookie(language);
      location.reload();
    });
  }

  window.googleTranslateElementInit = function () {
    if (!window.google || !window.google.translate) return;
    new window.google.translate.TranslateElement({
      pageLanguage: 'pt',
      includedLanguages: 'pt,en,es',
      autoDisplay: false,
      multilanguagePage: true
    }, 'google_translate_element');

    var desired = getTargetLanguage();
    if (desired === 'pt') {
      clearTranslationCookies();
      return;
    }
    setTranslationCookie(desired);
    var attempts = 0;
    var timer = window.setInterval(function () {
      var combo = document.querySelector('.goog-te-combo');
      if (combo) {
        window.clearInterval(timer);
        if (combo.value !== desired) {
          combo.value = desired;
          combo.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (++attempts >= 60) window.clearInterval(timer);
    }, 250);
  };

  function init() {
    addStyles();
    ensureTranslatorHost();
    addHomePageSelector();
    var language = getTargetLanguage();
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : language;
    if (language !== 'pt') setTranslationCookie(language);

    var script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    script.onerror = function () {
      var picker = document.getElementById('sanbaLanguagePicker');
      if (picker) picker.title = 'A tradução não carregou. Verifique a conexão e tente novamente.';
    };
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();