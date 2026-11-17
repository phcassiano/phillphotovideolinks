import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, cleanupUsers, createBusiness, createUser, grantVitrine, serviceClient, type DB } from './helpers';

// Quatro perfis: anônimo, comerciante A (gratuito), comerciante B (Vitrine) e admin.
let anon: DB;
let A: Awaited<ReturnType<typeof createUser>>;
let B: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;
let bizA: { id: string; slug: string };
let bizB: { id: string; slug: string };
let bizPending: { id: string; slug: string };

beforeAll(async () => {
  anon = anonClient();
  [A, B, admin] = await Promise.all([createUser('a'), createUser('b'), createUser('admin', { admin: true })]);
  bizA = await createBusiness(A.id, 'Negocio A');
  bizB = await createBusiness(B.id, 'Negocio B');
  bizPending = await createBusiness(A.id, 'Negocio Pendente', 'pending');
  await grantVitrine(bizB.id);
});

afterAll(async () => {
  await cleanupUsers([A.id, B.id, admin.id]);
});

describe('anônimo', () => {
  it('lê apenas estabelecimentos aprovados pela view pública', async () => {
    const { data } = await anon.from('public_businesses').select('id').in('id', [bizA.id, bizPending.id]);
    expect(data?.map((r) => r.id)).toEqual([bizA.id]);
  });
  it('não lê a tabela businesses diretamente', async () => {
    const { data } = await anon.from('businesses').select('id').limit(5);
    expect(data ?? []).toHaveLength(0);
  });
  it('não grava em nenhuma tabela', async () => {
    const { error } = await anon.from('categories').insert({ name: 'Hack', slug: 'hack' });
    expect(error).not.toBeNull();
    const { error: e2 } = await anon.from('metric_events').insert({
      business_id: bizA.id, event_type: 'page_view', session_hash: 'xxxxxxxxxx', day: '2026-01-01',
    });
    expect(e2).not.toBeNull();
  });
  it('não chama a função de métricas (só o servidor)', async () => {
    const { error } = await anon.rpc('track_event', { p_business_id: bizA.id, p_event_type: 'page_view', p_session_hash: 'abcdefghij' });
    expect(error).not.toBeNull();
  });
  it('não vê produtos de negócio gratuito nem dados privados do dono', async () => {
    const { data } = await anon.from('public_businesses').select('*').eq('id', bizA.id).single();
    expect(data).not.toHaveProperty('owner_id');
    expect(data?.has_vitrine).toBe(false);
  });
});

describe('comerciante A', () => {
  it('não edita o negócio de B', async () => {
    const { data, error } = await A.client.from('businesses').update({ name: 'Invadido' }).eq('id', bizB.id).select();
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
    const { data: check } = await serviceClient().from('businesses').select('name').eq('id', bizB.id).single();
    expect(check?.name).not.toBe('Invadido');
  });
  it('não lê o negócio nem as assinaturas de B', async () => {
    const { data } = await A.client.from('businesses').select('id').eq('id', bizB.id);
    expect(data).toHaveLength(0);
    const { data: subs } = await A.client.from('subscriptions').select('id').eq('business_id', bizB.id);
    expect(subs).toHaveLength(0);
  });
  it('não se autoaprova', async () => {
    const { error } = await A.client.from('businesses').update({ status: 'approved' }).eq('id', bizPending.id);
    expect(error?.code).toBe('42501');
    const { data } = await serviceClient().from('businesses').select('status').eq('id', bizPending.id).single();
    expect(data?.status).toBe('pending');
  });
  it('cria negócio novo sempre como pendente e em seu nome', async () => {
    const svc = serviceClient();
    const { data: base } = await svc.from('businesses').select('category_id, city_id, neighborhood_id').eq('id', bizA.id).single();
    const { data, error } = await A.client
      .from('businesses')
      .insert({ ...base!, owner_id: B.id, name: 'Tentativa', address_line: 'Rua 1', whatsapp_e164: '+5561955551111', status: 'approved', is_demo: true })
      .select('owner_id, status, is_demo')
      .single();
    // owner_id diferente é barrado pela política; se passasse, o trigger forçaria os campos
    if (error) {
      expect(error.code).toBe('42501');
    } else {
      expect(data).toEqual({ owner_id: A.id, status: 'pending', is_demo: false });
    }
  });
  it('não vira admin', async () => {
    const { error } = await A.client.from('user_roles').insert({ user_id: A.id, role: 'admin' });
    expect(error).not.toBeNull();
    const { data: isAdmin } = await A.client.rpc('is_admin');
    expect(isAdmin).toBe(false);
  });
  it('não altera plano nem destaque', async () => {
    const { error } = await A.client.rpc('admin_grant_subscription', {
      p_business_id: bizA.id, p_plan_code: 'vitrine', p_starts_at: new Date().toISOString(), p_ends_at: new Date(Date.now() + 864e5).toISOString(),
    });
    expect(error?.code).toBe('42501');
    const { error: e2 } = await A.client.from('subscriptions').insert({ business_id: bizA.id, plan_id: bizA.id, price_cents: 0, status: 'active' });
    expect(e2).not.toBeNull();
    const { error: e3 } = await A.client.from('featured_businesses').insert({ business_id: bizA.id, ends_at: new Date(Date.now() + 864e5).toISOString() });
    expect(e3).not.toBeNull();
  });
  it('plano gratuito não insere produto', async () => {
    const { error } = await A.client.from('products').insert({ business_id: bizA.id, name: 'Pizza', price_cents: 1000 });
    expect(error?.hint).toBe('plan_limit');
  });
  it('plano gratuito não define logo nem descrição', async () => {
    const { error } = await A.client.from('businesses').update({ logo_path: `${bizA.id}/logo/x.webp` }).eq('id', bizA.id);
    expect(error?.hint).toBe('plan_limit');
    const { error: e2 } = await A.client.from('businesses').update({ description: 'Texto' }).eq('id', bizA.id);
    expect(e2?.hint).toBe('plan_limit');
  });
  it('edita dados básicos do próprio negócio', async () => {
    const { error } = await A.client.from('businesses').update({ address_line: 'Rua Nova, 2' }).eq('id', bizA.id);
    expect(error).toBeNull();
  });
  it('vê só os totais de 30 dias nas estatísticas', async () => {
    const { data, error } = await A.client.rpc('business_stats', { p_business_id: bizA.id, p_from: '2025-01-01' });
    expect(error).toBeNull();
    expect((data as { detailed: boolean; daily: unknown }).detailed).toBe(false);
    expect((data as { daily: unknown }).daily).toBeNull();
    const { error: e2 } = await A.client.rpc('business_stats', { p_business_id: bizB.id });
    expect(e2?.code).toBe('42501');
  });
  it('não lê tabelas de métricas nem o log de auditoria', async () => {
    expect((await A.client.from('business_metrics').select('id')).data).toHaveLength(0);
    expect((await A.client.from('admin_audit_log').select('id')).data).toHaveLength(0);
  });
  it('solicita assinatura só para o próprio negócio', async () => {
    const { error } = await A.client.rpc('request_subscription', { p_business_id: bizB.id, p_plan_code: 'vitrine' });
    expect(error?.code).toBe('42501');
    const { data, error: e2 } = await A.client.rpc('request_subscription', { p_business_id: bizA.id, p_plan_code: 'vitrine' });
    expect(e2).toBeNull();
    expect(data).toBeTruthy();
    const { error: dup } = await A.client.rpc('request_subscription', { p_business_id: bizA.id, p_plan_code: 'vitrine' });
    expect(dup?.code).toBe('23505');
  });
  it('não envia arquivo para a pasta de B no Storage', async () => {
    const blob = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'image/webp' });
    const { error } = await A.client.storage.from('business-media').upload(`${bizB.id}/logo/x.webp`, blob);
    expect(error).not.toBeNull();
    const { error: ok } = await A.client.storage.from('business-media').upload(`${bizA.id}/gallery/x.webp`, blob, { upsert: true });
    expect(ok).toBeNull();
  });
});

describe('comerciante B (Vitrine)', () => {
  it('insere produtos e eles aparecem publicamente', async () => {
    const { data: p, error } = await B.client.from('products').insert({ business_id: bizB.id, name: 'Calabresa', price_cents: 4500 }).select('id').single();
    expect(error).toBeNull();
    const { data } = await anon.from('products').select('id').eq('business_id', bizB.id);
    expect(data?.map((r) => r.id)).toContain(p!.id);
  });
  it('não aponta imagem para a pasta de outra loja', async () => {
    const { error } = await B.client.from('businesses').update({ logo_path: `${bizA.id}/logo/x.webp` }).eq('id', bizB.id);
    expect(error?.code).toBe('42501');
    const { error: e2 } = await B.client.from('products').insert({ business_id: bizB.id, name: 'X', photo_path: `${bizA.id}/product/x.webp` });
    expect(e2?.code).toBe('42501');
    const { error: e3 } = await B.client.from('business_photos').insert({ business_id: bizB.id, path: '/demo/acai-ponto-roxo/foto-1.webp' });
    expect(e3?.code).toBe('42501');
  });
  it('define logo e descrição', async () => {
    const { error } = await B.client.from('businesses').update({ logo_path: `${bizB.id}/logo/a.webp`, description: 'Pizzas' }).eq('id', bizB.id);
    expect(error).toBeNull();
    const { data } = await anon.from('public_businesses').select('logo_path, description, has_vitrine').eq('id', bizB.id).single();
    expect(data).toMatchObject({ has_vitrine: true, description: 'Pizzas' });
  });
  it('ao vencer, conteúdo da Vitrine fica oculto mas não é apagado', async () => {
    const svc = serviceClient();
    await svc.from('subscriptions').update({ ends_at: new Date(Date.now() - 1000).toISOString() }).eq('business_id', bizB.id);
    const { data: pub } = await anon.from('public_businesses').select('logo_path, description, has_vitrine').eq('id', bizB.id).single();
    expect(pub).toEqual({ logo_path: null, description: null, has_vitrine: false });
    expect((await anon.from('products').select('id').eq('business_id', bizB.id)).data).toHaveLength(0);
    expect((await B.client.from('products').select('id').eq('business_id', bizB.id)).data!.length).toBeGreaterThan(0);
    const { error } = await B.client.from('products').insert({ business_id: bizB.id, name: 'Nova', price_cents: 1 });
    expect(error?.hint).toBe('plan_limit');
    await grantVitrine(bizB.id);
  });
});

describe('admin', () => {
  it('aprova, rejeita com motivo e registra no log', async () => {
    const { error } = await admin.client.from('businesses').update({ status: 'rejected' }).eq('id', bizPending.id);
    expect(error).not.toBeNull(); // motivo obrigatório
    const { error: e2 } = await admin.client
      .from('businesses')
      .update({ status: 'rejected', status_reason: 'Fotos inadequadas' })
      .eq('id', bizPending.id);
    expect(e2).toBeNull();
    const { error: e3 } = await admin.client.from('businesses').update({ status: 'approved' }).eq('id', bizPending.id);
    expect(e3).toBeNull();
    const { data: log } = await admin.client.from('admin_audit_log').select('action, details').eq('entity_id', bizPending.id);
    expect(log?.some((l) => l.action === 'businesses.update')).toBe(true);
  });
  it('não aprova dono sem e-mail confirmado', async () => {
    const u = await createUser('naoconfirmado', { confirmed: false });
    const biz = await createBusiness(u.id, 'Sem confirmacao', 'pending');
    const { error } = await admin.client.from('businesses').update({ status: 'approved' }).eq('id', biz.id);
    expect(error?.hint).toBe('email_not_confirmed');
    await cleanupUsers([u.id]);
  });
  it('vê o painel e não usa slug reservado em cidade', async () => {
    const { data, error } = await admin.client.rpc('admin_dashboard');
    expect(error).toBeNull();
    expect(data).toHaveProperty('mrr_cents');
    const { data: st } = await admin.client.from('states').select('id').limit(1).single();
    const { error: e2 } = await admin.client.from('cities').insert({ state_id: st!.id, name: 'Painel', slug: 'painel' });
    expect(e2?.message).toMatch(/reservado/);
  });
  it('ativa assinatura solicitada', async () => {
    const { data: sub } = await admin.client.from('subscriptions').select('id').eq('business_id', bizA.id).eq('status', 'pending').single();
    const { error } = await admin.client.rpc('admin_activate_subscription', {
      p_subscription_id: sub!.id,
      p_starts_at: new Date().toISOString(),
      p_ends_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    });
    expect(error).toBeNull();
    const { data } = await anon.from('public_businesses').select('has_vitrine').eq('id', bizA.id).single();
    expect(data?.has_vitrine).toBe(true);
  });
});

describe('métricas', () => {
  it('deduplica por sessão e dia e ignora o dono', async () => {
    const svc = serviceClient();
    const args = { p_business_id: bizB.id, p_event_type: 'whatsapp_click' as const, p_session_hash: `sessao-${Date.now()}` };
    expect((await svc.rpc('track_event', args)).data).toBe(true);
    expect((await svc.rpc('track_event', args)).data).toBe(false);
    expect((await svc.rpc('track_event', { ...args, p_session_hash: `outra-${Date.now()}`, p_viewer_id: B.id })).data).toBe(false);
    const { data } = await B.client.rpc('business_stats', { p_business_id: bizB.id });
    expect((data as { totals: { whatsapp_clicks: number } }).totals.whatsapp_clicks).toBeGreaterThanOrEqual(1);
  });
});

describe('horários (função set_business_hours)', () => {
  it('dono substitui os próprios horários; outro comerciante não altera', async () => {
    const hours = [{ weekday: 1, opens_at: '08:00', closes_at: '12:00' }, { weekday: 1, opens_at: '14:00', closes_at: '18:00' }];
    expect((await A.client.rpc('set_business_hours', { p_business_id: bizA.id, p_hours: hours })).error).toBeNull();
    const { error } = await B.client.rpc('set_business_hours', { p_business_id: bizA.id, p_hours: [{ weekday: 2, opens_at: '08:00', closes_at: '09:00' }] });
    expect(error).not.toBeNull();
    const { data } = await anon.from('business_hours').select('weekday').eq('business_id', bizA.id);
    expect(data).toHaveLength(2);
    expect((await anon.rpc('set_business_hours', { p_business_id: bizA.id, p_hours: [] })).error).not.toBeNull();
  });
});
