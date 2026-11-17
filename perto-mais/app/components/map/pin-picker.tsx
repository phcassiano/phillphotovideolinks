import { MapPin, Trash2 } from 'lucide-react';
import { LazyMap } from './lazy-map';
import { Button } from '~/components/ui/button';

/** Pino arrastável para o comerciante marcar a posição (sem geocodificação paga). */
export function PinPicker({
  lat,
  lng,
  fallbackCenter,
  onChange,
  error,
}: {
  lat: number | null;
  lng: number | null;
  fallbackCenter: [number, number];
  onChange: (lat: number | null, lng: number | null) => void;
  error?: string;
}) {
  const has = lat != null && lng != null;
  const center: [number, number] = has ? [lat, lng] : fallbackCenter;
  return (
    <div className="flex flex-col gap-2">
      <p id="pin-hint" className="text-sm text-ink-muted">
        {has ? 'Arraste o pino ou toque no mapa para ajustar.' : 'Toque no mapa no ponto exato do seu negócio.'}
      </p>
      <LazyMap
        className="h-72 ring-1 ring-line"
        center={center}
        zoom={16}
        markers={has ? [{ id: 'pin', lat, lng, title: 'Posição do negócio' }] : []}
        draggable
        onMove={(la, ln) => onChange(Number(la.toFixed(6)), Number(ln.toFixed(6)))}
        label="Mapa para marcar a posição do negócio"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-ink-muted">
          <MapPin aria-hidden className="size-4" />
          {has ? `Posição marcada (${lat.toFixed(5)}, ${lng.toFixed(5)})` : 'Sem posição — o negócio não aparece no mapa.'}
        </span>
        {has ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(null, null)}>
            <Trash2 aria-hidden /> Remover
          </Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
