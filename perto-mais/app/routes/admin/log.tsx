import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { dateTimeBR } from '~/features/admin/hooks';
import { useSupabase } from '~/lib/supabase/client';

const PAGE = 50;

export default function AdminLog() {
  const supabase = useSupabase();
  const [page, setPage] = React.useState(1);
  const q = useQuery({
    queryKey: ['admin', 'log', page],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('admin_audit_log')
        .select('id, action, entity, entity_id, details, created_at, actor_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE, page * PAGE - 1);
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const pages = Math.max(1, Math.ceil((q.data?.count ?? 0) / PAGE));
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-black tracking-tight">Registro de ações</h1>
      <p className="mt-1 text-sm text-ink-muted">Toda alteração feita por um administrador fica registrada aqui.</p>
      {q.isError ? <Alert tone="error" className="mt-4">Erro ao carregar.</Alert> : null}
      <div className="mt-4 rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]">
        {q.isLoading ? <div className="p-4"><Skeleton className="h-40" /></div> : q.data?.rows.length ? (
          <ul className="divide-y divide-line text-sm">
            {q.data.rows.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap gap-x-3">
                  <span className="font-semibold">{r.action}</span>
                  <span className="text-ink-muted">{dateTimeBR(r.created_at)}</span>
                  <span className="text-ink-muted">por {r.actor_id?.slice(0, 8) ?? 'sistema'}</span>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-brand-700">Detalhes</summary>
                  <pre className="mt-1 max-h-60 overflow-auto rounded-xl bg-cream p-3 text-xs">{JSON.stringify(r.details, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        ) : <p className="p-8 text-center text-ink-muted">Nenhuma ação registrada ainda.</p>}
      </div>
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-sm">{page} de {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button>
        </div>
      ) : null}
    </div>
  );
}
