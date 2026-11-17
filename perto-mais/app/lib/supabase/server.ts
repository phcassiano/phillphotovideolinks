import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { Database } from '~/types/database';
import { serverEnv } from '~/lib/env.server';

/**
 * Cliente Supabase do servidor, autenticado pela sessão em cookie.
 * Sempre devolva `headers` na resposta do loader/action para renovar cookies.
 */
export function createSupabaseServerClient(request: Request) {
  const headers = new Headers();
  const supabase = createServerClient<Database>(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '').map(({ name, value }) => ({
          name,
          value: value ?? '',
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          headers.append('Set-Cookie', serializeCookieHeader(name, value, options));
        }
      },
    },
  });
  return { supabase, headers };
}

export type ServerSupabase = ReturnType<typeof createSupabaseServerClient>['supabase'];
