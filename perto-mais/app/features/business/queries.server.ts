import type { ServerSupabase } from '~/lib/supabase/server';
import { PUBLIC_BUSINESS_COLUMNS, type ListingFilters, type PublicBusiness } from './types';

export async function searchBusinesses(supabase: ServerSupabase, f: ListingFilters) {
  const pageSize = f.pageSize ?? 12;
  const page = Math.max(1, f.page ?? 1);
  const { data: ids, error } = await supabase.rpc('search_businesses', {
    p_city: f.city ?? undefined,
    p_neighborhood: f.neighborhood ?? undefined,
    p_category: f.category ?? undefined,
    p_query: f.query ?? undefined,
    p_open_now: f.openNow ?? false,
    p_featured: f.featured ?? false,
    p_vitrine: f.vitrine ?? false,
    p_sort: f.sort === 'nearest' && !f.geo ? 'relevance' : (f.sort ?? 'relevance'),
    p_lat: f.geo?.lat,
    p_lng: f.geo?.lng,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  const total = Number(ids?.[0]?.total_count ?? 0);
  const items = await getBusinessesByIds(supabase, ids?.map((r) => r.id) ?? []);
  const distance = new Map(ids?.map((r) => [r.id, r.distance_km]) ?? []);
  return {
    items: items.map((b) => ({ ...b, distance_km: distance.get(b.id) ?? null })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getBusinessesByIds(supabase: ServerSupabase, ids: string[]): Promise<PublicBusiness[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('public_businesses').select(PUBLIC_BUSINESS_COLUMNS).in('id', ids);
  if (error) throw error;
  const byId = new Map((data as PublicBusiness[]).map((b) => [b.id, b]));
  return ids.map((id) => byId.get(id)).filter((b): b is PublicBusiness => !!b);
}

export type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  parent_id: string | null;
  children: CategoryNode[];
};

export async function getCategoryTree(supabase: ServerSupabase): Promise<CategoryNode[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, icon, parent_id, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  const roots: CategoryNode[] = [];
  const nodes = new Map<string, CategoryNode>();
  for (const c of data) nodes.set(c.id, { ...c, children: [] });
  for (const c of data) {
    const node = nodes.get(c.id)!;
    if (c.parent_id && nodes.has(c.parent_id)) nodes.get(c.parent_id)!.children.push(node);
    else if (!c.parent_id) roots.push(node);
  }
  return roots;
}

export function flattenCategories(tree: CategoryNode[]) {
  return tree.flatMap((c) => [c, ...c.children]);
}
