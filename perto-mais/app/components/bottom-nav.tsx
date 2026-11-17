import { House, LayoutGrid, Map, Megaphone } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '~/lib/utils';

const ITEMS = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/categorias', label: 'Categorias', icon: LayoutGrid },
  { to: '/mapa', label: 'Mapa', icon: Map },
  { to: '/anuncie', label: 'Anuncie', icon: Megaphone },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-ink-muted',
                  isActive && 'text-brand-700',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', isActive && 'bg-brand-50')}>
                    <Icon aria-hidden className="size-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
