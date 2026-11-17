import * as React from 'react';
import { data, Form, Link, redirect, useNavigation, useSearchParams, useSubmit } from 'react-router';
import type { Route } from './+types/login';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Spinner } from '~/components/ui/skeleton';
import { getSession, safeNext } from '~/lib/auth.server';
import { loginSchema } from '~/lib/schemas/auth';
import { fieldErrors, formToObject } from '~/lib/schemas/common';
import { seo } from '~/lib/seo';
import { useZodForm } from '~/lib/use-zod-form';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await getSession(request);
  if (user) throw redirect(safeNext(new URL(request.url).searchParams.get('next')), { headers });
  return data(null, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const fd = await request.formData();
  const parsed = loginSchema.safeParse(formToObject(fd));
  if (!parsed.success) return data({ errors: fieldErrors(parsed.error), message: null, unconfirmed: false }, { status: 400 });
  const { supabase, headers } = await getSession(request);
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const unconfirmed = error.code === 'email_not_confirmed';
    return data(
      {
        errors: null,
        unconfirmed,
        message: unconfirmed ? 'Seu e-mail ainda não foi confirmado.' : 'E-mail ou senha incorretos.',
      },
      { status: 400, headers },
    );
  }
  throw redirect(safeNext(String(fd.get('next') ?? '')), { headers });
}

export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ matches, title: 'Entrar', description: 'Acesse o painel do seu negócio.', path: '/login', noindex: true });

export default function Login({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const submit = useSubmit();
  const nav = useNavigation();
  const ref = React.useRef<HTMLFormElement>(null);
  const { register, handleSubmit, err, getValues } = useZodForm(loginSchema, { email: '', password: '' }, actionData?.errors);
  return (
    <div className="container-page max-w-md pt-10">
      <h1 className="text-3xl font-black tracking-tight">Entrar</h1>
      <p className="mt-2 text-ink-muted">Área do comerciante.</p>
      {params.get('senha') === 'ok' ? <Alert tone="success" className="mt-5">Senha alterada. Entre com a nova senha.</Alert> : null}
      {actionData?.message ? (
        <Alert tone="error" className="mt-5">
          {actionData.message}{' '}
          {actionData.unconfirmed ? (
            <Link to={`/cadastro/confirme?email=${encodeURIComponent(getValues('email'))}`}>Reenviar confirmação</Link>
          ) : null}
        </Alert>
      ) : null}
      <Form ref={ref} method="post" noValidate onSubmit={handleSubmit(() => submit(ref.current))} className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <input type="hidden" name="next" value={params.get('next') ?? ''} />
        <Field id="email" label="E-mail" error={err('email')}>
          <Input {...register('email')} type="email" autoComplete="email" />
        </Field>
        <Field id="password" label="Senha" error={err('password')}>
          <Input {...register('password')} type="password" autoComplete="current-password" />
        </Field>
        <Button type="submit" size="lg" disabled={nav.state !== 'idle'}>
          {nav.state !== 'idle' ? <Spinner label="Entrando" /> : null} Entrar
        </Button>
        <Link to="/recuperar-senha" className="text-center text-sm font-semibold text-brand-700">
          Esqueci minha senha
        </Link>
      </Form>
      <p className="mt-6 text-center text-ink-muted">
        Ainda não tem conta? <Link to="/cadastro" className="font-semibold text-brand-700">Cadastre seu negócio</Link>
      </p>
    </div>
  );
}
