import { data, Link } from 'react-router';
import type { Route } from './+types/listagem';
import { CategoryIcon } from '~/components/category-icon';
import { Breadcrumbs, ListingFilters, ListingResults } from '~/components/listing';
import { flattenCategories, getCategoryTree, searchBusinesses } from '~/features/business/queries.server';
import { hasActiveFilters, parseListingParams } from '~/features/business/listing-params';
import { locationCookies, readLocation } from '~/lib/location.server';
import { breadcrumbJsonLd, seo, siteUrlFromMatches } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { cn } from '~/lib/utils';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const url = new URL(request.url);
  const { data: city } = await supabase
    .from('cities')
    .select('id, slug, name, neighborhoods(id, slug, name, is_active)')
    .eq('slug', params.cidade)
    .eq('is_active', true)
    .maybeSingle();
  const hood = city?.neighborhoods.find((n) => n.slug === params.bairro && n.is_active);
  if (!city || !hood) throw data(null, { status: 404 });

  const tree = await getCategoryTree(supabase);
  const all = flattenCategories(tree);
  const categorySlug = 'categoria' in params ? (params.categoria as string) : null;
  const category = categorySlug ? all.find((c) => c.slug === categorySlug) : null;
  if (categorySlug && !category) throw data(null, { status: 404 });
  const parent = category?.parent_id ? all.find((c) => c.id === category.parent_id) : null;

  const saved = readLocation(request);
  const filters = parseListingParams(url);
  const [result, counts] = await Promise.all([
    searchBusinesses(supabase, { ...filters, city: city.slug, neighborhood: hood.slug, category: categorySlug, geo: saved.geo }),
    supabase.rpc('category_counts', { p_city: city.slug, p_neighborhood: hood.slug }),
  ]);

  // conta por categoria principal (soma subcategorias)
  const countBy = new Map<string, number>();
  for (const row of counts.data ?? []) {
    const n = Number(row.total);
    countBy.set(row.category_id, (countBy.get(row.category_id) ?? 0) + n);
    if (row.parent_id) countBy.set(row.parent_id, (countBy.get(row.parent_id) ?? 0) + n);
  }
  const chips = (category && !category.parent_id ? category.children : parent ? parent.children : tree)
    .map((c) => ({ slug: c.slug, name: c.name, icon: c.icon, count: countBy.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0);

  // Primeira visita sem localização salva: lembra o bairro visitado.
  if (!saved.city) for (const c of locationCookies(request, { city: city.slug, neighborhood: hood.slug })) headers.append('Set-Cookie', c);

  const crumbs = [
    { name: 'Início', path: '/' },
    { name: city.name, path: `/${city.slug}` },
    { name: hood.name, path: `/${city.slug}/${hood.slug}` },
    ...(parent ? [{ name: parent.name, path: `/${city.slug}/${hood.slug}/${parent.slug}` }] : []),
    ...(category ? [{ name: category.name, path: `/${city.slug}/${hood.slug}/${category.slug}` }] : []),
  ];

  return data(
    {
      city: { slug: city.slug, name: city.name },
      hood: { slug: hood.slug, name: hood.name },
      category: category ? { slug: category.slug, name: category.name, icon: category.icon } : null,
      parentSlug: parent?.slug ?? null,
      chips,
      crumbs,
      result,
      filtered: hasActiveFilters(url),
      hasAny: (countBy.get(category?.id ?? '') ?? 0) > 0 || (!category && [...countBy.values()].some((n) => n > 0)),
    },
    { headers },
  );
}

export const meta: Route.MetaFunction = ({ data: d, matches, location }) => {
  if (!d) return [{ title: 'Página não encontrada' }];
  const place = `${d.hood.name}, ${d.city.name}`;
  const title = d.category ? `${d.category.name} em ${place}` : `Comércio local em ${place}`;
  const description = d.category
    ? `Encontre ${d.category.name.toLowerCase()} em ${place}. Veja endereço, horário e fale direto pelo WhatsApp.`
    : `Lojas, restaurantes e serviços em ${place}. Encontre perto de você e fale direto pelo WhatsApp.`;
  const path = d.crumbs[d.crumbs.length - 1]!.path;
  const sp = new URLSearchParams(location.search);
  return seo({
    matches,
    title,
    description,
    path,
    // combinações vazias e variações filtradas não são indexadas
    noindex: !d.hasAny || [...sp.keys()].some((k) => k !== 'pagina'),
    jsonLd: [breadcrumbJsonLd(siteUrlFromMatches(matches), d.crumbs)],
  });
};

export default function Listagem({ loaderData }: Route.ComponentProps) {
  const { city, hood, category, parentSlug, chips, crumbs, result, filtered } = loaderData;
  const base = `/${city.slug}/${hood.slug}`;
  return (
    <div className="container-page pt-5">
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-3 flex items-center gap-3 text-2xl font-black tracking-tight md:text-3xl">
        {category ? (
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <CategoryIcon name={category.icon} className="size-6" />
          </span>
        ) : null}
        <span>
          {category ? category.name : 'Comércio'} em {hood.name}
        </span>
      </h1>

      {chips.length > 0 ? (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <ul className="flex w-max gap-2" aria-label="Categorias">
            {(category || parentSlug) && (
              <li>
                <Link to={parentSlug ? `${base}/${parentSlug}` : base} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                  ← {parentSlug ? 'Toda a categoria' : 'Todas'}
                </Link>
              </li>
            )}
            {chips.map((c) => (
              <li key={c.slug}>
                <Link
                  to={`${base}/${c.slug}`}
                  aria-current={category?.slug === c.slug ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line hover:bg-cream-200',
                    'aria-[current=page]:bg-brand-700 aria-[current=page]:text-white',
                  )}
                >
                  <CategoryIcon name={c.icon} className="size-4" /> {c.name}
                  <span className="text-xs opacity-70">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <ListingFilters />
      </div>
      <ListingResults
        items={result.items}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
        filtered={filtered}
        emptyTitle={category ? `Ainda não há ${category.name.toLowerCase()} em ${hood.name}` : `Ainda não há estabelecimentos em ${hood.name}`}
      />
    </div>
  );
}
