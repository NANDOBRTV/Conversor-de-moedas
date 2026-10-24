import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !mpToken || !webhookSecret) return json({ error: "Webhook não configurado." }, 503);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const url = new URL(req.url);
  const dataObj = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {};
  const paymentId = String(url.searchParams.get("data.id") || url.searchParams.get("id") || dataObj.id || "");
  const xSignature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(xSignature.split(",").map(part => {
    const index = part.trim().indexOf("=");
    return index < 0 ? ["", ""] : [part.trim().slice(0, index), part.trim().slice(index + 1)];
  }));
  const ts = parts.ts || "", suppliedV1 = parts.v1 || "";
  if (!paymentId || !/^[0-9]+$/.test(paymentId) || !ts || !suppliedV1 || !requestId) return json({ error: "Assinatura ou identificador ausente." }, 400);
  const expected = await hmacSha256Hex(webhookSecret, `id:${paymentId.toLowerCase()};request-id:${requestId};ts:${ts};`);
  if (!safeEqual(expected, suppliedV1.toLowerCase())) return json({ error: "Assinatura inválida." }, 401);
  try {
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { "Authorization": `Bearer ${mpToken}` } });
    const payment = await paymentResponse.json().catch(() => ({}));
    if (!paymentResponse.ok) return json({ error: "Não foi possível consultar o pagamento no provedor." }, 502);
    const externalReference = String(payment.external_reference || "");
    if (!externalReference) return json({ received: true, ignored: true });
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: order, error: orderError } = await admin.from("payment_orders").select("*").eq("id", externalReference).maybeSingle();
    if (orderError || !order) return json({ received: true, ignored: true });
    const status = String(payment.status || "");
    if (status === "approved") {
      if (String(payment.currency_id) !== "BRL" || Math.abs(Number(payment.transaction_amount) - Number(order.amount)) > 0.001) {
        console.error("Payment amount/currency mismatch for order", order.id);
        return json({ error: "Valor ou moeda não corresponde ao pedido." }, 409);
      }
      if (order.status === "approved" && String(order.payment_id) === paymentId) return json({ received: true, already_processed: true });
      const { data: profile } = await admin.from("reseller_profiles").select("membership_tier").eq("user_id", order.user_id).maybeSingle();
      if (!profile || profile.membership_tier !== "common") {
        await admin.from("payment_orders").update({ payment_id: paymentId }).eq("id", order.id);
        return json({ received: true, profile_unchanged: true });
      }
      const now = new Date();
      const accessUntil = order.plan_tier === "gold" ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
      const { error: profileUpdateError } = await admin.from("reseller_profiles").update({
        membership_tier: order.plan_tier, access_status: "active",
        plan_name: order.plan_tier === "gold" ? "Ouro" : "Diamante",
        requested_plan: order.plan_tier === "gold" ? "monthly" : "one_time",
        access_until: accessUntil
      }).eq("user_id", order.user_id).eq("membership_tier", "common");
      if (profileUpdateError) return json({ error: "Pagamento confirmado, mas não foi possível atualizar o perfil." }, 500);
      const { error: orderUpdateError } = await admin.from("payment_orders").update({
        status: "approved", payment_id: paymentId, approved_at: now.toISOString()
      }).eq("id", order.id);
      if (orderUpdateError) return json({ error: "Pagamento confirmado; atualização do pedido será repetida." }, 500);
    } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(status)) {
      await admin.from("payment_orders").update({ status: status === "charged_back" ? "refunded" : status, payment_id: paymentId }).eq("id", order.id);
    }
    return json({ received: true });
  } catch (error) {
    console.error("mercadopago-webhook error", error);
    return json({ error: "Falha interna ao processar a notificação." }, 500);
  }
});