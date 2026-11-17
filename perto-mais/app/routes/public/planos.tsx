import { data } from 'react-router';
import type { Route } from './+types/planos';
import { PlanCards } from '~/components/plan-cards';
import { getPublicPlans } from '~/features/business/plans.server';
import { seo } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  return data({ plans: await getPublicPlans(supabase) }, { headers });
}

export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ matches, title: 'Planos', description: 'Cadastre seu negócio grátis ou monte sua vitrine digital completa.', path: '/planos' });

export default function Planos({ loaderData }: Route.ComponentProps) {
  return (
    <div className="container-page max-w-4xl pt-8">
      <h1 className="text-3xl font-black tracking-tight">Planos para comerciantes</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Comece grátis. Quando quiser mostrar fotos, cardápio e preços, ative a Vitrine. Sem fidelidade: o pagamento é combinado
        diretamente com a nossa equipe e, se não renovar, seu conteúdo fica guardado.
      </p>
      <div className="mt-8">
        <PlanCards plans={loaderData.plans} />
      </div>
      <section className="mt-12 rounded-3xl bg-white p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Como funciona o pagamento da Vitrine</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-ink-muted">
          <li>Você cria a conta e cadastra o negócio (grátis).</li>
          <li>No painel, em “Assinatura”, solicita o plano Vitrine.</li>
          <li>Nossa equipe entra em contato para combinar o pagamento.</li>
          <li>Confirmado o pagamento, a Vitrine é ativada pelo período contratado.</li>
        </ol>
      </section>
    </div>
  );
}
