import { ArrowRight } from 'lucide-react';
import { data, Link } from 'react-router';
import type { Route } from './+types/cidade';
import { Breadcrumbs } from '~/components/listing';
import { breadcrumbJsonLd, seo, siteUrlFromMatches } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const { data: city } = await supabase
    .from('cities')
    .select('slug, name, states(name, uf), neighborhoods(slug, name, is_active, sort_order)')
    .eq('slug', params.cidade)
    .eq('is_active', true)
    .maybeSingle();
  if (!city) throw data(null, { status: 404 });
  const { data: counts } = await supabase.rpc('category_counts', { p_city: city.slug });
  const total = (counts ?? []).reduce((s, r) => s + Number(r.total), 0);
  return data(
    {
      city: { slug: city.slug, name: city.name, uf: city.states?.uf ?? '' },
      hoods: city.neighborhoods.filter((n) => n.is_active).sort((a, b) => a.sort_order - b.sort_order),
      total,
    },
    { headers },
  );
}

export const meta: Route.MetaFunction = ({ data: d, matches }) => {
  if (!d) return [{ title: 'Página não encontrada' }];
  const crumbs = [
    { name: 'Início', path: '/' },
    { name: d.city.name, path: `/${d.city.slug}` },
  ];
  return seo({
    matches,
    title: `Comércio local em ${d.city.name} - ${d.city.uf}`,
    description: `Escolha seu bairro em ${d.city.name} e encontre lojas, restaurantes e serviços perto de você.`,
    path: `/${d.city.slug}`,
    noindex: d.total === 0,
    jsonLd: [breadcrumbJsonLd(siteUrlFromMatches(matches), crumbs)],
  });
};

export default function Cidade({ loaderData: { city, hoods } }: Route.ComponentProps) {
  return (
    <div className="container-page pt-5">
      <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: city.name, path: `/${city.slug}` }]} />
      <h1 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">Bairros de {city.name}</h1>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hoods.map((n) => (
          <li key={n.slug}>
            <Link
              to={`/${city.slug}/${n.slug}`}
              className="flex min-h-16 items-center justify-between rounded-2xl bg-white px-5 font-semibold shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)]"
            >
              {n.name} <ArrowRight aria-hidden className="size-5 text-brand" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
