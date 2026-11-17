import { data, Form, useNavigation } from 'react-router';
import type { Route } from './+types/recuperar-senha';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { serverEnv } from '~/lib/env.server';
import { recoverSchema } from '~/lib/schemas/auth';
import { fieldErrors, formToObject } from '~/lib/schemas/common';
import { noIndexMeta } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const meta: Route.MetaFunction = () => [{ title: 'Recuperar senha' }, ...noIndexMeta];

export async function action({ request }: Route.ActionArgs) {
  const parsed = recoverSchema.safeParse(formToObject(await request.formData()));
  if (!parsed.success) return data({ ok: false, errors: fieldErrors(parsed.error) }, { status: 400 });
  const { supabase, headers } = createSupabaseServerClient(request);
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${serverEnv.siteUrl}/auth/confirmar` });
  return data({ ok: true, errors: null }, { headers });
}

export default function Recuperar({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  return (
    <div className="container-page max-w-md pt-10">
      <h1 className="text-3xl font-black tracking-tight">Recuperar senha</h1>
      <p className="mt-2 text-ink-muted">Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.</p>
      {actionData?.ok ? (
        <Alert tone="success" className="mt-5" title="Pronto!">
          Se existir uma conta com este e-mail, você vai receber o link em instantes.
        </Alert>
      ) : (
        <Form method="post" className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <Field id="email" label="E-mail" error={actionData?.errors?.email}>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" size="lg" disabled={nav.state !== 'idle'}>
            Enviar link
          </Button>
        </Form>
      )}
    </div>
  );
}
