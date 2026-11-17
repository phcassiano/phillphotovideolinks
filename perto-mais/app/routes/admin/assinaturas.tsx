import { useQuery } from '@tanstack/react-query';
import * as React from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Field } from '~/components/ui/field';
import { Input, Select } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { dateBR, toDateInput, useAdminMutation } from '~/features/admin/hooks';
import { formatBRL } from '~/lib/money';
import { useSupabase } from '~/lib/supabase/client';
import { cn } from '~/lib/utils';

const ST = {
  pending: { label: 'Pendente', variant: 'warning' as const },
  active: { label: 'Ativa', variant: 'open' as const },
  canceled: { label: 'Cancelada', variant: 'closed' as const },
  expired: { label: 'Vencida', variant: 'closed' as const },
};
const startOfDay = (d: string) => new Date(`${d}T00:00:00-03:00`).toISOString();
const endOfDay = (d: string) => new Date(`${d}T23:59:59-03:00`).toISOString();

function PeriodDialog({
  title,
  open,
  onOpenChange,
  onConfirm,
  busy,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (v: { start: string; end: string; notes: string }) => void;
  busy: boolean;
  children?: React.ReactNode;
}) {
  const [start, setStart] = React.useState(toDateInput(new Date()));
  const [end, setEnd] = React.useState(toDateInput(new Date(Date.now() + 30 * 864e5)));
  const [notes, setNotes] = React.useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description="Confirme que o pagamento foi recebido antes de ativar.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm({ start, end, notes });
          }}
        >
          {children}
          <div className="grid grid-cols-2 gap-3">
            <Field id="p-start" label="Início"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
            <Field id="p-end" label="Fim"><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required /></Field>
          </div>
          <Field id="p-notes" label="Observação" optional hint="Ex.: Pix recebido em 17/11.">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </Field>
          <Button type="submit" disabled={busy || end <= start}>Ativar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminAssinaturas() {
  const supabase = useSupabase();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'all';
  const businessId = params.get('negocio');
  const key = ['admin', 'subscriptions', status, businessId];
  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase
        .from('subscriptions')
        .select('id, status, price_cents, starts_at, ends_at, created_at, notes, business_id, businesses(name), plans(name, code)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (status !== 'all') q = q.eq('status', status as 'pending');
      if (businessId) q = q.eq('business_id', businessId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  const plans = useQuery({
    queryKey: ['admin', 'plans-paid'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('code, name').eq('is_default', false).order('sort_order');
      if (error) throw error;
      return data;
    },
  });
  const [activating, setActivating] = React.useState<string | null>(null);
  const [granting, setGranting] = React.useState(false);
  const [grantPlan, setGrantPlan] = React.useState('');
  const inv = [['admin', 'subscriptions'], ['admin', 'dashboard']];
  const activate = useAdminMutation(
    async (v: { id: string; start: string; end: string; notes: string }) =>
      supabase.rpc('admin_activate_subscription', { p_subscription_id: v.id, p_starts_at: startOfDay(v.start), p_ends_at: endOfDay(v.end), p_notes: v.notes || undefined }),
    { success: 'Assinatura ativada.', invalidate: inv },
  );
  const grant = useAdminMutation(
    async (v: { start: string; end: string; notes: string }) =>
      supabase.rpc('admin_grant_subscription', { p_business_id: businessId!, p_plan_code: grantPlan || plans.data![0]!.code, p_starts_at: startOfDay(v.start), p_ends_at: endOfDay(v.end), p_notes: v.notes || undefined }),
    { success: 'Assinatura criada.', invalidate: inv },
  );
  const cancel = useAdminMutation(async (id: string) => supabase.rpc('admin_cancel_subscription', { p_subscription_id: id }), { success: 'Assinatura cancelada.', invalidate: inv });
  const now = Date.now();

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Assinaturas</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[['all', 'Todas'], ['pending', 'Pendentes'], ['active', 'Ativas'], ['canceled', 'Canceladas']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => {
              const sp = new URLSearchParams(params);
              sp.set('status', v!);
              setParams(sp);
            }}
            aria-pressed={status === v}
            className={cn('min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-line', status === v ? 'bg-ink text-white' : 'bg-white')}
          >
            {l}
          </button>
        ))}
        {businessId ? (
          <>
            <Link to="/admin/assinaturas" className="ml-2 text-sm font-semibold text-brand-700">Limpar filtro do estabelecimento</Link>
            <Button className="ml-auto" onClick={() => setGranting(true)} disabled={!plans.data?.length}>Nova assinatura</Button>
          </>
        ) : null}
      </div>
      {list.isError ? <Alert tone="error" className="mt-4">Erro ao carregar.</Alert> : null}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]">
        {list.isLoading ? <div className="p-4"><Skeleton className="h-40" /></div> : list.data?.length ? (
          <ul className="divide-y divide-line">
            {list.data.map((s) => {
              const expired = s.status === 'active' && s.ends_at && new Date(s.ends_at).getTime() <= now;
              const st = ST[expired ? 'expired' : s.status];
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <Link to={`/admin/estabelecimentos/${s.business_id}`} className="min-w-0 flex-1 font-semibold hover:text-brand-700">{s.businesses?.name}</Link>
                  <span className="text-sm">{s.plans?.name} · {formatBRL(s.price_cents)}</span>
                  <span className="text-sm text-ink-muted">{s.starts_at ? `${dateBR(s.starts_at)} a ${dateBR(s.ends_at)}` : `pedido em ${dateBR(s.created_at)}`}</span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <span className="flex gap-1">
                    {s.status === 'pending' ? <Button size="sm" onClick={() => setActivating(s.id)}>Ativar</Button> : null}
                    {s.status === 'pending' || (s.status === 'active' && !expired) ? (
                      <Button size="sm" variant="ghost" onClick={() => window.confirm('Cancelar esta assinatura?') && cancel.mutate(s.id)}>Cancelar</Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="p-8 text-center text-ink-muted">Nenhuma assinatura.</p>}
      </div>
      <PeriodDialog
        title="Ativar assinatura"
        open={!!activating}
        onOpenChange={(v) => !v && setActivating(null)}
        busy={activate.isPending}
        onConfirm={(v) => activate.mutate({ id: activating!, ...v }, { onSuccess: () => setActivating(null) })}
      />
      <PeriodDialog title="Nova assinatura" open={granting} onOpenChange={setGranting} busy={grant.isPending} onConfirm={(v) => grant.mutate(v, { onSuccess: () => setGranting(false) })}>
        <Field id="g-plan" label="Plano">
          <Select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)}>
            {plans.data?.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </Select>
        </Field>
      </PeriodDialog>
    </div>
  );
}
