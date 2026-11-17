import { z } from 'zod';
import type { Route } from './+types/location';
import { locationCookies } from '~/lib/location.server';
import { json } from '~/lib/server/request.server';
import { createSupabaseServerClient } from '~/lib/supabase/server';

const schema = z.object({
  city: z.string().regex(/^[a-z0-9-]+$/),
  neighborhood: z.string().regex(/^[a-z0-9-]+$/).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export async function action({ request }: Route.ActionArgs) {
  const form = Object.fromEntries(await request.formData());
  const parsed = schema.safeParse(form);
  if (!parsed.success) return json({ ok: false, error: 'Localização inválida.' }, { status: 400 });
  const { supabase } = createSupabaseServerClient(request);
  const { data: city } = await supabase
    .from('cities')
    .select('id, slug, neighborhoods(slug)')
    .eq('slug', parsed.data.city)
    .eq('is_active', true)
    .maybeSingle();
  if (!city) return json({ ok: false, error: 'Cidade não encontrada.' }, { status: 404 });
  const hood = parsed.data.neighborhood;
  if (hood && !city.neighborhoods.some((n) => n.slug === hood)) {
    return json({ ok: false, error: 'Bairro não encontrado.' }, { status: 404 });
  }
  const geo = parsed.data.lat != null && parsed.data.lng != null ? { lat: parsed.data.lat, lng: parsed.data.lng } : undefined;
  const headers = new Headers();
  for (const c of locationCookies(request, { city: city.slug, neighborhood: hood ?? null, geo })) headers.append('Set-Cookie', c);
  return json({ ok: true }, { headers });
}
