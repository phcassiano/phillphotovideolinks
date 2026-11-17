import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import * as React from 'react';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { dateBR } from '~/features/admin/hooks';
import { formatPhoneBR } from '~/lib/phone';
import { useSupabase } from '~/lib/supabase/client';

const PAGE = 50;

export default function AdminUsuarios() {
  const supabase = useSupabase();
  const [search, setSearch] = React.useState('');
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const list = useQuery({
    queryKey: ['admin', 'users', q, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_users', { p_search: q || undefined, p_limit: PAGE, p_offset: (page - 1) * PAGE });
      if (error) throw error;
      return data;
    },
  });
  const total = Number(list.data?.[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Usuários e comerciantes</h1>
      <form
        className="mt-4 flex max-w-md gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
      >
        <label htmlFor="u-q" className="sr-only">Buscar por nome ou e-mail</label>
        <Input id="u-q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou e-mail" />
        <Button type="submit" variant="secondary" aria-label="Buscar"><Search aria-hidden /></Button>
      </form>
      {list.isError ? <Alert tone="error" className="mt-4">Erro ao carregar.</Alert> : null}
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]" tabIndex={0} role="region" aria-label="Tabela de usuários">
        {list.isLoading ? <div className="p-4"><Skeleton className="h-40" /></div> : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Nome</th>
                <th scope="col" className="px-4 py-3 font-semibold">E-mail</th>
                <th scope="col" className="px-4 py-3 font-semibold">Telefone</th>
                <th scope="col" className="px-4 py-3 font-semibold">Negócios</th>
                <th scope="col" className="px-4 py-3 font-semibold">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    {u.full_name || '—'} {u.roles.includes('admin') ? <Badge variant="brand">admin</Badge> : null}
                  </td>
                  <td className="px-4 py-3">
                    {u.email} {!u.email_confirmed_at ? <Badge variant="warning">não confirmado</Badge> : null}
                  </td>
                  <td className="px-4 py-3">{formatPhoneBR(u.phone_e164) || '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{u.businesses_count}</td>
                  <td className="px-4 py-3">{dateBR(u.created_at)}</td>
                </tr>
              ))}
              {list.data?.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-ink-muted">Nenhum usuário encontrado.</td></tr> : null}
            </tbody>
          </table>
        )}
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
