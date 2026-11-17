import { isbot } from 'isbot';
import { z } from 'zod';
import type { Route } from './+types/track';
import { serverEnv } from '~/lib/env.server';
import { clientIp, json, sessionId, sha256 } from '~/lib/server/request.server';
import { supabaseAdmin } from '~/lib/supabase/admin.server';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const trackSchema = z.object({
  businessId: z.uuid(),
  event: z.enum(['page_view', 'whatsapp_click', 'phone_click', 'product_view']),
  productId: z.uuid().nullable().optional(),
});

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') return json({ ok: false }, { status: 405 });
  const ua = request.headers.get('user-agent') ?? '';
  if (!ua || isbot(ua)) return json({ ok: true, counted: false, reason: 'bot' });

  const body = trackSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ ok: false, error: 'invalid' }, { status: 400 });

  const admin = supabaseAdmin();
  const ip = clientIp(request);
  const { data: allowed } = await admin.rpc('check_rate_limit', {
    p_key: `track:${sha256(ip + serverEnv.metricsSalt)}`,
    p_limit: 120,
    p_window_seconds: 60,
  });
  if (allowed === false) return json({ ok: false, error: 'rate_limited' }, { status: 429 });

  const { supabase, headers } = createSupabaseServerClient(request);
  const { data: userData } = await supabase.auth.getUser();
  const sid = sessionId(request);
  if (sid.setCookie) headers.append('Set-Cookie', sid.setCookie);

  const { data: counted, error } = await admin.rpc('track_event', {
    p_business_id: body.data.businessId,
    p_event_type: body.data.event,
    p_session_hash: sha256(`${serverEnv.metricsSalt}:${sid.id}`),
    p_product_id: body.data.productId ?? undefined,
    p_viewer_id: userData.user?.id,
  });
  if (error) return json({ ok: false, error: 'server' }, { status: 500, headers });
  return json({ ok: true, counted }, { headers });
}

export function loader() {
  return json({ ok: false }, { status: 405 });
}
