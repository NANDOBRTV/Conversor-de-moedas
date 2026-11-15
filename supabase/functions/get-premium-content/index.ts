// Private premium document delivery. Never embed paid HTML in GitHub Pages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ORIGIN = "https://nandobrtv.github.io";
const HEADERS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "Vary": "Origin"
};
const products = new Set(["kit_divulgacao", "planilha_lucro", "calculadora_precos"]);
function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  if (req.headers.get("origin") !== ORIGIN) return reply({ error: "Origem não autorizada." }, 403);
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return reply({ error: "Entre na sua conta para acessar este material." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ error: "Serviço de conteúdo não configurado." }, 503);

  const size = Number(req.headers.get("content-length") || 0);
  if (size > 1024) return reply({ error: "Requisição muito grande." }, 413);
  let body: { product_code?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "Requisição inválida." }, 400); }
  const code = body.product_code;
  if (typeof code !== "string" || !products.has(code)) return reply({ error: "Produto inválido." }, 400);
  try {
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return reply({ error: "Sessão expirada ou inválida." }, 401);
    const { data: access, error: accessError } = await admin.from("product_entitlements")
      .select("active,source_order_id").eq("user_id", user.id)
      .eq("product_code", code).maybeSingle();
    if (accessError) throw accessError;
    if (access?.active !== true || !access.source_order_id)
      return reply({ error: "Produto não liberado para esta conta." }, 403);
    // Defense in depth: no revoked, cancelled or pending purchase may deliver content.
    const { data: order, error: orderError } = await admin.from("revenue_orders")
      .select("id,status,product_code,user_id,payment_provider")
      .eq("id", access.source_order_id).maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.user_id !== user.id || order.product_code !== code ||
        order.payment_provider !== "stripe" ||
        !["payment_confirmed","delivered"].includes(order.status)) {
      return reply({ error: "Pagamento não confirmado ou acesso revogado." }, 403);
    }
    const { data: blob, error: storageError } = await admin.storage
      .from("premium-content").download(code + ".html");
    if (storageError || !blob) {
      console.error("Private premium file unavailable", code);
      return reply({ error: "Material temporariamente indisponível." }, 503);
    }
    if (blob.size > 1024 * 1024) return reply({ error: "Material excede o limite configurado." }, 503);
    const html = await blob.text();
    return reply({ ok: true, product_code: code, html });
  } catch (error) {
    console.error("get-premium-content", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Não foi possível validar o acesso ao material." }, 503);
  }
});
