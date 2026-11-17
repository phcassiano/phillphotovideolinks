import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'react-router';
import type { Route } from './+types/confirmar';
import { createSupabaseServerClient } from '~/lib/supabase/server';

// Link dos e-mails de confirmação e de recuperação (fluxo token_hash).
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const { supabase, headers } = createSupabaseServerClient(request);
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      throw redirect(type === 'recovery' ? '/redefinir-senha' : '/painel?confirmado=1', { headers });
    }
  }
  throw redirect('/login?link=invalido', { headers });
}
