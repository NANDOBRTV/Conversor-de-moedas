/* Seletor global de idiomas para todas as páginas do Conversor Sanba.
   Tradução de página por Google Website Translator; preferência partilhada entre páginas. */
(function(){
  var KEY='sanba_language';
  function detect(){var l=(navigator.languages&&navigator.languages[0]||navigator.language||'pt').toLowerCase();return l.indexOf('es')===0?'es':l.indexOf('en')===0?'en':'pt';}
  function saved(){try{return localStorage.getItem(KEY)||'auto';}catch(e){return 'auto';}}
  function target(){var v=saved();return v==='auto'?detect():v;}
  function setCookie(value){try{document.cookie='googtrans=/pt/'+value+';path=/;max-age=31536000;SameSite=Lax';}catch(e){}}
  function ensureUi(){
    if(document.getElementById('sanbaLanguagePicker'))return;
    var wrap=document.createElement('div');wrap.id='sanbaLanguageWrap';
    wrap.innerHTML='<span aria-hidden="true">🌐</span><select id="sanbaLanguagePicker" aria-label="Selecionar idioma"><option value="auto">🌎 Automático</option><option value="pt">🇧🇷 Português</option><option value="en">🇺🇸 English</option><option value="es">🇪🇸 Español</option></select>';
    document.body.appendChild(wrap);
    var style=document.createElement('style');style.textContent='#sanbaLanguageWrap{position:fixed;top:12px;left:12px;z-index:99999;display:flex;align-items:center;gap:6px;padding:5px 9px;border:1px solid rgba(255,255,255,.7);border-radius:12px;background:#fff;color:#19365f;box-shadow:0 5px 18px rgba(0,0,0,.18);font:14px Arial,sans-serif}#sanbaLanguageWrap select{max-width:145px;border:0;background:transparent;color:#19365f;font-weight:700;font-size:12px;padding:5px 2px;cursor:pointer}#sanbaLanguageWrap select:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}#google_translate_element{position:absolute!important;left:-9999px!important;top:-9999px!important;visibility:hidden!important}@media(max-width:520px){#sanbaLanguageWrap{top:8px;left:8px;padding:4px 6px}#sanbaLanguageWrap select{max-width:118px;font-size:11px}}';
    document.head.appendChild(style);
    var picker=wrap.querySelector('select');picker.value=['auto','pt','en','es'].includes(saved())?saved():'auto';
    picker.addEventListener('change',function(){try{localStorage.setItem(KEY,picker.value);}catch(e){}var lang=target();setCookie(lang);if(lang==='pt'){document.cookie='googtrans=;path=/;max-age=0';}location.reload();});
    var host=document.createElement('div');host.id='google_translate_element';document.body.appendChild(host);
  }
  window.googleTranslateElementInit=function(){
    if(!window.google||!google.translate)return;
    new google.translate.TranslateElement({pageLanguage:'pt',includedLanguages:'pt,en,es',autoDisplay:false,multilanguagePage:true},'google_translate_element');
    var desired=target();if(desired!=='pt')setCookie(desired);
    var tries=0;var timer=setInterval(function(){var combo=document.querySelector('.goog-te-combo');if(combo){clearInterval(timer);if(combo.value!==desired){combo.value=desired;combo.dispatchEvent(new Event('change'));}}if(++tries>40)clearInterval(timer);},250);
  };
  function init(){ensureUi();var lang=target();document.documentElement.lang=lang==='pt'?'pt-BR':lang;if(lang!=='pt')setCookie(lang);var s=document.createElement('script');s.src='https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';s.async=true;s.onerror=function(){var p=document.getElementById('sanbaLanguagePicker');if(p)p.title='O serviço de tradução não carregou. Verifique a conexão.';};document.head.appendChild(s);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();