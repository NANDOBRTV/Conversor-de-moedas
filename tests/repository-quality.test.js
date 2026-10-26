import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const root = new URL("../", import.meta.url);
const readRoot = (path) => readFile(new URL(path, root), "utf8");

test("a página principal declara idioma, viewport e política CSP", async () => {
  const html = await readRoot("index.html");
  assert.match(html, /<html[^>]+lang=["']pt-BR["']/i);
  assert.match(html, /name=["']viewport["']/i);
  assert.match(html, /http-equiv=["']Content-Security-Policy["']/i);
});

test("a página principal não contém IDs HTML duplicados", async () => {
  const html = await readRoot("index.html");
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  assert.deepEqual([...duplicates], [], `IDs duplicados: ${[...duplicates].join(", ")}`);
});

test("os controles críticos do conversor continuam presentes", async () => {
  const html = await readRoot("index.html");
  for (const id of [
    "currencySelect", "userId", "moedas", "reais", "resC", "resR",
    "wppC", "wppR", "copyC", "copyR", "clearAll"
  ]) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`), `Controle ausente: ${id}`);
  }
});

test("a página principal não contém padrões comuns de segredos de produção", async () => {
  const html = await readRoot("index.html");
  assert.doesNotMatch(html, /sk_live_[A-Za-z0-9]+/);
  assert.doesNotMatch(html, /whsec_[A-Za-z0-9]+/);
  assert.doesNotMatch(html, /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][^"']+/i);
});

test("arquivos centrais e testes do navegador existem", async () => {
  for (const path of ["index.html", "supabase-config.js", "testes-conversor.html", "supabase/schema.sql"]) {
    await access(new URL(path, root), constants.R_OK);
  }
});
