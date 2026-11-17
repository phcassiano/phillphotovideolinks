import { createBrowserClient } from '@supabase/ssr';
import { useRouteLoaderData } from 'react-router';
import type { Database } from '~/types/database';
import type { PublicEnv } from '~/lib/env.server';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function getBrowserSupabase(env: Pick<PublicEnv, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>) {
  browserClient ??= createBrowserClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return browserClient;
}

export function usePublicEnv(): PublicEnv {
  const data = useRouteLoaderData('root') as { env: PublicEnv } | undefined;
  if (!data) throw new Error('Loader raiz indisponível');
  return data.env;
}

export function useSupabase() {
  return getBrowserSupabase(usePublicEnv());
}
