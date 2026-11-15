// Run locally; do not commit output. Requires git history with the original files.
// Copies legacy content from the original commit, removes front-end access checks,
// and produces isolated standalone documents for the PRIVATE Supabase Storage bucket.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUTPUT = join(ROOT, "private-artifacts");
const BASE_COMMIT = "2c16c6629f4754b8a54f378609d41a92cbb2034c";
const get = path => execFileSync("git", ["show", BASE_COMMIT + ":" + path], { encoding: "utf8" });
const safeDocument = (title, style, inner, script = "") =>
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
  title + '</title><style>' + style + '</style></head><body>' + inner +
  (script ? '<script>' + script + '</script>' : '') + '</body></html>';
const getStyle = html => (html.match(/<style>([\s\S]*?)<\/style>/i) || [,""])[1];
function requireMatch(value, message) { if (!value) throw new Error(message); return value; }

const kit = get("kit-divulgacao-online.html");
const kitBody = requireMatch(kit.match(/<article id="content" hidden>([\s\S]*?)<\/article>/i), "Kit original not found")[1];
const kitHtml = safeDocument("Kit de Divulgação Sanba", getStyle(kit), '<article id="content">' + kitBody + "</article>");

const sheet = get("planilha-lucro.html");
const sheetScript = requireMatch(sheet.match(/<script type="module">([\s\S]*?)<\/script>/i), "Sheet script missing")[1];
let sheetLogic = sheetScript.slice(sheetScript.indexOf("function v(id)"));
if (!sheetLogic.startsWith("function v(id)")) throw new Error("Sheet calculation entry missing");
if (!sheetLogic.endsWith("verify();\n") && !/verify\(\);\s*$/.test(sheetLogic)) throw new Error("Unexpected sheet initialization");
sheetLogic = sheetLogic.replace(/verify\(\);\s*$/, "$('gate').classList.add('hidden');$('app').classList.remove('hidden');calc();");
const sheetBody = sheet.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, "");
const sheetInner = requireMatch(sheetBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i), "Sheet body missing")[1];
const sheetHtml = safeDocument("Planilha de Lucro", getStyle(sheet), sheetInner,
  "const $=id=>document.getElementById(id);const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});" + sheetLogic);

const calc = get("calculadora-precos.html");
const calcScript = requireMatch(calc.match(/<script type="module">([\s\S]*?)<\/script>/i), "Price calculator script missing")[1];
let calcLogic = calcScript.slice(calcScript.indexOf("function num(id)"));
if (!calcLogic.startsWith("function num(id)")) throw new Error("Calculator entry missing");
calcLogic = calcLogic.replace(/init\(\);\s*$/, "$('gate').classList.add('hidden');$('tool').classList.remove('hidden');calc();");
const calcBody = calc.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, "");
const calcInner = requireMatch(calcBody.match(/<body[^>]*>([\s\S]*?)<\/body>/i), "Calculator body missing")[1];
const calcHtml = safeDocument("Calculadora de Preços", getStyle(calc), calcInner,
  "const $=id=>document.getElementById(id);const fmt=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';" + calcLogic);

mkdirSync(OUTPUT, { recursive: true, mode: 0o700 });
for (const [name, html] of [
  ["kit_divulgacao.html", kitHtml],
  ["planilha_lucro.html", sheetHtml],
  ["calculadora_precos.html", calcHtml]
]) {
  writeFileSync(join(OUTPUT, name), html, { encoding: "utf8", mode: 0o600 });
  console.log("Private export:", name, html.length, "characters");
}
console.log("Upload these files to the PRIVATE bucket premium-content. Never push private-artifacts/ to GitHub.");
