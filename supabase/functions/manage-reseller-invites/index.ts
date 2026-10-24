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
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (req.headers.get("origin") !== "https://nandobrtv.github.io") return json({ error: "Origem não autorizada." }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!url || !serviceKey) return json({ error: "Serviço de convites não configurado." }, 503);
  if (!token) return json({ error: "Entre na conta de desenvolvedor." }, 401);

  let body: { action?: unknown; invited_email?: unknown; invite_id?: unknown; user_id?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Pedido inválido." }, 400); }
  const action = String(body.action || "");
  const allowed = ["create_invite", "list_invites", "list_applications", "approve_application", "reject_application", "revoke_invite"];
  if (!allowed.includes(action)) return json({ error: "Ação inválida." }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json({ error: "Sua sessão expirou. Entre novamente." }, 401);
  const { data: profile, error: profileError } = await admin.from("reseller_profiles")
    .select("membership_tier, access_status, access_until")
    .eq("user_id", user.id).maybeSingle();
  if (profileError || profile?.membership_tier !== "developer" || profile.access_status !== "active" ||
      (profile.access_until && new Date(profile.access_until).getTime() <= Date.now())) {
    return json({ error: "Somente a conta de desenvolvedor ativa pode gerenciar convites e solicitações." }, 403);
  }

  if (action === "create_invite") {
    const emailRaw = typeof body.invited_email === "string" ? body.invited_email.trim().toLowerCase() : "";
    const invitedEmail = emailRaw || null;
    if (invitedEmail && (invitedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail))) {
      return json({ error: "Informe um e-mail válido ou deixe o campo vazio para convite não vinculado a e-mail." }, 400);
    }
    const rawToken = newToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin.from("reseller_invites").insert({
      token_hash: tokenHash, invited_email: invitedEmail, created_by: user.id, expires_at: expiresAt
    }).select("id, invited_email, status, created_at, expires_at").single();
    if (error || !data) {
      console.error("Invite creation failed", error);
      return json({ error: "Não foi possível gerar o convite agora." }, 500);
    }
    const link = "https://nandobrtv.github.io/Conversor-de-moedas/revendedor.html?convite=" + rawToken;
    return json({ ok: true, invite: data, link });
  }

  if (action === "list_invites") {
    const { data, error } = await admin.from("reseller_invites")
      .select("id, invited_email, status, created_at, expires_at, used_at, used_by")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return json({ error: "Não foi possível carregar os convites." }, 500);
    return json({ invites: data || [] });
  }

  if (action === "list_applications") {
    const { data, error } = await admin.from("reseller_profiles")
      .select("user_id, username, email, reseller_application_status, reseller_requested_at, reseller_reviewed_at, reseller_review_note, reseller_invite_id")
      .in("reseller_application_status", ["pending", "approved", "rejected"])
      .order("reseller_requested_at", { ascending: false }).limit(200);
    if (error) return json({ error: "Não foi possível carregar as solicitações." }, 500);
    return json({ applications: data || [] });
  }

  if (action === "revoke_invite") {
    const inviteId = typeof body.invite_id === "string" ? body.invite_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inviteId)) return json({ error: "Convite inválido." }, 400);
    const { data, error } = await admin.from("reseller_invites").update({ status: "revoked" })
      .eq("id", inviteId).eq("status", "issued").select("id").maybeSingle();
    if (error) return json({ error: "Não foi possível revogar o convite." }, 500);
    if (!data) return json({ error: "Convite já utilizado, revogado ou não encontrado." }, 409);
    return json({ ok: true });
  }

  const userId = typeof body.user_id === "string" ? body.user_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return json({ error: "Solicitação inválida." }, 400);
  const approve = action === "approve_application";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const update = approve
    ? { reseller_application_status: "approved", access_status: "active", plan_name: "Revendedor", access_until: null, reseller_reviewed_by: user.id, reseller_reviewed_at: new Date().toISOString(), reseller_review_note: note }
    : { reseller_application_status: "rejected", access_status: "pending", plan_name: "Solicitação recusada", reseller_reviewed_by: user.id, reseller_reviewed_at: new Date().toISOString(), reseller_review_note: note };
  const { data, error } = await admin.from("reseller_profiles").update(update)
    .eq("user_id", userId).eq("reseller_application_status", "pending")
    .select("user_id, username, reseller_application_status, access_status").maybeSingle();
  if (error) {
    console.error("Application review failed", error);
    return json({ error: "Não foi possível atualizar a solicitação." }, 500);
  }
  if (!data) return json({ error: "Solicitação não encontrada ou já analisada." }, 409);
  return json({ ok: true, application: data });
});
