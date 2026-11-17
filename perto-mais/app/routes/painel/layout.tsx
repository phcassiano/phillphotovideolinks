import { BarChart3, CreditCard, ExternalLink, LogOut, Package, Store, UserRound } from 'lucide-react';
import { data, Form, Link, NavLink, Outlet, useOutletContext } from 'react-router';
import type { Route } from './+types/layout';
import { Logo } from '~/components/brand';
import { buttonVariants } from '~/components/ui/button';
import { requireUser } from '~/lib/auth.server';
import { noIndexMeta } from '~/lib/seo';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Painel' }, ...noIndexMeta];

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, slug, name, status')
    .eq('owner_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  headers.set('Cache-Control', 'private, no-store');
  return data(
    {
      user: { id: user.id, email: user.email ?? '', emailConfirmed: !!user.email_confirmed_at },
      business: biz,
    },
    { headers },
  );
}

export type PanelContext = {
  user: { id: string; email: string; emailConfirmed: boolean };
  business: { id: string; slug: string; name: string; status: string } | null;
};
export const usePanel = () => useOutletContext<PanelContext>();

const NAV = [
  { to: '/painel', label: 'Início', icon: BarChart3, end: true },
  { to: '/painel/estabelecimento', label: 'Estabelecimento', icon: Store },
  { to: '/painel/produtos', label: 'Produtos', icon: Package },
  { to: '/painel/assinatura', label: 'Assinatura', icon: CreditCard },
  { to: '/painel/conta', label: 'Conta', icon: UserRound },
];

export default function PainelLayout({ loaderData }: Route.ComponentProps) {
  const { business } = loaderData;
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-3">
          <Logo />
          <span className="hidden rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 sm:inline">Painel</span>
          <div className="ml-auto flex items-center gap-1">
            {business?.status === 'approved' ? (
              <Link to={`/estabelecimento/${business.slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })} target="_blank">
                <ExternalLink aria-hidden /> <span className="hidden sm:inline">Ver minha página</span>
                <span className="sr-only sm:hidden">Ver minha página</span>
              </Link>
            ) : null}
            <Form method="post" action="/sair">
              <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                <LogOut aria-hidden /> <span className="hidden sm:inline">Sair</span>
                <span className="sr-only sm:hidden">Sair</span>
              </button>
            </Form>
          </div>
        </div>
        <nav aria-label="Painel" className="container-page -mb-px overflow-x-auto [scrollbar-width:none]">
          <ul className="flex w-max gap-1">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-12 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-semibold text-ink-muted hover:text-ink',
                      isActive && 'border-brand-700 text-brand-700',
                    )
                  }
                >
                  <Icon aria-hidden className="size-4" /> {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="conteudo" className="container-page pt-6">
        <Outlet context={loaderData satisfies PanelContext} />
      </main>
    </div>
  );
}
