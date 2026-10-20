-- =============================================================================
-- Radar de Imprensa — tabelas principais
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organizações e perfis de usuário
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 160),
  email text not null,
  role public.user_role not null default 'assessor',
  organization_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_organization_idx on public.profiles (organization_id);
create unique index profiles_email_key on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- Referências: localidades, editorias, temas, veículos
-- -----------------------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  country char(2) not null default 'BR',
  state_code char(2) not null check (state_code ~ '^[A-Z]{2}$'),
  state_name text not null,
  -- city_name nulo representa o estado como um todo (ex.: correspondente estadual)
  city_name text,
  ibge_code text unique check (ibge_code is null or ibge_code ~ '^[0-9]{2}([0-9]{5})?$'),
  normalized_city text generated always as (public.f_normalize(city_name)) stored
);
create unique index locations_unique_city
  on public.locations (country, state_code, coalesce(normalized_city, ''));
create index locations_state_idx on public.locations (state_code);
create index locations_city_trgm on public.locations using gin (normalized_city extensions.gin_trgm_ops);

create table public.editorial_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  parent_id uuid references public.editorial_categories (id) on delete restrict,
  active boolean not null default true,
  sort_order int not null default 0,
  check (parent_id is null or parent_id <> id)
);
create unique index editorial_categories_unique_name
  on public.editorial_categories (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), public.f_normalize(name));
create index editorial_categories_parent_idx on public.editorial_categories (parent_id);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  normalized_name text generated always as (public.f_normalize(name)) stored unique
);

create table public.media_outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  normalized_name text generated always as (public.f_normalize(name)) stored,
  website text check (website is null or website ~* '^https?://'),
  -- nulo quando o tipo ainda não foi informado (ex.: importação sem a coluna)
  outlet_type public.outlet_type,
  headquarters_city_id uuid references public.locations (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index media_outlets_unique_name
  on public.media_outlets (normalized_name, coalesce(headquarters_city_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index media_outlets_type_idx on public.media_outlets (outlet_type);
create index media_outlets_name_trgm on public.media_outlets using gin (normalized_name extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Jornalistas
-- -----------------------------------------------------------------------------
create table public.journalists (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 3 and 160),
  professional_name text check (professional_name is null or char_length(btrim(professional_name)) between 2 and 160),
  biography text check (biography is null or char_length(biography) <= 2000),
  profile_photo_url text check (profile_photo_url is null or profile_photo_url ~* '^https://'),
  -- a foto só é exibida quando há autorização registrada
  photo_authorized boolean not null default false,
  professional_status public.professional_status not null default 'desconhecido',
  verification_status public.verification_status not null default 'nao_verificado',
  -- Separação exigida pela política de confiança:
  last_checked_at timestamptz,   -- última busca realizada (automática ou manual)
  last_evidence_at timestamptz,  -- última evidência encontrada
  last_verified_at timestamptz,  -- última confirmação profissional
  next_check_at timestamptz,     -- próxima verificação periódica agendada
  claimed_by uuid unique references public.profiles (id) on delete set null,
  is_hidden boolean not null default false,
  merged_into_id uuid references public.journalists (id) on delete set null,
  search_name text generated always as (
    public.f_normalize(full_name || ' ' || coalesce(professional_name, ''))
  ) stored,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merged_into_id is null or merged_into_id <> id)
);
create index journalists_search_name_trgm on public.journalists using gin (search_name extensions.gin_trgm_ops);
create index journalists_status_idx on public.journalists (verification_status);
create index journalists_next_check_idx on public.journalists (next_check_at) where merged_into_id is null;
create index journalists_merged_idx on public.journalists (merged_into_id) where merged_into_id is not null;

-- Identificadores profissionais autorizados (registro profissional, perfil institucional etc.)
create table public.journalist_identifiers (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  identifier_type text not null check (identifier_type in (
    'registro_profissional', 'perfil_institucional', 'orcid', 'site_pessoal', 'outro'
  )),
  identifier_value text not null check (char_length(btrim(identifier_value)) between 2 and 300),
  created_at timestamptz not null default now()
);
create unique index journalist_identifiers_unique
  on public.journalist_identifiers (identifier_type, lower(btrim(identifier_value)));
create index journalist_identifiers_journalist_idx on public.journalist_identifiers (journalist_id);

create table public.journalist_topics (
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  origin text not null default 'admin' check (origin in ('titular', 'evidencia', 'admin', 'importacao')),
  created_at timestamptz not null default now(),
  primary key (journalist_id, topic_id)
);
create index journalist_topics_topic_idx on public.journalist_topics (topic_id);

-- -----------------------------------------------------------------------------
-- Evidências (fontes públicas que sustentam as informações)
-- -----------------------------------------------------------------------------
create table public.source_evidence (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid references public.journalists (id) on delete cascade,
  related_entity_type text check (related_entity_type in (
    'journalist', 'employment', 'contact', 'identifier', 'topic'
  )),
  related_entity_id uuid,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  source_title text check (source_title is null or char_length(source_title) <= 300),
  observed_at timestamptz,
  collected_at timestamptz not null default now(),
  evidence_type public.evidence_type not null,
  evidence_summary text check (evidence_summary is null or char_length(evidence_summary) <= 2000),
  confidence_score numeric(4, 3) check (confidence_score between 0 and 1),
  review_status public.evidence_review_status not null default 'pendente',
  -- evidências demonstrativas nunca sustentam confirmações
  is_demo boolean not null default false,
  provider text,
  created_by uuid references public.profiles (id) on delete set null,
  check (source_url is not null or source_title is not null),
  check (not is_demo or evidence_type = 'demonstrativa')
);
create index source_evidence_journalist_idx on public.source_evidence (journalist_id, collected_at desc);
create index source_evidence_entity_idx on public.source_evidence (related_entity_type, related_entity_id);
create unique index source_evidence_dedupe
  on public.source_evidence (journalist_id, source_url, related_entity_type, coalesce(related_entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where source_url is not null;

-- -----------------------------------------------------------------------------
-- Vínculos profissionais (históricos; nunca sobrescritos)
-- -----------------------------------------------------------------------------
create table public.journalist_employments (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  media_outlet_id uuid not null references public.media_outlets (id) on delete restrict,
  location_id uuid references public.locations (id) on delete set null,
  job_title text check (job_title is null or char_length(btrim(job_title)) between 2 and 120),
  start_date date,
  end_date date,
  is_current boolean not null default true,
  verification_status public.verification_status not null default 'nao_verificado',
  last_verified_at timestamptz,
  source_id uuid references public.source_evidence (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_current or end_date is null),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index journalist_employments_journalist_idx on public.journalist_employments (journalist_id);
create index journalist_employments_outlet_idx on public.journalist_employments (media_outlet_id);
create index journalist_employments_location_idx on public.journalist_employments (location_id);
create index journalist_employments_current_idx on public.journalist_employments (journalist_id) where is_current;
-- evita vínculos atuais duplicados (mesmo veículo e mesmo cargo)
create unique index journalist_employments_unique_current
  on public.journalist_employments (journalist_id, media_outlet_id, coalesce(public.f_normalize(job_title), ''))
  where is_current;

create table public.journalist_employment_categories (
  employment_id uuid not null references public.journalist_employments (id) on delete cascade,
  category_id uuid not null references public.editorial_categories (id) on delete restrict,
  primary key (employment_id, category_id)
);
create index journalist_employment_categories_category_idx on public.journalist_employment_categories (category_id);

-- -----------------------------------------------------------------------------
-- Contatos profissionais
-- -----------------------------------------------------------------------------
create table public.journalist_contacts (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  employment_id uuid references public.journalist_employments (id) on delete set null,
  contact_type public.contact_type not null,
  contact_value text not null check (char_length(btrim(contact_value)) between 3 and 300),
  is_primary boolean not null default false,
  visibility public.contact_visibility not null default 'restrito',
  professional_purpose text check (professional_purpose is null or char_length(professional_purpose) <= 300),
  legal_basis public.legal_basis not null default 'legitimo_interesse',
  -- WhatsApp só pode ser cadastrado com autorização registrada do titular
  consent_recorded_at timestamptz,
  source_id uuid references public.source_evidence (id) on delete set null,
  verification_status public.verification_status not null default 'nao_verificado',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_type <> 'whatsapp_profissional' or consent_recorded_at is not null),
  check (legal_basis <> 'consentimento' or consent_recorded_at is not null),
  check (
    case contact_type
      when 'email_profissional' then contact_value ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'
      when 'formulario_contato' then contact_value ~* '^https://'
      else contact_value ~ '^\+?[0-9 ()-]{8,20}$'
    end
  )
);
create unique index journalist_contacts_unique
  on public.journalist_contacts (journalist_id, contact_type, lower(btrim(contact_value)));
create unique index journalist_contacts_one_primary
  on public.journalist_contacts (journalist_id) where is_primary;
create index journalist_contacts_journalist_idx on public.journalist_contacts (journalist_id);

-- -----------------------------------------------------------------------------
-- Histórico de alterações (preenchido por triggers)
-- -----------------------------------------------------------------------------
create table public.journalist_change_history (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  change_source public.change_source not null default 'manual',
  changed_at timestamptz not null default now(),
  approved_by uuid references public.profiles (id) on delete set null
);
create index journalist_change_history_journalist_idx on public.journalist_change_history (journalist_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- Verificações periódicas e propostas de alteração
-- -----------------------------------------------------------------------------
create table public.verification_jobs (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  status public.verification_job_status not null default 'agendada',
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts int not null default 0 check (attempts >= 0),
  error_message text,
  provider text,
  result_summary jsonb,
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index verification_jobs_queue_idx on public.verification_jobs (scheduled_at) where status = 'agendada';
create index verification_jobs_journalist_idx on public.verification_jobs (journalist_id, created_at desc);
create unique index verification_jobs_one_open
  on public.verification_jobs (journalist_id) where status in ('agendada', 'executando');

create table public.change_proposals (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  proposed_changes jsonb not null default '[]'::jsonb check (jsonb_typeof(proposed_changes) = 'array'),
  evidence_ids uuid[] not null default '{}',
  confidence_score numeric(4, 3) check (confidence_score between 0 and 1),
  status public.proposal_status not null default 'pendente',
  source public.proposal_source not null,
  description text check (description is null or char_length(description) <= 4000),
  requires_human_review boolean not null default true,
  is_demo boolean not null default false,
  -- status do perfil antes de entrar "em revisão" (restaurado se a proposta for rejeitada)
  prior_verification_status public.verification_status,
  verification_job_id uuid references public.verification_jobs (id) on delete set null,
  proposed_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  check (jsonb_array_length(proposed_changes) > 0 or description is not null)
);
create index change_proposals_status_idx on public.change_proposals (status, created_at desc);
create index change_proposals_journalist_idx on public.change_proposals (journalist_id);

-- -----------------------------------------------------------------------------
-- Resolução de identidade: sugestões e registros de unificação
-- -----------------------------------------------------------------------------
create table public.journalist_merge_suggestions (
  id uuid primary key default gen_random_uuid(),
  journalist_a_id uuid not null references public.journalists (id) on delete cascade,
  journalist_b_id uuid not null references public.journalists (id) on delete cascade,
  score numeric(4, 3) not null check (score between 0 and 1),
  reasons jsonb not null default '[]'::jsonb,
  status public.review_status not null default 'pendente',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (journalist_a_id < journalist_b_id),
  unique (journalist_a_id, journalist_b_id)
);

create table public.journalist_merges (
  id uuid primary key default gen_random_uuid(),
  survivor_id uuid not null references public.journalists (id) on delete cascade,
  merged_id uuid not null references public.journalists (id) on delete cascade,
  suggestion_id uuid references public.journalist_merge_suggestions (id) on delete set null,
  moved jsonb not null default '{}'::jsonb,
  merged_by uuid references public.profiles (id) on delete set null,
  merged_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references public.profiles (id) on delete set null
);
create unique index journalist_merges_active on public.journalist_merges (merged_id) where reverted_at is null;

-- -----------------------------------------------------------------------------
-- Recursos dos assessores: favoritos, mailings, interações
-- -----------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, journalist_id)
);
create index favorites_journalist_idx on public.favorites (journalist_id);

create table public.mailing_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  visibility public.mailing_visibility not null default 'privada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (visibility = 'privada' or organization_id is not null)
);
create unique index mailing_lists_owner_name on public.mailing_lists (owner_id, public.f_normalize(name));
create index mailing_lists_org_idx on public.mailing_lists (organization_id) where visibility = 'organizacao';

create table public.mailing_list_members (
  mailing_list_id uuid not null references public.mailing_lists (id) on delete cascade,
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  notes text check (notes is null or char_length(notes) <= 1000),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (mailing_list_id, journalist_id)
);
create index mailing_list_members_journalist_idx on public.mailing_list_members (journalist_id);

create table public.journalist_interactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  interaction_type public.interaction_type not null,
  subject text not null check (char_length(btrim(subject)) between 2 and 200),
  notes text check (notes is null or char_length(notes) <= 4000),
  interaction_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index journalist_interactions_owner_idx on public.journalist_interactions (owner_id, interaction_date desc);

-- -----------------------------------------------------------------------------
-- Titulares: reivindicação de perfil e solicitações de privacidade
-- -----------------------------------------------------------------------------
create table public.profile_claims (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  verification_method public.claim_method not null,
  evidence_text text check (evidence_text is null or char_length(evidence_text) <= 2000),
  -- sinal auxiliar: domínio do e-mail do usuário coincide com o site de um veículo atual
  email_domain_match boolean not null default false,
  status public.review_status not null default 'pendente',
  review_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index profile_claims_one_pending
  on public.profile_claims (journalist_id, user_id) where status = 'pendente';

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid references public.journalists (id) on delete set null,
  requester_id uuid references public.profiles (id) on delete set null,
  request_type public.privacy_request_type not null,
  details text not null check (char_length(btrim(details)) between 10 and 4000),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status public.privacy_request_status not null default 'aberta',
  resolution_notes text,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index privacy_requests_status_idx on public.privacy_requests (status, created_at);

-- -----------------------------------------------------------------------------
-- Auditoria, limites de uso e parâmetros globais
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup on public.rate_limit_events (user_id, action, created_at desc);

create table public.contact_access_logs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  access_date date not null default current_date,
  first_accessed_at timestamptz not null default now(),
  primary key (user_id, access_date, journalist_id)
);

-- Parâmetros globais. NUNCA armazenar segredos aqui (são legíveis por usuários autenticados).
create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Importações CSV
-- -----------------------------------------------------------------------------
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  file_name text not null,
  status public.import_status not null default 'previa',
  column_mapping jsonb not null default '{}'::jsonb,
  contact_visibility public.contact_visibility not null default 'restrito',
  total_rows int not null default 0,
  valid_rows int not null default 0,
  invalid_rows int not null default 0,
  duplicate_rows int not null default 0,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  committed_by uuid references public.profiles (id) on delete set null
);
create index import_batches_created_idx on public.import_batches (created_at desc);

create table public.import_rows (
  batch_id uuid not null references public.import_batches (id) on delete cascade,
  row_number int not null check (row_number > 0),
  raw jsonb not null,
  normalized jsonb,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  duplicate_of uuid references public.journalists (id) on delete set null,
  duplicate_reason text,
  action public.import_row_action not null default 'criar',
  result_journalist_id uuid references public.journalists (id) on delete set null,
  primary key (batch_id, row_number)
);

-- -----------------------------------------------------------------------------
-- Gatilhos de updated_at
-- -----------------------------------------------------------------------------
create trigger organizations_touch before update on public.organizations
  for each row execute function app_private.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function app_private.touch_updated_at();
create trigger media_outlets_touch before update on public.media_outlets
  for each row execute function app_private.touch_updated_at();
create trigger journalists_touch before update on public.journalists
  for each row execute function app_private.touch_updated_at();
create trigger journalist_employments_touch before update on public.journalist_employments
  for each row execute function app_private.touch_updated_at();
create trigger journalist_contacts_touch before update on public.journalist_contacts
  for each row execute function app_private.touch_updated_at();
create trigger mailing_lists_touch before update on public.mailing_lists
  for each row execute function app_private.touch_updated_at();
