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
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!url || !serviceKey || !anonKey) return json({ error: "Serviço administrativo não configurado." }, 503);
  if (!token) return json({ error: "Entre na conta administrativa." }, 401);
  let body: { action?: unknown; order_id?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const action = body.action;
  if (!["list", "approve", "reject"].includes(String(action))) return json({ error: "Ação inválida." }, 400);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json({ error: "Sua sessão expirou." }, 401);
  const { data: profile, error: profileError } = await admin.from("reseller_profiles")
    .select("membership_tier, access_status, access_until").eq("user_id", user.id).maybeSingle();
  if (profileError || profile?.membership_tier !== "developer") return json({ error: "Apenas a conta administradora pode gerenciar pedidos." }, 403);
  if (profile.access_status !== "active" || (profile.access_until && new Date(profile.access_until).getTime() <= Date.now())) {
    return json({ error: "O acesso administrativo está inativo ou expirado." }, 403);
  }
  if (action === "list") {
    const { data, error } = await admin.from("customer_orders").select("id,user_id,plan_tier,product_name,amount,currency,status,customer_name,customer_username,customer_email,created_at,admin_note").order("created_at", { ascending: false }).limit(200);
    if (error) return json({ error: "Não foi possível carregar os pedidos." }, 500);
    return json({ orders: data || [] });
  }
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) return json({ error: "Número do pedido inválido." }, 400);
  const { data: order, error: orderError } = await admin.from("customer_orders").select("*").eq("id", orderId).maybeSingle();
  if (orderError || !order) return json({ error: "Pedido não encontrado." }, 404);
  if (order.status !== "pending") return json({ error: "Este pedido já foi processado." }, 409);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  if (action === "reject") {
    const { data: rejectedOrder, error } = await admin.from("customer_orders")
      .update({ status: "rejected", admin_note: note, approved_by: user.id, updated_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", "pending").select("id").maybeSingle();
    if (error) return json({ error: "Não foi possível rejeitar o pedido." }, 500);
    if (!rejectedOrder) return json({ error: "Este pedido já foi processado. Atualize a lista antes de tentar novamente." }, 409);
    return json({ ok: true, status: "rejected" });
  }
  const { data: approvalResult, error: approvalError } = await admin.rpc("approve_customer_order_atomic", {
    p_order_id: orderId,
    p_admin_user_id: user.id,
    p_note: note
  });
  if (approvalError) {
    const reason = String(approvalError.message || "");
    if (/já foi processado|outra operação|plano Comum ativo/i.test(reason)) return json({ error: "Este pedido já foi processado. Atualize a lista antes de tentar novamente." }, 409);
    if (/não encontrado/i.test(reason)) return json({ error: "Pedido ou perfil do cliente não encontrado." }, 404);
    if (/apenas a conta administradora|plano do pedido inválido/i.test(reason)) return json({ error: "A aprovação não foi autorizada." }, 403);
    console.error("Atomic customer-order approval failed", approvalError);
    return json({ error: "Não foi possível aprovar o pedido. Nenhuma alteração parcial foi mantida." }, 500);
  }
  return json(approvalResult || { ok: true, status: "approved", user_id: order.user_id, plan_tier: order.plan_tier });
});