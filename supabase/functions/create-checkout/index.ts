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

async function checkVpn(req: Request): Promise<{ blocked: boolean; unavailable: boolean }> {
  // Prefer the edge-provided client IP; fall back to the forwarded chain.
  const clientIp = req.headers.get("cf-connecting-ip")?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!clientIp || clientIp.length > 100) return { blocked: false, unavailable: true };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch("https://iplogs.com/v1/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: clientIp }),
      signal: controller.signal,
    });
    if (!response.ok) return { blocked: false, unavailable: true };
    const result = await response.json();
    if (typeof result?.verdict !== "string") return { blocked: false, unavailable: true };
    const torDetected = Array.isArray(result?.signals)
      && result.signals.some((s: {type?: string; matched?: boolean}) => s?.type === "tor_exit" && s?.matched === true);
    const blocked = result.is_vpn === true
      || result.verdict === "vpn_detected"
      || result.ip_info?.is_proxy === true
      || torDetected;
    return { blocked, unavailable: false };
  } catch {
    return { blocked: false, unavailable: true };
  } finally {
    clearTimeout(timeout);
  }
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function requestIp(req: Request): string | null {
  const value = req.headers.get("cf-connecting-ip")?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!value || value.length > 100 || value.includes("\n")) return null;
  return value;
}
async function consumeRateLimit(req: Request, scope: string, limit: number, windowSeconds: number, identity?: string): Promise<boolean> {
  const ip = requestIp(req);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!ip || !url || !serviceKey) return false;
  const key = await sha256Hex(ip.toLowerCase());
  const response = await fetch(url + "/rest/v1/rpc/check_and_consume_rate_limit", {
    method: "POST",
    headers: {
      "apikey": serviceKey,
      "Authorization": "Bearer " + serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_key_hash: key, p_scope: scope, p_limit: limit, p_window_seconds: windowSeconds }),
  });
  if (!response.ok) return false;
  const allowed = await response.json();
  if (allowed !== true) return false;
  if (identity !== undefined) {
    const identityHash = await sha256Hex(identity.trim().toLowerCase());
    const identityResponse = await fetch(url + "/rest/v1/rpc/check_and_consume_rate_limit", {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": "Bearer " + serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_key_hash: identityHash,
        p_scope: "login_identifier",
        p_limit: 8,
        p_window_seconds: 900,
      }),
    });
    if (!identityResponse.ok) return false;
    if (await identityResponse.json() !== true) return false;
  }
  return true;
}

async function enforceVpnCheck(req: Request): Promise<Response | null> {
  const result = await checkVpn(req);
  if (result.blocked) {
    return json({ error: "Acesso bloqueado: detectamos VPN, proxy ou Tor. Desative esse serviço e tente novamente pela sua conexão normal." }, 403);
  }
  if (result.unavailable) {
    return json({ error: "Não foi possível verificar a conexão com segurança agora. Tente novamente em alguns minutos." }, 503);
  }
  return null;
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (req.headers.get("origin") !== "https://nandobrtv.github.io") return json({ error: "Origem não autorizada." }, 403);

  if (!(await consumeRateLimit(req, "checkout_ip", 8, 60))) {
    return json({ error: "Muitas tentativas em pouco tempo. Aguarde e tente novamente." }, 429);
  }

  const vpnBlock = await enforceVpnCheck(req);
  if (vpnBlock) return vpnBlock;

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