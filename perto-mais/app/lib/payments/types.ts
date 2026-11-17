import type { ServerSupabase } from '~/lib/supabase/server';

/**
 * Contrato para provedores de pagamento. Hoje só existe o "manual"
 * (o admin confirma o recebimento feito por fora). Mercado Pago ou Stripe
 * entram como outra implementação + rota de webhook, sem mudar as telas.
 */
export interface PaymentProvider {
  readonly id: string;
  /** Inicia a contratação. Manual: cria a solicitação pendente. Gateway: devolveria a URL de checkout. */
  requestSubscription(args: { supabase: ServerSupabase; businessId: string; planCode: string }): Promise<RequestResult>;
  /** Cancela uma solicitação ainda pendente feita pelo próprio comerciante. */
  cancelRequest(args: { supabase: ServerSupabase; subscriptionId: string }): Promise<void>;
  /** Webhooks do provedor (gateways). O manual não recebe webhooks. */
  handleWebhook?(request: Request): Promise<Response>;
}

export type RequestResult =
  | { kind: 'pending_manual'; subscriptionId: string }
  | { kind: 'redirect'; url: string; subscriptionId: string };

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
