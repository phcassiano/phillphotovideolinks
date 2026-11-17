import { redirect } from 'react-router';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function getSession(request: Request) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const { data } = await supabase.auth.getUser();
  return { supabase, headers, user: data.user };
}

export async function requireUser(request: Request) {
  const s = await getSession(request);
  if (!s.user) {
    const url = new URL(request.url);
    throw redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, { headers: s.headers });
  }
  return { ...s, user: s.user };
}

export async function requireAdmin(request: Request) {
  const s = await requireUser(request);
  const { data: isAdmin } = await s.supabase.rpc('is_admin');
  if (!isAdmin) throw new Response('Acesso restrito', { status: 403 });
  return s;
}

/** Só aceita redirecionamentos internos. */
export function safeNext(value: string | null, fallback = '/painel') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
