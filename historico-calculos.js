/* Histórico local de cálculos — não armazena o ID Sanba nem envia dados para servidores. */
(function () {
  "use strict";

  const STORAGE_KEY = "sanba_calculation_history_v1";
  const MAX_ITEMS = 15;
  const card = document.querySelector(".card");
  if (!card || document.getElementById("calculationHistory")) return;

  const style = document.createElement("style");
  style.textContent = `
    #calculationHistory{margin-top:18px;padding:14px;border:1px solid #dbe3ef;border-radius:14px;background:#f8fafc;color:#243247}
    #calculationHistory h2{font-size:16px;color:#1e3c72;margin:0 0 6px}
    #calculationHistory .history-help{font-size:12px;line-height:1.5;color:#64748b;margin:0 0 12px}
    #calculationHistory .history-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    #calculationHistory button{border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#1e3c72;padding:9px 10px;font:700 12px system-ui;cursor:pointer}
    #calculationHistory button:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}
    #calculationHistory .history-list{list-style:none;padding:0;margin:0;display:grid;gap:8px}
    #calculationHistory .history-item{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px}
    #calculationHistory .history-item strong{display:block;font-size:13px;color:#0f172a}
    #calculationHistory .history-item small{display:block;color:#64748b;margin:3px 0 8px}
    #calculationHistory .history-item button{width:100%;min-height:38px}
    #calculationHistory .history-empty{font-size:12px;color:#64748b;padding:10px 0}
    #calculationHistory .history-status{font-size:12px;color:#047857;min-height:1.4em;margin:8px 0 0}
  `;
  document.head.appendChild(style);

  const panel = document.createElement("section");
  panel.id = "calculationHistory";
  panel.setAttribute("aria-labelledby", "calculationHistoryTitle");
  panel.innerHTML = `
    <h2 id="calculationHistoryTitle">Histórico de cálculos</h2>
    <p class="history-help">Seus últimos cálculos ficam somente neste navegador. Por privacidade, o ID Sanba não é salvo nem exportado.</p>
    <div class="history-actions">
      <button type="button" id="exportCalculationHistory">Exportar CSV</button>
      <button type="button" id="clearCalculationHistory">Apagar histórico</button>
    </div>
    <ul class="history-list" id="calculationHistoryList" aria-live="polite"></ul>
    <p class="history-status" id="calculationHistoryStatus" role="status"></p>
  `;
  card.appendChild(panel);

  const list = panel.querySelector("#calculationHistoryList");
  const status = panel.querySelector("#calculationHistoryStatus");
  const currencySelect = document.getElementById("currencySelect");
  const coinsInput = document.getElementById("moedas");
  const valueInput = document.getElementById("reais");
  let pendingCapture;

  function readHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.filter(isValidItem).slice(0, MAX_ITEMS) : [];
    } catch (_) {
      return [];
    }
  }

  function isValidItem(item) {
    return item && ["coins", "value"].includes(item.mode)
      && ["BRL", "USD", "VES"].includes(item.currency)
      && typeof item.input === "string"
      && typeof item.output === "string"
      && typeof item.result === "string"
      && typeof item.createdAt === "string";
  }

  function writeHistory(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
      return true;
    } catch (_) {
      status.textContent = "O navegador não permitiu salvar o histórico local.";
      return false;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR");
  }

  function render() {
    const items = readHistory();
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "history-empty";
      empty.textContent = "Nenhum cálculo salvo ainda. Faça uma simulação para começar.";
      list.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "history-item";
      const title = document.createElement("strong");
      title.textContent = item.mode === "coins"
        ? item.input + " moedas → " + item.result
        : item.input + " → " + item.output + " moedas";
      const date = document.createElement("small");
      date.textContent = item.currency + " · " + formatDate(item.createdAt);
      const restore = document.createElement("button");
      restore.type = "button";
      restore.textContent = "Usar este cálculo";
      restore.setAttribute("aria-label", "Reutilizar cálculo de " + title.textContent);
      restore.addEventListener("click", function () {
        currencySelect.value = item.currency;
        currencySelect.dispatchEvent(new Event("change", { bubbles: true }));
        if (item.mode === "coins") {
          document.getElementById("tabC")?.click();
          coinsInput.value = item.input.replace(/[^0-9]/g, "");
          coinsInput.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          document.getElementById("tabR")?.click();
          valueInput.value = item.input;
          valueInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        status.textContent = "Cálculo restaurado. Confira os dados antes de continuar.";
      });
      li.append(title, date, restore);
      list.appendChild(li);
    });
  }

  function capture() {
    const isCoins = document.getElementById("tabC")?.getAttribute("aria-selected") === "true";
    const isValue = document.getElementById("tabR")?.getAttribute("aria-selected") === "true";
    if (isCoins && !document.getElementById("resC")?.classList.contains("show")) return;
    if (isValue && !document.getElementById("resR")?.classList.contains("show")) return;
    if (!isCoins && !isValue) return;
    const mode = isCoins ? "coins" : "value";
    const input = String((isCoins ? coinsInput : valueInput).value || "").trim();
    const result = String(document.getElementById(isCoins ? "valC" : "valR")?.textContent || "").trim();
    const output = String(document.getElementById(isCoins ? "detC" : "detR")?.textContent || "").trim();
    if (!input || !result || !output) return;

    const item = {
      mode,
      currency: currencySelect.value,
      input,
      output,
      result,
      createdAt: new Date().toISOString()
    };
    const items = readHistory();
    const previous = items[0];
    if (previous && previous.mode === item.mode && previous.currency === item.currency
      && previous.input === item.input && previous.result === item.result) return;
    items.unshift(item);
    if (writeHistory(items)) {
      status.textContent = "Cálculo salvo no histórico deste navegador.";
      render();
    }
  }

  function scheduleCapture() {
    clearTimeout(pendingCapture);
    pendingCapture = setTimeout(capture, 650);
  }

  coinsInput?.addEventListener("input", scheduleCapture);
  valueInput?.addEventListener("input", scheduleCapture);
  currencySelect?.addEventListener("change", scheduleCapture);

  panel.querySelector("#clearCalculationHistory").addEventListener("click", function () {
    if (!window.confirm("Apagar o histórico de cálculos salvo neste navegador?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      status.textContent = "Histórico local apagado.";
      render();
    } catch (_) {
      status.textContent = "Não foi possível apagar o histórico neste navegador.";
    }
  });

  panel.querySelector("#exportCalculationHistory").addEventListener("click", function () {
    const items = readHistory();
    if (!items.length) {
      status.textContent = "Não há cálculos para exportar.";
      return;
    }
    const rows = [
      ["data", "modo", "moeda", "entrada", "resultado", "detalhe"],
      ...items.map((item) => [item.createdAt, item.mode, item.currency, item.input, item.result, item.output])
    ];
    const csv = rows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historico-calculos-sanba.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status.textContent = "Arquivo CSV preparado. O ID Sanba não faz parte da exportação.";
  });

  render();
})();