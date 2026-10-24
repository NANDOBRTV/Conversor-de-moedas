// Carregador externo compatível com a política CSP do GitHub Pages.
// Se o módulo principal não carregar, mostra o problema no próprio formulário.
(function () {
  function showLoadError() {
    var message = document.getElementById('loginMessage');
    if (message) {
      message.textContent = 'Não foi possível carregar o sistema de login. Atualize a página; se continuar, informe ao suporte que o arquivo revendedor-app.js não carregou.';
      message.className = 'login-message visible error';
    }
  }
  var script = document.createElement('script');
  script.type = 'module';
  script.src = './revendedor-app.js?v=20261024-2';
  script.onerror = showLoadError;
  document.head.appendChild(script);
})();
