import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '~/types/database';
import type { PublicEnv } from '~/lib/env.server';
import { usePublicEnv } from '~/lib/public-env';

export { usePublicEnv };

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getBrowserSupabase(env: Pick<PublicEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>) {
  browserClient ??= createBrowserClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return browserClient;
}

export function useSupabase() {
  return getBrowserSupabase(usePublicEnv());
}
