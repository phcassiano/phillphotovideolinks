import type { Route } from './+types/locais';
import { json } from '~/lib/server/request.server';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase } = createSupabaseServerClient(request);
  const { data, error } = await supabase
    .from('cities')
    .select('slug, name, sort_order, states(uf), neighborhoods(slug, name, latitude, longitude, sort_order, is_active)')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return json({ cities: [] }, { status: 500 });
  const cities = data.map((c) => ({
    slug: c.slug,
    name: c.name,
    state_uf: c.states?.uf ?? '',
    neighborhoods: c.neighborhoods
      .filter((n) => n.is_active)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR'))
      .map(({ slug, name, latitude, longitude }) => ({ slug, name, latitude, longitude })),
  }));
  return json({ cities }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
}
