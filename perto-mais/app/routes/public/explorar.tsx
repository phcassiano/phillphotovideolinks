import { Search } from 'lucide-react';
import { data, Form, useSubmit } from 'react-router';
import type { Route } from './+types/explorar';
import { ListingFilters, ListingResults } from '~/components/listing';
import { Button } from '~/components/ui/button';
import { Input, Select } from '~/components/ui/input';
import { flattenCategories, getCategoryTree, searchBusinesses } from '~/features/business/queries.server';
import { hasActiveFilters, parseListingParams } from '~/features/business/listing-params';
import { readLocation } from '~/lib/location.server';
import { seo } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const url = new URL(request.url);
  const saved = readLocation(request);
  const { data: cities } = await supabase
    .from('cities')
    .select('slug, name, neighborhoods(slug, name, is_active, sort_order)')
    .eq('is_active', true)
    .order('sort_order');
  const city = cities?.find((c) => c.slug === (url.searchParams.get('cidade') ?? saved.city)) ?? cities?.[0];
  if (!city) throw data(null, { status: 404 });
  const hoods = city.neighborhoods.filter((n) => n.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const hoodParam = url.searchParams.get('bairro');
  const hood = hoodParam === 'todos' ? null : (hoods.find((n) => n.slug === (hoodParam ?? (saved.city === city.slug ? saved.neighborhood : null))) ?? null);
  const tree = await getCategoryTree(supabase);
  const catParam = url.searchParams.get('categoria');
  const category = flattenCategories(tree).find((c) => c.slug === catParam) ?? null;

  const filters = parseListingParams(url);
  const result = await searchBusinesses(supabase, {
    ...filters,
    city: city.slug,
    neighborhood: hood?.slug ?? null,
    category: category?.slug ?? null,
    geo: saved.geo,
  });
  return data(
    {
      city: { slug: city.slug, name: city.name },
      hoods: hoods.map(({ slug, name }) => ({ slug, name })),
      hood: hood?.slug ?? 'todos',
      tree: tree.map((c) => ({ slug: c.slug, name: c.name, children: c.children.map(({ slug, name }) => ({ slug, name })) })),
      category: category?.slug ?? '',
      q: filters.query ?? '',
      result,
      filtered: hasActiveFilters(url) || !!category,
    },
    { headers },
  );
}

export const meta: Route.MetaFunction = ({ data: d, matches, location }) =>
  seo({
    matches,
    title: d?.q ? `Busca: ${d.q}` : `Explorar ${d?.city.name ?? ''}`,
    description: `Encontre lojas, restaurantes e serviços em ${d?.city.name ?? 'seu bairro'}.`,
    path: '/explorar',
    noindex: location.search.length > 0,
  });

export default function Explorar({ loaderData }: Route.ComponentProps) {
  const { city, hoods, hood, tree, category, q, result, filtered } = loaderData;
  const submit = useSubmit();
  return (
    <div className="container-page pt-6">
      <h1 className="text-2xl font-black tracking-tight md:text-3xl">{q ? `Resultados para “${q}”` : `Explorar ${city.name}`}</h1>
      <Form
        method="get"
        role="search"
        className="mt-4 grid gap-2 rounded-3xl bg-white p-3 shadow-[var(--shadow-card)] md:grid-cols-[1fr_12rem_14rem_auto]"
        onChange={(e) => {
          if ((e.target as HTMLElement).tagName === 'SELECT') submit(e.currentTarget, { preventScrollReset: true });
        }}
      >
        <input type="hidden" name="cidade" value={city.slug} />
        <label className="relative">
          <span className="sr-only">O que você está procurando?</span>
          <Search aria-hidden className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <Input name="q" defaultValue={q} placeholder="O que você está procurando?" className="pl-11" key={q} />
        </label>
        <label>
          <span className="sr-only">Bairro</span>
          <Select name="bairro" defaultValue={hood} key={hood}>
            <option value="todos">Todos os bairros</option>
            {hoods.map((n) => (
              <option key={n.slug} value={n.slug}>
                {n.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">Categoria</span>
          <Select name="categoria" defaultValue={category} key={category}>
            <option value="">Todas as categorias</option>
            {tree.map((c) => (
              <optgroup key={c.slug} label={c.name}>
                <option value={c.slug}>{c.name} (todas)</option>
                {c.children.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </label>
        <Button type="submit">Buscar</Button>
      </Form>
      <div className="mt-4">
        <ListingFilters />
      </div>
      <ListingResults items={result.items} total={result.total} page={result.page} pageCount={result.pageCount} filtered={filtered} />
    </div>
  );
}
