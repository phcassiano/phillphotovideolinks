import type { ListingFilters, SortOption } from './types';

/** Lê filtros da querystring (mesmos nomes nas listagens e no /explorar). */
export function parseListingParams(url: URL): Omit<ListingFilters, 'city' | 'neighborhood' | 'category' | 'geo'> {
  const sp = url.searchParams;
  const sortRaw = sp.get('ordem');
  const sort: SortOption = sortRaw === 'proximos' ? 'nearest' : sortRaw === 'recentes' ? 'recent' : 'relevance';
  const page = Number(sp.get('pagina') ?? '1');
  return {
    query: sp.get('q')?.trim().slice(0, 80) || null,
    openNow: sp.get('abertos') === '1',
    featured: sp.get('destaque') === '1',
    vitrine: sp.get('vitrine') === '1',
    sort,
    page: Number.isInteger(page) && page > 0 && page < 500 ? page : 1,
  };
}

export function hasActiveFilters(url: URL) {
  const sp = url.searchParams;
  return ['q', 'abertos', 'destaque', 'vitrine', 'ordem', 'pagina'].some((k) => sp.has(k));
}
