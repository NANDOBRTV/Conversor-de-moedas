import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readRoot = (path) => readFile(new URL(path, root), "utf8");

const pages = [
  "index.html",
  "cliente.html",
  "revendedor.html",
  "admin-pedidos.html",
  "aprovacoes-revendedores.html",
  "convites-revendedores.html",
  "pedidos-revendedores.html",
  "calculadora-precos.html",
  "planilha-lucro.html",
  "novas-receitas.html",
  "kit-divulgacao.html",
  "kit-divulgacao-online.html",
  "desenvolvedor.html",
  "testes-conversor.html",
  "prototipo-sanba-2.html"
];

test("todas as páginas HTML do produto carregam o tema compartilhado Sanba 2.0", async () => {
  for (const path of pages) {
    const html = await readRoot(path);
    assert.match(html, /<html[^>]+lang=["']pt-BR["']/i, `${path}: idioma pt-BR`);
    assert.match(html, /<meta[^>]+name=["']viewport["']/i, `${path}: viewport responsivo`);
    assert.match(html, /<link[^>]+href=["']\.\/sanba-20-theme\.css\?v=20261029["']/i, `${path}: tema compartilhado`);
  }
});

test("o tema compartilhado inclui tokens de marca, foco acessível, responsividade e movimento reduzido", async () => {
  const css = await readRoot("sanba-20-theme.css");
  for (const token of [
    "--sanba-ink: #0f172a",
    "--sanba-teal: #0f766e",
    "--sanba-mint: #ccfbf1",
    "--sanba-page: #f4f7fb",
    ":focus-visible",
    "@media (max-width: 640px)",
    "@media (prefers-reduced-motion: reduce)"
  ]) {
    assert.ok(css.includes(token), `Token/regra ausente no tema: ${token}`);
  }
});

test("a camada visual não injeta scripts nem depende de recursos externos", async () => {
  const css = await readRoot("sanba-20-theme.css");
  assert.doesNotMatch(css, /@import\s+url\s*\(/i);
  assert.doesNotMatch(css, /https?:\/\//i);
  assert.doesNotMatch(css, /<script/i);
});
