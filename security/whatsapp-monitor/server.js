import http from "node:http";
import { timingSafeEqual, createHash } from "node:crypto";

const PORT = Number(process.env.PORT || 10000);
const WEBHOOK_SECRET = process.env.SECURITY_ALERT_WEBHOOK_SECRET || "";
const WA_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WA_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WA_RECIPIENT = (process.env.SECURITY_ALERT_RECIPIENT || "").replace(/\\D/g, "");
const WA_TEMPLATE_NAME = process.env.WHATSAPP_SECURITY_TEMPLATE || "sanba_security_alert";
const WA_TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const requests = new Map();
const recentEvents = new Map();

const EVENT_LABELS = {
  failed_login_burst: "Muitas tentativas de login malsucedidas",
  auth_rate_limit: "Limite de tentativas de autenticação atingido",
  unauthorized_access: "Tentativa de acesso não autorizado",
  suspicious_api: "Atividade suspeita na API"
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'"
  });
  res.end(JSON.stringify(body));
}

function validSecret(req) {
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET.length < 32) return false;
  const header = req.headers.authorization || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!supplied || supplied.length !== WEBHOOK_SECRET.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(WEBHOOK_SECRET));
}

function rateLimited(req) {
  const raw = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim().slice(0, 100);
  const key = createHash("sha256").update(raw).digest("hex");
  const now = Date.now();
  if (requests.size > 5000) {
    for (const [oldKey, oldEntry] of requests) {
      if (now - oldEntry.startedAt >= WINDOW_MS) requests.delete(oldKey);
    }
  }
  let entry = requests.get(key);
  if (!entry || now - entry.startedAt >= WINDOW_MS) {
    entry = { startedAt: now, count: 0 };
    requests.set(key, entry);
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, "utf8") > 4096) throw Object.assign(new Error("body_too_large"), { status: 413 });
  }
  try { return JSON.parse(raw || "{}"); }
  catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}

async function sendWhatsAppAlert(event) {
  if (!WA_ACCESS_TOKEN || !WA_PHONE_NUMBER_ID || !WA_RECIPIENT) throw new Error("whatsapp_not_configured");
  const url = `https://graph.facebook.com/v23.0/${encodeURIComponent(WA_PHONE_NUMBER_ID)}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: WA_RECIPIENT,
      type: "template",
      template: {
        name: WA_TEMPLATE_NAME,
        language: { code: WA_TEMPLATE_LANGUAGE },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: event.severity },
            { type: "text", text: EVENT_LABELS[event.type] },
            { type: "text", text: String(event.count) },
            { type: "text", text: event.occurredAt }
          ]
        }]
      }
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) {
    // Never log tokens, recipient numbers, or the complete provider response.
    const error = new Error("whatsapp_delivery_failed");
    error.status = response.status;
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "conversor-sanba-security-monitor",
      configured: Boolean(WEBHOOK_SECRET.length >= 32 && WA_ACCESS_TOKEN && WA_PHONE_NUMBER_ID && WA_RECIPIENT)
    });
  }
  if (req.method !== "POST" || url.pathname !== "/v1/security-event") {
    return sendJson(res, 404, { error: "Rota não encontrada." });
  }
  if (!validSecret(req)) return sendJson(res, 401, { error: "Não autorizado." });
  if (rateLimited(req)) return sendJson(res, 429, { error: "Limite de eventos excedido." });

  try {
    const body = await readJson(req);
    if (!body || !Object.hasOwn(EVENT_LABELS, body.type)) return sendJson(res, 400, { error: "Tipo de evento inválido." });
    const count = Number(body.count);
    if (!Number.isInteger(count) || count < 1 || count > 100000) return sendJson(res, 400, { error: "Contagem inválida." });
    const severity = body.severity === "critical" ? "CRÍTICO" : body.severity === "high" ? "ALTO" : "MÉDIO";
    const occurredAt = typeof body.occurredAt === "string" && !Number.isNaN(Date.parse(body.occurredAt))
      ? new Date(body.occurredAt).toISOString().slice(0, 19).replace("T", " ")
      : new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
    const fingerprint = createHash("sha256").update([body.type, severity, Math.floor(Date.now() / 300000)].join(":")).digest("hex");
    const now = Date.now();
    for (const [key, timestamp] of recentEvents) if (now - timestamp > 600000) recentEvents.delete(key);
    if (recentEvents.has(fingerprint)) return sendJson(res, 202, { ok: true, deduplicated: true });

    await sendWhatsAppAlert({ type: body.type, severity, count, occurredAt });
    recentEvents.set(fingerprint, now);
    console.log(JSON.stringify({ event: "security_alert_sent", type: body.type, severity, count, occurredAt }));
    return sendJson(res, 202, { ok: true, alert: "sent" });
  } catch (error) {
    if (error?.status === 400 || error?.status === 413) return sendJson(res, error.status, { error: error.message === "body_too_large" ? "Evento muito grande." : "JSON inválido." });
    console.error(JSON.stringify({ event: "security_alert_delivery_error", reason: error?.message === "whatsapp_not_configured" ? "not_configured" : "provider_error" }));
    return sendJson(res, 503, { error: "Alerta não enviado. Verifique a configuração do serviço." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Conversor Sanba Security Monitor listening on port " + PORT);
});
