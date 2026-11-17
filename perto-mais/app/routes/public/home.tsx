import { ArrowRight, MapPinned, MessageCircle, Search, Store } from 'lucide-react';
import { data, Form, Link } from 'react-router';
import type { Route } from './+types/home';
import { BusinessGrid } from '~/components/business-card';
import { CategoryIcon } from '~/components/category-icon';
import { LocationPicker } from '~/components/location-picker';
import { buttonVariants, Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { site } from '~/config/site';
import { getCategoryTree, searchBusinesses } from '~/features/business/queries.server';
import { readLocation } from '~/lib/location.server';
import { seo } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  const saved = readLocation(request);
  let city = saved.city;
  if (!city) {
    const { data: first } = await supabase.from('cities').select('slug').eq('is_active', true).order('sort_order').limit(1).maybeSingle();
    city = first?.slug ?? null;
  }
  const hood = saved.city === city ? saved.neighborhood : null;
  const [categories, featured, nearby, recent] = await Promise.all([
    getCategoryTree(supabase),
    searchBusinesses(supabase, { city, featured: true, pageSize: 6, geo: saved.geo }),
    saved.geo
      ? searchBusinesses(supabase, { city, sort: 'nearest', geo: saved.geo, pageSize: 6 })
      : hood
        ? searchBusinesses(supabase, { city, neighborhood: hood, pageSize: 6 })
        : null,
    searchBusinesses(supabase, { city, sort: 'recent', pageSize: 6, geo: saved.geo }),
  ]);
  return data(
    {
      city,
      hood,
      categories,
      featured: featured.items,
      nearby: nearby?.items ?? [],
      nearbyMode: saved.geo ? ('geo' as const) : hood ? ('hood' as const) : null,
      recent: recent.items,
      total: recent.total,
    },
    { headers },
  );
}

export const meta: Route.MetaFunction = ({ matches }) =>
  seo({
    matches,
    title: site.name,
    description: site.description,
    path: '/',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: '/explorar?q={search_term_string}' },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  });

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="container-page mt-12">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { city, hood, categories, featured, nearby, nearbyMode, recent, total } = loaderData;
  const listPath = city && hood ? `/${city}/${hood}` : '/explorar';
  const catHref = (slug: string) => (city && hood ? `/${city}/${hood}/${slug}` : `/explorar?categoria=${slug}`);

  return (
    <>
      <section className="relative overflow-hidden">
        <div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-accent/30 blur-3xl" />
        <div aria-hidden className="absolute -left-20 top-40 size-64 rounded-full bg-brand/15 blur-3xl" />
        <div className="container-page relative pb-6 pt-8 md:pb-10 md:pt-14">
          <h1 className="max-w-2xl text-[2.1rem] font-black leading-[1.08] tracking-tight md:text-5xl">
            Seu bairro inteiro <span className="text-brand-700">na palma da mão.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-muted">
            Encontre lojas, restaurantes e serviços perto de você. Fale diretamente com quem faz acontecer no seu bairro.
          </p>
          <Form action="/explorar" role="search" className="mt-6 flex max-w-2xl flex-col gap-2 rounded-3xl bg-white p-2 shadow-[var(--shadow-lift)] sm:flex-row">
            <label htmlFor="home-q" className="sr-only">
              O que você está procurando?
            </label>
            <div className="relative flex-1">
              <Search aria-hidden className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
              <Input
                id="home-q"
                name="q"
                placeholder="O que você está procurando?"
                className="min-h-13 border-0 pl-12 shadow-none focus-visible:ring-0"
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="lg">
              Buscar
            </Button>
          </Form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <span>Procurando em</span>
            <LocationPicker className="bg-white/70 ring-1 ring-line" />
          </div>
        </div>
      </section>

      <Section
        title="Categorias"
        action={
          <Link to="/categorias" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700">
            Ver todas <ArrowRight aria-hidden className="size-4" />
          </Link>
        }
      >
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {categories.slice(0, 12).map((c) => (
            <li key={c.id}>
              <Link
                to={catHref(c.slug)}
                className="flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-white p-3 text-center text-[0.8rem] font-semibold leading-tight shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <CategoryIcon name={c.icon} className="size-6" />
                </span>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {featured.length > 0 ? (
        <Section title="Em destaque">
          <BusinessGrid items={featured} />
        </Section>
      ) : null}

      {nearby.length > 0 ? (
        <Section
          title={nearbyMode === 'geo' ? 'Perto de você' : 'No seu bairro'}
          action={
            <Link to={listPath} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700">
              Ver todos <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
        >
          <BusinessGrid items={nearby} />
        </Section>
      ) : null}

      {recent.length > 0 ? (
        <Section title="Chegaram agora">
          <BusinessGrid items={recent} />
        </Section>
      ) : (
        <section className="container-page mt-12">
          <div className="rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)]">
            <Store aria-hidden className="mx-auto size-10 text-brand" />
            <h2 className="mt-3 text-xl font-bold">Ainda não há estabelecimentos por aqui</h2>
            <p className="mt-1 text-ink-muted">Seja o primeiro do bairro a aparecer.</p>
            <Link to="/anuncie" className={buttonVariants({ className: 'mt-5' })}>
              Anunciar meu negócio
            </Link>
          </div>
        </section>
      )}

      {total > 0 ? (
        <div className="container-page mt-8 flex justify-center">
          <Link to={listPath} className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
            Ver todos os {total} estabelecimentos <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : null}

      <section className="container-page mt-16" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-xl font-extrabold tracking-tight md:text-2xl">
          Como funciona
        </h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            { icon: MapPinned, title: 'Escolha seu bairro', text: 'Selecione onde você está ou use sua localização.' },
            { icon: Search, title: 'Encontre o que precisa', text: 'Busque por nome, categoria ou veja no mapa.' },
            { icon: MessageCircle, title: 'Entre em contato diretamente', text: 'Chame no WhatsApp ou ligue, sem intermediário.' },
          ].map((step, i) => (
            <li key={step.title} className="flex gap-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-700 text-lg font-black text-white">{i + 1}</span>
              <div>
                <h3 className="flex items-center gap-2 font-bold">
                  <step.icon aria-hidden className="size-5 text-brand" /> {step.title}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page mt-12">
        <div className="flex flex-col items-start gap-4 rounded-3xl bg-ink p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="text-xl font-extrabold md:text-2xl">Tem um negócio no bairro?</h2>
            <p className="mt-1 text-white/80">Cadastre grátis e receba contatos direto no seu WhatsApp.</p>
          </div>
          <Link to="/anuncie" className={buttonVariants({ size: 'lg', className: 'bg-brand text-ink hover:bg-accent' })}>
            Anunciar meu negócio
          </Link>
        </div>
      </section>
    </>
  );
}
