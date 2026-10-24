import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nandobrtv.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (req.headers.get("origin") !== "https://nandobrtv.github.io") return json({ error: "Origem não autorizada." }, 403);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization") || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : authorization;
  const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: "Serviço de pagamento ainda não configurado no Supabase." }, 503);
  if (!mpToken) return json({ error: "Falta configurar a credencial do Mercado Pago no Supabase." }, 503);
  if (!accessToken) return json({ error: "Entre na sua conta antes de comprar." }, 401);

  let body: { tier?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const tier = body.tier;
  if (tier !== "gold" && tier !== "diamond") return json({ error: "Plano inválido." }, 400);

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Sua sessão expirou. Entre novamente." }, 401);
    const { data: profile, error: profileError } = await admin.from("reseller_profiles")
      .select("user_id, username, email, membership_tier")
      .eq("user_id", user.id).maybeSingle();
    if (profileError || !profile) return json({ error: "Não encontramos seu perfil de revendedor." }, 404);
    if (profile.membership_tier === "developer") return json({ error: "A conta Desenvolvedor não precisa comprar um plano." }, 409);
    if (profile.membership_tier !== "common") return json({ error: "Sua conta já possui um plano. Fale com o suporte para alterações ou renovação." }, 409);

    const amount = tier === "gold" ? 9.90 : 49.90;
    const planName = tier === "gold" ? "Plano Ouro - 30 dias" : "Plano Diamante";
    const { data: order, error: orderError } = await admin.from("payment_orders").insert({
      user_id: user.id, plan_tier: tier, amount, currency: "BRL", status: "pending"
    }).select("id").single();
    if (orderError || !order) return json({ error: "Não foi possível registrar seu pedido. Tente novamente." }, 500);

    const siteUrl = "https://nandobrtv.github.io/Conversor-de-moedas/revendedor.html";
    const preferenceBody = {
      items: [{
        id: tier,
        title: planName,
        description: tier === "gold" ? "Acesso ao Painel Sanba por 30 dias. Renovação não automática nesta versão." : "Acesso aos recursos do plano Diamante conforme os termos do serviço.",
        quantity: 1, currency_id: "BRL", unit_price: amount
      }],
      payer: { email: user.email || profile.email },
      external_reference: order.id,
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: siteUrl + "?payment=success",
        pending: siteUrl + "?payment=pending",
        failure: siteUrl + "?payment=failure"
      },
      auto_return: "approved",
      payment_methods: { installments: 1 },
      statement_descriptor: "CONVERSOR SANBA",
      metadata: { order_id: order.id, user_id: user.id, plan_tier: tier }
    };
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${mpToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(preferenceBody)
    });
    const mpData = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok || !mpData.id || !mpData.init_point) {
      await admin.from("payment_orders").update({ status: "cancelled" }).eq("id", order.id);
      console.error("Mercado Pago preference error", mpResponse.status, JSON.stringify(mpData).slice(0, 1000));
      return json({ error: "O Mercado Pago não conseguiu criar o checkout. Verifique as credenciais e tente novamente." }, 502);
    }
    await admin.from("payment_orders").update({ preference_id: String(mpData.id), checkout_url: String(mpData.init_point) }).eq("id", order.id);
    return json({ checkout_url: mpData.init_point, order_id: order.id });
  } catch (error) {
    console.error("create-checkout error", error);
    return json({ error: "Não foi possível iniciar o pagamento agora." }, 500);
  }
});