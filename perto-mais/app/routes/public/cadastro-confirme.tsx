import { MailCheck } from 'lucide-react';
import { data, Form, Link, useNavigation, useSearchParams } from 'react-router';
import type { Route } from './+types/cadastro-confirme';
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { serverEnv } from '~/lib/env.server';
import { email as emailSchema } from '~/lib/schemas/common';
import { noIndexMeta } from '~/lib/seo';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export const meta: Route.MetaFunction = () => [{ title: 'Confirme seu e-mail' }, ...noIndexMeta];

export async function action({ request }: Route.ActionArgs) {
  const fd = await request.formData();
  const parsed = emailSchema.safeParse(fd.get('email'));
  if (!parsed.success) return data({ ok: false });
  const { supabase, headers } = createSupabaseServerClient(request);
  await supabase.auth.resend({ type: 'signup', email: parsed.data, options: { emailRedirectTo: `${serverEnv.siteUrl}/auth/confirmar` } });
  return data({ ok: true }, { headers });
}

export default function Confirme({ actionData }: Route.ComponentProps) {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const nav = useNavigation();
  return (
    <div className="container-page grid max-w-lg place-items-center pt-12 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-700">
        <MailCheck aria-hidden className="size-8" />
      </span>
      <h1 className="mt-4 text-2xl font-black">Confirme seu e-mail</h1>
      <p className="mt-2 text-ink-muted">
        Enviamos um link de confirmação{email ? <> para <strong className="text-ink">{email}</strong></> : null}. Abra o e-mail e toque em
        “Confirmar e-mail”. Depois disso, nossa equipe revisa seu cadastro.
      </p>
      {actionData?.ok ? <Alert tone="success" className="mt-5 text-left">Se houver uma conta pendente com este e-mail, reenviamos o link.</Alert> : null}
      {email ? (
        <Form method="post" className="mt-6">
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="secondary" disabled={nav.state !== 'idle'}>
            Reenviar e-mail
          </Button>
        </Form>
      ) : null}
      <Link to="/login" className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand-700">
        Ir para o login
      </Link>
    </div>
  );
}
