// =============================================================================
// Gateway de TESTE que imita a superfície do Supabase usada pelo app:
//   /rest/v1/*  -> PostgREST real (porta POSTGREST_PORT)
//   /auth/v1/*  -> emulação mínima do Supabase Auth (signup, token, user, logout)
// Os usuários ficam em auth.users do PostgreSQL de teste (senha via pgcrypto).
// Uso exclusivo em testes locais/CI. Nunca usar em produção.
// =============================================================================
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const POSTGREST = `http://127.0.0.1:${process.env.POSTGREST_PORT ?? 3001}`;
const SECRET = process.env.JWT_SECRET;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const refreshTokens = new Map();

const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
export function signJwt(payload, secret = SECRET) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  const [head, body, sig] = (token ?? "").split(".");
  if (!sig) return null;
  const expected = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  return payload.exp && payload.exp * 1000 < Date.now() ? null : payload;
}

function userObject(row) {
  return {
    id: row.id, aud: "authenticated", role: "authenticated", email: row.email,
    email_confirmed_at: row.created_at, app_metadata: { provider: "email" },
    user_metadata: row.raw_user_meta_data ?? {}, created_at: row.created_at, updated_at: row.created_at,
  };
}
function session(row) {
  const now = Math.floor(Date.now() / 1000);
  const access = signJwt({ sub: row.id, role: "authenticated", aud: "authenticated", email: row.email, iat: now, exp: now + 3600 });
  const refresh = randomBytes(24).toString("hex");
  refreshTokens.set(refresh, row.id);
  return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: refresh, user: userObject(row) };
}
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => resolve(data));
});

async function handleAuth(req, res, url) {
  const body = req.method === "POST" ? JSON.parse((await readBody(req)) || "{}") : {};
  if (url.pathname === "/auth/v1/signup") {
    const id = randomUUID();
    try {
      const { rows } = await pool.query(
        "insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, lower($2), extensions.crypt($3, extensions.gen_salt('bf')), $4) returning *",
        [id, body.email, body.password, body.data ?? {}],
      );
      return json(res, 200, session(rows[0]));
    } catch {
      return json(res, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
    }
  }
  if (url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "password") {
      const { rows } = await pool.query(
        "select * from auth.users where email = lower($1) and encrypted_password = extensions.crypt($2, encrypted_password)",
        [body.email, body.password],
      );
      if (!rows[0]) return json(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return json(res, 200, session(rows[0]));
    }
    if (grant === "refresh_token") {
      const userId = refreshTokens.get(body.refresh_token);
      if (!userId) return json(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      const { rows } = await pool.query("select * from auth.users where id = $1", [userId]);
      return json(res, 200, session(rows[0]));
    }
  }
  if (url.pathname === "/auth/v1/user") {
    const payload = verifyJwt((req.headers.authorization ?? "").replace(/^Bearer /, ""));
    if (!payload?.sub) return json(res, 403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" });
    const { rows } = await pool.query("select * from auth.users where id = $1", [payload.sub]);
    if (!rows[0]) return json(res, 403, { code: 403, error_code: "user_not_found", msg: "User not found" });
    return json(res, 200, userObject(rows[0]));
  }
  if (url.pathname === "/auth/v1/logout") return json(res, 204);
  return json(res, 404, { msg: "not implemented in test gateway" });
}

function proxyRest(req, res, url) {
  const target = new URL(url.pathname.replace(/^\/rest\/v1/, "") + url.search, POSTGREST);
  const upstream = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  upstream.on("error", () => json(res, 502, { msg: "PostgREST indisponível" }));
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/rest/v1")) return proxyRest(req, res, url);
    if (url.pathname.startsWith("/auth/v1")) return handleAuth(req, res, url).catch((e) => json(res, 500, { msg: e.message }));
    json(res, 404, { msg: "not found" });
  })
  .listen(PORT, () => console.log(`gateway de teste em http://127.0.0.1:${PORT}`));
