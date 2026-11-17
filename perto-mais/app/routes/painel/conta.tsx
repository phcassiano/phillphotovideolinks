import * as React from 'react';
import { data, Form, redirect, useActionData, useNavigation } from 'react-router';
import type { Route } from './+types/conta';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { useToast } from '~/components/ui/toast';
import { requireUser } from '~/lib/auth.server';
import { STORAGE_BUCKET } from '~/lib/images';
import { formatPhoneBR } from '~/lib/phone';
import { resetPasswordSchema } from '~/lib/schemas/auth';
import { accountSchema } from '~/lib/schemas/business';
import { fieldErrors, formToObject } from '~/lib/schemas/common';
import { supabaseAdmin } from '~/lib/supabase/admin.server';

export async function loader({ request }: Route.LoaderArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const { data: profile } = await supabase.from('profiles').select('full_name, phone_e164').eq('id', user.id).single();
  return data({ email: user.email ?? '', profile }, { headers });
}

type Result = { intent: string; ok: boolean; errors?: Record<string, string> | null; message?: string };

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers, user } = await requireUser(request);
  const fd = await request.formData();
  const intent = String(fd.get('intent'));

  if (intent === 'profile') {
    const parsed = accountSchema.safeParse(formToObject(fd));
    if (!parsed.success) return data<Result>({ intent, ok: false, errors: fieldErrors(parsed.error) }, { status: 400 });
    const { error } = await supabase.from('profiles').update({ full_name: parsed.data.fullName, phone_e164: parsed.data.phone }).eq('id', user.id);
    return data<Result>({ intent, ok: !error, message: error ? 'Não foi possível salvar.' : 'Dados salvos.' }, { headers });
  }

  if (intent === 'password') {
    const parsed = resetPasswordSchema.safeParse(formToObject(fd));
    if (!parsed.success) return data<Result>({ intent, ok: false, errors: fieldErrors(parsed.error) }, { status: 400 });
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    return data<Result>({ intent, ok: !error, message: error ? 'Não foi possível alterar a senha.' : 'Senha alterada.' }, { headers });
  }

  if (intent === 'delete') {
    if (String(fd.get('confirm')).trim().toUpperCase() !== 'EXCLUIR') {
      return data<Result>({ intent, ok: false, errors: { confirm: 'Digite EXCLUIR para confirmar.' } }, { status: 400 });
    }
    const admin = supabaseAdmin();
    // remove arquivos do Storage de cada negócio do usuário
    const { data: businesses } = await admin.from('businesses').select('id').eq('owner_id', user.id);
    for (const b of businesses ?? []) {
      for (const folder of ['logo', 'cover', 'gallery', 'product']) {
        const { data: files } = await admin.storage.from(STORAGE_BUCKET).list(`${b.id}/${folder}`, { limit: 1000 });
        if (files?.length) await admin.storage.from(STORAGE_BUCKET).remove(files.map((f) => `${b.id}/${folder}/${f.name}`));
      }
    }
    const { error } = await admin.auth.admin.deleteUser(user.id); // apaga negócios, produtos e métricas em cascata
    if (error) return data<Result>({ intent, ok: false, message: 'Não foi possível excluir a conta agora.' }, { status: 500 });
    await supabase.auth.signOut();
    throw redirect('/?conta=excluida', { headers });
  }
  return data<Result>({ intent, ok: false, message: 'Ação inválida.' }, { status: 400 });
}

export default function Conta({ loaderData }: Route.ComponentProps) {
  const { email, profile } = loaderData;
  const a = useActionData<typeof action>() as Result | undefined;
  const nav = useNavigation();
  const toast = useToast();
  const busy = (intent: string) => nav.state === 'submitting' && nav.formData?.get('intent') === intent;
  const errs = (intent: string) => (a?.intent === intent ? (a.errors ?? {}) : {});

  React.useEffect(() => {
    if (a?.ok && a.message) toast({ tone: 'success', message: a.message });
  }, [a, toast]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-black tracking-tight">Minha conta</h1>

      <Form method="post" className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Seus dados</h2>
        <p className="text-sm text-ink-muted">E-mail: {email}</p>
        <Field id="fullName" label="Nome" error={errs('profile').fullName}>
          <Input name="fullName" defaultValue={profile?.full_name ?? ''} autoComplete="name" />
        </Field>
        <Field id="phone" label="Telefone" optional error={errs('profile').phone}>
          <Input name="phone" type="tel" defaultValue={formatPhoneBR(profile?.phone_e164)} autoComplete="tel" />
        </Field>
        {a?.intent === 'profile' && !a.ok && a.message ? <Alert tone="error">{a.message}</Alert> : null}
        <Button type="submit" name="intent" value="profile" className="self-start" disabled={busy('profile')}>
          Salvar
        </Button>
      </Form>

      <Form method="post" className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-bold">Trocar senha</h2>
        <Field id="password" label="Nova senha" error={errs('password').password}>
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>
        <Field id="confirm" label="Repita a nova senha" error={errs('password').confirm}>
          <Input name="confirm" type="password" autoComplete="new-password" />
        </Field>
        {a?.intent === 'password' && !a.ok && a.message ? <Alert tone="error">{a.message}</Alert> : null}
        <Button type="submit" name="intent" value="password" className="self-start" disabled={busy('password')}>
          Alterar senha
        </Button>
      </Form>

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-danger/30">
        <h2 className="text-lg font-bold text-danger">Excluir conta</h2>
        <p className="text-sm text-ink-muted">
          Apaga sua conta, seu estabelecimento, fotos, produtos e estatísticas. Não dá para desfazer.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" className="self-start">
              Excluir minha conta
            </Button>
          </DialogTrigger>
          <DialogContent title="Excluir conta definitivamente?" side="bottom">
            <Form method="post" className="flex flex-col gap-4">
              <p className="text-ink-muted">Para confirmar, digite <strong className="text-ink">EXCLUIR</strong> abaixo.</p>
              <Field id="confirm-delete" label="Confirmação" error={errs('delete').confirm}>
                <Input name="confirm" autoComplete="off" />
              </Field>
              {a?.intent === 'delete' && a.message ? <Alert tone="error">{a.message}</Alert> : null}
              <Button type="submit" name="intent" value="delete" variant="danger" disabled={busy('delete')}>
                Excluir tudo
              </Button>
            </Form>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
