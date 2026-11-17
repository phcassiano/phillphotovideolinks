export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  return `${km.toLocaleString('pt-BR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

export function nearest<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  lat: number,
  lng: number,
): T | undefined {
  let best: T | undefined;
  let bestD = Infinity;
  for (const item of items) {
    if (item.latitude == null || item.longitude == null) continue;
    const d = distanceKm(lat, lng, item.latitude, item.longitude);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}
