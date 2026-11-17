import { ChevronDown, Crosshair, MapPin, Search } from 'lucide-react';
import * as React from 'react';
import { useFetcher } from 'react-router';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/skeleton';
import { Alert } from '~/components/ui/alert';
import { useRootData } from '~/lib/root-data';
import { nearest } from '~/lib/geo';
import { slugify } from '~/lib/slug';
import { cn } from '~/lib/utils';

type Hood = { slug: string; name: string; latitude: number | null; longitude: number | null };
type City = { slug: string; name: string; state_uf: string; neighborhoods: Hood[] };

export function LocationPicker({
  className,
  compact = false,
  trigger,
}: {
  className?: string;
  compact?: boolean;
  trigger?: React.ReactElement;
}) {
  const { location } = useRootData();
  const [open, setOpen] = React.useState(false);
  const label = location.neighborhood
    ? `${location.neighborhood.name}, ${location.city?.name ?? ''}`
    : (location.city?.name ?? 'Escolha seu bairro');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
        <button
          type="button"
          className={cn(
            'flex min-h-11 max-w-full items-center gap-1.5 rounded-xl px-2.5 text-left text-sm font-semibold hover:bg-cream-200',
            className,
          )}
          aria-label={`Localização: ${label}. Trocar`}
        >
          <MapPin aria-hidden className="size-5 shrink-0 text-brand" />
          <span className={cn('truncate', compact && 'max-w-[11rem]')}>{label}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        </button>
        )}
      </DialogTrigger>
      {open ? <LocationDialog onDone={() => setOpen(false)} /> : null}
    </Dialog>
  );
}

function LocationDialog({ onDone }: { onDone: () => void }) {
  const { location } = useRootData();
  const list = useFetcher<{ cities: City[] }>();
  const save = useFetcher<{ ok: boolean; error?: string }>();
  const [query, setQuery] = React.useState('');
  const [citySlug, setCitySlug] = React.useState(location.city?.slug ?? '');
  const [geoState, setGeoState] = React.useState<'idle' | 'locating' | 'error'>('idle');
  const [geoError, setGeoError] = React.useState('');

  React.useEffect(() => {
    if (list.state === 'idle' && !list.data) list.load('/api/locais');
  }, [list]);

  React.useEffect(() => {
    if (save.state === 'idle' && save.data?.ok) onDone();
  }, [save.state, save.data, onDone]);

  const cities = list.data?.cities ?? [];
  const city = cities.find((c) => c.slug === citySlug) ?? cities[0];
  const q = slugify(query);
  const hoods = (city?.neighborhoods ?? []).filter((n) => !q || n.slug.includes(q));

  function choose(c: string, n: string | null, geo?: { lat: number; lng: number }) {
    const fd = new FormData();
    fd.set('city', c);
    if (n) fd.set('neighborhood', n);
    if (geo) {
      fd.set('lat', String(geo.lat));
      fd.set('lng', String(geo.lng));
    }
    save.submit(fd, { method: 'post', action: '/api/location' });
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setGeoState('error');
      setGeoError('Seu navegador não informa a localização. Escolha o bairro na lista.');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const all = cities.flatMap((c) => c.neighborhoods.map((n) => ({ ...n, city: c.slug })));
        const best = nearest(all, lat, lng);
        if (!best) {
          setGeoState('error');
          setGeoError('Ainda não atendemos a sua região. Escolha um bairro na lista.');
          return;
        }
        setGeoState('idle');
        choose(best.city, best.slug, { lat, lng });
      },
      () => {
        setGeoState('error');
        setGeoError('Não foi possível obter sua localização. Verifique a permissão ou escolha na lista.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <DialogContent title="Onde você está?" description="Mostramos o comércio do bairro que você escolher." side="bottom">
      <div className="flex flex-col gap-4">
        <Button variant="soft" onClick={useMyLocation} disabled={geoState === 'locating' || !cities.length}>
          {geoState === 'locating' ? <Spinner label="Localizando" /> : <Crosshair aria-hidden />}
          Usar minha localização
        </Button>
        {geoState === 'error' ? <Alert tone="warning">{geoError}</Alert> : null}
        {save.data?.error ? <Alert tone="error">{save.data.error}</Alert> : null}

        {cities.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cidade">
            {cities.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setCitySlug(c.slug)}
                aria-pressed={city?.slug === c.slug}
                className="min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-line aria-pressed:bg-ink aria-pressed:text-white"
              >
                {c.name} · {c.state_uf}
              </button>
            ))}
          </div>
        ) : null}

        <label className="relative block">
          <span className="sr-only">Buscar bairro</span>
          <Search aria-hidden className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar bairro" className="pl-11" />
        </label>

        {list.state === 'loading' && !list.data ? (
          <div className="grid place-items-center py-8 text-brand-700">
            <Spinner label="Carregando bairros" />
          </div>
        ) : city ? (
          <ul className="flex flex-col gap-1" aria-label={`Bairros de ${city.name}`}>
            <li>
              <button
                type="button"
                onClick={() => choose(city.slug, null)}
                className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left font-semibold hover:bg-cream-200"
              >
                Toda {city.name}
              </button>
            </li>
            {hoods.map((n) => {
              const active = location.city?.slug === city.slug && location.neighborhood?.slug === n.slug;
              return (
                <li key={n.slug}>
                  <button
                    type="button"
                    onClick={() => choose(city.slug, n.slug)}
                    aria-current={active ? 'true' : undefined}
                    className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left hover:bg-cream-200 aria-[current=true]:bg-brand-50 aria-[current=true]:font-semibold aria-[current=true]:text-brand-700"
                  >
                    {n.name}
                    {active ? <span className="text-xs">atual</span> : null}
                  </button>
                </li>
              );
            })}
            {hoods.length === 0 ? <li className="px-3 py-6 text-center text-ink-muted">Nenhum bairro encontrado.</li> : null}
          </ul>
        ) : list.data ? (
          <p className="py-6 text-center text-ink-muted">Nenhuma cidade disponível ainda.</p>
        ) : null}
        {save.state !== 'idle' ? (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-muted">
            <Spinner label="Salvando" /> Salvando…
          </p>
        ) : null}
      </div>
    </DialogContent>
  );
}
