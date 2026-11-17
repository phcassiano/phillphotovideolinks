import { ChevronLeft, ChevronRight, Crosshair, SearchX } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { BusinessGrid } from '~/components/business-card';
import { LocationPicker } from '~/components/location-picker';
import { buttonVariants } from '~/components/ui/button';
import type { PublicBusiness } from '~/features/business/types';
import { useRootData } from '~/lib/root-data';
import { cn } from '~/lib/utils';

function withParam(search: string, changes: Record<string, string | null>) {
  const sp = new URLSearchParams(search);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) sp.delete(k);
    else sp.set(k, v);
  }
  sp.delete('pagina');
  for (const [k, v] of Object.entries(changes)) if (k === 'pagina' && v) sp.set('pagina', v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const chip =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ring-1 ring-line bg-white transition-colors hover:bg-cream-200 aria-[current=true]:bg-ink aria-[current=true]:text-white aria-[current=true]:ring-ink';

export function ListingFilters() {
  const { search, pathname } = useLocation();
  const { location } = useRootData();
  const sp = new URLSearchParams(search);
  const toggle = (key: string, label: string) => {
    const on = sp.get(key) === '1';
    return (
      <Link
        to={`${pathname}${withParam(search, { [key]: on ? null : '1' })}`}
        aria-current={on ? 'true' : undefined}
        className={chip}
        preventScrollReset
      >
        {label}
      </Link>
    );
  };
  const sort = sp.get('ordem');
  const sortLink = (value: string | null, label: string) => (
    <Link
      to={`${pathname}${withParam(search, { ordem: value })}`}
      aria-current={sort === value || (!sort && value === null) ? 'true' : undefined}
      className={chip}
      preventScrollReset
    >
      {label}
    </Link>
  );
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtros">
      <div className="flex w-max gap-2">
        {sortLink(null, 'Relevância')}
        {location.geo ? (
          sortLink('proximos', 'Mais próximos')
        ) : (
          <LocationPicker
            trigger={
              <button type="button" className={chip}>
                <Crosshair aria-hidden className="size-4" /> Mais próximos
              </button>
            }
          />
        )}
        {sortLink('recentes', 'Mais recentes')}
        {toggle('abertos', 'Abertos agora')}
        {toggle('destaque', 'Em destaque')}
        {toggle('vitrine', 'Com vitrine')}
      </div>
    </div>
  );
}

export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  const { search, pathname } = useLocation();
  if (pageCount <= 1) return null;
  const href = (p: number) => `${pathname}${withParam(search, { pagina: p > 1 ? String(p) : null })}`;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pageCount);
  return (
    <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link to={href(page - 1)} className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label="Página anterior">
          <ChevronLeft aria-hidden />
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1]! > 1 ? <span aria-hidden className="px-1 text-ink-muted">…</span> : null}
          <Link
            to={href(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(buttonVariants({ variant: p === page ? 'primary' : 'secondary', size: 'icon' }))}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link to={href(page + 1)} className={buttonVariants({ variant: 'secondary', size: 'icon' })} aria-label="Próxima página">
          <ChevronRight aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}

export function ListingResults({
  items,
  total,
  page,
  pageCount,
  emptyTitle = 'Nenhum estabelecimento encontrado',
  filtered,
}: {
  items: PublicBusiness[];
  total: number;
  page: number;
  pageCount: number;
  emptyTitle?: string;
  filtered: boolean;
}) {
  const { pathname } = useLocation();
  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <SearchX aria-hidden className="mx-auto size-10 text-brand" />
        <h2 className="mt-3 text-lg font-bold">{emptyTitle}</h2>
        <p className="mx-auto mt-1 max-w-md text-ink-muted">
          {filtered
            ? 'Tente remover alguns filtros ou buscar por outra palavra.'
            : 'Conhece um negócio daqui? Convide para anunciar — ou anuncie o seu.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {filtered ? (
            <Link to={pathname} className={buttonVariants({ variant: 'secondary' })}>
              Limpar filtros
            </Link>
          ) : null}
          <Link to="/anuncie" className={buttonVariants()}>
            Anunciar meu negócio
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
        {total === 1 ? '1 estabelecimento' : `${total} estabelecimentos`}
      </p>
      <BusinessGrid items={items} />
      <Pagination page={page} pageCount={pageCount} />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={it.path} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight aria-hidden className="size-3.5" /> : null}
            {i === items.length - 1 ? (
              <span aria-current="page" className="font-semibold text-ink">
                {it.name}
              </span>
            ) : (
              <Link to={it.path} className="inline-block py-1 hover:text-brand-700">
                {it.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
