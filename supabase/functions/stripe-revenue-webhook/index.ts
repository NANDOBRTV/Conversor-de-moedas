import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const hex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(",").map((v) => v.trim());
  const timestamp = parts.find((v) => v.startsWith("t="))?.slice(2);
  const signatures = parts.filter((v) => v.startsWith("v1=")).map((v) => v.slice(3));
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const expected = hex(digest);
  return signatures.some((sig) => sig.length === expected.length && [...sig].reduce((acc, ch, i) => acc | (ch.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  try {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !url || !serviceKey || !secret.startsWith("whsec_")) return reply({ error: "Webhook não configurado." }, 503);
    const raw = await req.text();
    if (!await verifyStripeSignature(raw, req.headers.get("Stripe-Signature") || "", secret)) return reply({ error: "Assinatura inválida." }, 400);
    const event = JSON.parse(raw);
    if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return reply({ received: true, ignored: event.type || "unknown_event" });
    const session = event.data?.object;
    if (!session || session.payment_status !== "paid") return reply({ received: true, ignored: "not_paid" });

    const metadata = session.metadata || {};
    const orderId = String(metadata.order_id || "");
    const userId = String(metadata.supabase_user_id || "");
    const sessionId = String(session.id || "");
    const amountCents = Number(session.amount_total || 0);
    const currency = String(session.currency || "").toUpperCase();
    if (!/^[0-9a-f-]{36}$/i.test(orderId) || !userId || !sessionId || !Number.isInteger(amountCents) || amountCents <= 0) return reply({ error: "Metadados de pagamento incompletos." }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    if (metadata.order_type === "plan") {
      const { data: order, error } = await admin.from("payment_orders").select("id,user_id,plan_tier,amount,currency,status,provider,stripe_checkout_session_id").eq("id", orderId).maybeSingle();
      if (error) throw error;
      if (!order) return reply({ error: "Pedido do plano não encontrado." }, 404);
      if (order.user_id !== userId || order.provider !== "stripe" || order.plan_tier !== metadata.plan_tier) return reply({ error: "O pagamento não corresponde ao pedido." }, 409);
      if (order.status === "approved" && order.stripe_checkout_session_id === sessionId) return reply({ received: true, duplicate: true });
      if (order.status !== "pending" || order.stripe_checkout_session_id !== sessionId) return reply({ error: "O pedido não está pendente ou a sessão não corresponde." }, 409);
      if (currency !== "BRL" || amountCents !== Math.round(Number(order.amount) * 100)) return reply({ error: "Valor ou moeda não corresponde ao pedido." }, 409);

      const { data: profile, error: profileError } = await admin.from("reseller_profiles").select("membership_tier").eq("user_id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || !["common", metadata.plan_tier].includes(profile.membership_tier)) return reply({ error: "O perfil mudou durante o pagamento; precisa de revisão." }, 409);
      const now = new Date();
      if (profile.membership_tier === "common") {
        const accessUntil = metadata.plan_tier === "gold" ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
        const { data: updated, error: profileUpdateError } = await admin.from("reseller_profiles").update({
          membership_tier: metadata.plan_tier, access_status: "active",
          plan_name: metadata.plan_tier === "gold" ? "Ouro" : "Diamante",
          requested_plan: metadata.plan_tier === "gold" ? "monthly" : "one_time",
          access_until: accessUntil
        }).eq("user_id", userId).eq("membership_tier", "common").select("user_id").maybeSingle();
        if (profileUpdateError) throw profileUpdateError;
        if (!updated) return reply({ error: "Pagamento recebido, mas o acesso precisa de revisão manual." }, 409);
      }
      const { error: orderUpdateError } = await admin.from("payment_orders").update({
        status: "approved", provider: "stripe", payment_id: sessionId, approved_at: now.toISOString()
      }).eq("id", orderId).eq("status", "pending");
      if (orderUpdateError) throw orderUpdateError;
      return reply({ received: true, confirmed: true, order_type: "plan" });
    }

    const { data: order, error } = await admin.from("revenue_orders").select("id,user_id,product_code,amount,currency,status,payment_provider,payment_method,stripe_checkout_session_id,stripe_payment_intent_id").eq("id", orderId).maybeSingle();
    if (error) throw error;
    if (!order) return reply({ error: "Pedido não encontrado." }, 404);
    if (order.user_id !== userId || order.payment_provider !== "stripe") return reply({ error: "O pagamento não corresponde ao pedido." }, 409);
    const expectedCents = Math.round(Number(order.amount) * 100);
    if (amountCents !== expectedCents || currency !== String(order.currency).toUpperCase()) return reply({ error: "Valor ou moeda não corresponde ao pedido." }, 409);
    if (order.stripe_checkout_session_id !== sessionId) return reply({ error: "Sessão Stripe não corresponde ao pedido." }, 409);
    if (!["pending", "payment_confirmed", "delivered"].includes(order.status)) return reply({ error: "O pedido não está em um estado válido para confirmar pagamento." }, 409);
    if (order.product_code === "planilha_lucro") {
      const { error: entitlementError } = await admin.from("product_entitlements").upsert({
        user_id: userId, product_code: "planilha_lucro", source_order_id: order.id, active: true, granted_at: new Date().toISOString()
      }, { onConflict: "user_id,product_code" });
      if (entitlementError) throw entitlementError;
    }
    if (order.status !== "pending") return reply({ received: true, duplicate: true, access_granted: order.product_code === "planilha_lucro" });
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin.from("revenue_orders").update({
      status: "payment_confirmed", payment_confirmed_at: now, updated_at: now
    }).eq("id", order.id).eq("status", "pending").eq("payment_provider", "stripe").select("id").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return reply({ received: true, duplicate: true });
    return reply({ received: true, confirmed: true, order_type: "revenue", access_granted: order.product_code === "planilha_lucro" });
  } catch (error) {
    console.error("stripe webhook error:", error instanceof Error ? error.message : "unknown");
    return reply({ error: "Falha ao processar evento Stripe." }, 500);
  }
});
