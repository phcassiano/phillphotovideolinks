import { data, Form, redirect, useNavigation } from 'react-router';
import type { Route } from './+types/redefinir-senha';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { requireUser } from '~/lib/auth.server';
import { resetPasswordSchema } from '~/lib/schemas/auth';
import { fieldErrors, formToObject } from '~/lib/schemas/common';
import { noIndexMeta } from '~/lib/seo';

export const meta: Route.MetaFunction = () => [{ title: 'Nova senha' }, ...noIndexMeta];

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  return data(null, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = await requireUser(request);
  const parsed = resetPasswordSchema.safeParse(formToObject(await request.formData()));
  if (!parsed.success) return data({ errors: fieldErrors(parsed.error), message: null }, { status: 400 });
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return data({ errors: null, message: 'Não foi possível alterar a senha. Escolha uma senha diferente da anterior.' }, { status: 400 });
  await supabase.auth.signOut();
  throw redirect('/login?senha=ok', { headers });
}

export default function Redefinir({ actionData }: Route.ComponentProps) {
  const nav = useNavigation();
  return (
    <div className="container-page max-w-md pt-10">
      <h1 className="text-3xl font-black tracking-tight">Escolha uma nova senha</h1>
      {actionData?.message ? <Alert tone="error" className="mt-5">{actionData.message}</Alert> : null}
      <Form method="post" className="mt-6 flex flex-col gap-4 rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <Field id="password" label="Nova senha" hint="Pelo menos 8 caracteres." error={actionData?.errors?.password}>
          <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field id="confirm" label="Repita a senha" error={actionData?.errors?.confirm}>
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="lg" disabled={nav.state !== 'idle'}>
          Salvar senha
        </Button>
      </Form>
    </div>
  );
}
