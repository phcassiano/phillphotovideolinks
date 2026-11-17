import { Clock, Eye, Lock, MessageCircle, Package, Pencil, Phone, Sparkles } from 'lucide-react';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePanel } from './layout';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button, buttonVariants } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { useToast } from '~/components/ui/toast';
import { dbErrorMessage, panelKeys, useBusiness, usePlan, useStats, type Stats } from '~/features/panel/queries';
import { useSupabase } from '~/lib/supabase/client';
import { cn } from '~/lib/utils';

const STATUS = {
  pending: { label: 'Em análise', variant: 'warning' as const, text: 'Nossa equipe está revisando seu cadastro. Você recebe acesso à página pública assim que for aprovado.' },
  approved: { label: 'Publicado', variant: 'open' as const, text: 'Seu negócio está no ar. Alterações aparecem na hora.' },
  rejected: { label: 'Rejeitado', variant: 'danger' as const, text: '' },
  suspended: { label: 'Suspenso', variant: 'danger' as const, text: '' },
};

export function StatTiles({ stats, loading }: { stats?: Stats; loading: boolean }) {
  const tiles = [
    { key: 'page_views', label: 'Visualizações', icon: Eye },
    { key: 'whatsapp_clicks', label: 'Cliques no WhatsApp', icon: MessageCircle },
    { key: 'phone_clicks', label: 'Cliques no telefone', icon: Phone },
    { key: 'product_views', label: 'Produtos vistos', icon: Package },
  ] as const;
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.key} className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-1.5 text-sm text-ink-muted">
            <t.icon aria-hidden className="size-4" /> {t.label}
          </p>
          {loading || !stats ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1 text-3xl font-black tabular-nums">{stats.totals[t.key].toLocaleString('pt-BR')}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function DailyChart({ daily }: { daily: NonNullable<Stats['daily']> }) {
  const max = Math.max(1, ...daily.map((d) => d.page_views));
  return (
    <figure>
      <figcaption className="text-sm font-semibold">Visualizações por dia</figcaption>
      <div className="mt-3 flex h-36 items-end gap-[2px]" role="img" aria-label={`Gráfico de visualizações de ${daily.length} dias`}>
        {daily.map((d) => (
          <div
            key={d.day}
            title={`${new Date(d.day + 'T12:00:00').toLocaleDateString('pt-BR')}: ${d.page_views} visualizações, ${d.whatsapp_clicks} no WhatsApp`}
            className="flex-1 rounded-t bg-brand/80 hover:bg-brand-700"
            style={{ height: `${Math.max(2, (d.page_views / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-muted">
        <span>{new Date(daily[0]!.day + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
        <span>{new Date(daily[daily.length - 1]!.day + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
      </div>
    </figure>
  );
}

function StatsSection({ businessId }: { businessId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = React.useState(() => new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(today);
  const stats = useStats(businessId, from, to);
  const s = stats.data;
  return (
    <section className="mt-8" aria-labelledby="stats-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="stats-title" className="text-xl font-bold">
          Estatísticas {s && !s.detailed ? <span className="text-base font-normal text-ink-muted">· últimos 30 dias</span> : null}
        </h2>
        {s?.detailed ? (
          <div className="flex items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block font-semibold">De</span>
              <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-40" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Até</span>
              <Input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </label>
          </div>
        ) : null}
      </div>
      {stats.isError ? <Alert tone="error" className="mt-4">Não foi possível carregar as estatísticas.</Alert> : null}
      <div className="mt-4">
        <StatTiles stats={s} loading={stats.isLoading} />
      </div>
      {s?.detailed && s.daily?.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
            <DailyChart daily={s.daily} />
          </div>
          <div className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-semibold">Produtos mais vistos</h3>
            {s.products?.length ? (
              <ol className="mt-3 flex flex-col gap-2 text-sm">
                {s.products.slice(0, 8).map((p) => (
                  <li key={p.product_id} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="font-bold tabular-nums">{p.views}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">Nenhuma visualização de produto no período.</p>
            )}
          </div>
        </div>
      ) : null}
      {s && !s.detailed ? (
        <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card)] bg-ink p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <Lock aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
            Veja visitas dia a dia, escolha o período e descubra quais produtos chamam mais atenção com a Vitrine.
          </p>
          <Link to="/painel/assinatura" className={buttonVariants({ className: 'shrink-0 bg-brand text-ink hover:bg-accent' })}>
            <Sparkles aria-hidden /> Conhecer a Vitrine
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function Dashboard({ businessId }: { businessId: string }) {
  const business = useBusiness(businessId);
  const plan = usePlan(businessId);
  const supabase = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const resubmit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resubmit_business', { p_business_id: businessId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ tone: 'success', message: 'Cadastro reenviado para análise.' });
      qc.invalidateQueries({ queryKey: panelKeys.business(businessId) });
    },
    onError: (e) => toast({ tone: 'error', message: dbErrorMessage(e) }),
  });
  const b = business.data;
  const st = b ? STATUS[b.status] : null;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-ink-muted">Situação do cadastro</h2>
          {!b || !st ? (
            <Skeleton className="mt-2 h-16" />
          ) : (
            <>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold">
                {b.name} <Badge variant={st.variant}>{st.label}</Badge>
              </p>
              {st.text ? <p className="mt-2 text-sm text-ink-muted">{st.text}</p> : null}
              {b.status === 'rejected' || b.status === 'suspended' ? (
                <Alert tone="error" className="mt-3" title="Motivo informado pela equipe">
                  {b.status_reason}
                </Alert>
              ) : null}
              {b.status === 'rejected' ? (
                <Button className="mt-3" onClick={() => resubmit.mutate()} disabled={resubmit.isPending}>
                  Corrigi, reenviar para análise
                </Button>
              ) : null}
            </>
          )}
        </section>
        <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-ink-muted">Plano atual</h2>
          {!plan.data ? (
            <Skeleton className="mt-2 h-16" />
          ) : (
            <>
              <p className="mt-1 text-xl font-bold">{plan.data.name}</p>
              <Link to="/painel/assinatura" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700">
                {plan.data.is_default ? 'Ativar a Vitrine →' : 'Ver assinatura →'}
              </Link>
            </>
          )}
        </section>
      </div>

      <nav aria-label="Atalhos" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { to: '/painel/estabelecimento', label: 'Editar dados', icon: Pencil },
          { to: '/painel/estabelecimento#horarios', label: 'Horários', icon: Clock },
          { to: '/painel/estabelecimento#imagens', label: 'Imagens', icon: Sparkles },
          { to: '/painel/produtos', label: 'Produtos', icon: Package },
        ].map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className={cn('flex min-h-14 items-center gap-2 rounded-2xl bg-white px-4 font-semibold shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)]')}
          >
            <a.icon aria-hidden className="size-5 text-brand" /> {a.label}
          </Link>
        ))}
      </nav>

      <StatsSection businessId={businessId} />
    </>
  );
}

export default function PainelIndex() {
  const { business, user } = usePanel();
  const [params] = useSearchParams();
  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Olá! 👋</h1>
      {params.get('confirmado') ? (
        <Alert tone="success" className="mt-4" title="E-mail confirmado">
          Obrigado! Seu cadastro segue para análise.
        </Alert>
      ) : null}
      {!user.emailConfirmed ? (
        <Alert tone="warning" className="mt-4" title="Confirme seu e-mail">
          O negócio só pode ser publicado depois que você confirmar o e-mail {user.email}.
        </Alert>
      ) : null}
      <div className="mt-5">
        {business ? (
          <Dashboard businessId={business.id} />
        ) : (
          <Alert tone="info" title="Você ainda não tem um negócio cadastrado" action={<Link to="/painel/estabelecimento" className={buttonVariants()}>Cadastrar meu negócio</Link>}>
            Cadastre os dados do seu estabelecimento para enviá-lo à análise.
          </Alert>
        )}
      </div>
    </div>
  );
}
