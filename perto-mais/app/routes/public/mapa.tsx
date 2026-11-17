import { Navigation, X } from 'lucide-react';
import * as React from 'react';
import { data, Link, useSearchParams } from 'react-router';
import type { Route } from './+types/mapa';
import { CategoryIcon } from '~/components/category-icon';
import { CallButton, WhatsAppButton } from '~/components/contact-buttons';
import { LazyMap } from '~/components/map/lazy-map';
import { Badge } from '~/components/ui/badge';
import { Button, buttonVariants } from '~/components/ui/button';
import { flattenCategories, getCategoryTree } from '~/features/business/queries.server';
import { PUBLIC_BUSINESS_COLUMNS, type PublicBusiness } from '~/features/business/types';
import { readLocation } from '~/lib/location.server';
import { mediaUrl } from '~/lib/images';
import { seo } from '~/lib/seo';
import { usePublicEnv } from '~/lib/public-env';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { directionsLink } from '~/lib/whatsapp';
import { cn } from '~/lib/utils';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const url = new URL(request.url);
  const saved = readLocation(request);
  const { data: cities } = await supabase
    .from('cities')
    .select('slug, name, latitude, longitude, neighborhoods(slug, name, latitude, longitude, is_active)')
    .eq('is_active', true)
    .order('sort_order');
  const city = cities?.find((c) => c.slug === saved.city) ?? cities?.[0];
  if (!city) throw data(null, { status: 404 });
  const hood = saved.city === city.slug ? city.neighborhoods.find((n) => n.slug === saved.neighborhood && n.is_active) : undefined;

  const tree = await getCategoryTree(supabase);
  const catSlug = url.searchParams.get('categoria');
  const cat = flattenCategories(tree).find((c) => c.slug === catSlug);

  let q = supabase
    .from('public_businesses')
    .select(PUBLIC_BUSINESS_COLUMNS)
    .eq('city_slug', city.slug)
    .not('latitude', 'is', null)
    .limit(500);
  if (hood) q = q.eq('neighborhood_slug', hood.slug);
  if (cat) q = cat.parent_id ? q.eq('category_slug', cat.slug) : q.or(`category_slug.eq.${cat.slug},parent_category_slug.eq.${cat.slug}`);
  const { data: rows, error } = await q;
  if (error) throw error;

  const center: [number, number] =
    saved.geo ? [saved.geo.lat, saved.geo.lng]
    : hood?.latitude != null && hood.longitude != null ? [hood.latitude, hood.longitude]
    : [city.latitude ?? -15.79, city.longitude ?? -47.88];

  return data(
    {
      place: hood ? `${hood.name}, ${city.name}` : city.name,
      center,
      categories: tree.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon })),
      category: cat?.slug ?? null,
      businesses: rows as PublicBusiness[],
    },
    { headers },
  );
}

export const meta: Route.MetaFunction = ({ data: d, matches, location }) =>
  seo({
    matches,
    title: `Mapa do comércio${d ? ` em ${d.place}` : ''}`,
    description: 'Veja no mapa lojas, restaurantes e serviços do seu bairro.',
    path: '/mapa',
    noindex: location.search.length > 0,
  });

export default function Mapa({ loaderData }: Route.ComponentProps) {
  const { place, center, categories, category, businesses } = loaderData;
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = businesses.find((b) => b.id === selectedId) ?? null;
  const env = usePublicEnv();

  const markers = React.useMemo(
    () =>
      businesses.map((b) => ({
        id: b.id,
        lat: b.latitude!,
        lng: b.longitude!,
        title: b.name,
        color: b.has_vitrine ? '#A3480D' : '#E86B19',
      })),
    [businesses],
  );

  const catLink = (slug: string | null) => {
    const sp = new URLSearchParams(params);
    if (slug) sp.set('categoria', slug);
    else sp.delete('categoria');
    const s = sp.toString();
    return s ? `?${s}` : '?';
  };

  return (
    <div className="container-page pt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Mapa · {place}</h1>
        <p className="text-sm text-ink-muted" aria-live="polite">
          {businesses.length === 1 ? '1 estabelecimento' : `${businesses.length} estabelecimentos`}
        </p>
      </div>
      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <ul className="flex w-max gap-2" aria-label="Filtrar por categoria">
          <li>
            <Link
              to={catLink(null)}
              preventScrollReset
              aria-current={!category ? 'true' : undefined}
              className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line aria-[current=true]:bg-ink aria-[current=true]:text-white"
            >
              Todas
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                to={catLink(c.slug)}
                preventScrollReset
                aria-current={category === c.slug ? 'true' : undefined}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line aria-[current=true]:bg-ink aria-[current=true]:text-white"
              >
                <CategoryIcon name={c.icon} className="size-4" /> {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-3">
        <LazyMap
          className="h-[calc(100dvh-15rem)] min-h-[22rem] shadow-[var(--shadow-card)]"
          center={center}
          zoom={14}
          markers={markers}
          cluster
          fitToMarkers
          selectedId={selectedId}
          onMarkerClick={setSelectedId}
          label={`Mapa de estabelecimentos em ${place}`}
        />
        {businesses.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] mx-auto max-w-sm rounded-2xl bg-white p-4 text-center shadow-[var(--shadow-lift)]">
            <p className="font-semibold">Nenhum estabelecimento com localização nesta área.</p>
            <Link to="/anuncie" className={buttonVariants({ size: 'sm', className: 'pointer-events-auto mt-3' })}>
              Anunciar meu negócio
            </Link>
          </div>
        ) : null}
        {selected ? (
          <div
            className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-md animate-fade-up rounded-3xl bg-white p-4 shadow-[var(--shadow-lift)]"
            role="dialog"
            aria-label={`Resumo de ${selected.name}`}
          >
            <div className="flex gap-3">
              <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50 text-brand-700">
                {selected.logo_path ? (
                  <img src={mediaUrl(env.SUPABASE_URL, selected.logo_path) ?? ''} alt="" className="size-full object-cover" />
                ) : (
                  <CategoryIcon name={selected.category_icon} className="size-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1">
                  {selected.is_demo ? <Badge variant="demo">Demonstração</Badge> : null}
                  {selected.is_open_now != null ? (
                    <Badge variant={selected.is_open_now ? 'open' : 'closed'}>{selected.is_open_now ? 'Aberto' : 'Fechado'}</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 font-bold leading-snug">{selected.name}</p>
                <p className="truncate text-sm text-ink-muted">
                  {selected.category_name} · {selected.address_line}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-2" aria-label="Fechar resumo" onClick={() => setSelectedId(null)}>
                <X aria-hidden />
              </Button>
            </div>
            <div className={cn('mt-3 grid gap-2', selected.whatsapp_e164 ? 'grid-cols-3' : 'grid-cols-2')}>
              <WhatsAppButton business={selected} size="sm" className="px-2" />
              <Button asChild variant="secondary" size="sm" className="px-2">
                <a href={directionsLink(selected.latitude!, selected.longitude!)} target="_blank" rel="noopener noreferrer">
                  <Navigation aria-hidden /> Rota
                </a>
              </Button>
              <Link to={`/estabelecimento/${selected.slug}`} className={buttonVariants({ variant: 'soft', size: 'sm', className: 'px-2' })}>
                Ver página
              </Link>
            </div>
            {!selected.whatsapp_e164 ? <CallButton business={selected} size="sm" className="mt-2 w-full" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
