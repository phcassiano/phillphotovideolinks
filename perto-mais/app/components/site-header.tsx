import { LayoutDashboard, LogIn, Search, ShieldCheck } from 'lucide-react';
import { Form, Link, NavLink, useSearchParams } from 'react-router';
import { Logo } from '~/components/brand';
import { LocationPicker } from '~/components/location-picker';
import { Input } from '~/components/ui/input';
import { buttonVariants } from '~/components/ui/button';
import { useRootData } from '~/lib/root-data';
import { cn } from '~/lib/utils';

const NAV = [
  { to: '/', label: 'Início', end: true },
  { to: '/categorias', label: 'Categorias' },
  { to: '/mapa', label: 'Mapa' },
  { to: '/anuncie', label: 'Anuncie' },
];

export function SiteHeader() {
  const { user } = useRootData();
  const [params] = useSearchParams();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/75">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Pular para o conteúdo
      </a>
      <div className="container-page flex h-16 items-center gap-3">
        <Logo className="shrink-0" />
        <LocationPicker className="min-w-0 md:ml-2" compact />
        <Form action="/explorar" role="search" className="relative ml-auto hidden w-full max-w-xs lg:block">
          <label htmlFor="header-q" className="sr-only">
            O que você está procurando?
          </label>
          <Search aria-hidden className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <Input id="header-q" name="q" defaultValue={params.get('q') ?? ''} placeholder="Buscar no bairro" className="pl-11" />
        </Form>
        <nav aria-label="Principal" className="ml-auto hidden items-center gap-1 md:flex lg:ml-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn('rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-cream-200', isActive && 'text-brand-700')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-1">
          {user?.isAdmin ? (
            <Link to="/admin" className={buttonVariants({ variant: 'ghost', size: 'icon' })} aria-label="Administração">
              <ShieldCheck aria-hidden />
            </Link>
          ) : null}
          {user ? (
            <Link to="/painel" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <LayoutDashboard aria-hidden /> <span className="hidden sm:inline">Meu painel</span>
              <span className="sr-only sm:hidden">Meu painel</span>
            </Link>
          ) : (
            <Link to="/login" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <LogIn aria-hidden /> <span className="hidden sm:inline">Entrar</span>
              <span className="sr-only sm:hidden">Entrar</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
