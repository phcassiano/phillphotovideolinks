export type TrackEvent = 'page_view' | 'whatsapp_click' | 'phone_click' | 'product_view';

/** Registra uma métrica sem bloquear a navegação. O servidor deduplica e filtra robôs. */
export function track(businessId: string, event: TrackEvent, productId?: string) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({ businessId, event, productId: productId ?? null });
  try {
    if (navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) return;
  } catch {
    /* segue para fetch */
  }
  fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
}
