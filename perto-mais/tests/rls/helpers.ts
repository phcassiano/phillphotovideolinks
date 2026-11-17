import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/database';

export type DB = SupabaseClient<Database>;
const url = () => process.env.SUPABASE_URL!;
const anonKey = () => process.env.SUPABASE_ANON_KEY!;

export function serviceClient(): DB {
  return createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
export function anonClient(): DB {
  return createClient<Database>(url(), anonKey(), { auth: { persistSession: false } });
}

const run = Math.random().toString(36).slice(2, 8);

export async function createUser(label: string, opts: { admin?: boolean; confirmed?: boolean } = {}) {
  const svc = serviceClient();
  const email = `rls-${label}-${run}@teste.local`;
  const password = 'Senha-forte-123';
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: opts.confirmed ?? true,
    user_metadata: { full_name: `Teste ${label}` },
  });
  if (error) throw error;
  const id = data.user.id;
  if (opts.admin) {
    const { error: e } = await svc.from('user_roles').insert({ user_id: id, role: 'admin' });
    if (e) throw e;
  }
  const client = createClient<Database>(url(), anonKey(), { auth: { persistSession: false } });
  if (opts.confirmed ?? true) {
    const { error: e } = await client.auth.signInWithPassword({ email, password });
    if (e) throw e;
  }
  return { id, email, client };
}

export async function baseIds() {
  const svc = serviceClient();
  const { data: city } = await svc.from('cities').select('id, neighborhoods(id, slug)').eq('slug', 'brasilia').single();
  const { data: cat } = await svc.from('categories').select('id').eq('slug', 'pizzarias').single();
  return { cityId: city!.id, hoodId: city!.neighborhoods[0]!.id, categoryId: cat!.id };
}

export async function createBusiness(ownerId: string, name: string, status: 'pending' | 'approved' = 'approved') {
  const svc = serviceClient();
  const ids = await baseIds();
  const { data, error } = await svc
    .from('businesses')
    .insert({
      owner_id: ownerId,
      name: `${name} ${run}`,
      category_id: ids.categoryId,
      city_id: ids.cityId,
      neighborhood_id: ids.hoodId,
      address_line: 'Rua de Teste, 1',
      whatsapp_e164: '+5561955559999',
      latitude: -15.65,
      longitude: -47.79,
      status,
    })
    .select('id, slug')
    .single();
  if (error) throw error;
  return data;
}

export async function grantVitrine(businessId: string, days = 30) {
  const svc = serviceClient();
  const { data: plan } = await svc.from('plans').select('id, price_cents').eq('code', 'vitrine').single();
  const { error } = await svc.from('subscriptions').insert({
    business_id: businessId,
    plan_id: plan!.id,
    status: 'active',
    price_cents: plan!.price_cents,
    starts_at: new Date(Date.now() - 86400000).toISOString(),
    ends_at: new Date(Date.now() + days * 86400000).toISOString(),
  });
  if (error) throw error;
}

export async function cleanupUsers(ids: string[]) {
  const svc = serviceClient();
  for (const id of ids) await svc.auth.admin.deleteUser(id);
}
