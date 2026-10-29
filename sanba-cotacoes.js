/* Cotações públicas de referência; separadas dos preços comerciais Sanba. */
(function () {
  'use strict';

  var root = document.getElementById('sanbaReferenceRates');
  if (!root) return;

  var status = root.querySelector('[data-rate-status]');
  var list = root.querySelector('[data-rate-list]');
  var refresh = root.querySelector('[data-rate-refresh]');
  var endpoint = 'https://api.frankfurter.dev/v2/rates?base=BRL&quotes=USD,EUR,GBP,CAD';
  var labels = { USD: 'Dólar americano', EUR: 'Euro', GBP: 'Libra esterlina', CAD: 'Dólar canadense' };
  var number = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
  var foreign = {
    USD: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 }),
    EUR: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 }),
    GBP: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 }),
    CAD: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 4 })
  };

  function message(text, state) {
    status.textContent = text;
    status.dataset.state = state || 'info';
  }

  function render(data) {
    var rates = {};
    var dates = [];
    data.forEach(function (item) {
      if (!item || item.base !== 'BRL' || !labels[item.quote] || !Number.isFinite(item.rate) || item.rate <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(item.date || '')) {
        throw new Error('A fonte retornou uma taxa inválida.');
      }
      rates[item.quote] = item.rate;
      dates.push(item.date);
    });

    var codes = Object.keys(labels);
    if (!codes.every(function (code) { return Number.isFinite(rates[code]) && rates[code] > 0; })) {
      throw new Error('A fonte não retornou todas as moedas esperadas.');
    }

    list.replaceChildren();
    codes.forEach(function (code) {
      var item = document.createElement('article');
      item.className = 'sanba-rate-item';
      var title = document.createElement('h4');
      title.textContent = code + ' · ' + labels[code];
      var main = document.createElement('strong');
      main.textContent = '1 ' + code + ' ≈ ' + brl.format(1 / rates[code]);
      var detail = document.createElement('p');
      detail.textContent = '1 BRL ≈ ' + foreign[code].format(rates[code]) + ' ' + code;
      item.append(title, main, detail);
      list.appendChild(item);
    });

    dates.sort();
    var date = dates[dates.length - 1];
    var formattedDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
    message('Cotações de referência publicadas em ' + formattedDate + '. Fonte: Frankfurter.', 'success');
  }

  async function load() {
    refresh.disabled = true;
    refresh.textContent = 'Atualizando…';
    message('Consultando cotações de referência…', 'loading');
    list.replaceChildren();
    try {
      var response = await fetch(endpoint, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('Resposta vazia');
      render(data);
      refresh.textContent = 'Atualizar taxas';
    } catch (_) {
      message('Não foi possível carregar as cotações. Confira a conexão e tente novamente.', 'error');
      refresh.textContent = 'Tentar novamente';
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener('click', load);
  load();
})();
