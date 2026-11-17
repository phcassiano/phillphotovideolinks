import { parseCookieHeader } from '@supabase/ssr';

export const LOCATION_COOKIE = 'perto_loc';
export const GEO_COOKIE = 'perto_geo';
const ONE_YEAR = 60 * 60 * 24 * 365;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type SavedLocation = {
  city: string | null;
  neighborhood: string | null;
  geo: { lat: number; lng: number } | null;
};

export function readLocation(request: Request): SavedLocation {
  const cookies = parseCookieHeader(request.headers.get('Cookie') ?? '');
  const loc = cookies.find((c) => c.name === LOCATION_COOKIE)?.value ?? '';
  const geoRaw = cookies.find((c) => c.name === GEO_COOKIE)?.value ?? '';
  const [city, neighborhood] = decodeURIComponent(loc).split('/');
  let geo: SavedLocation['geo'] = null;
  const m = /^(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)$/.exec(decodeURIComponent(geoRaw));
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) geo = { lat, lng };
  }
  return {
    city: city && SLUG.test(city) ? city : null,
    neighborhood: neighborhood && SLUG.test(neighborhood) ? neighborhood : null,
    geo,
  };
}

function cookie(name: string, value: string, maxAge: number, secure: boolean) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function locationCookies(
  request: Request,
  loc: { city: string; neighborhood: string | null; geo?: { lat: number; lng: number } | null },
): string[] {
  const secure = new URL(request.url).protocol === 'https:';
  const out = [cookie(LOCATION_COOKIE, loc.neighborhood ? `${loc.city}/${loc.neighborhood}` : loc.city, ONE_YEAR, secure)];
  if (loc.geo) {
    // precisão de ~100 m é suficiente para distância e protege a privacidade
    out.push(cookie(GEO_COOKIE, `${loc.geo.lat.toFixed(3)},${loc.geo.lng.toFixed(3)}`, 60 * 60 * 24 * 7, secure));
  } else if (loc.geo === null) {
    out.push(cookie(GEO_COOKIE, '', 0, secure));
  }
  return out;
}
