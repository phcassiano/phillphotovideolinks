import type { ServerSupabase } from '~/lib/supabase/server';
import { getCategoryTree } from './queries.server';

/** Cidades, bairros e categorias para os formulários do comerciante. */
export async function getFormOptions(supabase: ServerSupabase) {
  const [{ data: cities }, tree] = await Promise.all([
    supabase
      .from('cities')
      .select('id, name, latitude, longitude, neighborhoods(id, name, latitude, longitude, is_active, sort_order)')
      .eq('is_active', true)
      .order('sort_order'),
    getCategoryTree(supabase),
  ]);
  return {
    cities: (cities ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      neighborhoods: c.neighborhoods
        .filter((n) => n.is_active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })),
    })),
    categories: tree.map((c) => ({ id: c.id, name: c.name, children: c.children.map(({ id, name }) => ({ id, name })) })),
  };
}
export type FormOptions = Awaited<ReturnType<typeof getFormOptions>>;
