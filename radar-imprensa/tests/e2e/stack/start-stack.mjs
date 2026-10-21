// Sobe o ambiente local de teste: banco recriado (shim + migrations + seed),
// PostgREST e gateway de Auth. Grava as variáveis em tests/e2e/.env.e2e.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resetDatabase } from "../../../scripts/db-local.mjs";
import { createHmac } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const SECRET = "segredo-de-teste-local-com-mais-de-32-caracteres";
const POSTGREST_BIN = process.env.POSTGREST_BIN ?? "postgrest";

const sign = (payload) => {
  const b = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const data = `${b({ alg: "HS256", typ: "JWT" })}.${b(payload)}`;
  return `${data}.${createHmac("sha256", SECRET).update(data).digest("base64url")}`;
};

const dbUrl = await resetDatabase({ seed: true });
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
await client.query(`do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'authenticator' noinherit;
  end if;
end $$;`);
await client.query("grant anon, authenticated, service_role to authenticator");
await client.end();

const authUrl = new URL(dbUrl);
authUrl.username = "authenticator";
authUrl.password = "authenticator";

const postgrest = spawn(POSTGREST_BIN, [], {
  env: {
    ...process.env,
    PGRST_DB_URI: authUrl.toString(),
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions",
    PGRST_JWT_SECRET: SECRET,
    PGRST_SERVER_PORT: "3001",
    PGRST_DB_MAX_ROWS: "500",
  },
  stdio: "inherit",
});
const gateway = spawn(process.execPath, [path.join(here, "auth-gateway.mjs")], {
  env: { ...process.env, JWT_SECRET: SECRET, DATABASE_URL: dbUrl, GATEWAY_PORT: "54321", POSTGREST_PORT: "3001" },
  stdio: "inherit",
});

const anon = sign({ role: "anon", iss: "teste", exp: 4102444800 });
const service = sign({ role: "service_role", iss: "teste", exp: 4102444800 });
writeFileSync(
  path.join(here, "..", ".env.e2e"),
  [
    "NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321",
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    "CRON_SECRET=segredo-do-cron-de-teste-com-32-caracteres-ou-mais",
    "VERIFICATION_PROVIDER=demo",
    "FEATURE_PAUTA_MATCHING=true",
    `E2E_DATABASE_URL=${dbUrl}`,
  ].join("\n") + "\n",
);
console.log("Ambiente de teste pronto. Variáveis em tests/e2e/.env.e2e");

const stop = () => {
  postgrest.kill();
  gateway.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
