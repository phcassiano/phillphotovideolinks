// Supabase Edge Function (Deno): disparador das verificações periódicas.
//
// Agendada pelo Supabase Cron (pg_cron + pg_net), chama o endpoint protegido
// do app (/api/cron/verificacoes), que executa um lote pequeno com os
// provedores configurados. Mantém os segredos fora do SQL:
//   supabase secrets set APP_URL=https://seu-app.vercel.app CRON_SECRET=...
//
// A função exige o cabeçalho Authorization com a chave service_role (o padrão
// de invocação do Supabase), portanto não pode ser chamada anonimamente.

const APP_URL = Deno.env.get("APP_URL");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  const auth = req.headers.get("authorization") ?? "";
  if (!SERVICE_ROLE_KEY || auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  if (!APP_URL || !CRON_SECRET) {
    // Configuração ausente não quebra nada: apenas informa e encerra.
    return new Response(JSON.stringify({ skipped: true, reason: "APP_URL/CRON_SECRET não configurados" }), { status: 200 });
  }
  const body = await req.json().catch(() => ({}));
  const response = await fetch(`${APP_URL.replace(/\/$/, "")}/api/cron/verificacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CRON_SECRET}` },
    body: JSON.stringify({ batchSize: body.batchSize ?? 10, schedule: body.schedule ?? false }),
    signal: AbortSignal.timeout(55_000),
  });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: { "Content-Type": "application/json" } });
});
