import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readRoot = (path) => readFile(new URL(path, root), "utf8");

// As 13 páginas operacionais do site. A página de protótipo e a página de
// testes ficam fora desta lista porque não são rotas de operação do produto.
const productPages = [
  "index.html",
  "cliente.html",
  "revendedor.html",
  "admin-pedidos.html",
  "aprovacoes-revendedores.html",
  "calculadora-precos.html",
  "convites-revendedores.html",
  "desenvolvedor.html",
  "kit-divulgacao.html",
  "kit-divulgacao-online.html",
  "novas-receitas.html",
  "pedidos-revendedores.html",
  "planilha-lucro.html"
];

test("as 13 páginas operacionais carregam o tradutor compartilhado", async () => {
  assert.equal(productPages.length, 13);
  for (const page of productPages) {
    const html = await readRoot(page);
    assert.match(
      html,
      /<script\b[^>]*src=["']\.\/idiomas\.js["'][^>]*>/i,
      page + ": idiomas.js ausente"
    );
  }
});

test("a escolha de idioma é persistida e o seletor fica restrito à página principal", async () => {
  const script = await readRoot("idiomas.js");
  assert.match(script, /localStorage\.setItem\(KEY, selected\)/);
  assert.match(script, /googtrans/);
  assert.match(script, /includedLanguages:\s*'pt,en,es'/);
  assert.match(script, /function isHomePage\(\)/);
  assert.match(script, /if \(!isHomePage\(\) \|\| document\.getElementById\('sanbaLanguagePicker'\)\)/);
});

test("os links internos entre as páginas operacionais apontam para arquivos existentes", async () => {
  for (const page of productPages) {
    const html = await readRoot(page);
    const links = [...html.matchAll(/\bhref\s*=\s*["']([^"']+\.html(?:[?#][^"']*)?)["']/gi)];
    for (const match of links) {
      const href = match[1];
      if (/^(?:[a-z]+:|\/\/|#)/i.test(href)) continue;
      const path = href.split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\/+/, "");
      if (!path) continue;
      await access(new URL(path, root));
    }
  }
});

test("as páginas com CSP permitem os domínios necessários ao tradutor Google", async () => {
  for (const page of productPages) {
    const html = await readRoot(page);
    const tag = html.match(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i);
    if (!tag) continue; // Páginas sem CSP não bloqueiam o tradutor por esta política.
    const content = tag[0].match(/content="([^"]*)"/i)?.[1] || "";
    const directives = Object.fromEntries(
      content.split(";").map((part) => {
        const [name, ...values] = part.trim().split(/\s+/);
        return [name, values.join(" ")];
      })
    );
    assert.match(directives["script-src"] || "", /https:\/\/translate\.google\.com/, page + ": script-src");
    assert.match(directives["connect-src"] || "", /https:\/\/translate\.googleapis\.com/, page + ": connect-src");
    assert.match(directives["frame-src"] || "", /https:\/\/translate\.googleusercontent\.com/, page + ": frame-src");
  }
});
