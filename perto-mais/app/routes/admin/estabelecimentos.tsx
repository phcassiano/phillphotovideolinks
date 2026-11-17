import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { dateBR } from '~/features/admin/hooks';
import { useSupabase } from '~/lib/supabase/client';
import { cn } from '~/lib/utils';

export const STATUS_LABEL = {
  pending: { label: 'Pendente', variant: 'warning' as const },
  approved: { label: 'Aprovado', variant: 'open' as const },
  rejected: { label: 'Rejeitado', variant: 'danger' as const },
  suspended: { label: 'Suspenso', variant: 'danger' as const },
};
const TABS = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Rejeitados' },
  { value: 'suspended', label: 'Suspensos' },
  { value: 'all', label: 'Todos' },
] as const;
const PAGE = 25;

export default function AdminEstabelecimentos() {
  const supabase = useSupabase();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('pagina') ?? 1));
  const [search, setSearch] = React.useState(q);

  const list = useQuery({
    queryKey: ['admin', 'businesses', status, q, page],
    queryFn: async () => {
      let query = supabase
        .from('businesses')
        .select('id, name, slug, status, is_demo, created_at, categories(name), neighborhoods(name), cities(name)', { count: 'exact' })
        .order('created_at', { ascending: status === 'pending' })
        .range((page - 1) * PAGE, page * PAGE - 1);
      if (status !== 'all') query = query.eq('status', status as 'pending');
      if (q) query = query.ilike('name', `%${q}%`);
      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });

  const set = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) sp.delete(k);
      else sp.set(k, v);
    }
    if (!('pagina' in changes)) sp.delete('pagina');
    setParams(sp);
  };
  const pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PAGE));

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Estabelecimentos</h1>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Situação">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={status === t.value}
            onClick={() => set({ status: t.value })}
            className={cn('min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-line', status === t.value ? 'bg-ink text-white' : 'bg-white')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex max-w-md gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: search || null });
        }}
      >
        <label htmlFor="adm-q" className="sr-only">
          Buscar por nome
        </label>
        <Input id="adm-q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome" />
        <Button type="submit" variant="secondary" aria-label="Buscar">
          <Search aria-hidden />
        </Button>
      </form>
      {list.isError ? <Alert tone="error" className="mt-4">Erro ao carregar.</Alert> : null}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]">
        {list.isLoading ? (
          <div className="p-4"><Skeleton className="h-40" /></div>
        ) : list.data?.rows.length ? (
          <ul className="divide-y divide-line">
            {list.data.rows.map((b) => (
              <li key={b.id}>
                <Link to={`/admin/estabelecimentos/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-cream">
                  <span className="w-full min-w-0 font-semibold lg:w-auto lg:flex-1">
                    {b.name} {b.is_demo ? <Badge variant="demo">Demo</Badge> : null}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {b.categories?.name} · {b.neighborhoods?.name}, {b.cities?.name}
                  </span>
                  <span className="text-sm text-ink-muted">{dateBR(b.created_at)}</span>
                  <Badge variant={STATUS_LABEL[b.status].variant}>{STATUS_LABEL[b.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-ink-muted">Nenhum estabelecimento nesta lista.</p>
        )}
      </div>
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => set({ pagina: String(page - 1) })}>
            Anterior
          </Button>
          <span className="text-sm">
            {page} de {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => set({ pagina: String(page + 1) })}>
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  );
}
