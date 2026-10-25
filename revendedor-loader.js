// Carrega o módulo de autenticação e exibe erros de inicialização em vez de deixar o login travado.
(function () {
  var finished = false;
  function showLoadError(text) {
    if (finished) return;
    finished = true;
    var message = document.getElementById('loginMessage');
    if (message) {
      message.textContent = text || 'O sistema de login não conseguiu iniciar. Recarregue a página; se continuar, informe ao suporte.';
      message.className = 'login-message visible error';
    }
  }
  var script = document.createElement('script');
  script.type = 'module';
  script.src = './revendedor-app.js?v=20261025-stripe-1';
  script.onerror = function () {
    showLoadError('Não foi possível baixar o sistema de login. Confira sua conexão e recarregue a página.');
  };
  document.head.appendChild(script);
  // Também detecta erro de sintaxe/importação, que nem sempre aciona script.onerror.
  window.setTimeout(function () {
    if (!window.SANBA_RESELLER_APP_READY) {
      showLoadError('O sistema de login falhou ao iniciar. Atualize a página; se continuar, informe ao suporte.');
    }
  }, 6000);
})();
