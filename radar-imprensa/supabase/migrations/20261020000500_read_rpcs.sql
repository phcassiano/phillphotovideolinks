-- =============================================================================
-- Radar de Imprensa — RPCs de leitura (busca, perfil, contatos, exportação)
-- Todas aplicam autenticação, visibilidade e limite de uso no servidor.
-- =============================================================================

-- Resumo público dos vínculos de um jornalista (atuais ou todos).
create or replace function app_private.employments_json(p_journalist_id uuid, p_current boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x ->> 'is_current' desc, x ->> 'start_date' desc nulls last), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', e.id,
      'job_title', e.job_title,
      'start_date', e.start_date,
      'end_date', e.end_date,
      'is_current', e.is_current,
      'verification_status', e.verification_status,
      'last_verified_at', e.last_verified_at,
      'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'outlet_type', o.outlet_type, 'website', o.website),
      'location', case when l.id is null then null else jsonb_build_object(
        'id', l.id, 'state_code', l.state_code, 'state_name', l.state_name, 'city_name', l.city_name) end,
      'categories', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'parent_id', c.parent_id) order by c.name)
        from public.journalist_employment_categories ec
        join public.editorial_categories c on c.id = ec.category_id
        where ec.employment_id = e.id
      ), '[]'::jsonb)
    ) as x
    from public.journalist_employments e
    join public.media_outlets o on o.id = e.media_outlet_id
    left join public.locations l on l.id = e.location_id
    where e.journalist_id = p_journalist_id
      and (p_current is null or e.is_current = p_current)
  ) s
$$;

create or replace function app_private.has_visible_contact(p_journalist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.journalist_contacts c
    where c.journalist_id = p_journalist_id and c.visibility = 'assinantes'
  )
$$;

-- -----------------------------------------------------------------------------
-- Busca avançada
-- -----------------------------------------------------------------------------
-- Todos os filtros de vínculo (editoria, local, veículo, tipo, cargo) são
-- aplicados sobre O MESMO vínculo: "Política + PI + Portal" exige um vínculo
-- que atenda simultaneamente aos três critérios. Por padrão, somente vínculos
-- atuais são considerados, evitando confundir antigos empregos com os atuais.
create or replace function public.search_journalists(
  p_query text default null,
  p_category_ids uuid[] default null,
  p_state_code text default null,
  p_location_id uuid default null,
  p_outlet_id uuid default null,
  p_outlet_types public.outlet_type[] default null,
  p_job_title text default null,
  p_has_contact boolean default false,
  p_verified_only boolean default false,
  p_current_only boolean default true,
  p_sort text default 'relevancia',
  p_page int default 1,
  p_page_size int default 20
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := app_private.is_admin();
  v_size int := least(greatest(coalesce(p_page_size, 20), 1), 50);
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_query text := public.f_normalize(left(p_query, 120));
  v_job text := public.f_normalize(left(p_job_title, 80));
  v_state text := upper(nullif(btrim(p_state_code), ''));
  v_cats uuid[];
  v_current_only boolean := coalesce(p_current_only, true);
  v_emp_filter boolean;
  v_total bigint;
  v_items jsonb;
begin
  if v_uid is null and not app_private.is_system_context() then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  -- Proteção contra varredura: limite por minuto e paginação profunda bloqueada.
  perform app_private.check_rate_limit('search', app_private.setting_int('rate_limit.search_per_minute', 60), 60);
  if (v_page - 1) * v_size >= app_private.setting_int('search.max_offset', 1000) and not v_is_admin then
    raise exception 'Refine os filtros: paginação limitada às primeiras % posições',
      app_private.setting_int('search.max_offset', 1000) using errcode = '22023';
  end if;

  if p_category_ids is not null and cardinality(p_category_ids) > 0 then
    with recursive tree as (
      select c.id from public.editorial_categories c where c.id = any (p_category_ids)
      union
      select c.id from public.editorial_categories c join tree t on c.parent_id = t.id
    )
    select array_agg(id) into v_cats from tree;
  end if;

  v_emp_filter := v_current_only or v_cats is not null or v_state is not null or p_location_id is not null
    or p_outlet_id is not null or (p_outlet_types is not null and cardinality(p_outlet_types) > 0) or v_job is not null;

  with matching_emp as (
    select e.journalist_id, bool_or(e.is_current) as any_current,
           max(case e.verification_status when 'confirmado' then 3 when 'provavel' then 2 else 1 end) as emp_rank
    from public.journalist_employments e
    join public.media_outlets o on o.id = e.media_outlet_id
    left join public.locations l on l.id = e.location_id
    where (not v_current_only or e.is_current)
      and (p_outlet_id is null or e.media_outlet_id = p_outlet_id)
      and (p_outlet_types is null or cardinality(p_outlet_types) = 0 or o.outlet_type = any (p_outlet_types))
      and (v_state is null or l.state_code = v_state)
      and (p_location_id is null or e.location_id = p_location_id)
      and (v_job is null or public.f_normalize(e.job_title) like '%' || v_job || '%')
      and (v_cats is null or exists (
        select 1 from public.journalist_employment_categories ec
        where ec.employment_id = e.id and ec.category_id = any (v_cats)))
    group by e.journalist_id
  ),
  candidates as (
    select j.id, j.full_name, j.professional_name, j.verification_status, j.last_verified_at,
           j.updated_at, j.profile_photo_url, j.photo_authorized, j.professional_status,
           coalesce(m.any_current, false) as matched_current,
           coalesce(m.emp_rank, 0) as emp_rank,
           case when v_query is null then 0
                else greatest(
                  similarity(j.search_name, v_query),
                  case when j.search_name like '%' || v_query || '%' then 0.9 else 0 end
                ) end as name_score
    from public.journalists j
    left join matching_emp m on m.journalist_id = j.id
    where j.merged_into_id is null
      and (v_is_admin or not j.is_hidden)
      and (not v_emp_filter or m.journalist_id is not null)
      and (not coalesce(p_verified_only, false) or j.verification_status = 'confirmado')
      and (not coalesce(p_has_contact, false) or app_private.has_visible_contact(j.id))
      and (
        v_query is null
        or j.search_name like '%' || v_query || '%'
        or j.search_name % v_query
        or exists (
          select 1 from public.journalist_topics jt join public.topics t on t.id = jt.topic_id
          where jt.journalist_id = j.id and t.normalized_name like '%' || v_query || '%')
      )
  ),
  counted as (
    select c.*, count(*) over () as total_count,
           case c.verification_status
             when 'confirmado' then 5 when 'provavel' then 4 when 'em_revisao' then 3
             when 'nao_verificado' then 2 else 1 end as status_rank
    from candidates c
  ),
  page as (
    select * from counted
    order by
      case when p_sort = 'nome' then public.f_normalize(full_name) end asc,
      case when p_sort = 'verificacao_recente' then last_verified_at end desc nulls last,
      case when p_sort = 'atualizacao' then updated_at end desc,
      -- relevância: vínculo atual confirmado primeiro, depois aderência ao texto
      matched_current desc,
      status_rank desc,
      emp_rank desc,
      name_score desc,
      public.f_normalize(full_name) asc,
      id asc
    limit v_size offset (v_page - 1) * v_size
  )
  select
    coalesce(max(total_count), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'professional_name', p.professional_name,
      'verification_status', p.verification_status,
      'professional_status', p.professional_status,
      'last_verified_at', p.last_verified_at,
      'profile_photo_url', case when p.photo_authorized then p.profile_photo_url end,
      'matched_current', p.matched_current,
      'has_contact', app_private.has_visible_contact(p.id),
      'current_employments', app_private.employments_json(p.id, true)
    ) order by p.matched_current desc), '[]'::jsonb)
  into v_total, v_items
  from page p;

  -- jsonb_agg acima não preserva a ordenação da CTE "page"; reordenamos por posição.
  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb) into v_items
  from (
    select item, ord from jsonb_array_elements(v_items) with ordinality as a(item, ord)
  ) s;

  return jsonb_build_object('total', v_total, 'page', v_page, 'page_size', v_size, 'items', v_items);
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfil detalhado (sem contatos)
-- -----------------------------------------------------------------------------
create or replace function public.get_journalist_profile(p_journalist_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := app_private.is_admin();
  v_owner boolean := app_private.owns_journalist(p_journalist_id);
  j public.journalists;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  perform app_private.check_rate_limit('profile_view', app_private.setting_int('rate_limit.profile_views_per_minute', 60), 60);

  select * into j from public.journalists where id = p_journalist_id;
  if not found or ((j.is_hidden or j.merged_into_id is not null) and not v_is_admin and not v_owner) then
    return null;
  end if;

  return jsonb_build_object(
    'id', j.id,
    'full_name', j.full_name,
    'professional_name', j.professional_name,
    'biography', j.biography,
    'profile_photo_url', case when j.photo_authorized then j.profile_photo_url end,
    'professional_status', j.professional_status,
    'verification_status', j.verification_status,
    'last_verified_at', j.last_verified_at,
    'last_checked_at', j.last_checked_at,
    'last_evidence_at', j.last_evidence_at,
    'next_check_at', case when v_is_admin then j.next_check_at end,
    'is_claimed', j.claimed_by is not null,
    'is_owner', v_owner,
    'is_hidden', j.is_hidden,
    'merged_into_id', j.merged_into_id,
    'current_employments', app_private.employments_json(j.id, true),
    'past_employments', app_private.employments_json(j.id, false),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'origin', jt.origin) order by t.name)
      from public.journalist_topics jt join public.topics t on t.id = jt.topic_id
      where jt.journalist_id = j.id), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'source_url', s.source_url, 'source_title', s.source_title,
        'observed_at', s.observed_at, 'collected_at', s.collected_at,
        'evidence_type', s.evidence_type, 'evidence_summary', s.evidence_summary,
        'review_status', s.review_status, 'is_demo', s.is_demo,
        'related_entity_type', s.related_entity_type
      ) order by coalesce(s.observed_at, s.collected_at) desc)
      from public.source_evidence s
      where s.journalist_id = j.id
        and (v_is_admin or s.review_status = 'aceita')), '[]'::jsonb),
    'has_contact', app_private.has_visible_contact(j.id)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Contatos profissionais: limite diário de perfis distintos por usuário
-- -----------------------------------------------------------------------------
create or replace function public.get_journalist_contacts(p_journalist_id uuid)
returns table (
  id uuid,
  contact_type public.contact_type,
  contact_value text,
  is_primary boolean,
  visibility public.contact_visibility,
  professional_purpose text,
  verification_status public.verification_status,
  last_verified_at timestamptz,
  source_title text,
  source_url text,
  employment_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_privileged boolean := app_private.is_admin() or app_private.owns_journalist(p_journalist_id);
  v_daily int;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;

  if not v_privileged then
    if not app_private.journalist_is_visible(p_journalist_id) then
      return;
    end if;
    insert into public.contact_access_logs (user_id, journalist_id)
    values (v_uid, p_journalist_id)
    on conflict do nothing;
    select count(*) into v_daily from public.contact_access_logs l
     where l.user_id = v_uid and l.access_date = current_date;
    if v_daily > app_private.setting_int('rate_limit.contact_profiles_per_day', 300) then
      raise exception 'Limite diário de consulta de contatos atingido' using errcode = 'P0429', hint = 'rate_limited';
    end if;
  end if;

  return query
    select c.id, c.contact_type, c.contact_value, c.is_primary, c.visibility, c.professional_purpose,
           c.verification_status, c.last_verified_at, s.source_title, s.source_url, c.employment_id
    from public.journalist_contacts c
    left join public.source_evidence s on s.id = c.source_id
    where c.journalist_id = p_journalist_id
      and (v_privileged or c.visibility = 'assinantes')
    order by c.is_primary desc, c.contact_type, c.created_at;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cartões resumidos para listas do usuário (favoritos, mailings, interações)
-- Somente IDs já vinculados ao próprio usuário (ou à sua organização) são aceitos.
-- -----------------------------------------------------------------------------
create or replace function public.journalist_cards(p_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := app_private.is_admin();
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return '[]'::jsonb;
  end if;
  if cardinality(p_ids) > 500 then
    raise exception 'Máximo de 500 perfis por consulta' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', j.id,
      'full_name', j.full_name,
      'professional_name', j.professional_name,
      'verification_status', j.verification_status,
      'last_verified_at', j.last_verified_at,
      'is_available', not j.is_hidden and j.merged_into_id is null,
      'current_employments', case when not j.is_hidden and j.merged_into_id is null
                                  then app_private.employments_json(j.id, true) else '[]'::jsonb end
    ) order by public.f_normalize(j.full_name))
    from public.journalists j
    where j.id = any (p_ids)
      and (
        v_is_admin
        or exists (select 1 from public.favorites f where f.user_id = v_uid and f.journalist_id = j.id)
        or exists (select 1 from public.journalist_interactions i where i.owner_id = v_uid and i.journalist_id = j.id)
        or exists (select 1 from public.mailing_list_members mm
                   where mm.journalist_id = j.id and app_private.can_access_mailing(mm.mailing_list_id))
      )
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- Exportação de mailing: apenas contatos permitidos, com limite e auditoria
-- -----------------------------------------------------------------------------
create or replace function public.export_mailing_contacts(p_mailing_id uuid)
returns table (
  journalist_id uuid,
  full_name text,
  professional_name text,
  outlet_names text,
  job_titles text,
  locations text,
  categories text,
  email text,
  phone text,
  contact_form text,
  verification_status public.verification_status,
  last_verified_at timestamptz,
  notes text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if not app_private.can_access_mailing(p_mailing_id) then
    raise exception 'Mailing não encontrado ou sem permissão' using errcode = '42501';
  end if;
  perform app_private.check_rate_limit('export', app_private.setting_int('rate_limit.exports_per_hour', 10), 3600);

  select count(*) into v_count from public.mailing_list_members m where m.mailing_list_id = p_mailing_id;
  if v_count > app_private.setting_int('export.max_rows', 500) then
    raise exception 'Mailing excede o limite de % registros por exportação',
      app_private.setting_int('export.max_rows', 500) using errcode = '22023';
  end if;

  perform app_private.log_audit('mailing.export', 'mailing_list', p_mailing_id::text,
    jsonb_build_object('rows', v_count));

  return query
    select j.id, j.full_name, j.professional_name,
      (select string_agg(distinct o.name, '; ') from public.journalist_employments e
         join public.media_outlets o on o.id = e.media_outlet_id
        where e.journalist_id = j.id and e.is_current),
      (select string_agg(distinct e.job_title, '; ') from public.journalist_employments e
        where e.journalist_id = j.id and e.is_current),
      (select string_agg(distinct coalesce(l.city_name || '/', '') || l.state_code, '; ')
         from public.journalist_employments e join public.locations l on l.id = e.location_id
        where e.journalist_id = j.id and e.is_current),
      (select string_agg(distinct c.name, '; ') from public.journalist_employments e
         join public.journalist_employment_categories ec on ec.employment_id = e.id
         join public.editorial_categories c on c.id = ec.category_id
        where e.journalist_id = j.id and e.is_current),
      (select string_agg(c.contact_value, '; ' order by c.is_primary desc) from public.journalist_contacts c
        where c.journalist_id = j.id and c.visibility = 'assinantes' and c.contact_type = 'email_profissional'),
      (select string_agg(c.contact_value, '; ' order by c.is_primary desc) from public.journalist_contacts c
        where c.journalist_id = j.id and c.visibility = 'assinantes'
          and c.contact_type in ('telefone_profissional', 'whatsapp_profissional')),
      (select string_agg(c.contact_value, '; ') from public.journalist_contacts c
        where c.journalist_id = j.id and c.visibility = 'assinantes' and c.contact_type = 'formulario_contato'),
      j.verification_status, j.last_verified_at, m.notes
    from public.mailing_list_members m
    join public.journalists j on j.id = m.journalist_id
    where m.mailing_list_id = p_mailing_id
      and not j.is_hidden and j.merged_into_id is null
    order by public.f_normalize(j.full_name);
end;
$$;

-- Lista de opções (veículos) para filtros, com limite.
create or replace function public.search_outlets(p_query text, p_limit int default 20)
returns table (id uuid, name text, outlet_type public.outlet_type)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select o.id, o.name, o.outlet_type
  from public.media_outlets o
  where auth.uid() is not null
    and o.active
    and (public.f_normalize(p_query) is null
         or o.normalized_name like '%' || public.f_normalize(p_query) || '%'
         or o.normalized_name % public.f_normalize(p_query))
  order by similarity(o.normalized_name, coalesce(public.f_normalize(p_query), '')) desc, o.name
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

revoke execute on function public.search_journalists from anon, public;
revoke execute on function public.get_journalist_profile from anon, public;
revoke execute on function public.get_journalist_contacts from anon, public;
revoke execute on function public.journalist_cards from anon, public;
revoke execute on function public.export_mailing_contacts from anon, public;
revoke execute on function public.search_outlets from anon, public;
revoke execute on function public.prune_rate_limit_events from anon, public;
grant execute on function public.search_journalists to authenticated, service_role;
grant execute on function public.get_journalist_profile to authenticated, service_role;
grant execute on function public.get_journalist_contacts to authenticated, service_role;
grant execute on function public.journalist_cards to authenticated, service_role;
grant execute on function public.export_mailing_contacts to authenticated, service_role;
grant execute on function public.search_outlets to authenticated, service_role;
grant execute on function public.prune_rate_limit_events to authenticated, service_role;
