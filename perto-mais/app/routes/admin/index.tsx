import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Alert } from '~/components/ui/alert';
import { Skeleton } from '~/components/ui/skeleton';
import { formatBRL } from '~/lib/money';
import { useSupabase } from '~/lib/supabase/client';

type Dash = {
  businesses_total: number;
  businesses_by_status: Record<string, number>;
  businesses_premium: number;
  businesses_free: number;
  users_total: number;
  neighborhoods_total: number;
  whatsapp_clicks_30d: number;
  page_views_30d: number;
  new_businesses_30d: number;
  subscriptions_active: number;
  subscriptions_pending: number;
  mrr_cents: number;
};

export default function AdminIndex() {
  const supabase = useSupabase();
  const q = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_dashboard');
      if (error) throw error;
      return data as unknown as Dash;
    },
  });
  const d = q.data;
  const tiles: { label: string; value: string | number | undefined; to?: string }[] = [
    { label: 'Estabelecimentos', value: d?.businesses_total, to: '/admin/estabelecimentos' },
    { label: 'Aguardando aprovação', value: d?.businesses_by_status.pending ?? 0, to: '/admin/estabelecimentos?status=pending' },
    { label: 'Gratuitos', value: d?.businesses_free },
    { label: 'Com Vitrine (premium)', value: d?.businesses_premium },
    { label: 'Usuários', value: d?.users_total, to: '/admin/usuarios' },
    { label: 'Bairros ativos', value: d?.neighborhoods_total, to: '/admin/locais' },
    { label: 'Cliques no WhatsApp (30 dias)', value: d?.whatsapp_clicks_30d.toLocaleString('pt-BR') },
    { label: 'Visualizações (30 dias)', value: d?.page_views_30d.toLocaleString('pt-BR') },
    { label: 'Novos cadastros (30 dias)', value: d?.new_businesses_30d },
    { label: 'Assinaturas ativas', value: d?.subscriptions_active, to: '/admin/assinaturas' },
    { label: 'Solicitações de assinatura', value: d?.subscriptions_pending, to: '/admin/assinaturas?status=pending' },
    { label: 'Receita recorrente mensal', value: d ? formatBRL(d.mrr_cents) : undefined },
  ];
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Visão geral</h1>
      {q.isError ? <Alert tone="error" className="mt-4">Não foi possível carregar os números.</Alert> : null}
      <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-sm text-ink-muted">{t.label}</p>
              {t.value === undefined ? <Skeleton className="mt-2 h-8 w-20" /> : <p className="mt-1 text-2xl font-black tabular-nums md:text-3xl">{t.value}</p>}
            </>
          );
          return (
            <li key={t.label}>
              {t.to ? (
                <Link to={t.to} className="block h-full rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)]">
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
