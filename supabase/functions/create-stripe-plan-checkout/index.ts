import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "https://nandobrtv.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (req.headers.get("origin") !== "https://nandobrtv.github.io") return json({ error: "Origem não autorizada." }, 403);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!url || !serviceKey || !stripeKey) return json({ error: "Checkout Stripe ainda não está configurado no servidor." }, 503);

  // Segurança: esta versão é exclusivamente para testes. Recusa chaves live
  // para evitar cobranças reais enquanto o preço temporário de R$ 1 estiver ativo.
  if (!stripeKey.startsWith("sk_test_")) {
    return json({ error: "Checkout de teste exige uma chave STRIPE_SECRET_KEY iniciada por sk_test_. Nenhuma cobrança real foi iniciada." }, 503);
  }
  if (!token) return json({ error: "Entre na sua conta antes de comprar." }, 401);

  let body: { tier?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const tier = body.tier;
  if (tier !== "gold" && tier !== "diamond") return json({ error: "Plano inválido." }, 400);

  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Sua sessão expirou. Entre novamente." }, 401);

    const { data: profile, error: profileError } = await admin.from("reseller_profiles")
      .select("user_id, username, email, membership_tier")
      .eq("user_id", user.id).maybeSingle();
    if (profileError || !profile) return json({ error: "Não encontramos seu perfil." }, 404);
    if (profile.membership_tier === "developer") return json({ error: "A conta Desenvolvedor não precisa comprar um plano." }, 409);
    if (profile.membership_tier !== "common") return json({ error: "Sua conta já possui um plano. Fale com o suporte para renovação ou alteração." }, 409);
    if (!user.email && !profile.email) return json({ error: "Adicione um e-mail válido à sua conta antes de pagar." }, 400);

    // Preço temporário de teste solicitado: R$ 1,00 para qualquer plano.
    // Antes de produção, restaurar Ouro = R$ 9,90 e Diamante = R$ 49,90.
    const amount = 1.00;
    const planName = tier === "gold" ? "Plano Ouro (30 dias) — TESTE" : "Plano Diamante — TESTE";
    const { data: order, error: orderError } = await admin.from("payment_orders").insert({
      user_id: user.id, plan_tier: tier, amount, currency: "BRL", status: "pending", provider: "stripe"
    }).select("id").single();
    if (orderError || !order) {
      console.error("payment_orders insert failed", orderError?.message);
      return json({ error: "Não foi possível registrar o pedido. Tente novamente." }, 500);
    }

    const siteUrl = "https://nandobrtv.github.io/Conversor-de-moedas/revendedor.html";
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", siteUrl + "?payment=success&session_id={CHECKOUT_SESSION_ID}");
    params.set("cancel_url", siteUrl + "?payment=cancelled");
    params.set("customer_email", user.email || profile.email || "");
    params.set("client_reference_id", order.id);
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "brl");
    params.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
    params.set("line_items[0][price_data][product_data][name]", planName);
    params.set("line_items[0][price_data][product_data][description]", tier === "gold"
      ? "Acesso de teste ao Painel Sanba por 30 dias. Preço temporário de R$ 1,00."
      : "Acesso de teste aos recursos do Plano Diamante. Preço temporário de R$ 1,00.");
    params.set("metadata[order_type]", "plan");
    params.set("metadata[order_id]", order.id);
    params.set("metadata[supabase_user_id]", user.id);
    params.set("metadata[plan_tier]", tier);
    params.set("payment_intent_data[metadata][order_type]", "plan");
    params.set("payment_intent_data[metadata][order_id]", order.id);
    params.set("payment_intent_data[metadata][supabase_user_id]", user.id);
    params.set("payment_intent_data[metadata][plan_tier]", tier);

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: "Bearer " + stripeKey, "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const stripe = await response.json().catch(() => ({}));
    if (!response.ok || !stripe.id || !stripe.url) {
      await admin.from("payment_orders").update({ status: "cancelled" }).eq("id", order.id);
      console.error("Stripe checkout error", response.status, JSON.stringify({ type: stripe?.error?.type, code: stripe?.error?.code, param: stripe?.error?.param, message: stripe?.error?.message }).slice(0, 900));
      return json({ error: "O Stripe recusou a criação do checkout: " + String(stripe?.error?.message || "erro sem detalhes") }, 502);
    }

    const { error: updateError } = await admin.from("payment_orders").update({
      stripe_checkout_session_id: String(stripe.id), checkout_url: String(stripe.url), provider: "stripe"
    }).eq("id", order.id);
    if (updateError) {
      await admin.from("payment_orders").update({ status: "cancelled" }).eq("id", order.id);
      return json({ error: "Não foi possível salvar a sessão de pagamento." }, 500);
    }
    return json({ checkout_url: stripe.url, order_id: order.id });
  } catch (error) {
    console.error("create-stripe-plan-checkout error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível iniciar o pagamento agora." }, 500);
  }
});