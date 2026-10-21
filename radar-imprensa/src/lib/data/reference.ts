import "server-only";
import { cache } from "react";
import type { OutletType } from "@/lib/domain/enums";
import { friendlyDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
}

export interface LocationRow {
  id: string;
  state_code: string;
  state_name: string;
  city_name: string | null;
}

export interface OutletRow {
  id: string;
  name: string;
  outlet_type: OutletType | null;
  website: string | null;
}

export const getCategories = cache(async (): Promise<CategoryRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("editorial_categories")
    .select("id, name, slug, parent_id, sort_order")
    .eq("active", true)
    .order("sort_order")
    .order("name");
  if (error) throw friendlyDbError(error);
  return data ?? [];
});

export const getStates = cache(async (): Promise<LocationRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id, state_code, state_name, city_name")
    .is("city_name", null)
    .order("state_name");
  if (error) throw friendlyDbError(error);
  return data ?? [];
});

export const getLocations = cache(async (stateCode?: string): Promise<LocationRow[]> => {
  const supabase = await createClient();
  let query = supabase.from("locations").select("id, state_code, state_name, city_name").order("state_code").order("city_name", { nullsFirst: true });
  if (stateCode) query = query.eq("state_code", stateCode);
  const { data, error } = await query.limit(2000);
  if (error) throw friendlyDbError(error);
  return data ?? [];
});

export const getOutlets = cache(async (): Promise<OutletRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_outlets")
    .select("id, name, outlet_type, website")
    .eq("active", true)
    .order("name")
    .limit(2000);
  if (error) throw friendlyDbError(error);
  return data ?? [];
});

export function groupCategories(categories: CategoryRow[]) {
  const parents = categories.filter((c) => !c.parent_id);
  return parents.map((parent) => ({ parent, children: categories.filter((c) => c.parent_id === parent.id) }));
}

export function locationLabel(l: { city_name: string | null; state_code: string; state_name?: string }): string {
  return l.city_name ? `${l.city_name}/${l.state_code}` : `${l.state_name ?? l.state_code} (estado)`;
}
