import { Map as MapIcon } from 'lucide-react';
import * as React from 'react';
import type { MapProps } from './types';
import { cn } from '~/lib/utils';

const LeafletMap = React.lazy(() => import('./leaflet-map'));

/** Só baixa Leaflet quando o mapa fica visível, e nunca no servidor. */
export function LazyMap({ className, ...props }: MapProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const placeholder = (
    <div className="grid size-full place-items-center rounded-[var(--radius-card)] bg-cream-200 text-ink-muted">
      <span className="flex items-center gap-2 text-sm">
        <MapIcon aria-hidden className="size-5" /> Carregando mapa…
      </span>
    </div>
  );

  return (
    <div ref={ref} className={cn('relative isolate overflow-hidden rounded-[var(--radius-card)]', className)}>
      {visible ? (
        <React.Suspense fallback={placeholder}>
          <LeafletMap {...props} />
        </React.Suspense>
      ) : (
        placeholder
      )}
    </div>
  );
}
