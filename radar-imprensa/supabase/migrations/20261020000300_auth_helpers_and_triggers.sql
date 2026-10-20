-- =============================================================================
-- Radar de Imprensa — funções de autorização, cadastro, histórico e auditoria
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Contexto da requisição
-- -----------------------------------------------------------------------------
-- Papel de banco da requisição. O PostgREST executa `set local role <papel>`;
-- dentro de funções SECURITY DEFINER o current_user muda, mas o GUC `role` não.
create or replace function app_private.request_db_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('role', true), 'none'), session_user::text)
$$;

-- Verdadeiro para tarefas de sistema: service_role (servidor) ou sessão direta
-- de banco sem papel de API (ex.: pg_cron, migrations).
create or replace function app_private.is_system_context()
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.request_db_role() not in ('anon', 'authenticated')
$$;

-- Verdadeiro quando a operação NÃO vem diretamente da API com papel de usuário
-- (ou seja, vem de uma função SECURITY DEFINER ou de contexto de sistema).
create or replace function app_private.is_privileged_writer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user::text not in ('anon', 'authenticated')
$$;

create or replace function app_private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app_private.current_user_role() in ('admin', 'super_admin'), false)
$$;

create or replace function app_private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app_private.current_user_role() = 'super_admin', false)
$$;

create or replace function app_private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id from public.profiles p where p.id = auth.uid()
$$;

-- Administradores autenticados ou contexto de sistema (service_role / cron).
create or replace function app_private.can_run_admin_tasks()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_admin() or (auth.uid() is null and app_private.is_system_context())
$$;

create or replace function app_private.owns_journalist(p_journalist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.journalists j
    where j.id = p_journalist_id and j.claimed_by = auth.uid() and auth.uid() is not null
  )
$$;

create or replace function app_private.journalist_is_visible(p_journalist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.journalists j
    where j.id = p_journalist_id and not j.is_hidden and j.merged_into_id is null
  )
$$;

create or replace function app_private.can_access_mailing(p_mailing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mailing_lists m
    where m.id = p_mailing_id
      and auth.uid() is not null
      and (
        m.owner_id = auth.uid()
        or (
          m.visibility = 'organizacao'
          and m.organization_id is not null
          and m.organization_id = app_private.current_org_id()
        )
      )
  )
$$;

create or replace function app_private.owns_mailing(p_mailing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mailing_lists m
    where m.id = p_mailing_id and m.owner_id = auth.uid() and auth.uid() is not null
  )
$$;

-- -----------------------------------------------------------------------------
-- Parâmetros globais
-- -----------------------------------------------------------------------------
create or replace function app_private.setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::int end
       from public.app_settings s where s.key = p_key),
    p_default
  )
$$;

-- -----------------------------------------------------------------------------
-- Auditoria
-- -----------------------------------------------------------------------------
create or replace function app_private.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
$$;

-- -----------------------------------------------------------------------------
-- Limite de requisições (persistido no banco; funciona com várias instâncias)
-- -----------------------------------------------------------------------------
create or replace function app_private.check_rate_limit(p_action text, p_max int, p_window_seconds int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return; -- contexto de sistema
  end if;
  if app_private.is_admin() then
    return; -- administradores não sofrem limite operacional
  end if;
  select count(*) into v_count
    from public.rate_limit_events e
   where e.user_id = v_uid
     and e.action = p_action
     and e.created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then
    raise exception 'Limite de uso excedido para "%". Tente novamente mais tarde.', p_action
      using errcode = 'P0429', hint = 'rate_limited';
  end if;
  insert into public.rate_limit_events (user_id, action) values (v_uid, p_action);
end;
$$;

create or replace function public.prune_rate_limit_events()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted int;
begin
  if not app_private.can_run_admin_tasks() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  delete from public.rate_limit_events where created_at < now() - interval '2 days';
  get diagnostics v_deleted = row_count;
  delete from public.contact_access_logs where access_date < current_date - 90;
  return v_deleted;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cadastro: cria o perfil a partir de auth.users
-- -----------------------------------------------------------------------------
create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
  v_org_id uuid;
  v_org_name text := nullif(btrim(v_meta ->> 'organization_name'), '');
begin
  -- Apenas papéis de autoatendimento; administradores são promovidos manualmente.
  v_role := case when v_meta ->> 'account_type' = 'jornalista' then 'jornalista' else 'assessor' end;

  if v_org_name is not null then
    insert into public.organizations (name) values (left(v_org_name, 160)) returning id into v_org_id;
  end if;

  insert into public.profiles (id, email, full_name, role, organization_id)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(btrim(v_meta ->> 'full_name'), ''), ''), 160),
    v_role,
    v_org_id
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- Mantém o e-mail do perfil sincronizado com auth.users.
create or replace function app_private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function app_private.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- Proteções contra escalonamento de privilégio
-- -----------------------------------------------------------------------------
create or replace function app_private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app_private.is_privileged_writer() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Somente o administrador principal pode alterar papel, organização ou e-mail'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function app_private.guard_profile_update();

-- O titular pode editar apenas campos descritivos do próprio perfil.
create or replace function app_private.guard_journalist_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app_private.is_privileged_writer() or app_private.is_admin() then
    return new;
  end if;
  if new.id is distinct from old.id
     or new.full_name is distinct from old.full_name
     or new.verification_status is distinct from old.verification_status
     or new.last_checked_at is distinct from old.last_checked_at
     or new.last_evidence_at is distinct from old.last_evidence_at
     or new.last_verified_at is distinct from old.last_verified_at
     or new.next_check_at is distinct from old.next_check_at
     or new.claimed_by is distinct from old.claimed_by
     or new.is_hidden is distinct from old.is_hidden
     or new.merged_into_id is distinct from old.merged_into_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Campo protegido: alteração exige revisão administrativa' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger journalists_guard before update on public.journalists
  for each row execute function app_private.guard_journalist_update();

-- Vínculos e contatos editados pelo titular: status de verificação controlado.
create or replace function app_private.guard_owner_professional_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if app_private.is_privileged_writer() or app_private.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.journalist_id is distinct from old.journalist_id then
    raise exception 'Não é permitido transferir registros entre perfis' using errcode = '42501';
  end if;
  -- Declaração do próprio titular: registrada como provável até revisão/confirmação.
  if tg_op = 'INSERT' or new.verification_status is distinct from old.verification_status then
    new.verification_status := 'provavel';
  end if;
  new.last_verified_at := case when tg_op = 'UPDATE' then old.last_verified_at else null end;
  return new;
end;
$$;

create trigger journalist_employments_owner_guard before insert or update on public.journalist_employments
  for each row execute function app_private.guard_owner_professional_data();
create trigger journalist_contacts_owner_guard before insert or update on public.journalist_contacts
  for each row execute function app_private.guard_owner_professional_data();

-- -----------------------------------------------------------------------------
-- Histórico de alterações: um registro por campo alterado
-- -----------------------------------------------------------------------------
create or replace function app_private.current_change_source()
returns public.change_source
language plpgsql
stable
set search_path = ''
as $$
declare
  v text := nullif(current_setting('app.change_source', true), '');
begin
  if v is not null then
    return v::public.change_source;
  end if;
  if auth.uid() is null then
    return 'sistema';
  end if;
  if app_private.is_admin() then
    return 'manual';
  end if;
  return 'titular';
end;
$$;

create or replace function app_private.record_change_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_row jsonb := case when tg_op = 'DELETE' then v_old else v_new end;
  v_journalist_id uuid;
  v_entity text := tg_argv[0];
  v_source public.change_source := app_private.current_change_source();
  v_key text;
  v_ignored text[] := array['updated_at', 'created_at', 'search_name', 'normalized_name', 'last_checked_at', 'next_check_at'];
begin
  v_journalist_id := case when v_entity = 'journalist' then (v_row ->> 'id')::uuid
                          else (v_row ->> 'journalist_id')::uuid end;

  -- Ignora remoções em cascata da própria ficha (exclusão LGPD).
  if v_journalist_id is null
     or not exists (select 1 from public.journalists j where j.id = v_journalist_id) then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.journalist_change_history
      (journalist_id, entity_type, entity_id, field_name, old_value, new_value, change_source, approved_by)
    values (v_journalist_id, v_entity, (v_row ->> 'id')::uuid, '*criado*', null, v_new, v_source, auth.uid());
  elsif tg_op = 'DELETE' then
    insert into public.journalist_change_history
      (journalist_id, entity_type, entity_id, field_name, old_value, new_value, change_source, approved_by)
    values (v_journalist_id, v_entity, (v_row ->> 'id')::uuid, '*removido*', v_old, null, v_source, auth.uid());
  else
    for v_key in select jsonb_object_keys(v_new) loop
      continue when v_key = any (v_ignored);
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        insert into public.journalist_change_history
          (journalist_id, entity_type, entity_id, field_name, old_value, new_value, change_source, approved_by)
        values (v_journalist_id, v_entity, (v_row ->> 'id')::uuid, v_key, v_old -> v_key, v_new -> v_key, v_source, auth.uid());
      end if;
    end loop;
  end if;
  return null;
end;
$$;

create trigger journalists_history after update on public.journalists
  for each row execute function app_private.record_change_history('journalist');
create trigger journalist_employments_history after insert or update or delete on public.journalist_employments
  for each row execute function app_private.record_change_history('employment');
create trigger journalist_contacts_history after insert or update or delete on public.journalist_contacts
  for each row execute function app_private.record_change_history('contact');

-- -----------------------------------------------------------------------------
-- Auditoria automática de escrita em tabelas sensíveis
-- -----------------------------------------------------------------------------
create or replace function app_private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    v_meta := jsonb_build_object(
      'role_from', old.role, 'role_to', new.role,
      'org_from', old.organization_id, 'org_to', new.organization_id
    );
    if old.role is not distinct from new.role and old.organization_id is not distinct from new.organization_id then
      return null; -- apenas mudanças de permissão são auditadas em perfis
    end if;
  elsif tg_table_name = 'app_settings' then
    v_meta := jsonb_build_object('key', v_row ->> 'key', 'value', v_row -> 'value');
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), lower(tg_op), tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'key'), v_meta);
  return null;
end;
$$;

create trigger profiles_audit after update on public.profiles
  for each row execute function app_private.audit_row_change();
create trigger journalists_audit after insert or update or delete on public.journalists
  for each row execute function app_private.audit_row_change();
create trigger journalist_contacts_audit after insert or update or delete on public.journalist_contacts
  for each row execute function app_private.audit_row_change();
create trigger media_outlets_audit after insert or update or delete on public.media_outlets
  for each row execute function app_private.audit_row_change();
create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function app_private.audit_row_change();
