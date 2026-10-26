import http from "node:http";
import { createHash } from "node:crypto";

const PORT = Number(process.env.PORT || 10000);
const ALLOWED_ORIGINS = new Set([
  "https://nandobrtv.github.io",
  "https://cute-easy-worlds-kawaii-coloring-series-for-kids.catalog.yampi.io"
]);
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 2_048;
const requests = new Map();

function json(res, status, body, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Vary": "Origin"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

function clientKey(req) {
  // Render provides the client address through x-forwarded-for.
  return (req.headers["x-forwarded-for"] || "unknown").toString().split(",")[0].trim().slice(0, 80);
}

function rateLimited(req) {
  const now = Date.now();
  const key = clientKey(req);
  const current = requests.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requests.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      const error = new Error("body_too_large");
      error.status = 413;
      throw error;
    }
  }
  try { return JSON.parse(raw || "{}"); }
  catch {
    const error = new Error("invalid_json");
    error.status = 400;
    throw error;
  }
}

async function checkPwnedPassword(password) {
  // The full password is never sent to HIBP: only the first five SHA-1 hex chars.
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true", "User-Agent": "ConversorSanba-PasswordProtection/1.0" },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error("hibp_unavailable");
  const text = await response.text();
  const match = text.split("\r\n").find(line => line.split(":")[0]?.toUpperCase() === suffix);
  const count = match ? Number(match.split(":")[1]) : 0;
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("hibp_invalid_response");
  return { compromised: count > 0, occurrences: count };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: "Origem não autorizada." });
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin || "null",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
      "Cache-Control": "no-store"
    });
    return res.end();
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(res, 403, { error: "Origem não autorizada." });
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, service: "conversor-sanba-protection", status: "online" }, origin);
  }
  if (req.method !== "POST" || url.pathname !== "/v1/password-check") {
    return json(res, 404, { error: "Rota não encontrada." }, origin);
  }
  if (rateLimited(req)) return json(res, 429, { error: "Muitas tentativas. Aguarde um minuto e tente novamente." }, origin);

  try {
    const body = await readJson(req);
    if (typeof body.password !== "string" || body.password.length < 1 || body.password.length > 256) {
      return json(res, 400, { error: "Informe uma senha válida para verificação." }, origin);
    }
    const result = await checkPwnedPassword(body.password);
    return json(res, 200, { ok: true, ...result }, origin);
  } catch (error) {
    if (error?.status === 400 || error?.status === 413) {
      return json(res, error.status, { error: error.message === "body_too_large" ? "Requisição muito grande." : "JSON inválido." }, origin);
    }
    // Do not log request bodies, passwords, or hashes.
    return json(res, 503, { error: "A verificação de senhas está temporariamente indisponível. Tente novamente." }, origin);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Conversor Sanba Protection listening on port ${PORT}`);
});
