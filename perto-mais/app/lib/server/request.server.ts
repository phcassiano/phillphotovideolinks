import { createHash, randomBytes } from 'node:crypto';
import { parseCookieHeader } from '@supabase/ssr';

export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export const SESSION_COOKIE = 'perto_sid';

/** Identificador anônimo de sessão (cookie httpOnly, 12 horas). Não identifica a pessoa. */
export function sessionId(request: Request): { id: string; setCookie: string | null } {
  const existing = parseCookieHeader(request.headers.get('Cookie') ?? '').find((c) => c.name === SESSION_COOKIE)?.value;
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return { id: existing, setCookie: null };
  const id = randomBytes(16).toString('hex');
  const secure = new URL(request.url).protocol === 'https:';
  return {
    id,
    setCookie: `${SESSION_COOKIE}=${id}; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`,
  };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function json(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { ...init, headers });
}
