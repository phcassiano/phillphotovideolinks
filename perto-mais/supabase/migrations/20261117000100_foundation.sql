-- Perto+ · Fundação: extensões, enums, funções utilitárias
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent não é IMMUTABLE; este wrapper permite usá-lo em índices.
create or replace function public.immutable_unaccent(value text)
returns text
language sql
immutable parallel safe strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value)
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable parallel safe strict
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(public.immutable_unaccent(value)), '[^a-z0-9]+', '-', 'g'))
$$;

-- Configuração de busca em português que ignora acentos.
create text search configuration public.pt_unaccent (copy = pg_catalog.portuguese);
alter text search configuration public.pt_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, portuguese_stem;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable parallel safe
set search_path = ''
as $$
  select case when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
  else 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )) end
$$;

create type public.app_role as enum ('admin', 'merchant');
create type public.business_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.subscription_status as enum ('pending', 'active', 'canceled', 'expired');
create type public.metric_event_type as enum ('page_view', 'whatsapp_click', 'phone_click', 'product_view');
create type public.billing_interval as enum ('none', 'month', 'year');
