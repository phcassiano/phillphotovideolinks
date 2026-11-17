import { PaymentError, type PaymentProvider } from './types';

export const manualProvider: PaymentProvider = {
  id: 'manual',
  async requestSubscription({ supabase, businessId, planCode }) {
    const { data, error } = await supabase.rpc('request_subscription', { p_business_id: businessId, p_plan_code: planCode });
    if (error) throw new PaymentError(error.code === '23505' ? 'Já existe uma solicitação em análise.' : error.message, error.code);
    return { kind: 'pending_manual', subscriptionId: data };
  },
  async cancelRequest({ supabase, subscriptionId }) {
    const { error } = await supabase.rpc('cancel_subscription_request', { p_subscription_id: subscriptionId });
    if (error) throw new PaymentError(error.message, error.code);
  },
};
