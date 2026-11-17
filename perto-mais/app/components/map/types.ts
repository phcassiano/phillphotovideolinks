export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  color?: string;
  highlighted?: boolean;
};

export type MapProps = {
  center: [number, number];
  zoom?: number;
  markers: MapMarker[];
  cluster?: boolean;
  fitToMarkers?: boolean;
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
  /** Modo de edição: um pino arrastável; devolve a nova posição. */
  draggable?: boolean;
  onMove?: (lat: number, lng: number) => void;
  label: string;
  className?: string;
};
