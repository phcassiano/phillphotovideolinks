-- Perto+ · Row Level Security (nega por padrão) e privilégios

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','states','reserved_slugs','cities','neighborhoods','categories','plans',
    'businesses','business_hours','business_photos','product_categories','products','subscriptions',
    'featured_businesses','metric_events','business_metrics','admin_audit_log','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Helper: o usuário atual é dono do estabelecimento?
create or replace function public.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.businesses where id = p_business_id and owner_id = (select auth.uid()))
$$;

create or replace function public.is_public_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.businesses where id = p_business_id and status = 'approved')
$$;

-- profiles ---------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- user_roles: somente leitura pela API. Admin é criado por script/SQL.
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Cadastros-base: público lê os ativos; admin gerencia.
create policy states_select on public.states for select to anon, authenticated using (true);
create policy states_admin on public.states for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy cities_select on public.cities for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy cities_admin on public.cities for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy neighborhoods_select on public.neighborhoods for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy neighborhoods_admin on public.neighborhoods for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy categories_select on public.categories for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy categories_admin on public.categories for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy plans_select on public.plans for select to anon, authenticated
  using ((is_active and is_public) or is_default or (select public.is_admin()));
create policy plans_admin on public.plans for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy reserved_slugs_select on public.reserved_slugs for select to authenticated
  using ((select public.is_admin()));

-- businesses: público lê pela view public_businesses; tabela só dono/admin.
create policy businesses_select on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy businesses_insert on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy businesses_update on public.businesses for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()))
  with check (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy businesses_delete on public.businesses for delete to authenticated
  using ((select public.is_admin()));

-- business_hours: horário é informação básica (plano gratuito).
create policy business_hours_select on public.business_hours for select to anon, authenticated
  using (public.is_public_business(business_id) or public.owns_business(business_id) or (select public.is_admin()));
create policy business_hours_write on public.business_hours for all to authenticated
  using (public.owns_business(business_id) or (select public.is_admin()))
  with check (public.owns_business(business_id) or (select public.is_admin()));

-- Vitrine: público só vê se o negócio está aprovado e o plano vigente inclui o recurso.
create policy business_photos_select on public.business_photos for select to anon, authenticated
  using (
    (public.is_public_business(business_id) and public.business_has(business_id, 'gallery'))
    or public.owns_business(business_id) or (select public.is_admin())
  );
create policy business_photos_write on public.business_photos for all to authenticated
  using (public.owns_business(business_id) or (select public.is_admin()))
  with check (public.owns_business(business_id) or (select public.is_admin()));

create policy product_categories_select on public.product_categories for select to anon, authenticated
  using (
    (public.is_public_business(business_id) and public.business_has(business_id, 'products'))
    or public.owns_business(business_id) or (select public.is_admin())
  );
create policy product_categories_write on public.product_categories for all to authenticated
  using (public.owns_business(business_id) or (select public.is_admin()))
  with check (public.owns_business(business_id) or (select public.is_admin()));

create policy products_select on public.products for select to anon, authenticated
  using (
    (public.is_public_business(business_id) and public.business_has(business_id, 'products'))
    or public.owns_business(business_id) or (select public.is_admin())
  );
create policy products_write on public.products for all to authenticated
  using (public.owns_business(business_id) or (select public.is_admin()))
  with check (public.owns_business(business_id) or (select public.is_admin()));

-- subscriptions: dono lê as suas; escrita só pelas funções request/admin_*.
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.owns_business(business_id) or (select public.is_admin()));

-- featured_businesses: admin gerencia; público vê pelo campo is_featured da view.
create policy featured_select on public.featured_businesses for select to authenticated
  using (public.owns_business(business_id) or (select public.is_admin()));
create policy featured_admin on public.featured_businesses for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Métricas: ninguém escreve direto; dono lê pela função business_stats.
create policy metric_events_admin on public.metric_events for select to authenticated
  using ((select public.is_admin()));
create policy business_metrics_admin on public.business_metrics for select to authenticated
  using ((select public.is_admin()));

create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using ((select public.is_admin()));

-- rate_limits: sem políticas (somente service_role via função).

---------------------------------------------------------------------------
-- Privilégios
---------------------------------------------------------------------------
-- Tabelas que nunca são escritas pela API por anon/authenticated.
revoke insert, update, delete on public.user_roles, public.subscriptions, public.metric_events,
  public.business_metrics, public.admin_audit_log, public.rate_limits, public.reserved_slugs
  from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
-- anon nunca escreve em nada.
revoke insert, update, delete, truncate on all tables in schema public from anon;

grant select on public.public_businesses to anon, authenticated;

-- Funções internas ou só do servidor.
revoke execute on function
  public.track_event(uuid, public.metric_event_type, text, uuid, uuid),
  public.check_rate_limit(text, integer, integer),
  public.expire_subscriptions(),
  public.log_admin_action(text, text, uuid, jsonb),
  public.handle_new_user(),
  public.audit_admin_write()
from public, anon, authenticated;
grant execute on function
  public.track_event(uuid, public.metric_event_type, text, uuid, uuid),
  public.check_rate_limit(text, integer, integer),
  public.expire_subscriptions()
to service_role;

-- Funções que exigem login.
revoke execute on function
  public.request_subscription(uuid, text),
  public.cancel_subscription_request(uuid),
  public.resubmit_business(uuid),
  public.business_stats(uuid, date, date),
  public.admin_activate_subscription(uuid, timestamptz, timestamptz, text),
  public.admin_grant_subscription(uuid, text, timestamptz, timestamptz, text),
  public.admin_cancel_subscription(uuid, text),
  public.admin_dashboard(),
  public.admin_list_users(text, integer, integer),
  public.admin_business_owner(uuid)
from public, anon;
