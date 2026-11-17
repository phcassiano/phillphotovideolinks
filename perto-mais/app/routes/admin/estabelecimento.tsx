import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Star, Trash2 } from 'lucide-react';
import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { STATUS_LABEL } from './estabelecimentos';
import { Alert } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent } from '~/components/ui/dialog';
import { Field } from '~/components/ui/field';
import { Input, Textarea } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { dateBR, toDateInput, useAdminMutation } from '~/features/admin/hooks';
import { mediaUrl } from '~/lib/images';
import { formatBRL } from '~/lib/money';
import { formatPhoneBR, toE164BR } from '~/lib/phone';
import { usePublicEnv, useSupabase } from '~/lib/supabase/client';

type Status = 'pending' | 'approved' | 'rejected' | 'suspended';

function ReasonDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  onConfirm: (reason: string) => void;
  busy: boolean;
}) {
  const [reason, setReason] = React.useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description="O motivo fica visível para o comerciante no painel.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length >= 5) onConfirm(reason.trim());
          }}
        >
          <Field id="reason" label="Motivo" hint="Mínimo de 5 caracteres.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required minLength={5} />
          </Field>
          <Button type="submit" variant="danger" disabled={busy || reason.trim().length < 5}>
            Confirmar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminEstabelecimento() {
  const { id = '' } = useParams();
  const supabase = useSupabase();
  const env = usePublicEnv();
  const navigate = useNavigate();
  const key = ['admin', 'business', id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [b, owner, photos, products, featured, subs] = await Promise.all([
        supabase.from('businesses').select('*, categories(name), neighborhoods(name), cities(name)').eq('id', id).single(),
        supabase.rpc('admin_business_owner', { p_business_id: id }),
        supabase.from('business_photos').select('id, path, caption').eq('business_id', id).order('sort_order'),
        supabase.from('products').select('id, name, price_cents, photo_path').eq('business_id', id).order('sort_order'),
        supabase.from('featured_businesses').select('id, starts_at, ends_at').eq('business_id', id).order('ends_at', { ascending: false }),
        supabase.from('subscriptions').select('id, status, starts_at, ends_at, plans(name)').eq('business_id', id).order('created_at', { ascending: false }),
      ]);
      if (b.error) throw b.error;
      return { b: b.data, owner: owner.data?.[0] ?? null, photos: photos.data ?? [], products: products.data ?? [], featured: featured.data ?? [], subs: subs.data ?? [] };
    },
  });
  const invalidate = [key, ['admin', 'businesses']];
  const setStatus = useAdminMutation(
    async ({ status, reason }: { status: Status; reason?: string }) =>
      supabase.from('businesses').update({ status, status_reason: reason ?? null }).eq('id', id),
    { success: 'Situação atualizada.', invalidate },
  );
  const [reasonFor, setReasonFor] = React.useState<'rejected' | 'suspended' | null>(null);
  const [featureEnd, setFeatureEnd] = React.useState(toDateInput(new Date(Date.now() + 30 * 864e5)));
  const addFeatured = useAdminMutation(
    async () =>
      supabase.from('featured_businesses').insert({ business_id: id, starts_at: new Date().toISOString(), ends_at: new Date(`${featureEnd}T23:59:59-03:00`).toISOString() }),
    { success: 'Destaque programado.', invalidate },
  );
  const delFeatured = useAdminMutation(async (fid: string) => supabase.from('featured_businesses').delete().eq('id', fid), { success: 'Destaque removido.', invalidate });
  const delPhoto = useAdminMutation(async (pid: string) => supabase.from('business_photos').delete().eq('id', pid), { success: 'Foto removida.', invalidate });
  const delProduct = useAdminMutation(async (pid: string) => supabase.from('products').delete().eq('id', pid), { success: 'Produto removido.', invalidate });
  const clearField = useAdminMutation(
    async (field: 'logo_path' | 'cover_path' | 'description') => supabase.from('businesses').update({ [field]: null } as { logo_path: null }).eq('id', id),
    { success: 'Conteúdo removido.', invalidate },
  );
  const save = useAdminMutation(
    async (v: { name: string; address_line: string; whatsapp: string; phone: string }) => {
      const whatsapp = toE164BR(v.whatsapp);
      if (!whatsapp) throw new Error('WhatsApp inválido.');
      const phone = v.phone ? toE164BR(v.phone) : null;
      if (v.phone && !phone) throw new Error('Telefone inválido.');
      return supabase.from('businesses').update({ name: v.name, address_line: v.address_line, whatsapp_e164: whatsapp, phone_e164: phone }).eq('id', id);
    },
    { success: 'Dados salvos.', invalidate },
  );
  const remove = useAdminMutation(async () => supabase.from('businesses').delete().eq('id', id), { success: 'Estabelecimento excluído.', invalidate: [['admin', 'businesses']] });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <Alert tone="error">Estabelecimento não encontrado.</Alert>;
  const { b, owner, photos, products, featured, subs } = q.data;
  const st = STATUS_LABEL[b.status];
  const now = Date.now();

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link to="/admin/estabelecimentos" className="text-sm font-semibold text-brand-700">← Estabelecimentos</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black tracking-tight">{b.name}</h1>
        <Badge variant={st.variant}>{st.label}</Badge>
        {b.is_demo ? <Badge variant="demo">Demonstração</Badge> : null}
        {b.status === 'approved' ? (
          <Link to={`/estabelecimento/${b.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700">
            <ExternalLink aria-hidden className="size-4" /> Página pública
          </Link>
        ) : null}
      </div>
      {b.status_reason ? <Alert tone="warning" title="Motivo registrado">{b.status_reason}</Alert> : null}

      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-bold">Moderação</h2>
        {owner && !owner.email_confirmed_at ? (
          <Alert tone="warning" className="mt-3">O dono ainda não confirmou o e-mail; a aprovação fica bloqueada até lá.</Alert>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {b.status !== 'approved' ? (
            <Button onClick={() => setStatus.mutate({ status: 'approved' })} disabled={setStatus.isPending || !owner?.email_confirmed_at}>
              {b.status === 'suspended' ? 'Reativar' : 'Aprovar'}
            </Button>
          ) : null}
          {b.status === 'pending' ? <Button variant="secondary" onClick={() => setReasonFor('rejected')}>Rejeitar</Button> : null}
          {b.status === 'approved' ? <Button variant="danger" onClick={() => setReasonFor('suspended')}>Suspender</Button> : null}
          {b.status === 'rejected' || b.status === 'suspended' ? (
            <Button variant="secondary" onClick={() => setStatus.mutate({ status: 'pending' })}>Voltar para análise</Button>
          ) : null}
        </div>
        <ReasonDialog
          open={!!reasonFor}
          onOpenChange={(v) => !v && setReasonFor(null)}
          title={reasonFor === 'rejected' ? 'Rejeitar cadastro' : 'Suspender estabelecimento'}
          busy={setStatus.isPending}
          onConfirm={(reason) => setStatus.mutate({ status: reasonFor!, reason }, { onSuccess: () => setReasonFor(null) })}
        />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] text-sm">
          <h2 className="mb-2 text-base font-bold">Responsável</h2>
          {owner ? (
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1">
              <dt className="text-ink-muted">Nome</dt><dd>{owner.full_name || '—'}</dd>
              <dt className="text-ink-muted">E-mail</dt><dd className="break-all">{owner.email}</dd>
              <dt className="text-ink-muted">Confirmado</dt><dd>{owner.email_confirmed_at ? dateBR(owner.email_confirmed_at) : 'Não'}</dd>
              <dt className="text-ink-muted">Telefone</dt><dd>{formatPhoneBR(owner.phone_e164) || '—'}</dd>
            </dl>
          ) : <p>—</p>}
          <h2 className="mb-2 mt-4 text-base font-bold">Local</h2>
          <p>{b.categories?.name} · {b.address_line}, {b.neighborhoods?.name}, {b.cities?.name}</p>
          <p className="text-ink-muted">Cadastrado em {dateBR(b.created_at)}</p>
        </section>

        <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-bold">Destaque na home</h2>
          <ul className="mt-2 text-sm">
            {featured.map((f) => {
              const active = new Date(f.starts_at).getTime() <= now && new Date(f.ends_at).getTime() > now;
              return (
                <li key={f.id} className="flex items-center justify-between gap-2 py-1">
                  <span className="flex items-center gap-1.5">
                    <Star aria-hidden className={active ? 'size-4 fill-accent text-accent' : 'size-4 text-ink-muted'} />
                    {dateBR(f.starts_at)} a {dateBR(f.ends_at)} {active ? <Badge variant="featured">ativo</Badge> : null}
                  </span>
                  <Button variant="ghost" size="icon" aria-label="Remover destaque" onClick={() => delFeatured.mutate(f.id)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              );
            })}
            {featured.length === 0 ? <li className="text-ink-muted">Nunca destacado.</li> : null}
          </ul>
          <div className="mt-3 flex items-end gap-2">
            <Field id="feature-end" label="Destacar até">
              <Input type="date" value={featureEnd} min={toDateInput(new Date())} onChange={(e) => setFeatureEnd(e.target.value)} />
            </Field>
            <Button onClick={() => addFeatured.mutate(undefined)} disabled={addFeatured.isPending || b.status !== 'approved'}>
              Destacar
            </Button>
          </div>
          <h2 className="mt-5 font-bold">Assinaturas</h2>
          <ul className="mt-1 text-sm text-ink-muted">
            {subs.map((s) => <li key={s.id}>{s.plans?.name} · {s.status} · {dateBR(s.starts_at)}–{dateBR(s.ends_at)}</li>)}
            {subs.length === 0 ? <li>Nenhuma.</li> : null}
          </ul>
          <Link to={`/admin/assinaturas?negocio=${b.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700">Gerenciar assinaturas →</Link>
        </section>
      </div>

      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-bold">Editar dados</h2>
        <form
          key={b.updated_at}
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            save.mutate({ name: String(fd.get('name')), address_line: String(fd.get('address_line')), whatsapp: String(fd.get('whatsapp')), phone: String(fd.get('phone')) });
          }}
        >
          <Field id="a-name" label="Nome"><Input name="name" defaultValue={b.name} required minLength={2} /></Field>
          <Field id="a-addr" label="Endereço"><Input name="address_line" defaultValue={b.address_line} required minLength={3} /></Field>
          <Field id="a-wa" label="WhatsApp"><Input name="whatsapp" defaultValue={formatPhoneBR(b.whatsapp_e164)} /></Field>
          <Field id="a-ph" label="Telefone" optional><Input name="phone" defaultValue={formatPhoneBR(b.phone_e164)} /></Field>
          <Button type="submit" className="self-end sm:col-span-2 sm:justify-self-start" disabled={save.isPending}>Salvar</Button>
        </form>
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-bold">Conteúdo</h2>
        <p className="text-sm text-ink-muted">Remova o que for inadequado. As ações ficam registradas.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {(['logo_path', 'cover_path'] as const).map((f) =>
            b[f] ? (
              <div key={f} className="flex flex-col items-start gap-1">
                <img src={mediaUrl(env.SUPABASE_URL, b[f]) ?? ''} alt={f === 'logo_path' ? 'Logo' : 'Capa'} className="h-20 rounded-xl object-cover" />
                <Button variant="ghost" size="sm" onClick={() => clearField.mutate(f)}><Trash2 aria-hidden /> Remover {f === 'logo_path' ? 'logo' : 'capa'}</Button>
              </div>
            ) : null,
          )}
        </div>
        {b.description ? (
          <div className="mt-3 rounded-xl bg-cream p-3 text-sm">
            <p className="whitespace-pre-line">{b.description}</p>
            <Button variant="ghost" size="sm" className="mt-1" onClick={() => clearField.mutate('description')}><Trash2 aria-hidden /> Remover descrição</Button>
          </div>
        ) : null}
        {photos.length ? (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((p) => (
              <li key={p.id} className="relative">
                <img src={mediaUrl(env.SUPABASE_URL, p.path) ?? ''} alt={p.caption ?? 'Foto'} className="aspect-square w-full rounded-xl object-cover" />
                <Button variant="secondary" size="icon" className="absolute right-1 top-1" aria-label="Remover foto" onClick={() => delPhoto.mutate(p.id)}><Trash2 aria-hidden /></Button>
              </li>
            ))}
          </ul>
        ) : null}
        {products.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>{p.name} · {p.price_cents != null ? formatBRL(p.price_cents) : 'Consulte'}</span>
                <Button variant="ghost" size="icon" aria-label={`Remover produto ${p.name}`} onClick={() => delProduct.mutate(p.id)}><Trash2 aria-hidden /></Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-danger/30">
        <h2 className="font-bold text-danger">Excluir estabelecimento</h2>
        <p className="text-sm text-ink-muted">Apaga o cadastro, produtos, fotos e métricas. A conta do comerciante continua existindo.</p>
        <Button
          variant="danger"
          className="mt-3"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Excluir definitivamente “${b.name}”?`)) remove.mutate(undefined, { onSuccess: () => navigate('/admin/estabelecimentos') });
          }}
        >
          Excluir
        </Button>
      </section>
    </div>
  );
}
