import { manualProvider } from './manual.server';
import type { PaymentProvider } from './types';

const providers: Record<string, PaymentProvider> = { manual: manualProvider };

/** Provedor ativo. Trocar por 'mercadopago'/'stripe' quando existir a implementação. */
export function paymentProvider(id = process.env.PAYMENT_PROVIDER ?? 'manual'): PaymentProvider {
  const p = providers[id];
  if (!p) throw new Error(`Provedor de pagamento desconhecido: ${id}`);
  return p;
}
