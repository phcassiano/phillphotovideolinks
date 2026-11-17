import { Check, Clock } from 'lucide-react';
import * as React from 'react';
import { data, Form, Link, useActionData, useNavigation } from 'react-router';
import type { Route } from './+types/assinatura';
import { PlanCards } from '~/components/plan-cards';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button, buttonVariants } from '~/components/ui/button';
import { useToast } from '~/components/ui/toast';
import { getPublicPlans } from '~/features/business/plans.server';
import { requireUser } from '~/lib/auth.server';
import { formatBRL } from '~/lib/money';
import { paymentProvider } from '~/lib/payments/index.server';
import { PaymentError } from '~/lib/payments/types';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { data: biz } = await supabase.from('businesses').select('id, name').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
  if (!biz) return data({ business: null, plan: null, plans: [], subscriptions: [] }, { headers });
  const [{ data: plan }, plans, { data: subscriptions }] = await Promise.all([
    supabase.rpc('business_plan', { p_business_id: biz.id }),
    getPublicPlans(supabase),
    supabase
      .from('subscriptions')
      .select('id, status, price_cents, starts_at, ends_at, created_at, canceled_at, plans(name, code)')
      .eq('business_id', biz.id)
      .order('created_at', { ascending: false }),
  ]);
  return data({ business: biz, plan, plans, subscriptions: subscriptions ?? [] }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const fd = await request.formData();
  const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
  if (!biz) return data({ ok: false, message: 'Cadastre seu negócio primeiro.' }, { status: 400 });
  const provider = paymentProvider();
  try {
    if (fd.get('intent') === 'cancel') {
      await provider.cancelRequest({ supabase, subscriptionId: String(fd.get('subscriptionId')) });
      return data({ ok: true, message: 'Solicitação cancelada.' }, { headers });
    }
    const planCode = String(fd.get('plan') ?? '');
    if (!/^[a-z0-9_-]+$/.test(planCode)) return data({ ok: false, message: 'Plano inválido.' }, { status: 400 });
    const result = await provider.requestSubscription({ supabase, businessId: biz.id, planCode });
    if (result.kind === 'redirect') return Response.redirect(result.url, 303);
    return data({ ok: true, message: 'Solicitação enviada! Nossa equipe vai entrar em contato para combinar o pagamento.' }, { headers });
  } catch (e) {
    return data({ ok: false, message: e instanceof PaymentError ? e.message : 'Não foi possível concluir.' }, { status: 400, headers });
  }
}

const STATUS = {
  pending: { label: 'Aguardando pagamento', variant: 'warning' as const },
  active: { label: 'Ativa', variant: 'open' as const },
  canceled: { label: 'Cancelada', variant: 'closed' as const },
  expired: { label: 'Vencida', variant: 'closed' as const },
};
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

export default function Assinatura({ loaderData }: Route.ComponentProps) {
  const { business, plan, plans, subscriptions } = loaderData;
  const a = useActionData<typeof action>();
  const nav = useNavigation();
  const toast = useToast();
  React.useEffect(() => {
    if (a?.ok) toast({ tone: 'success', message: a.message });
  }, [a, toast]);

  if (!business) {
    return (
      <Alert tone="info" title="Cadastre seu negócio primeiro" action={<Link to="/painel/estabelecimento" className={buttonVariants()}>Cadastrar</Link>}>
        A assinatura é vinculada ao estabelecimento.
      </Alert>
    );
  }
  const pending = subscriptions.find((s) => s.status === 'pending');
  const now = Date.now();
  const active = subscriptions.find((s) => s.status === 'active' && s.ends_at && new Date(s.ends_at).getTime() > now);
  const paid = plans.filter((p) => !p.is_default);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">Assinatura</h1>
      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold text-ink-muted">Plano atual</h2>
        <p className="mt-1 text-2xl font-black">{plan?.name}</p>
        {active ? (
          <p className="mt-1 flex items-center gap-1.5 text-ink-muted">
            <Check aria-hidden className="size-4 text-success" /> Ativo até {date(active.ends_at)}. Depois disso, o conteúdo da Vitrine fica oculto
            (não é apagado) até a renovação.
          </p>
        ) : null}
      </section>

      {a && !a.ok ? <Alert tone="error">{a.message}</Alert> : null}

      {pending ? (
        <Alert
          tone="warning"
          title={`Solicitação do plano ${pending.plans?.name ?? ''} em análise`}
          action={
            <Form method="post">
              <input type="hidden" name="subscriptionId" value={pending.id} />
              <Button type="submit" name="intent" value="cancel" variant="secondary" size="sm" disabled={nav.state !== 'idle'}>
                Cancelar solicitação
              </Button>
            </Form>
          }
        >
          Valor: {formatBRL(pending.price_cents)}/mês. Nossa equipe vai falar com você para combinar o pagamento. Assim que ele for confirmado,
          a Vitrine é ativada.
        </Alert>
      ) : null}

      {!pending && paid.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-bold">{active ? 'Renovar' : 'Ative a Vitrine'}</h2>
          <PlanCards plans={plans} ctaTo={null} />
          <Form method="post" className="mt-4 flex flex-wrap gap-3">
            {paid.map((p) => (
              <Button key={p.code} type="submit" name="plan" value={p.code} size="lg" disabled={nav.state !== 'idle'}>
                {active ? `Solicitar renovação do ${p.name}` : `Solicitar o plano ${p.name}`} · {formatBRL(p.price_cents)}/mês
              </Button>
            ))}
          </Form>
          <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
            <Clock aria-hidden className="mt-0.5 size-4 shrink-0" /> Não cobramos nada pelo site. Após a solicitação, combinamos o pagamento
            diretamente com você.
          </p>
        </section>
      ) : null}

      {subscriptions.length > 0 ? (
        <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold">Histórico</h2>
          <ul className="mt-3 divide-y divide-line">
            {subscriptions.map((s) => {
              const expired = s.status === 'active' && s.ends_at && new Date(s.ends_at).getTime() <= now;
              const st = STATUS[expired ? 'expired' : s.status];
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-semibold">{s.plans?.name}</span>
                  <span className="text-ink-muted">
                    {s.starts_at ? `${date(s.starts_at)} a ${date(s.ends_at)}` : `Pedido em ${date(s.created_at)}`} · {formatBRL(s.price_cents)}
                  </span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
