-- Perto+ · Remoção dos dados de demonstração (somente service_role).
create or replace function public.remove_demo_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_businesses integer;
  v_users integer;
begin
  delete from public.businesses where is_demo;
  get diagnostics v_businesses = row_count;
  -- remove usuários marcados como demonstração que não têm mais negócios
  delete from auth.users u
  where coalesce((u.raw_app_meta_data ->> 'demo')::boolean, false)
    and not exists (select 1 from public.businesses b where b.owner_id = u.id);
  get diagnostics v_users = row_count;
  return jsonb_build_object('businesses', v_businesses, 'users', v_users);
end;
$$;
revoke execute on function public.remove_demo_data() from public, anon, authenticated;
grant execute on function public.remove_demo_data() to service_role;
