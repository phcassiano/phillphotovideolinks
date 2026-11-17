import type { Database } from '~/types/database';

type ViewRow = Database['public']['Views']['public_businesses']['Row'];
type NonNull<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };

/** Linha da view pública com os campos que nunca são nulos tipados como tal. */
export type PublicBusiness = NonNull<
  ViewRow,
  | 'id' | 'slug' | 'name' | 'category_slug' | 'category_name' | 'city_slug' | 'city_name'
  | 'neighborhood_slug' | 'neighborhood_name' | 'address_line' | 'has_vitrine' | 'is_featured'
  | 'is_demo' | 'is_highlighted' | 'shows_products' | 'shows_gallery' | 'uses_menu_layout'
> & { distance_km?: number | null };

export const PUBLIC_BUSINESS_COLUMNS =
  'id, slug, name, category_id, category_slug, category_name, category_icon, uses_menu_layout, parent_category_id, parent_category_slug, parent_category_name, city_id, city_slug, city_name, state_uf, neighborhood_id, neighborhood_slug, neighborhood_name, address_line, address_complement, postal_code, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, logo_path, cover_path, plan_code, has_vitrine, is_highlighted, shows_products, shows_gallery, is_featured, is_open_now, is_demo, approved_at, created_at, updated_at';

export type SortOption = 'relevance' | 'nearest' | 'recent';

export type ListingFilters = {
  city?: string | null;
  neighborhood?: string | null;
  category?: string | null;
  query?: string | null;
  openNow?: boolean;
  featured?: boolean;
  vitrine?: boolean;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
  geo?: { lat: number; lng: number } | null;
};
