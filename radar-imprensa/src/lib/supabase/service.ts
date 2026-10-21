import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

// Cliente com service_role: ignora RLS. Uso restrito a tarefas de sistema no
// servidor (ex.: processamento agendado). NUNCA importar em código de cliente.
export function createServiceClient() {
  const key = serverEnv.serviceRoleKey;
  if (!key) return null;
  const { url } = getSupabasePublicConfig();
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
