import { BadgeDollarSign, Building2, FileClock, LayoutDashboard, LogOut, MapPinned, Shapes, Tags, Users } from 'lucide-react';
import { data, Form, NavLink, Outlet } from 'react-router';
import type { Route } from './+types/layout';
import { Logo } from '~/components/brand';
import { buttonVariants } from '~/components/ui/button';
import { requireAdmin } from '~/lib/auth.server';
import { noIndexMeta } from '~/lib/seo';
import { cn } from '~/lib/utils';

export const meta: Route.MetaFunction = () => [{ title: 'Administração' }, ...noIndexMeta];

export async function loader({ request }: Route.LoaderArgs) {
  const { headers, user } = await requireAdmin(request);
  headers.set('Cache-Control', 'private, no-store');
  return data({ email: user.email ?? '' }, { headers });
}

const NAV = [
  { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/admin/estabelecimentos', label: 'Estabelecimentos', icon: Building2 },
  { to: '/admin/assinaturas', label: 'Assinaturas', icon: BadgeDollarSign },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
  { to: '/admin/locais', label: 'Cidades e bairros', icon: MapPinned },
  { to: '/admin/categorias', label: 'Categorias', icon: Shapes },
  { to: '/admin/planos', label: 'Planos', icon: Tags },
  { to: '/admin/log', label: 'Registro de ações', icon: FileClock },
];

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-white md:sticky md:top-0 md:h-dvh md:border-b-0 md:border-r">
        <div className="flex h-16 items-center gap-2 px-4">
          <Logo />
          <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">Admin</span>
          <Form method="post" action="/sair" className="ml-auto md:hidden">
            <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Sair">
              <LogOut aria-hidden />
            </button>
          </Form>
        </div>
        <nav aria-label="Administração" className="overflow-x-auto px-2 pb-2 [scrollbar-width:none] md:overflow-visible">
          <ul className="flex w-max gap-1 md:w-auto md:flex-col">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn('flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-cream', isActive && 'bg-brand-50 text-brand-700')
                  }
                >
                  <Icon aria-hidden className="size-4" /> {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden px-4 py-3 text-xs text-ink-muted md:absolute md:bottom-0 md:block">
          <p className="truncate">{loaderData.email}</p>
          <Form method="post" action="/sair">
            <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mt-1 -ml-3' })}>
              <LogOut aria-hidden /> Sair
            </button>
          </Form>
        </div>
      </aside>
      <main id="conteudo" className="min-w-0 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}
