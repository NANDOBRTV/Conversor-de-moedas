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
  // A primeira chamada limita o IP. Quando identity é informado, esta chamada
  // aplica somente o limite por identificador, sem consumir o contador do IP de novo.
  if (identity === undefined) {
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
  }
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
  // Se o provedor externo de reputação de IP estiver indisponível, não bloqueie
  // todos os logins legítimos. VPN/proxy/Tor detectados continuam bloqueados acima.
  if (result.unavailable) {
    console.warn("VPN reputation check unavailable; allowing login to continue.");
  }
  return null;
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const origin = req.headers.get("origin");
  if (origin !== "https://nandobrtv.github.io") {
    return json({ error: "Origem não autorizada." }, 403);
  }

  if (!(await consumeRateLimit(req, "login_ip", 20, 60))) {
    return json({ error: "Muitas tentativas em pouco tempo. Aguarde e tente novamente." }, 429);
  }

  const vpnBlock = await enforceVpnCheck(req);
  if (vpnBlock) return vpnBlock;

  let body: { identifier?: unknown; username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : (typeof body.username === "string" ? body.username.trim().toLowerCase() : "");
  const password = typeof body.password === "string" ? body.password : "";
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const isUsername = /^[A-Za-z0-9_.-]{3,30}$/.test(identifier);
  if ((!isEmail && !isUsername) || password.length < 1 || password.length > 128) {
    return json({ error: "Usuário ou senha inválidos." }, 400);
  }

  if (!(await consumeRateLimit(req, "login_ip", 20, 60, identifier))) {
    return json({ error: "Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente." }, 429);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "Serviço de login ainda não configurado." }, 503);
  }

  try {
    // A chave privilegiada existe somente no ambiente seguro da Edge Function.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("reseller_profiles")
      .select("user_id")
      .eq(isEmail ? "email" : "username", identifier)
      .maybeSingle();

    if (profileError || !profile) {
      return json({ error: "Usuário ou senha incorretos." }, 401);
    }

    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(profile.user_id);
    const email = userResult?.user?.email;
    if (userError || !email) return json({ error: "Usuário ou senha incorretos." }, 401);

    // A senha é validada pelo próprio Supabase Auth; nunca é armazenada por esta função.
    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) return json({ error: "Usuário ou senha incorretos." }, 401);

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      token_type: data.session.token_type,
    });
  } catch {
    return json({ error: "Não foi possível concluir o login agora." }, 500);
  }
});
