import { AtSign, Clock, MapPin, Navigation, Share2, Star } from 'lucide-react';
import * as React from 'react';
import { data } from 'react-router';
import type { Route } from './+types/estabelecimento';
import { CategoryIcon } from '~/components/category-icon';
import { CallButton, WhatsAppButton } from '~/components/contact-buttons';
import { Breadcrumbs } from '~/components/listing';
import { LazyMap } from '~/components/map/lazy-map';
import { ProductShowcase } from '~/components/product-showcase';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { useToast } from '~/components/ui/toast';
import { PUBLIC_BUSINESS_COLUMNS, type PublicBusiness } from '~/features/business/types';
import { track } from '~/features/metrics/track';
import { groupHours, nowInZone } from '~/lib/hours';
import { mediaUrl } from '~/lib/images';
import { formatPhoneBR } from '~/lib/phone';
import { absoluteUrl, breadcrumbJsonLd, seo, siteUrlFromMatches } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';
import { usePublicEnv } from '~/lib/public-env';
import { directionsLink } from '~/lib/whatsapp';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const { data: row } = await supabase.from('public_businesses').select(PUBLIC_BUSINESS_COLUMNS).eq('slug', params.slug).maybeSingle();
  if (!row) throw data(null, { status: 404 });
  const b = row as PublicBusiness;
  const [hours, photos, productCategories, products] = await Promise.all([
    supabase.from('business_hours').select('weekday, opens_at, closes_at').eq('business_id', b.id),
    b.shows_gallery
      ? supabase.from('business_photos').select('id, path, caption').eq('business_id', b.id).order('sort_order')
      : Promise.resolve({ data: [] }),
    b.shows_products
      ? supabase.from('product_categories').select('id, name').eq('business_id', b.id).order('sort_order')
      : Promise.resolve({ data: [] }),
    b.shows_products
      ? supabase
          .from('products')
          .select('id, name, description, price_cents, photo_path, is_available, is_featured, product_category_id, sort_order')
          .eq('business_id', b.id)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
  ]);
  headers.set('Cache-Control', 'private, no-store');
  return data(
    {
      business: b,
      hours: hours.data ?? [],
      photos: photos.data ?? [],
      productCategories: productCategories.data ?? [],
      products: products.data ?? [],
    },
    { headers },
  );
}

export const meta: Route.MetaFunction = ({ data: d, matches }) => {
  if (!d) return [{ title: 'Estabelecimento não encontrado' }, { name: 'robots', content: 'noindex' }];
  const b = d.business;
  const siteUrl = siteUrlFromMatches(matches);
  const supabaseUrl = (matches.find((m) => m?.id === 'root')?.data as { env: { SUPABASE_URL: string } }).env.SUPABASE_URL;
  const image = mediaUrl(supabaseUrl, b.cover_path ?? b.logo_path);
  const path = `/estabelecimento/${b.slug}`;
  const description =
    b.description ?? `${b.category_name} em ${b.neighborhood_name}, ${b.city_name}. Endereço, horário e contato direto pelo WhatsApp.`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': absoluteUrl(siteUrl, path),
    name: b.name,
    url: absoluteUrl(siteUrl, path),
    description,
    ...(image ? { image: absoluteUrl(siteUrl, image) } : {}),
    ...(b.phone_e164 || b.whatsapp_e164 ? { telephone: b.phone_e164 ?? b.whatsapp_e164 } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: [b.address_line, b.address_complement].filter(Boolean).join(', '),
      addressLocality: b.city_name,
      addressRegion: b.state_uf,
      ...(b.postal_code ? { postalCode: b.postal_code } : {}),
      addressCountry: 'BR',
    },
    ...(b.latitude != null && b.longitude != null ? { geo: { '@type': 'GeoCoordinates', latitude: b.latitude, longitude: b.longitude } } : {}),
    ...(d.hours.length
      ? {
          openingHoursSpecification: d.hours.map((h) => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: `https://schema.org/${days[h.weekday]}`,
            opens: h.opens_at.slice(0, 5),
            closes: h.closes_at.slice(0, 5),
          })),
        }
      : {}),
    ...(b.instagram ? { sameAs: [`https://instagram.com/${b.instagram}`] } : {}),
  };
  return seo({
    matches,
    title: `${b.name} — ${b.category_name} em ${b.neighborhood_name}`,
    description,
    path,
    image,
    type: 'business.business',
    noindex: b.is_demo,
    jsonLd: [
      localBusiness,
      breadcrumbJsonLd(siteUrl, [
        { name: 'Início', path: '/' },
        { name: b.neighborhood_name, path: `/${b.city_slug}/${b.neighborhood_slug}` },
        { name: b.category_name, path: `/${b.city_slug}/${b.neighborhood_slug}/${b.category_slug}` },
        { name: b.name, path },
      ]),
    ],
  });
};

function ShareButton({ name }: { name: string }) {
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      className="px-2 sm:flex-1"
      aria-label="Compartilhar"
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title: name, url });
          } catch {
            /* usuário cancelou */
          }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          toast({ tone: 'success', message: 'Link copiado.' });
        } catch {
          toast({ tone: 'error', message: 'Não foi possível copiar o link.' });
        }
      }}
    >
      <Share2 aria-hidden /> <span className="max-[400px]:hidden">Compartilhar</span>
    </Button>
  );
}

export default function Estabelecimento({ loaderData }: Route.ComponentProps) {
  const { business: b, hours, photos, productCategories, products } = loaderData;
  const env = usePublicEnv();
  const cover = mediaUrl(env.SUPABASE_URL, b.cover_path);
  const logo = mediaUrl(env.SUPABASE_URL, b.logo_path);
  const grouped = groupHours(hours);
  const [today, setToday] = React.useState<number | null>(null);

  React.useEffect(() => {
    track(b.id, 'page_view');
    setToday(nowInZone().weekday);
  }, [b.id]);

  return (
    <article className="pb-6">
      <div className="relative h-40 bg-gradient-to-br from-brand to-ink sm:h-56 md:h-72">
        {cover ? <img src={cover} alt="" className="size-full object-cover" fetchPriority="high" /> : null}
      </div>
      <div className="container-page">
        <div className="relative -mt-12 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-lift)] md:-mt-16 md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="-mt-14 size-24 shrink-0 overflow-hidden rounded-3xl border-4 border-white bg-brand-50 shadow-[var(--shadow-card)] md:-mt-16 md:size-28">
              {logo ? (
                <img src={logo} alt={`Logo de ${b.name}`} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-brand-700">
                  <CategoryIcon name={b.category_icon} className="size-10" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">
                {b.is_demo ? <Badge variant="demo">Demonstração</Badge> : null}
                {b.is_featured ? (
                  <Badge variant="featured">
                    <Star aria-hidden /> Destaque
                  </Badge>
                ) : null}
                {b.is_open_now != null ? (
                  <Badge variant={b.is_open_now ? 'open' : 'closed'}>{b.is_open_now ? 'Aberto agora' : 'Fechado agora'}</Badge>
                ) : null}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">{b.name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-ink-muted">
                <CategoryIcon name={b.category_icon} className="size-4" /> {b.category_name}
              </p>
            </div>
          </div>

          {b.is_demo ? (
            <p className="mt-4 rounded-2xl bg-[#efe7ff] px-4 py-3 text-sm text-[#45309a]">
              Este é um estabelecimento de demonstração, com dados fictícios. Os botões de contato não abrem conversas reais.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <WhatsAppButton business={b} label="FALAR PELO WHATSAPP" size="lg" className="sm:flex-1 sm:basis-full md:basis-auto" />
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-1">
              <CallButton business={b} className="px-2 sm:flex-1" />
              {b.latitude != null && b.longitude != null ? (
                <Button asChild variant="secondary" className="px-2 sm:flex-1">
                  <a href={directionsLink(b.latitude, b.longitude)} target="_blank" rel="noopener noreferrer">
                    <Navigation aria-hidden /> Rota
                  </a>
                </Button>
              ) : null}
              <ShareButton name={b.name} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Breadcrumbs
            items={[
              { name: 'Início', path: '/' },
              { name: b.neighborhood_name, path: `/${b.city_slug}/${b.neighborhood_slug}` },
              { name: b.category_name, path: `/${b.city_slug}/${b.neighborhood_slug}/${b.category_slug}` },
              { name: b.name, path: `/estabelecimento/${b.slug}` },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
          <div className="flex min-w-0 flex-col gap-4">
            {b.description ? (
              <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
                <h2 className="text-lg font-bold">Sobre</h2>
                <p className="mt-2 whitespace-pre-line text-ink-muted">{b.description}</p>
                {b.instagram ? (
                  <a
                    href={`https://instagram.com/${b.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700"
                  >
                    <AtSign aria-hidden className="size-4" /> {b.instagram}
                  </a>
                ) : null}
              </section>
            ) : null}

            {products.length > 0 ? (
              <ProductShowcase business={b} categories={productCategories} products={products} menuLayout={b.uses_menu_layout} />
            ) : null}

            {photos.length > 0 ? (
              <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
                <h2 className="text-lg font-bold">Fotos</h2>
                <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {photos.map((p) => (
                    <li key={p.id} className="overflow-hidden rounded-2xl bg-cream-200">
                      <img
                        src={mediaUrl(env.SUPABASE_URL, p.path) ?? ''}
                        alt={p.caption ?? `Foto de ${b.name}`}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="flex flex-col gap-4">
            <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MapPin aria-hidden className="size-5 text-brand" /> Endereço
              </h2>
              <address className="mt-2 not-italic text-ink-muted">
                {b.address_line}
                {b.address_complement ? `, ${b.address_complement}` : ''}
                <br />
                {b.neighborhood_name} · {b.city_name} - {b.state_uf}
                {b.postal_code ? <><br />CEP {b.postal_code}</> : null}
              </address>
              {b.phone_e164 ? <p className="mt-2 text-sm">Telefone: {formatPhoneBR(b.phone_e164)}</p> : null}
              {b.latitude != null && b.longitude != null ? (
                <div className="mt-4">
                  <LazyMap
                    className="h-56"
                    center={[b.latitude, b.longitude]}
                    zoom={16}
                    markers={[{ id: b.id, lat: b.latitude, lng: b.longitude, title: b.name }]}
                    label={`Mapa com a localização de ${b.name}`}
                  />
                </div>
              ) : null}
            </section>

            {hours.length > 0 ? (
              <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Clock aria-hidden className="size-5 text-brand" /> Horários
                </h2>
                <dl className="mt-3 divide-y divide-line text-sm">
                  {grouped.map((d) => (
                    <div key={d.weekday} className={`flex justify-between gap-4 py-2 ${today === d.weekday ? 'font-bold text-ink' : 'text-ink-muted'}`}>
                      <dt>{d.label}</dt>
                      <dd className="text-right">{d.intervals.length ? d.intervals.join(' · ') : 'Fechado'}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </article>
  );
}
