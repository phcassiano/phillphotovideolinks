-- =============================================================================
-- Radar de Imprensa — fluxos de escrita: propostas, titulares, privacidade,
-- papéis, resolução de identidade, importação e verificações periódicas.
-- =============================================================================

create or replace function app_private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.can_run_admin_tasks() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
end;
$$;

create or replace function app_private.proposal_change_source(p_source public.proposal_source)
returns public.change_source
language sql
immutable
set search_path = ''
as $$
  select case p_source
    when 'verificacao_automatica' then 'verificacao'
    when 'sugestao_usuario' then 'sugestao'
    when 'titular' then 'titular'
    when 'importacao' then 'importacao'
    else 'manual'
  end::public.change_source
$$;

-- =============================================================================
-- Propostas de alteração
-- =============================================================================
-- Operações suportadas em proposed_changes (array JSON):
--   {"op":"confirm_current"}
--   {"op":"set_field","field":"professional_name|biography|professional_status","value":...}
--   {"op":"set_verification_status","value":"confirmado|provavel|..."}
--   {"op":"end_employment","employment_id":"...","end_date":"AAAA-MM-DD"}
--   {"op":"add_employment","media_outlet_id":"...","job_title":"...","location_id":"...",
--    "category_ids":["..."],"start_date":"AAAA-MM-DD"}
--   {"op":"add_contact","contact_type":"...","contact_value":"...","visibility":"...",
--    "employment_id":"...","professional_purpose":"..."}
--   {"op":"update_contact_status","contact_id":"...","verification_status":"..."}
--   {"op":"add_topic","topic_name":"..."}
create or replace function app_private.apply_proposal_change(
  p_journalist_id uuid,
  p_change jsonb,
  p_evidence_id uuid,
  p_source public.proposal_source
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op text := p_change ->> 'op';
  v_sensitive boolean := v_op in ('add_employment', 'end_employment', 'add_contact');
  v_employment_id uuid;
  v_topic_id uuid;
  v_value text;
begin
  -- Mudanças de emprego e contato exigem evidência, exceto declaração do titular
  -- ou lançamento administrativo explícito.
  if v_sensitive and p_evidence_id is null and p_source not in ('titular', 'admin') then
    raise exception 'A operação "%" exige evidência vinculada', v_op using errcode = '22023';
  end if;

  case v_op
    when 'confirm_current' then
      update public.journalists
         set verification_status = 'confirmado', last_verified_at = now()
       where id = p_journalist_id;
      update public.journalist_employments
         set verification_status = 'confirmado', last_verified_at = now()
       where journalist_id = p_journalist_id and is_current;

    when 'set_field' then
      v_value := p_change ->> 'value';
      case p_change ->> 'field'
        when 'professional_name' then
          update public.journalists set professional_name = nullif(btrim(v_value), '') where id = p_journalist_id;
        when 'biography' then
          update public.journalists set biography = nullif(btrim(v_value), '') where id = p_journalist_id;
        when 'professional_status' then
          update public.journalists set professional_status = v_value::public.professional_status where id = p_journalist_id;
        else
          raise exception 'Campo não permitido: %', p_change ->> 'field' using errcode = '22023';
      end case;

    when 'set_verification_status' then
      update public.journalists
         set verification_status = (p_change ->> 'value')::public.verification_status,
             last_verified_at = case when p_change ->> 'value' = 'confirmado' then now() else last_verified_at end
       where id = p_journalist_id;

    when 'end_employment' then
      update public.journalist_employments
         set is_current = false,
             end_date = coalesce((p_change ->> 'end_date')::date, current_date),
             last_verified_at = now(),
             verification_status = 'confirmado'
       where id = (p_change ->> 'employment_id')::uuid and journalist_id = p_journalist_id;
      if not found then
        raise exception 'Vínculo não encontrado para este jornalista' using errcode = '22023';
      end if;

    when 'add_employment' then
      insert into public.journalist_employments
        (journalist_id, media_outlet_id, location_id, job_title, start_date, is_current,
         verification_status, last_verified_at, source_id)
      values (
        p_journalist_id,
        (p_change ->> 'media_outlet_id')::uuid,
        nullif(p_change ->> 'location_id', '')::uuid,
        nullif(btrim(p_change ->> 'job_title'), ''),
        nullif(p_change ->> 'start_date', '')::date,
        true,
        case when p_evidence_id is not null or p_source = 'admin' then 'confirmado' else 'provavel' end,
        case when p_evidence_id is not null or p_source = 'admin' then now() end,
        p_evidence_id
      )
      returning id into v_employment_id;
      insert into public.journalist_employment_categories (employment_id, category_id)
      select v_employment_id, c::uuid
        from jsonb_array_elements_text(coalesce(p_change -> 'category_ids', '[]'::jsonb)) as c
      on conflict do nothing;

    when 'add_contact' then
      insert into public.journalist_contacts
        (journalist_id, employment_id, contact_type, contact_value, visibility, professional_purpose,
         consent_recorded_at, legal_basis, source_id, verification_status, last_verified_at)
      values (
        p_journalist_id,
        nullif(p_change ->> 'employment_id', '')::uuid,
        (p_change ->> 'contact_type')::public.contact_type,
        btrim(p_change ->> 'contact_value'),
        coalesce(nullif(p_change ->> 'visibility', ''), 'restrito')::public.contact_visibility,
        nullif(btrim(p_change ->> 'professional_purpose'), ''),
        case when p_source = 'titular' then now() end,
        case when p_source = 'titular' then 'consentimento' else 'legitimo_interesse' end::public.legal_basis,
        p_evidence_id,
        'confirmado',
        now()
      )
      on conflict do nothing;

    when 'update_contact_status' then
      update public.journalist_contacts
         set verification_status = (p_change ->> 'verification_status')::public.verification_status,
             last_verified_at = case when p_change ->> 'verification_status' = 'confirmado' then now() else last_verified_at end
       where id = (p_change ->> 'contact_id')::uuid and journalist_id = p_journalist_id;

    when 'add_topic' then
      insert into public.topics (name) values (btrim(p_change ->> 'topic_name'))
      on conflict (normalized_name) do update set name = public.topics.name
      returning id into v_topic_id;
      insert into public.journalist_topics (journalist_id, topic_id, origin)
      values (p_journalist_id, v_topic_id, 'evidencia')
      on conflict do nothing;

    else
      raise exception 'Operação desconhecida: %', v_op using errcode = '22023';
  end case;
end;
$$;

create or replace function public.review_change_proposal(
  p_proposal_id uuid,
  p_approve boolean,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.change_proposals;
  v_change jsonb;
  v_evidence uuid;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;

  select * into p from public.change_proposals where id = p_proposal_id for update;
  if not found then
    raise exception 'Proposta não encontrada' using errcode = 'P0002';
  end if;
  if p.status <> 'pendente' then
    raise exception 'Proposta já revisada (%)', p.status using errcode = '22023';
  end if;

  perform set_config('app.change_source', app_private.proposal_change_source(p.source)::text, true);

  if p_approve then
    if p.is_demo and app_private.setting_int('verification.allow_demo_apply', 0) <> 1 then
      raise exception 'Propostas demonstrativas não podem ser aplicadas em produção' using errcode = '22023';
    end if;
    -- Evidência principal (a de maior confiança).
    select e.id into v_evidence
      from public.source_evidence e
     where e.id = any (p.evidence_ids)
     order by e.confidence_score desc nulls last
     limit 1;

    -- Restaura o status anterior antes de aplicar operações que o redefinem.
    update public.journalists
       set verification_status = coalesce(p.prior_verification_status, verification_status)
     where id = p.journalist_id and verification_status = 'em_revisao'
       and p.prior_verification_status is not null;

    for v_change in select * from jsonb_array_elements(p.proposed_changes) loop
      perform app_private.apply_proposal_change(p.journalist_id, v_change, v_evidence, p.source);
    end loop;

    update public.source_evidence set review_status = 'aceita'
     where id = any (p.evidence_ids) and review_status = 'pendente';
  else
    update public.source_evidence set review_status = 'rejeitada'
     where id = any (p.evidence_ids) and review_status = 'pendente'
       and not exists (
         select 1 from public.change_proposals o
          where o.id <> p.id and o.status in ('pendente', 'aprovada') and public.source_evidence.id = any (o.evidence_ids));
    -- Restaura o status se nenhuma outra proposta pendente mantiver o perfil em revisão.
    if p.prior_verification_status is not null and not exists (
      select 1 from public.change_proposals o
       where o.journalist_id = p.journalist_id and o.status = 'pendente' and o.id <> p.id
         and o.prior_verification_status is not null) then
      update public.journalists set verification_status = p.prior_verification_status
       where id = p.journalist_id and verification_status = 'em_revisao';
    end if;
  end if;

  update public.change_proposals
     set status = case when p_approve then 'aprovada' else 'rejeitada' end::public.proposal_status,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_notes = nullif(btrim(p_notes), '')
   where id = p.id;

  perform app_private.log_audit(
    case when p_approve then 'proposal.approve' else 'proposal.reject' end,
    'change_proposal', p.id::text,
    jsonb_build_object('journalist_id', p.journalist_id, 'source', p.source, 'ops', jsonb_array_length(p.proposed_changes)));

  return jsonb_build_object('id', p.id, 'status', case when p_approve then 'aprovada' else 'rejeitada' end);
end;
$$;

-- Sugestão de correção feita por qualquer usuário autenticado (sempre pendente).
create or replace function public.submit_correction(
  p_journalist_id uuid,
  p_description text,
  p_source_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_evidence uuid;
  v_owner boolean := app_private.owns_journalist(p_journalist_id);
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if not app_private.journalist_is_visible(p_journalist_id) and not v_owner then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'Descreva a correção com pelo menos 10 caracteres' using errcode = '22023';
  end if;
  if p_source_url is not null and p_source_url !~* '^https?://' then
    raise exception 'URL de fonte inválida' using errcode = '22023';
  end if;
  perform app_private.check_rate_limit('suggestion', app_private.setting_int('rate_limit.suggestions_per_day', 20), 86400);

  if p_source_url is not null then
    insert into public.source_evidence
      (journalist_id, related_entity_type, source_url, source_title, evidence_type, evidence_summary, created_by, collected_at)
    values (p_journalist_id, 'journalist', p_source_url, 'Fonte indicada em sugestão de correção',
            case when v_owner then 'declaracao_titular' else 'cadastro_manual' end,
            left(p_description, 2000), v_uid, now())
    on conflict do nothing
    returning id into v_evidence;
  end if;

  insert into public.change_proposals
    (journalist_id, proposed_changes, evidence_ids, status, source, description, proposed_by)
  values (
    p_journalist_id, '[]'::jsonb,
    case when v_evidence is null then '{}'::uuid[] else array[v_evidence] end,
    'pendente',
    case when v_owner then 'titular' else 'sugestao_usuario' end::public.proposal_source,
    btrim(p_description), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

-- =============================================================================
-- Titulares: reivindicação e confirmação
-- =============================================================================
create or replace function app_private.url_domain(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(substring(p_url from '^[a-zA-Z]+://([^/:?#]+)')), '^www\.', ''), '')
$$;

create or replace function public.submit_profile_claim(
  p_journalist_id uuid,
  p_method public.claim_method,
  p_evidence_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_domain text;
  v_match boolean;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  if app_private.current_user_role() <> 'jornalista' then
    raise exception 'Somente contas do tipo jornalista podem reivindicar perfis' using errcode = '42501';
  end if;
  if exists (select 1 from public.journalists where claimed_by = v_uid) then
    raise exception 'Sua conta já está vinculada a um perfil' using errcode = '22023';
  end if;
  if not app_private.journalist_is_visible(p_journalist_id) then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.journalists where id = p_journalist_id and claimed_by is not null) then
    raise exception 'Este perfil já foi reivindicado. Abra uma solicitação de privacidade se houver erro.' using errcode = '22023';
  end if;
  perform app_private.check_rate_limit('claim', 5, 86400);

  select email into v_email from public.profiles where id = v_uid;
  v_domain := lower(split_part(v_email, '@', 2));
  select exists (
    select 1 from public.journalist_employments e
    join public.media_outlets o on o.id = e.media_outlet_id
    where e.journalist_id = p_journalist_id and e.is_current
      and app_private.url_domain(o.website) is not null
      and (v_domain = app_private.url_domain(o.website) or v_domain like '%.' || app_private.url_domain(o.website))
  ) into v_match;

  insert into public.profile_claims (journalist_id, user_id, verification_method, evidence_text, email_domain_match)
  values (p_journalist_id, v_uid, p_method, nullif(btrim(p_evidence_text), ''), coalesce(v_match, false))
  returning id into v_id;

  perform app_private.log_audit('claim.submit', 'profile_claim', v_id::text,
    jsonb_build_object('journalist_id', p_journalist_id, 'email_domain_match', coalesce(v_match, false)));
  return v_id;
end;
$$;

create or replace function public.review_profile_claim(p_claim_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.profile_claims;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  select * into c from public.profile_claims where id = p_claim_id for update;
  if not found or c.status <> 'pendente' then
    raise exception 'Reivindicação não encontrada ou já revisada' using errcode = '22023';
  end if;

  if p_approve then
    if exists (select 1 from public.journalists where id = c.journalist_id and claimed_by is not null) then
      raise exception 'Perfil já vinculado a outra conta' using errcode = '22023';
    end if;
    perform set_config('app.change_source', 'titular', true);
    update public.journalists set claimed_by = c.user_id where id = c.journalist_id;
    update public.profile_claims
       set status = 'rejeitada', review_notes = 'Outra reivindicação foi aprovada', reviewed_at = now(), reviewed_by = auth.uid()
     where journalist_id = c.journalist_id and status = 'pendente' and id <> c.id;
  end if;

  update public.profile_claims
     set status = case when p_approve then 'aprovada' else 'rejeitada' end::public.review_status,
         review_notes = nullif(btrim(p_notes), ''), reviewed_at = now(), reviewed_by = auth.uid()
   where id = c.id;

  perform app_private.log_audit(case when p_approve then 'claim.approve' else 'claim.reject' end,
    'profile_claim', c.id::text, jsonb_build_object('journalist_id', c.journalist_id, 'user_id', c.user_id));
end;
$$;

-- O titular confirma que os dados atuais estão corretos.
create or replace function public.confirm_own_profile()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jid uuid;
begin
  select id into v_jid from public.journalists where claimed_by = auth.uid() and auth.uid() is not null;
  if v_jid is null then
    raise exception 'Nenhum perfil vinculado à sua conta' using errcode = 'P0002';
  end if;
  perform set_config('app.change_source', 'titular', true);

  insert into public.source_evidence
    (journalist_id, related_entity_type, related_entity_id, source_title, evidence_type,
     evidence_summary, observed_at, review_status, confidence_score, created_by)
  values (v_jid, 'journalist', v_jid, 'Confirmação do próprio titular', 'declaracao_titular',
          'O titular confirmou os dados profissionais atuais pela plataforma.', now(), 'aceita', 1, auth.uid());

  update public.journalists
     set verification_status = 'confirmado', last_verified_at = now(), last_evidence_at = now()
   where id = v_jid;
  update public.journalist_employments
     set verification_status = 'confirmado', last_verified_at = now()
   where journalist_id = v_jid and is_current;
  update public.journalist_contacts
     set verification_status = 'confirmado', last_verified_at = now()
   where journalist_id = v_jid and visibility <> 'oculto';
  return v_jid;
end;
$$;

-- =============================================================================
-- Privacidade (LGPD)
-- =============================================================================
create or replace function public.submit_privacy_request(
  p_type public.privacy_request_type,
  p_details text,
  p_journalist_id uuid default null,
  p_contact_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Autenticação necessária' using errcode = '28000';
  end if;
  perform app_private.check_rate_limit('privacy_request', 10, 86400);
  insert into public.privacy_requests (journalist_id, requester_id, request_type, details, contact_email)
  values (p_journalist_id, v_uid, p_type, btrim(p_details), nullif(btrim(p_contact_email), ''))
  returning id into v_id;
  perform app_private.log_audit('privacy.submit', 'privacy_request', v_id::text,
    jsonb_build_object('type', p_type, 'journalist_id', p_journalist_id));
  return v_id;
end;
$$;

create or replace function public.resolve_privacy_request(
  p_request_id uuid,
  p_status public.privacy_request_status,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.privacy_requests;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  select * into r from public.privacy_requests where id = p_request_id for update;
  if not found then
    raise exception 'Solicitação não encontrada' using errcode = 'P0002';
  end if;
  if r.status in ('atendida', 'recusada') then
    raise exception 'Solicitação já encerrada' using errcode = '22023';
  end if;

  if p_status = 'atendida' and r.journalist_id is not null then
    perform set_config('app.change_source', 'sistema', true);
    if r.request_type in ('ocultacao', 'oposicao') then
      update public.journalists set is_hidden = true where id = r.journalist_id;
      update public.journalist_contacts set visibility = 'oculto', is_primary = false where journalist_id = r.journalist_id;
      update public.verification_jobs set status = 'cancelada', finished_at = now()
       where journalist_id = r.journalist_id and status in ('agendada', 'executando');
    elsif r.request_type = 'exclusao' then
      -- A ficha e todos os dados derivados são removidos (cascata).
      -- O log de auditoria guarda apenas identificadores, sem dados pessoais.
      delete from public.journalists where id = r.journalist_id;
    end if;
  end if;

  update public.privacy_requests
     set status = p_status,
         resolution_notes = nullif(btrim(p_notes), ''),
         resolved_by = case when p_status in ('atendida', 'recusada') then auth.uid() end,
         resolved_at = case when p_status in ('atendida', 'recusada') then now() end
   where id = r.id;

  perform app_private.log_audit('privacy.resolve', 'privacy_request', r.id::text,
    jsonb_build_object('type', r.request_type, 'status', p_status, 'journalist_id', r.journalist_id));
end;
$$;

-- =============================================================================
-- Gestão de usuários (administrador principal)
-- =============================================================================
create or replace function public.set_user_role(
  p_user_id uuid,
  p_role public.user_role,
  p_organization_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.user_role;
begin
  if not app_private.is_super_admin() then
    raise exception 'Somente o administrador principal pode alterar papéis' using errcode = '42501';
  end if;
  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;
  if p_user_id = auth.uid() and p_role <> 'super_admin'
     and (select count(*) from public.profiles where role = 'super_admin') <= 1 then
    raise exception 'Não é possível remover o último administrador principal' using errcode = '22023';
  end if;
  update public.profiles set role = p_role, organization_id = p_organization_id where id = p_user_id;
end;
$$;

-- =============================================================================
-- Resolução de identidade
-- =============================================================================
-- Pares candidatos a duplicidade com sinais objetivos. A pontuação final é
-- calculada na aplicação (src/lib/identity) e NUNCA resulta em unificação
-- automática: apenas cria sugestões para revisão administrativa.
create or replace function public.duplicate_candidate_pairs(
  p_min_similarity real default 0.45,
  p_limit int default 200
)
returns table (
  journalist_a_id uuid,
  journalist_b_id uuid,
  name_a text,
  name_b text,
  professional_name_a text,
  professional_name_b text,
  name_similarity real,
  shared_outlets int,
  shared_identifiers int,
  conflicting_identifiers int,
  shared_bylines int,
  existing_status public.review_status
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform app_private.require_admin();
  perform set_config('pg_trgm.similarity_threshold', greatest(least(coalesce(p_min_similarity, 0.45), 1), 0.1)::text, true);

  return query
  with active as (
    select j.id, j.search_name, j.full_name, j.professional_name
    from public.journalists j where j.merged_into_id is null
  ),
  by_name as (
    select a.id as a_id, b.id as b_id
    from active a join active b on a.id < b.id and a.search_name % b.search_name
  ),
  by_identifier as (
    select least(i1.journalist_id, i2.journalist_id) as a_id, greatest(i1.journalist_id, i2.journalist_id) as b_id
    from public.journalist_identifiers i1
    join public.journalist_identifiers i2
      on i1.identifier_type = i2.identifier_type
     and lower(btrim(i1.identifier_value)) = lower(btrim(i2.identifier_value))
     and i1.journalist_id <> i2.journalist_id
  ),
  pairs as (
    select distinct p.a_id, p.b_id from (select * from by_name union select * from by_identifier) p
    join active a on a.id = p.a_id join active b on b.id = p.b_id
  )
  select
    p.a_id, p.b_id, a.full_name, b.full_name, a.professional_name, b.professional_name,
    similarity(a.search_name, b.search_name),
    (select count(distinct e1.media_outlet_id)::int
       from public.journalist_employments e1
       join public.journalist_employments e2 on e2.media_outlet_id = e1.media_outlet_id
      where e1.journalist_id = p.a_id and e2.journalist_id = p.b_id),
    (select count(*)::int from public.journalist_identifiers i1
       join public.journalist_identifiers i2 on i1.identifier_type = i2.identifier_type
        and lower(btrim(i1.identifier_value)) = lower(btrim(i2.identifier_value))
      where i1.journalist_id = p.a_id and i2.journalist_id = p.b_id),
    (select count(*)::int from public.journalist_identifiers i1
       join public.journalist_identifiers i2 on i1.identifier_type = i2.identifier_type
        and i1.identifier_type = 'registro_profissional'
        and lower(btrim(i1.identifier_value)) <> lower(btrim(i2.identifier_value))
      where i1.journalist_id = p.a_id and i2.journalist_id = p.b_id),
    (select count(*)::int from public.source_evidence s1
       join public.source_evidence s2 on s1.source_url = s2.source_url
      where s1.journalist_id = p.a_id and s2.journalist_id = p.b_id
        and s1.evidence_type = 'assinatura_materia' and s2.evidence_type = 'assinatura_materia'),
    (select ms.status from public.journalist_merge_suggestions ms
      where ms.journalist_a_id = p.a_id and ms.journalist_b_id = p.b_id)
  from pairs p
  join active a on a.id = p.a_id
  join active b on b.id = p.b_id
  order by similarity(a.search_name, b.search_name) desc
  limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

create or replace function public.merge_journalists(
  p_survivor_id uuid,
  p_merged_id uuid,
  p_suggestion_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.journalists;
  m public.journalists;
  v_moved jsonb := '{}'::jsonb;
  v_ids uuid[];
  v_merge_id uuid;
  v_survivor_has_primary boolean;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  if p_survivor_id = p_merged_id then
    raise exception 'Selecione dois perfis diferentes' using errcode = '22023';
  end if;
  select * into s from public.journalists where id = p_survivor_id for update;
  select * into m from public.journalists where id = p_merged_id for update;
  if s.id is null or m.id is null then
    raise exception 'Perfil não encontrado' using errcode = 'P0002';
  end if;
  if s.merged_into_id is not null or m.merged_into_id is not null then
    raise exception 'Um dos perfis já foi unificado a outro' using errcode = '22023';
  end if;
  if s.claimed_by is not null and m.claimed_by is not null then
    raise exception 'Ambos os perfis foram reivindicados por contas diferentes; revise manualmente' using errcode = '22023';
  end if;

  perform set_config('app.change_source', 'unificacao', true);

  -- Vínculos (exceto duplicatas exatas de vínculo atual)
  with upd as (
    update public.journalist_employments e set journalist_id = s.id
     where e.journalist_id = m.id
       and not (e.is_current and exists (
         select 1 from public.journalist_employments e2
          where e2.journalist_id = s.id and e2.is_current and e2.media_outlet_id = e.media_outlet_id
            and coalesce(public.f_normalize(e2.job_title), '') = coalesce(public.f_normalize(e.job_title), '')))
    returning e.id)
  select coalesce(array_agg(id), '{}') into v_ids from upd;
  v_moved := v_moved || jsonb_build_object('employments', to_jsonb(v_ids));

  -- Contatos (exceto valores já existentes no perfil sobrevivente)
  select exists (select 1 from public.journalist_contacts where journalist_id = s.id and is_primary) into v_survivor_has_primary;
  if v_survivor_has_primary then
    with upd as (
      update public.journalist_contacts set is_primary = false
       where journalist_id = m.id and is_primary returning id)
    select coalesce(array_agg(id), '{}') into v_ids from upd;
    v_moved := v_moved || jsonb_build_object('contacts_primary_cleared', to_jsonb(v_ids));
  end if;
  with upd as (
    update public.journalist_contacts c set journalist_id = s.id
     where c.journalist_id = m.id
       and not exists (select 1 from public.journalist_contacts c2
                        where c2.journalist_id = s.id and c2.contact_type = c.contact_type
                          and lower(btrim(c2.contact_value)) = lower(btrim(c.contact_value)))
    returning c.id)
  select coalesce(array_agg(id), '{}') into v_ids from upd;
  v_moved := v_moved || jsonb_build_object('contacts', to_jsonb(v_ids));

  with upd as (update public.source_evidence set journalist_id = s.id where journalist_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into v_ids from upd;
  v_moved := v_moved || jsonb_build_object('evidence', to_jsonb(v_ids));

  with upd as (update public.journalist_identifiers set journalist_id = s.id where journalist_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into v_ids from upd;
  v_moved := v_moved || jsonb_build_object('identifiers', to_jsonb(v_ids));

  with upd as (update public.journalist_interactions set journalist_id = s.id where journalist_id = m.id returning id)
  select coalesce(array_agg(id), '{}') into v_ids from upd;
  v_moved := v_moved || jsonb_build_object('interactions', to_jsonb(v_ids));

  -- Itens copiados (originais permanecem no perfil unificado para permitir a separação)
  with ins as (
    insert into public.journalist_topics (journalist_id, topic_id, origin)
    select s.id, t.topic_id, t.origin from public.journalist_topics t where t.journalist_id = m.id
    on conflict do nothing returning topic_id)
  select coalesce(array_agg(topic_id), '{}') into v_ids from ins;
  v_moved := v_moved || jsonb_build_object('topics_copied', to_jsonb(v_ids));

  v_moved := v_moved || jsonb_build_object('favorites_copied', coalesce((
    with ins as (
      insert into public.favorites (user_id, journalist_id)
      select f.user_id, s.id from public.favorites f where f.journalist_id = m.id
      on conflict do nothing returning user_id)
    select jsonb_agg(user_id) from ins), '[]'::jsonb));

  v_moved := v_moved || jsonb_build_object('mailing_members_copied', coalesce((
    with ins as (
      insert into public.mailing_list_members (mailing_list_id, journalist_id, notes, added_by)
      select mm.mailing_list_id, s.id, mm.notes, mm.added_by from public.mailing_list_members mm where mm.journalist_id = m.id
      on conflict do nothing returning mailing_list_id)
    select jsonb_agg(mailing_list_id) from ins), '[]'::jsonb));

  if m.claimed_by is not null then
    v_moved := v_moved || jsonb_build_object('claimed_by_transferred', m.claimed_by);
    update public.journalists set claimed_by = null where id = m.id;
    update public.journalists set claimed_by = m.claimed_by where id = s.id;
  end if;

  update public.verification_jobs set status = 'cancelada', finished_at = now()
   where journalist_id = m.id and status in ('agendada', 'executando');
  update public.journalists set merged_into_id = s.id where id = m.id;

  insert into public.journalist_merges (survivor_id, merged_id, suggestion_id, moved, merged_by)
  values (s.id, m.id, p_suggestion_id, v_moved, auth.uid())
  returning id into v_merge_id;

  update public.journalist_merge_suggestions
     set status = 'aprovada', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_suggestion_id
      or (journalist_a_id = least(s.id, m.id) and journalist_b_id = greatest(s.id, m.id));

  perform app_private.log_audit('journalist.merge', 'journalist', s.id::text,
    jsonb_build_object('merged_id', m.id, 'merge_id', v_merge_id));
  return v_merge_id;
end;
$$;

create or replace function public.unmerge_journalists(p_merge_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  mg public.journalist_merges;
  v jsonb;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  select * into mg from public.journalist_merges where id = p_merge_id for update;
  if not found or mg.reverted_at is not null then
    raise exception 'Unificação não encontrada ou já revertida' using errcode = '22023';
  end if;
  v := mg.moved;
  perform set_config('app.change_source', 'unificacao', true);

  update public.journalist_employments set journalist_id = mg.merged_id
   where journalist_id = mg.survivor_id
     and id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'employments', '[]')) x);
  update public.journalist_contacts set journalist_id = mg.merged_id
   where journalist_id = mg.survivor_id
     and id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'contacts', '[]')) x);
  update public.journalist_contacts set is_primary = true
   where journalist_id = mg.merged_id
     and id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'contacts_primary_cleared', '[]')) x)
     and not exists (select 1 from public.journalist_contacts c where c.journalist_id = mg.merged_id and c.is_primary);
  update public.source_evidence set journalist_id = mg.merged_id
   where id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'evidence', '[]')) x);
  update public.journalist_identifiers set journalist_id = mg.merged_id
   where id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'identifiers', '[]')) x);
  update public.journalist_interactions set journalist_id = mg.merged_id
   where id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'interactions', '[]')) x);
  delete from public.journalist_topics
   where journalist_id = mg.survivor_id
     and topic_id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'topics_copied', '[]')) x);
  delete from public.favorites
   where journalist_id = mg.survivor_id
     and user_id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'favorites_copied', '[]')) x);
  delete from public.mailing_list_members
   where journalist_id = mg.survivor_id
     and mailing_list_id in (select x::uuid from jsonb_array_elements_text(coalesce(v -> 'mailing_members_copied', '[]')) x);
  if v ? 'claimed_by_transferred' then
    update public.journalists set claimed_by = null where id = mg.survivor_id;
    update public.journalists set claimed_by = (v ->> 'claimed_by_transferred')::uuid where id = mg.merged_id;
  end if;

  update public.journalists set merged_into_id = null where id = mg.merged_id;
  update public.journalist_merges set reverted_at = now(), reverted_by = auth.uid() where id = mg.id;
  update public.journalist_merge_suggestions set status = 'rejeitada', reviewed_by = auth.uid(), reviewed_at = now()
   where journalist_a_id = least(mg.survivor_id, mg.merged_id) and journalist_b_id = greatest(mg.survivor_id, mg.merged_id);

  perform app_private.log_audit('journalist.unmerge', 'journalist', mg.survivor_id::text,
    jsonb_build_object('merged_id', mg.merged_id, 'merge_id', mg.id));
end;
$$;

-- =============================================================================
-- Importação CSV: gravação somente após aprovação da prévia
-- =============================================================================
create or replace function public.commit_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.import_batches;
  r public.import_rows;
  n jsonb;
  v_outlet uuid;
  v_location uuid;
  v_journalist uuid;
  v_evidence uuid;
  v_employment uuid;
  v_created int := 0;
  v_linked int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_state_name text;
  v_source text;
  v_interval int := app_private.setting_int('verification.interval_days', 30);
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  select * into b from public.import_batches where id = p_batch_id for update;
  if not found or b.status <> 'previa' then
    raise exception 'Importação não encontrada ou já processada' using errcode = '22023';
  end if;
  perform set_config('app.change_source', 'importacao', true);

  for r in select * from public.import_rows where batch_id = b.id order by row_number loop
    if r.action = 'ignorar' or jsonb_array_length(r.errors) > 0 or r.normalized is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    n := r.normalized;
    begin
      -- Veículo: reutiliza pelo nome normalizado ou cria.
      select o.id into v_outlet from public.media_outlets o
       where o.normalized_name = public.f_normalize(n ->> 'outlet_name')
       order by (o.headquarters_city_id is null) desc limit 1;
      if v_outlet is null then
        insert into public.media_outlets (name, outlet_type, website)
        values (btrim(n ->> 'outlet_name'), nullif(n ->> 'outlet_type', '')::public.outlet_type, nullif(n ->> 'outlet_website', ''))
        returning id into v_outlet;
      end if;

      -- Localidade
      v_location := null;
      if nullif(n ->> 'state_code', '') is not null then
        select l.id into v_location from public.locations l
         where l.state_code = upper(n ->> 'state_code')
           and coalesce(l.normalized_city, '') = coalesce(public.f_normalize(n ->> 'city_name'), '');
        if v_location is null then
          select l.state_name into v_state_name from public.locations l
           where l.state_code = upper(n ->> 'state_code') and l.city_name is null;
          if v_state_name is null then
            raise exception 'UF desconhecida: %', n ->> 'state_code';
          end if;
          insert into public.locations (state_code, state_name, city_name)
          values (upper(n ->> 'state_code'), v_state_name, btrim(n ->> 'city_name'))
          returning id into v_location;
        end if;
      end if;

      -- Jornalista
      if r.action = 'vincular' and r.duplicate_of is not null then
        v_journalist := r.duplicate_of;
        v_linked := v_linked + 1;
      else
        insert into public.journalists (full_name, created_by, verification_status, next_check_at)
        values (btrim(n ->> 'full_name'), auth.uid(), 'nao_verificado',
                now() + (random() * v_interval) * interval '1 day')
        returning id into v_journalist;
        v_created := v_created + 1;
      end if;

      -- Evidência da fonte informada (registrada como pendente: importação não é verificação)
      v_evidence := null;
      v_source := nullif(btrim(n ->> 'source'), '');
      if v_source is not null then
        insert into public.source_evidence
          (journalist_id, related_entity_type, related_entity_id, source_url, source_title, observed_at,
           evidence_type, evidence_summary, review_status, created_by)
        values (
          v_journalist, 'journalist', v_journalist,
          case when v_source ~* '^https?://' then v_source end,
          case when v_source ~* '^https?://' then 'Fonte informada na importação' else left(v_source, 300) end,
          nullif(n ->> 'verified_at', '')::timestamptz,
          'importacao',
          format('Importado do arquivo "%s", linha %s.', b.file_name, r.row_number),
          'pendente', auth.uid())
        on conflict do nothing
        returning id into v_evidence;
      end if;

      -- Vínculo atual
      select e.id into v_employment from public.journalist_employments e
       where e.journalist_id = v_journalist and e.is_current and e.media_outlet_id = v_outlet
         and coalesce(public.f_normalize(e.job_title), '') = coalesce(public.f_normalize(n ->> 'job_title'), '');
      if v_employment is null then
        insert into public.journalist_employments
          (journalist_id, media_outlet_id, location_id, job_title, is_current, verification_status, source_id)
        values (v_journalist, v_outlet, v_location, nullif(btrim(n ->> 'job_title'), ''), true, 'nao_verificado', v_evidence)
        returning id into v_employment;
      end if;
      insert into public.journalist_employment_categories (employment_id, category_id)
      select v_employment, c::uuid from jsonb_array_elements_text(coalesce(n -> 'category_ids', '[]'::jsonb)) c
      on conflict do nothing;

      -- Contatos profissionais
      if nullif(n ->> 'email', '') is not null then
        insert into public.journalist_contacts
          (journalist_id, employment_id, contact_type, contact_value, visibility, source_id, verification_status)
        values (v_journalist, v_employment, 'email_profissional', lower(btrim(n ->> 'email')), b.contact_visibility, v_evidence, 'nao_verificado')
        on conflict do nothing;
      end if;
      if nullif(n ->> 'phone', '') is not null then
        insert into public.journalist_contacts
          (journalist_id, employment_id, contact_type, contact_value, visibility, source_id, verification_status)
        values (v_journalist, v_employment, 'telefone_profissional', btrim(n ->> 'phone'), b.contact_visibility, v_evidence, 'nao_verificado')
        on conflict do nothing;
      end if;

      update public.import_rows set result_journalist_id = v_journalist
       where batch_id = r.batch_id and row_number = r.row_number;
    exception when others then
      v_failed := v_failed + 1;
      update public.import_rows
         set errors = errors || jsonb_build_array(jsonb_build_object('field', '*', 'message', 'Falha ao gravar: ' || sqlerrm))
       where batch_id = r.batch_id and row_number = r.row_number;
    end;
  end loop;

  update public.import_batches
     set status = 'importada', committed_at = now(), committed_by = auth.uid(),
         report = report || jsonb_build_object('created', v_created, 'linked', v_linked, 'skipped', v_skipped, 'failed', v_failed)
   where id = b.id;

  perform app_private.log_audit('import.commit', 'import_batch', b.id::text,
    jsonb_build_object('created', v_created, 'linked', v_linked, 'skipped', v_skipped, 'failed', v_failed));

  return jsonb_build_object('created', v_created, 'linked', v_linked, 'skipped', v_skipped, 'failed', v_failed);
end;
$$;

-- =============================================================================
-- Verificações periódicas
-- =============================================================================
-- Agenda verificações vencidas, distribuindo-as ao longo das próximas horas e
-- espalhando a próxima revisão (≈30 dias + variação) para evitar picos.
create or replace function public.schedule_due_verifications(p_limit int default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int := coalesce(p_limit, app_private.setting_int('verification.schedule_limit', 200));
  v_interval int := app_private.setting_int('verification.interval_days', 30);
  v_spread int := app_private.setting_int('verification.spread_hours', 20);
  v_count int;
begin
  perform app_private.require_admin();
  with due as (
    select j.id from public.journalists j
     where j.merged_into_id is null and not j.is_hidden
       and (j.next_check_at is null or j.next_check_at <= now())
       and not exists (select 1 from public.verification_jobs v
                        where v.journalist_id = j.id and v.status in ('agendada', 'executando'))
     order by j.next_check_at nulls first
     limit least(greatest(v_limit, 1), 5000)
     for update of j skip locked
  ),
  jobs as (
    insert into public.verification_jobs (journalist_id, scheduled_at)
    select d.id, now() + (random() * v_spread) * interval '1 hour' from due d
    on conflict do nothing
    returning journalist_id
  ),
  upd as (
    update public.journalists j
       set next_check_at = now() + v_interval * interval '1 day' + (random() * 72) * interval '1 hour'
      from jobs where j.id = jobs.journalist_id
    returning j.id
  )
  select count(*) into v_count from upd;
  return v_count;
end;
$$;

create or replace function public.enqueue_verification(p_journalist_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  select id into v_id from public.verification_jobs
   where journalist_id = p_journalist_id and status in ('agendada', 'executando');
  if v_id is not null then
    update public.verification_jobs set scheduled_at = least(scheduled_at, now())
     where id = v_id and status = 'agendada';
    return v_id;
  end if;
  insert into public.verification_jobs (journalist_id, scheduled_at, requested_by)
  values (p_journalist_id, now(), auth.uid())
  returning id into v_id;
  perform app_private.log_audit('verification.enqueue', 'journalist', p_journalist_id::text, jsonb_build_object('job_id', v_id));
  return v_id;
end;
$$;

create or replace function public.requeue_verification_job(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jid uuid;
begin
  if not app_private.is_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  select journalist_id into v_jid from public.verification_jobs where id = p_job_id;
  if v_jid is null then
    raise exception 'Verificação não encontrada' using errcode = 'P0002';
  end if;
  return public.enqueue_verification(v_jid);
end;
$$;

-- Reserva um lote pequeno de verificações (SKIP LOCKED permite execuções paralelas).
create or replace function public.claim_verification_jobs(p_batch_size int default null)
returns setof public.verification_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_size int := least(greatest(coalesce(p_batch_size, app_private.setting_int('verification.batch_size', 10)), 1), 50);
begin
  perform app_private.require_admin();
  -- Recupera execuções interrompidas.
  update public.verification_jobs
     set status = 'agendada', error_message = coalesce(error_message, 'Execução interrompida; reagendada')
   where status = 'executando' and started_at < now() - interval '30 minutes';

  return query
  with picked as (
    select v.id from public.verification_jobs v
     where v.status = 'agendada' and v.scheduled_at <= now()
     order by v.scheduled_at
     limit v_size
     for update skip locked
  )
  update public.verification_jobs j
     set status = 'executando', started_at = now(), attempts = j.attempts + 1
    from picked
   where j.id = picked.id
  returning j.*;
end;
$$;

-- Dados atuais de um jornalista para comparação com evidências.
create or replace function public.verification_snapshot(p_journalist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_admin();
  return (
    select jsonb_build_object(
      'id', j.id,
      'full_name', j.full_name,
      'professional_name', j.professional_name,
      'verification_status', j.verification_status,
      'last_verified_at', j.last_verified_at,
      'current_employments', app_private.employments_json(j.id, true),
      'past_employments', app_private.employments_json(j.id, false),
      'contacts', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'contact_type', c.contact_type, 'contact_value', c.contact_value,
          'verification_status', c.verification_status))
        from public.journalist_contacts c where c.journalist_id = j.id), '[]'::jsonb),
      'identifiers', coalesce((
        select jsonb_agg(jsonb_build_object('identifier_type', i.identifier_type, 'identifier_value', i.identifier_value))
        from public.journalist_identifiers i where i.journalist_id = j.id), '[]'::jsonb)
    )
    from public.journalists j where j.id = p_journalist_id
  );
end;
$$;

-- Registra o resultado de uma verificação de forma atômica.
--   p_outcome: concluida | ignorada | falhou
--   p_evidence: array de evidências [{source_url, source_title, observed_at, evidence_type,
--               evidence_summary, confidence_score, related_entity_type, related_entity_id, is_demo}]
--   p_proposal: {proposed_changes:[...], confidence_score, description, sensitive:boolean} ou null
-- Uma execução bem-sucedida atualiza last_checked_at (e last_evidence_at quando há
-- evidência), mas NUNCA last_verified_at: confirmar exige revisão humana ou o titular.
create or replace function public.record_verification_outcome(
  p_job_id uuid,
  p_outcome text,
  p_provider text default null,
  p_evidence jsonb default '[]'::jsonb,
  p_proposal jsonb default null,
  p_error text default null,
  p_summary jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.verification_jobs;
  v_ev jsonb;
  v_ev_id uuid;
  v_ev_ids uuid[] := '{}';
  v_proposal_id uuid;
  v_prior public.verification_status;
  v_max_attempts int := app_private.setting_int('verification.max_attempts', 3);
  v_is_demo boolean;
begin
  perform app_private.require_admin();
  select * into j from public.verification_jobs where id = p_job_id for update;
  if not found then
    raise exception 'Verificação não encontrada' using errcode = 'P0002';
  end if;
  if j.status <> 'executando' then
    raise exception 'Verificação não está em execução (%)', j.status using errcode = '22023';
  end if;
  perform set_config('app.change_source', 'verificacao', true);

  if p_outcome = 'falhou' then
    if j.attempts < v_max_attempts then
      update public.verification_jobs
         set status = 'agendada', error_message = left(p_error, 2000), provider = p_provider,
             scheduled_at = now() + (power(2, j.attempts) * 15) * interval '1 minute'
       where id = j.id;
    else
      update public.verification_jobs
         set status = 'falhou', error_message = left(p_error, 2000), provider = p_provider, finished_at = now()
       where id = j.id;
    end if;
    return jsonb_build_object('status', case when j.attempts < v_max_attempts then 'agendada' else 'falhou' end);
  end if;

  if p_outcome = 'ignorada' then
    -- Nenhuma busca foi feita (ex.: provedor não configurado): last_checked_at não muda.
    update public.verification_jobs
       set status = 'ignorada', finished_at = now(), provider = p_provider,
           error_message = left(p_error, 2000), result_summary = p_summary
     where id = j.id;
    return jsonb_build_object('status', 'ignorada');
  end if;

  if p_outcome <> 'concluida' then
    raise exception 'Resultado inválido: %', p_outcome using errcode = '22023';
  end if;

  for v_ev in select * from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) loop
    v_is_demo := coalesce((v_ev ->> 'is_demo')::boolean, false);
    insert into public.source_evidence
      (journalist_id, related_entity_type, related_entity_id, source_url, source_title, observed_at,
       evidence_type, evidence_summary, confidence_score, review_status, is_demo, provider)
    values (
      j.journalist_id,
      coalesce(v_ev ->> 'related_entity_type', 'journalist'),
      nullif(v_ev ->> 'related_entity_id', '')::uuid,
      v_ev ->> 'source_url',
      left(v_ev ->> 'source_title', 300),
      nullif(v_ev ->> 'observed_at', '')::timestamptz,
      case when v_is_demo then 'demonstrativa' else coalesce(v_ev ->> 'evidence_type', 'busca_automatizada') end::public.evidence_type,
      left(v_ev ->> 'evidence_summary', 2000),
      least(greatest(coalesce((v_ev ->> 'confidence_score')::numeric, 0), 0), 1),
      'pendente', v_is_demo, p_provider)
    on conflict (journalist_id, source_url, related_entity_type, coalesce(related_entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
      where source_url is not null
      do update set collected_at = now(), confidence_score = excluded.confidence_score
    returning id into v_ev_id;
    v_ev_ids := v_ev_ids || v_ev_id;
  end loop;

  if p_proposal is not null and jsonb_array_length(coalesce(p_proposal -> 'proposed_changes', '[]'::jsonb)) > 0 then
    if coalesce((p_proposal ->> 'sensitive')::boolean, true) then
      select verification_status into v_prior from public.journalists where id = j.journalist_id;
      if v_prior = 'em_revisao' then
        v_prior := null; -- já está em revisão por outra proposta
      end if;
    end if;
    insert into public.change_proposals
      (journalist_id, proposed_changes, evidence_ids, confidence_score, status, source, description,
       requires_human_review, is_demo, verification_job_id, prior_verification_status)
    values (
      j.journalist_id, p_proposal -> 'proposed_changes', v_ev_ids,
      least(greatest(coalesce((p_proposal ->> 'confidence_score')::numeric, 0), 0), 1),
      'pendente', 'verificacao_automatica', left(p_proposal ->> 'description', 4000),
      true, coalesce((p_proposal ->> 'is_demo')::boolean, false), j.id, v_prior)
    returning id into v_proposal_id;
    if v_prior is not null then
      update public.journalists set verification_status = 'em_revisao' where id = j.journalist_id;
    end if;
  end if;

  update public.journalists
     set last_checked_at = now(),
         last_evidence_at = case when cardinality(v_ev_ids) > 0 then now() else last_evidence_at end
   where id = j.journalist_id;

  update public.verification_jobs
     set status = 'concluida', finished_at = now(), provider = p_provider, error_message = null,
         result_summary = coalesce(p_summary, '{}'::jsonb)
           || jsonb_build_object('evidence_count', cardinality(v_ev_ids), 'proposal_id', v_proposal_id)
   where id = j.id;

  return jsonb_build_object('status', 'concluida', 'evidence_ids', to_jsonb(v_ev_ids), 'proposal_id', v_proposal_id);
end;
$$;

-- Marca como desatualizados os registros confirmados há muito tempo.
create or replace function public.mark_outdated_profiles()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int := app_private.setting_int('verification.outdated_after_days', 180);
  v_count int;
begin
  perform app_private.require_admin();
  perform set_config('app.change_source', 'sistema', true);
  update public.journalist_employments set verification_status = 'desatualizado'
   where verification_status = 'confirmado' and last_verified_at < now() - v_days * interval '1 day';
  update public.journalist_contacts set verification_status = 'desatualizado'
   where verification_status = 'confirmado' and last_verified_at < now() - v_days * interval '1 day';
  update public.journalists set verification_status = 'desatualizado'
   where verification_status = 'confirmado' and last_verified_at < now() - v_days * interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- =============================================================================
-- Indicadores do painel administrativo
-- =============================================================================
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_admin();
  return jsonb_build_object(
    'journalists_total', (select count(*) from public.journalists where merged_into_id is null),
    'by_status', coalesce((select jsonb_object_agg(verification_status, n) from (
        select verification_status, count(*) n from public.journalists where merged_into_id is null group by 1) s), '{}'::jsonb),
    'review_overdue', (select count(*) from public.journalists
                        where merged_into_id is null and not is_hidden and next_check_at < now()),
    'hidden', (select count(*) from public.journalists where is_hidden),
    'pending_proposals', (select count(*) from public.change_proposals where status = 'pendente'),
    'pending_claims', (select count(*) from public.profile_claims where status = 'pendente'),
    'open_privacy_requests', (select count(*) from public.privacy_requests where status in ('aberta', 'em_analise')),
    'pending_merge_suggestions', (select count(*) from public.journalist_merge_suggestions where status = 'pendente'),
    'jobs_last_30d', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) n from public.verification_jobs where created_at > now() - interval '30 days' group by 1) s), '{}'::jsonb),
    'failed_jobs_30d', (select count(*) from public.verification_jobs
                         where status = 'falhou' and created_at > now() - interval '30 days'),
    'recent_imports', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', id, 'file_name', file_name, 'status', status, 'created_at', created_at,
                                  'total_rows', total_rows, 'valid_rows', valid_rows, 'report', report) x
          from public.import_batches order by created_at desc limit 5) s), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilégios
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'review_change_proposal(uuid, boolean, text)',
    'submit_correction(uuid, text, text)',
    'submit_profile_claim(uuid, public.claim_method, text)',
    'review_profile_claim(uuid, boolean, text)',
    'confirm_own_profile()',
    'submit_privacy_request(public.privacy_request_type, text, uuid, text)',
    'resolve_privacy_request(uuid, public.privacy_request_status, text)',
    'set_user_role(uuid, public.user_role, uuid)',
    'duplicate_candidate_pairs(real, int)',
    'merge_journalists(uuid, uuid, uuid)',
    'unmerge_journalists(uuid)',
    'commit_import_batch(uuid)',
    'schedule_due_verifications(int)',
    'enqueue_verification(uuid)',
    'requeue_verification_job(uuid)',
    'claim_verification_jobs(int)',
    'verification_snapshot(uuid)',
    'record_verification_outcome(uuid, text, text, jsonb, jsonb, text, jsonb)',
    'mark_outdated_profiles()',
    'admin_dashboard_stats()'
  ] loop
    execute format('revoke execute on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end;
$$;

grant execute on all functions in schema app_private to authenticated, service_role;
revoke execute on all functions in schema app_private from anon, public;
