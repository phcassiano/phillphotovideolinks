-- =============================================================================
-- Radar de Imprensa — extensões, tipos enumerados e funções utilitárias
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Schema para funções internas que não devem ser expostas pela API REST.
create schema if not exists app_private;
revoke all on schema app_private from public;

-- -----------------------------------------------------------------------------
-- Tipos enumerados (valores em português, sem acentos)
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('assessor', 'jornalista', 'admin', 'super_admin');

create type public.outlet_type as enum (
  'tv', 'radio', 'jornal', 'portal', 'revista', 'agencia', 'independente'
);

create type public.professional_status as enum (
  'ativo', 'freelancer', 'afastado', 'inativo', 'desconhecido'
);

-- Política conservadora de confirmação (seção 11).
create type public.verification_status as enum (
  'confirmado', 'provavel', 'nao_verificado', 'desatualizado', 'em_revisao'
);

create type public.contact_type as enum (
  'email_profissional', 'telefone_profissional', 'whatsapp_profissional', 'formulario_contato'
);

-- assinantes: visível a usuários autenticados (via RPC com limite de acesso)
-- restrito:   somente administradores e o próprio titular
-- oculto:     mantido apenas para fins de auditoria/oposição; nunca exibido
create type public.contact_visibility as enum ('assinantes', 'restrito', 'oculto');

create type public.legal_basis as enum (
  'legitimo_interesse', 'consentimento', 'dado_tornado_publico_pelo_titular'
);

create type public.evidence_type as enum (
  'perfil_institucional', 'assinatura_materia', 'expediente', 'declaracao_titular',
  'importacao', 'cadastro_manual', 'busca_automatizada', 'demonstrativa'
);

create type public.evidence_review_status as enum ('pendente', 'aceita', 'rejeitada');

create type public.verification_job_status as enum (
  'agendada', 'executando', 'concluida', 'falhou', 'ignorada', 'cancelada'
);

create type public.proposal_status as enum ('pendente', 'aprovada', 'rejeitada', 'cancelada');

create type public.proposal_source as enum (
  'verificacao_automatica', 'sugestao_usuario', 'titular', 'importacao', 'admin'
);

create type public.claim_method as enum (
  'email_corporativo', 'documento_profissional', 'contato_redacao', 'outro'
);

create type public.review_status as enum ('pendente', 'aprovada', 'rejeitada');

create type public.privacy_request_type as enum (
  'acesso', 'correcao', 'ocultacao', 'exclusao', 'oposicao'
);

create type public.privacy_request_status as enum ('aberta', 'em_analise', 'atendida', 'recusada');

create type public.interaction_type as enum (
  'email', 'telefone', 'reuniao', 'entrevista', 'envio_release', 'outro'
);

create type public.mailing_visibility as enum ('privada', 'organizacao');

create type public.import_status as enum ('previa', 'importada', 'cancelada', 'falhou');

create type public.import_row_action as enum ('criar', 'vincular', 'ignorar');

create type public.change_source as enum (
  'manual', 'importacao', 'verificacao', 'titular', 'sugestao', 'unificacao', 'sistema'
);

-- -----------------------------------------------------------------------------
-- Normalização de texto (busca sem acentos, deduplicação)
-- -----------------------------------------------------------------------------
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

create or replace function public.f_normalize(text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(lower(public.f_unaccent(btrim(regexp_replace(coalesce($1, ''), '\s+', ' ', 'g')))), '')
$$;

-- Atualiza a coluna updated_at.
create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
