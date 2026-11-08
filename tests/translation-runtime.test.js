import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const scriptSource = await readFile(new URL("../idiomas.js", import.meta.url), "utf8");

function createEnvironment({ pathname, browserLanguage = "pt-BR", savedLanguage = null }) {
  const elements = new Map();
  const headChildren = [];
  const bodyChildren = [];
  const cookieWrites = [];
  const storage = new Map();
  if (savedLanguage) storage.set("sanba_language", savedLanguage);
  let reloaded = false;

  function createSelect() {
    const listeners = {};
    return {
      value: "",
      listeners,
      addEventListener(type, callback) { listeners[type] = callback; },
      dispatchEvent(event) {
        if (listeners[event.type]) listeners[event.type](event);
      }
    };
  }

  function createElement(tagName) {
    const element = {
      tagName: tagName.toUpperCase(),
      id: "",
      style: {},
      children: [],
      addEventListener() {},
      querySelector(selector) {
        return selector === "select" ? (this.select || null) : null;
      },
      setAttribute(name, value) {
        this.attributes ||= {};
        this.attributes[name] = value;
      }
    };
    Object.defineProperty(element, "innerHTML", {
      set(value) {
        this._innerHTML = value;
        if (tagName === "div" && value.includes("<select")) this.select = createSelect();
      },
      get() { return this._innerHTML || ""; }
    });
    return element;
  }

  const document = {
    readyState: "complete",
    documentElement: {
      lang: "",
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; }
    },
    head: {
      appendChild(element) {
        headChildren.push(element);
        if (element.id) elements.set(element.id, element);
      }
    },
    body: {
      appendChild(element) {
        bodyChildren.push(element);
        if (element.id) elements.set(element.id, element);
      }
    },
    createElement,
    getElementById(id) { return elements.get(id) || null; },
    querySelector() { return null; },
    addEventListener() {}
  };
  Object.defineProperty(document, "cookie", {
    get() { return cookieWrites.at(-1)?.split(";")[0] || ""; },
    set(value) { cookieWrites.push(String(value)); }
  });

  const location = { pathname, reload() { reloaded = true; } };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  };
  const window = {
    setInterval() { return 1; },
    clearInterval() {}
  };

  runInNewContext(scriptSource, {
    window,
    document,
    location,
    localStorage,
    navigator: { languages: [browserLanguage], language: browserLanguage },
    Event: class Event {
      constructor(type, options = {}) { this.type = type; this.bubbles = Boolean(options.bubbles); }
    }
  });

  return {
    document,
    elements,
    headChildren,
    bodyChildren,
    cookieWrites,
    storage,
    location,
    window,
    get reloaded() { return reloaded; },
    get scripts() { return headChildren.filter((item) => item.tagName === "SCRIPT"); },
    get picker() { return elements.get("sanbaLanguageWrap")?.select || null; }
  };
}

test("em português, o seletor fica na página principal e o tradutor externo não é carregado", () => {
  const env = createEnvironment({ pathname: "/Conversor-de-moedas/" });

  assert.ok(env.elements.has("sanbaLanguageWrap"));
  assert.equal(env.picker.value, "auto");
  assert.equal(env.scripts.length, 0);
  assert.equal(env.elements.has("google_translate_element"), false);
  assert.equal(env.document.documentElement.lang, "pt-BR");
});

test("em página interna, o idioma salvo é aplicado sem repetir o seletor", () => {
  const env = createEnvironment({
    pathname: "/Conversor-de-moedas/cliente.html",
    savedLanguage: "en"
  });

  assert.equal(env.elements.has("sanbaLanguageWrap"), false);
  assert.ok(env.elements.has("google_translate_element"));
  assert.equal(env.scripts.length, 1);
  assert.equal(env.scripts[0].src, "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit");
  assert.ok(env.cookieWrites.some((value) => value.includes("googtrans=/pt/en")));
  assert.equal(env.document.documentElement.lang, "en");
});

test("escolher espanhol na página principal salva a preferência e recarrega", () => {
  const env = createEnvironment({ pathname: "/Conversor-de-moedas/" });

  env.picker.value = "es";
  env.picker.listeners.change();

  assert.equal(env.storage.get("sanba_language"), "es");
  assert.ok(env.cookieWrites.some((value) => value.includes("googtrans=/pt/es")));
  assert.equal(env.reloaded, true);
});

test("o modo automático respeita a língua espanhola do navegador", () => {
  const env = createEnvironment({
    pathname: "/Conversor-de-moedas/planilha-lucro.html",
    browserLanguage: "es-MX"
  });

  assert.equal(env.document.documentElement.lang, "es");
  assert.equal(env.scripts.length, 1);
  assert.ok(env.cookieWrites.some((value) => value.includes("googtrans=/pt/es")));
});
