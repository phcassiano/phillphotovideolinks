import { redirect } from 'react-router';
import type { Route } from './+types/sair';
import { createSupabaseServerClient } from '~/lib/supabase/server';

export async function action({ request }: Route.ActionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);
  await supabase.auth.signOut();
  throw redirect('/', { headers });
}

export function loader() {
  throw redirect('/');
}
