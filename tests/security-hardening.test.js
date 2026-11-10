import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("public pages move JS to external files and use a restrictive CSP", async () => {
  for (const path of ["index.html", "cliente.html", "revendedor.html", "admin-pedidos.html"]) {
    const html = await read(path);
    assert.doesNotMatch(html, /<script(?:\s+type="module")?>\s*[^<\s][\s\S]*?<\/script>/i, path + ": inline script");
    assert.doesNotMatch(html, /script-src[^;"']*'unsafe-inline'/i, path + ": unsafe inline script CSP");
  }
  for (const path of ["conversor-app.js", "conversor-auth.js", "cliente-app.js", "admin-pedidos-app.js", "revendedor-url-sanitizer.js"]) {
    assert.ok((await read(path)).length > 100, path + ": external module missing");
  }
});

test("password protection uses k-anonymity and never receives a raw password or full SHA-1", async () => {
  const service = await read("security/password-protection/server.js");
  assert.match(service, /body\.sha1_prefix/);
  assert.doesNotMatch(service, /body\.password|body\.sha1\b/);
  assert.match(service, /MAX_TRACKED_IPS/);
  assert.match(service, /MAX_GLOBAL_REQUESTS/);
  for (const path of ["cliente-app.js", "revendedor-app.js"]) {
    const text = await read(path);
    assert.match(text, /sha1_prefix:sha1\.slice\(0,5\)/);
    assert.match(text, /result\.suffixes\.includes\(suffix\)/);
    assert.doesNotMatch(text, /JSON\.stringify\(\{\s*sha1\s*\}\)/);
  }
  assert.match(await read("revendedor-app.js"), /await checkPasswordLeak\(password\)/);
});

test("payment gateways deny unapproved resellers and process reversals", async () => {
  for (const path of ["supabase/functions/create-stripe-plan-checkout/index.ts",
                      "supabase/functions/create-checkout/index.ts",
                      "supabase/functions/stripe-revenue-webhook/index.ts",
                      "supabase/functions/mercadopago-webhook/index.ts"]) {
    const source = await read(path);
    assert.match(source, /reseller_application_status/);
    assert.match(source, /access_status/);
  }
  const stripe = await read("supabase/functions/stripe-revenue-webhook/index.ts");
  assert.match(stripe, /charge\.refunded/);
  assert.match(stripe, /charge\.dispute\.created/);
  assert.match(stripe, /source_order_id/);
  assert.match(stripe, /handlePaymentReversal/);
  const mp = await read("supabase/functions/mercadopago-webhook/index.ts");
  assert.match(mp, /sentAtMs/);
  assert.match(mp, /meta\.order_id/);
});

test("database checks price on server and narrows recharge write permissions", async () => {
  const schema = await read("supabase/schema.sql");
  const migration = await read("supabase/migrations/20261110_recharge_integrity_and_stripe_compat.sql");
  for (const source of [schema, migration]) {
    assert.match(source, /CREATE TRIGGER recharge_orders_integrity/i);
    assert.match(source, /recharge_reference_prices/i);
    assert.match(source, /REVOKE UPDATE ON public\.recharge_orders FROM authenticated/i);
    assert.match(source, /GRANT UPDATE \(status,\s*admin_note\)/i);
  }
});

test("private product content cannot be read in GitHub Pages source", async () => {
  const gate = await read("supabase/functions/get-premium-content/index.ts");
  assert.match(gate, /product_entitlements/);
  assert.match(gate, /premium-content/);
  assert.match(gate, /payment_confirmed/);
  for (const path of ["kit-divulgacao-online.html", "planilha-lucro.html", "calculadora-precos.html"]) {
    const html = await read(path);
    assert.match(html, /premium-viewer\.js/);
    assert.match(html, /sandbox="allow-scripts"/);
    assert.doesNotMatch(html, /<article id="content" hidden>|function calc\(|Mensagem 1<\/div>/i);
  }
  assert.match(await read("premium-viewer.js"), /get-premium-content/);
});
