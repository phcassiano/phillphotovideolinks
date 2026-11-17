import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '~/lib/supabase/client';
import type { Database } from '~/types/database';

export type Business = Database['public']['Tables']['businesses']['Row'];
export type Plan = Database['public']['Tables']['plans']['Row'];

export const panelKeys = {
  business: (id: string) => ['business', id] as const,
  plan: (id: string) => ['plan', id] as const,
  hours: (id: string) => ['hours', id] as const,
  photos: (id: string) => ['photos', id] as const,
  products: (id: string) => ['products', id] as const,
  productCategories: (id: string) => ['product-categories', id] as const,
  subscriptions: (id: string) => ['subscriptions', id] as const,
  stats: (id: string, from?: string, to?: string) => ['stats', id, from, to] as const,
};

export function useBusiness(id: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: panelKeys.business(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*, categories(name), neighborhoods(name, slug), cities(name, slug)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function usePlan(id: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: panelKeys.plan(id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('business_plan', { p_business_id: id });
      if (error) throw error;
      return data as Plan;
    },
  });
}

export function useHours(id: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: panelKeys.hours(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('business_hours').select('id, weekday, opens_at, closes_at').eq('business_id', id).order('weekday').order('opens_at');
      if (error) throw error;
      return data;
    },
  });
}

export type Stats = {
  detailed: boolean;
  from: string;
  to: string;
  totals: { page_views: number; whatsapp_clicks: number; phone_clicks: number; product_views: number };
  daily: { day: string; page_views: number; whatsapp_clicks: number; phone_clicks: number; product_views: number }[] | null;
  products: { product_id: string; name: string; views: number }[] | null;
};

export function useStats(id: string, from?: string, to?: string) {
  const supabase = useSupabase();
  return useQuery({
    queryKey: panelKeys.stats(id, from, to),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('business_stats', { p_business_id: id, p_from: from, p_to: to });
      if (error) throw error;
      return data as unknown as Stats;
    },
  });
}

/** Mensagem amigável para erros do banco (limites de plano, permissões). */
export function dbErrorMessage(error: unknown): string {
  const e = error as { message?: string; hint?: string; code?: string } | null;
  if (!e) return 'Algo deu errado.';
  if (e.hint === 'plan_limit' || e.code === 'P0001' || e.code === '23514') return e.message ?? 'Operação não permitida.';
  if (e.code === '42501') return 'Você não tem permissão para esta ação.';
  if (e.message?.includes('Failed to fetch')) return 'Sem conexão. Verifique sua internet.';
  return 'Não foi possível salvar. Tente novamente.';
}
