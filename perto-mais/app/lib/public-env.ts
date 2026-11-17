import { useRouteLoaderData } from 'react-router';
import type { PublicEnv } from '~/lib/env.server';

/** URL/anon key e URL do site vindos do loader raiz (sem carregar o supabase-js). */
export function usePublicEnv(): PublicEnv {
  const data = useRouteLoaderData('root') as { env: PublicEnv } | undefined;
  if (!data) throw new Error('Loader raiz indisponível');
  return data.env;
}
