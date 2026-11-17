import { BarChart3, MessageCircle, Search, Store } from 'lucide-react';
import { data, Link } from 'react-router';
import type { Route } from './+types/anuncie';
import { PlanCards } from '~/components/plan-cards';
import { buttonVariants } from '~/components/ui/button';
import { site } from '~/config/site';
import { getPublicPlans } from '~/features/business/plans.server';
import { seo } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  return data({ plans: await getPublicPlans(supabase) }, { headers });
}

export const meta: Route.MetaFunction = ({ matches }) =>
  seo({
    matches,
    title: 'Anuncie seu negócio',
    description: `Coloque seu comércio no ${site.name} e receba contatos direto no WhatsApp. Cadastro grátis.`,
    path: '/anuncie',
  });

const BENEFITS = [
  { icon: Search, title: 'Seja encontrado no bairro', text: 'Apareça nas buscas e no mapa de quem mora perto.' },
  { icon: MessageCircle, title: 'Contato direto', text: 'O cliente fala com você pelo WhatsApp ou telefone. Sem taxa por pedido.' },
  { icon: Store, title: 'Vitrine digital', text: 'Mostre fotos, cardápio e preços em uma página só sua.' },
  { icon: BarChart3, title: 'Saiba o que funciona', text: 'Acompanhe visitas e cliques no WhatsApp pelo painel.' },
];

export default function Anuncie({ loaderData }: Route.ComponentProps) {
  return (
    <div className="pt-8">
      <section className="container-page max-w-4xl">
        <h1 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">
          Seu negócio na palma da mão <span className="text-brand-700">de todo o bairro.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          Cadastre grátis em poucos minutos. Depois de aprovado, seu estabelecimento aparece nas buscas, nas categorias e no mapa.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/cadastro" className={buttonVariants({ size: 'lg' })}>
            Cadastrar meu negócio
          </Link>
          <Link to="/login" className={buttonVariants({ size: 'lg', variant: 'secondary' })}>
            Já tenho conta
          </Link>
        </div>
      </section>
      <section className="container-page mt-12 max-w-4xl">
        <ul className="grid gap-4 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex gap-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <b.icon aria-hidden className="size-6" />
              </span>
              <div>
                <h2 className="font-bold">{b.title}</h2>
                <p className="mt-1 text-sm text-ink-muted">{b.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="container-page mt-12 max-w-4xl" aria-labelledby="planos">
        <h2 id="planos" className="mb-4 text-2xl font-black tracking-tight">
          Planos
        </h2>
        <PlanCards plans={loaderData.plans} />
      </section>
    </div>
  );
}
