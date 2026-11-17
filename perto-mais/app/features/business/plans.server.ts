import type { ServerSupabase } from '~/lib/supabase/server';

export async function getPublicPlans(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from('plans')
    .select('code, name, description, features, price_cents, billing_interval, is_default')
    .eq('is_active', true)
    .eq('is_public', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}
