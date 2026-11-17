import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import * as React from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { data, Form, Link, useActionData, useNavigation, useSubmit } from 'react-router';
import type { Route } from './+types/estabelecimento';
import { BusinessFields } from '~/components/business-fields';
import { GalleryManager } from '~/components/panel/gallery-manager';
import { HoursEditor } from '~/components/panel/hours-editor';
import { ImagePicker } from '~/components/panel/image-field';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input, Textarea } from '~/components/ui/input';
import { Skeleton, Spinner } from '~/components/ui/skeleton';
import { useToast } from '~/components/ui/toast';
import { getFormOptions } from '~/features/business/form-options.server';
import { panelKeys, usePlan } from '~/features/panel/queries';
import { removeImage } from '~/features/panel/upload';
import { requireUser } from '~/lib/auth.server';
import { formatPhoneBR } from '~/lib/phone';
import { fieldErrors, formToObject } from '~/lib/schemas/common';
import { businessProfileSchema } from '~/lib/schemas/business';
import { useSupabase } from '~/lib/supabase/client';
import { useZodForm } from '~/lib/use-zod-form';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const [options, { data: business }] = await Promise.all([
    getFormOptions(supabase),
    supabase.from('businesses').select('*').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle(),
  ]);
  return data({ options, business }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const parsed = businessProfileSchema.safeParse(formToObject(await request.formData()));
  if (!parsed.success) return data({ ok: false, errors: fieldErrors(parsed.error), message: null }, { status: 400 });
  const v = parsed.data;
  const row = {
    name: v.name,
    category_id: v.categoryId,
    city_id: v.cityId,
    neighborhood_id: v.neighborhoodId,
    address_line: v.addressLine,
    address_complement: v.addressComplement,
    postal_code: v.postalCode,
    phone_e164: v.phone,
    whatsapp_e164: v.whatsapp,
    latitude: v.latitude,
    longitude: v.longitude,
    instagram: v.instagram,
    description: v.description,
    keywords: v.keywords,
  };
  const { data: existing } = await supabase.from('businesses').select('id').eq('owner_id', user.id).order('created_at').limit(1).maybeSingle();
  // RLS + gatilhos no banco garantem dono, status e limites de plano.
  const { error } = existing
    ? await supabase.from('businesses').update(row).eq('id', existing.id)
    : await supabase.from('businesses').insert({ ...row, owner_id: user.id, slug: '' });
  if (error) {
    const msg = error.hint === 'plan_limit' || error.code === '23514' || error.code === 'P0001' ? error.message : 'Não foi possível salvar. Confira os dados.';
    return data({ ok: false, errors: null, message: msg }, { status: 400, headers });
  }
  return data({ ok: true, errors: null, message: existing ? 'Dados salvos.' : 'Negócio cadastrado e enviado para análise.' }, { headers });
}

function VitrineLock() {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted">
      <Lock aria-hidden className="size-4" /> Disponível no plano Vitrine.
      <Link to="/painel/assinatura" className="font-semibold text-brand-700">
        Ver plano
      </Link>
    </span>
  );
}

function ImagesSection({ businessId, logo, cover }: { businessId: string; logo: string | null; cover: string | null }) {
  const plan = usePlan(businessId);
  const supabase = useSupabase();
  const qc = useQueryClient();
  const [paths, setPaths] = React.useState({ logo, cover });
  if (!plan.data) return <Skeleton className="h-40" />;
  const p = plan.data;
  const setField = (field: 'logo' | 'cover') => async (path: string | null) => {
    const patch = field === 'logo' ? { logo_path: path } : { cover_path: path };
    const { error } = await supabase.from('businesses').update(patch).eq('id', businessId);
    if (error) throw error;
    await removeImage(supabase, paths[field]);
    setPaths((s) => ({ ...s, [field]: path }));
    qc.invalidateQueries({ queryKey: panelKeys.business(businessId) });
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-6">
        <ImagePicker label="Logo" kind="logo" businessId={businessId} currentPath={paths.logo} locked={!p.can_logo} onUploaded={setField('logo')} onRemove={() => setField('logo')(null)} />
        <div className="min-w-0 flex-1">
          <ImagePicker label="Foto de capa" kind="cover" aspect="wide" businessId={businessId} currentPath={paths.cover} locked={!p.can_cover} onUploaded={setField('cover')} onRemove={() => setField('cover')(null)} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Galeria</h3>
        {p.can_gallery ? <GalleryManager businessId={businessId} maxPhotos={p.max_photos} /> : <VitrineLock />}
      </div>
    </div>
  );
}

function VitrineTextFields({
  businessId,
  register,
  err,
}: {
  businessId: string | null;
  register: UseFormReturn<FieldValues>['register'];
  err: (n: string) => string | undefined;
}) {
  const plan = usePlan(businessId ?? '');
  const can = !!businessId && !!plan.data && !plan.data.is_default;
  return (
    <>
      <Field id="description" label="Descrição" optional error={err('description')} hint={can ? 'Conte o que você oferece, diferenciais e formas de entrega.' : <VitrineLock />}>
        <Textarea {...register('description')} readOnly={!can} rows={5} maxLength={2000} />
      </Field>
      <Field id="instagram" label="Instagram" optional error={err('instagram')} hint={can ? 'Só o usuário, sem @.' : <VitrineLock />}>
        <Input {...register('instagram')} readOnly={!can} placeholder="seunegocio" />
      </Field>
    </>
  );
}

export default function EditarEstabelecimento({ loaderData }: Route.ComponentProps) {
  const { options, business: b } = loaderData;
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const nav = useNavigation();
  const toast = useToast();
  const qc = useQueryClient();
  const ref = React.useRef<HTMLFormElement>(null);
  const form = useZodForm(
    businessProfileSchema,
    {
      name: b?.name ?? '',
      categoryId: b?.category_id ?? '',
      cityId: b?.city_id ?? options.cities[0]?.id ?? '',
      neighborhoodId: b?.neighborhood_id ?? '',
      addressLine: b?.address_line ?? '',
      addressComplement: b?.address_complement ?? '',
      postalCode: b?.postal_code ?? '',
      phone: formatPhoneBR(b?.phone_e164),
      whatsapp: formatPhoneBR(b?.whatsapp_e164),
      latitude: b?.latitude != null ? String(b.latitude) : '',
      longitude: b?.longitude != null ? String(b.longitude) : '',
      instagram: b?.instagram ?? '',
      description: b?.description ?? '',
      keywords: (b?.keywords ?? []).join(', '),
    },
    actionData?.errors,
  );
  const busy = nav.state === 'submitting';

  React.useEffect(() => {
    if (actionData?.ok && actionData.message) {
      toast({ tone: 'success', message: actionData.message });
      if (b) qc.invalidateQueries({ queryKey: panelKeys.business(b.id) });
    }
  }, [actionData, toast, qc, b]);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">{b ? 'Meu estabelecimento' : 'Cadastrar meu negócio'}</h1>
      {b?.status === 'approved' ? (
        <Alert tone="info">Seu negócio está publicado: as alterações aparecem no site assim que você salvar.</Alert>
      ) : null}
      <Form ref={ref} method="post" noValidate onSubmit={form.handleSubmit(() => submit(ref.current))} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold">Dados do negócio</h2>
          <BusinessFields form={form as unknown as UseFormReturn<FieldValues, unknown, FieldValues>} err={form.err} options={options} />
          <Field id="keywords" label="Palavras-chave" optional hint="Separadas por vírgula. Ajudam na busca (ex.: delivery, marmita, pet)." error={form.err('keywords')}>
            <Input {...form.register('keywords')} />
          </Field>
          <VitrineTextFields businessId={b?.id ?? null} register={form.register as unknown as UseFormReturn<FieldValues>['register']} err={form.err} />
        </section>
        {actionData?.message && !actionData.ok ? <Alert tone="error">{actionData.message}</Alert> : null}
        <Button type="submit" size="lg" className="self-start" disabled={busy}>
          {busy ? <Spinner label="Salvando" /> : null} {b ? 'Salvar alterações' : 'Cadastrar e enviar para análise'}
        </Button>
      </Form>

      {b ? (
        <>
          <section id="imagens" className="scroll-mt-32 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 text-lg font-bold">Imagens</h2>
            <ImagesSection businessId={b.id} logo={b.logo_path} cover={b.cover_path} />
          </section>
          <section id="horarios" className="scroll-mt-32 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 text-lg font-bold">Horários de funcionamento</h2>
            <HoursEditor businessId={b.id} />
          </section>
        </>
      ) : null}
    </div>
  );
}
