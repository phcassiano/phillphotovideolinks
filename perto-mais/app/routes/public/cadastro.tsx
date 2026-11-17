import * as React from 'react';
import { data, Form, Link, redirect, useNavigation, useSubmit } from 'react-router';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import type { Route } from './+types/cadastro';
import { BusinessFields } from '~/components/business-fields';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/skeleton';
import { getFormOptions } from '~/features/business/form-options.server';
import { getSession } from '~/lib/auth.server';
import { serverEnv } from '~/lib/env.server';
import { fieldErrors, formToObject } from '~/lib/schemas/common';
import { signupSchema } from '~/lib/schemas/business';
import { clientIp, sha256 } from '~/lib/server/request.server';
import { seo } from '~/lib/seo';
import { supabaseAdmin } from '~/lib/supabase/admin.server';
import { useZodForm } from '~/lib/use-zod-form';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, user } = await getSession(request);
  if (user) throw redirect('/painel', { headers });
  return data({ options: await getFormOptions(supabase) }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const parsed = signupSchema.safeParse(formToObject(await request.formData()));
  if (!parsed.success) return data({ errors: fieldErrors(parsed.error), message: null }, { status: 400 });
  const input = parsed.data;

  const admin = supabaseAdmin();
  const { data: allowed } = await admin.rpc('check_rate_limit', {
    p_key: `signup:${sha256(clientIp(request) + serverEnv.metricsSalt)}`,
    p_limit: 5,
    p_window_seconds: 600,
  });
  if (allowed === false) {
    return data({ errors: null, message: 'Muitas tentativas de cadastro. Aguarde alguns minutos e tente de novo.' }, { status: 429 });
  }

  // bairro precisa pertencer à cidade e estar ativo
  const { data: hood } = await admin
    .from('neighborhoods')
    .select('id')
    .eq('id', input.neighborhoodId)
    .eq('city_id', input.cityId)
    .eq('is_active', true)
    .maybeSingle();
  if (!hood) return data({ errors: { neighborhoodId: 'Bairro inválido.' }, message: null }, { status: 400 });

  const { supabase, headers } = await getSession(request);
  const { data: signUp, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${serverEnv.siteUrl}/auth/confirmar`,
      data: { full_name: input.ownerName, phone_e164: input.ownerPhone },
    },
  });
  if (error) {
    const msg = /password/i.test(error.message)
      ? 'Senha fraca. Use pelo menos 8 caracteres, misturando letras e números.'
      : 'Não foi possível criar a conta agora. Tente novamente.';
    return data({ errors: null, message: msg }, { status: 400 });
  }
  const user = signUp.user;
  // E-mail já cadastrado: o Auth devolve usuário sem identidades. Não revelamos isso.
  if (user && (user.identities?.length ?? 0) > 0) {
    const { error: bizError } = await admin.from('businesses').insert({
      owner_id: user.id,
      name: input.name,
      category_id: input.categoryId,
      city_id: input.cityId,
      neighborhood_id: input.neighborhoodId,
      address_line: input.addressLine,
      address_complement: input.addressComplement,
      postal_code: input.postalCode,
      phone_e164: input.phone,
      whatsapp_e164: input.whatsapp,
      latitude: input.latitude,
      longitude: input.longitude,
      status: 'pending',
    });
    if (bizError) {
      await admin.auth.admin.deleteUser(user.id);
      return data({ errors: null, message: 'Não foi possível salvar o negócio. Confira os dados e tente de novo.' }, { status: 400 });
    }
  }
  headers.append('Location', `/cadastro/confirme?email=${encodeURIComponent(input.email)}`);
  return new Response(null, { status: 303, headers });
}

export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ matches, title: 'Cadastrar meu negócio', description: 'Cadastro gratuito para comerciantes do bairro.', path: '/cadastro' });

export default function Cadastro({ loaderData, actionData }: Route.ComponentProps) {
  const { options } = loaderData;
  const submit = useSubmit();
  const nav = useNavigation();
  const formRef = React.useRef<HTMLFormElement>(null);
  const form = useZodForm(
    signupSchema,
    {
      ownerName: '', email: '', password: '', ownerPhone: '', name: '', categoryId: '',
      cityId: options.cities[0]?.id ?? '', neighborhoodId: '', addressLine: '', addressComplement: '',
      postalCode: '', phone: '', whatsapp: '', latitude: '', longitude: '', acceptTerms: false,
    },
    actionData?.errors,
  );
  const { register, handleSubmit, err } = form;
  const busy = nav.state !== 'idle';

  return (
    <div className="container-page max-w-2xl pt-8">
      <h1 className="text-3xl font-black tracking-tight">Cadastre seu negócio</h1>
      <p className="mt-2 text-ink-muted">
        É grátis. Depois de confirmar o e-mail, nossa equipe revisa o cadastro e ele passa a aparecer nas buscas.
      </p>
      {actionData?.message ? <Alert tone="error" className="mt-5">{actionData.message}</Alert> : null}
      <Form
        ref={formRef}
        method="post"
        noValidate
        onSubmit={handleSubmit(() => submit(formRef.current))}
        className="mt-6 flex flex-col gap-6"
      >
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold">Seus dados</h2>
          <Field id="ownerName" label="Seu nome" error={err('ownerName')}>
            <Input {...register('ownerName')} autoComplete="name" />
          </Field>
          <Field id="ownerPhone" label="Seu telefone" hint="Para falarmos com você sobre o cadastro. Não aparece no site." error={err('ownerPhone')}>
            <Input {...register('ownerPhone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="(61) 99999-0000" />
          </Field>
          <Field id="email" label="E-mail" error={err('email')}>
            <Input {...register('email')} type="email" autoComplete="email" />
          </Field>
          <Field id="password" label="Senha" hint="Pelo menos 8 caracteres." error={err('password')}>
            <Input {...register('password')} type="password" autoComplete="new-password" />
          </Field>
        </section>
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold">Seu negócio</h2>
          <BusinessFields form={form as unknown as UseFormReturn<FieldValues, unknown, FieldValues>} err={err} options={options} />
        </section>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" {...register('acceptTerms')} className="mt-0.5 size-5 accent-[var(--color-brand-700)]" aria-invalid={!!err('acceptTerms')} />
          <span>
            Li e aceito os <Link to="/termos" className="font-semibold text-brand-700 underline" target="_blank">termos de uso</Link> e a{' '}
            <Link to="/privacidade" className="font-semibold text-brand-700 underline" target="_blank">política de privacidade</Link>.
            {err('acceptTerms') ? <span role="alert" className="mt-1 block font-medium text-danger">{err('acceptTerms')}</span> : null}
          </span>
        </label>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? <Spinner label="Enviando" /> : null} Criar conta e cadastrar
        </Button>
        <p className="text-center text-sm text-ink-muted">
          Já tem conta? <Link to="/login" className="font-semibold text-brand-700">Entrar</Link>
        </p>
      </Form>
    </div>
  );
}
