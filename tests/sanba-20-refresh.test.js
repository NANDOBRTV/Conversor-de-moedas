import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const readRoot = (path) => readFile(new URL(path, root), "utf8");

test("o protótipo Sanba 2.0 consulta taxas de referência e mostra a data", async () => {
  const html = await readRoot("prototipo-sanba-2.html");
  assert.match(html, /https:\/\/api\.frankfurter\.dev\/v2\/rates\?base=BRL&quotes=USD,EUR,GBP,CAD/);
  assert.match(html, /id="quote-source-note"/);
  assert.match(html, /dateFmt\(quoteDate\)/);
  assert.match(html, /Não são cotações em tempo real/i);
  assert.match(html, /Nenhum valor fictício será exibido/i);
  assert.doesNotMatch(html, /const rates=\{BRL:1,USD:0\.2/);
});

test("o conversor de demonstração oferece os cinco códigos de moeda e atualização manual", async () => {
  const html = await readRoot("prototipo-sanba-2.html");
  for (const code of ["BRL", "USD", "EUR", "GBP", "CAD"]) {
    assert.match(html, new RegExp('option value="' + code + '"'));
  }
  assert.match(html, /id="refresh-rates"/);
  assert.match(html, /id="swap"/);
  assert.match(html, /id="copy"/);
});

test("as áreas de cliente e revendedor mantêm a estrutura e recebem o tema Sanba 2.0", async () => {
  const customer = await readRoot("cliente.html");
  const reseller = await readRoot("revendedor.html");
  assert.match(customer, /id="sanba-20-refresh"/);
  assert.match(customer, /id="authForm"/);
  assert.match(customer, /supabase/i);
  assert.match(reseller, /id="sanba-20-refresh"/);
  assert.match(reseller, /revendedor-loader\.js/);
  assert.match(reseller, /supabase-config\.js/);
});

test("o JavaScript inline do protótipo passa na verificação de sintaxe do Node", async () => {
  const html = await readRoot("prototipo-sanba-2.html");
  const scripts = [...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  assert.ok(scripts.length > 0, "Nenhum script inline encontrado");
  for (const script of scripts) {
    const check = spawnSync(process.execPath, ["--check", "--input-type=commonjs"], {
      input: script,
      encoding: "utf8",
    });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  }
});
