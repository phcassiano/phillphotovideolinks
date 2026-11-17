import { site } from '~/config/site';

export function whatsappLink(e164: string, message?: string): string {
  const number = e164.replace(/\D/g, '');
  const text = message ?? site.whatsappMessage(site.name);
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function productWhatsappLink(e164: string, productName: string): string {
  return whatsappLink(e164, site.whatsappProductMessage(site.name, productName));
}

export function telLink(e164: string): string {
  return `tel:${e164}`;
}

/** Abre o app de mapas do aparelho com rota até o ponto. */
export function directionsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
