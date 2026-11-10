
/* Remove parâmetros de credenciais de URLs antigas antes de carregar o app. */
(function () {
  try {
    var url = new URL(window.location.href);
    var sensitive = ['username','password','pass','user','email','new-password'];
    var changed = false;
    sensitive.forEach(function (key) {
      if (url.searchParams.has(key)) { url.searchParams.delete(key); changed = true; }
    });
    if (changed) window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
  } catch (_) {}
})();
