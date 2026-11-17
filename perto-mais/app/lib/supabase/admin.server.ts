import { createClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database';
import { serverEnv } from '~/lib/env.server';

// service_role: ignora RLS. Use apenas em código de servidor e com validação prévia.
let client: ReturnType<typeof createClient<Database>> | undefined;
export function supabaseAdmin() {
  client ??= createClient<Database>(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
