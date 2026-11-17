-- Perto+ · Tabelas
-- Convenção: id uuid, created_at/updated_at em todas, RLS habilitada em migration própria.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.states (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null default 'BR' check (country_code ~ '^[A-Z]{2}$'),
  name text not null check (char_length(name) between 2 and 80),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  slug text not null default '' check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, uf),
  unique (country_code, slug)
);

-- Rotas fixas do site que nenhuma cidade pode usar como slug (/:cidade/:bairro).
create table public.reserved_slugs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references public.states (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null default '' unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text not null default 'America/Sao_Paulo',
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cities_state_id_idx on public.cities (state_id);

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null default '' check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug)
);
create index neighborhoods_city_id_idx on public.neighborhoods (city_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null default '' unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text not null default 'store' check (icon ~ '^[a-z0-9-]+$'),
  description text check (char_length(description) <= 300),
  uses_menu_layout boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);
create index categories_parent_id_idx on public.categories (parent_id);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_-]+$'),
  name text not null check (char_length(name) between 2 and 60),
  description text check (char_length(description) <= 300),
  features text[] not null default '{}',
  price_cents integer not null default 0 check (price_cents >= 0),
  billing_interval public.billing_interval not null default 'month',
  max_products integer not null default 0 check (max_products >= 0),
  max_photos integer not null default 0 check (max_photos >= 0),
  can_logo boolean not null default false,
  can_cover boolean not null default false,
  can_description boolean not null default false,
  can_instagram boolean not null default false,
  can_gallery boolean not null default false,
  can_products boolean not null default false,
  can_detailed_stats boolean not null default false,
  highlight_in_listing boolean not null default false,
  is_default boolean not null default false,
  is_public boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index plans_single_default_idx on public.plans (is_default) where is_default;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  slug text not null default '' unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  category_id uuid not null references public.categories (id) on delete restrict,
  city_id uuid not null references public.cities (id) on delete restrict,
  neighborhood_id uuid not null references public.neighborhoods (id) on delete restrict,
  address_line text not null check (char_length(address_line) between 3 and 200),
  address_complement text check (char_length(address_complement) <= 120),
  postal_code text check (postal_code ~ '^[0-9]{5}-?[0-9]{3}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_e164 text check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  description text check (char_length(description) <= 2000),
  keywords text[] not null default '{}' check (cardinality(keywords) <= 20),
  logo_path text check (char_length(logo_path) <= 300),
  cover_path text check (char_length(cover_path) <= 300),
  status public.business_status not null default 'pending',
  status_reason text check (char_length(status_reason) <= 500),
  approved_at timestamptz,
  is_demo boolean not null default false,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_contact_required check (phone_e164 is not null or whatsapp_e164 is not null),
  constraint businesses_coords_pair check ((latitude is null) = (longitude is null)),
  constraint businesses_reason_required check (status not in ('rejected', 'suspended') or coalesce(trim(status_reason), '') <> '')
);
create index businesses_owner_id_idx on public.businesses (owner_id);
create index businesses_category_id_idx on public.businesses (category_id);
create index businesses_city_id_idx on public.businesses (city_id);
create index businesses_neighborhood_id_idx on public.businesses (neighborhood_id);
create index businesses_status_idx on public.businesses (status);
create index businesses_public_listing_idx on public.businesses (city_id, neighborhood_id, category_id) where status = 'approved';
create index businesses_approved_at_idx on public.businesses (approved_at desc) where status = 'approved';
create index businesses_search_idx on public.businesses using gin (search_vector);
create index businesses_name_trgm_idx on public.businesses using gin ((public.immutable_unaccent(lower(name))) extensions.gin_trgm_ops);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  opens_at time not null,
  closes_at time not null, -- closes_at < opens_at = vira a meia-noite
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at <> closes_at)
);
create index business_hours_business_id_idx on public.business_hours (business_id, weekday);

create table public.business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  path text not null check (char_length(path) <= 300),
  caption text check (char_length(caption) <= 140),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index business_photos_business_id_idx on public.business_photos (business_id, sort_order);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_categories_business_id_idx on public.product_categories (business_id, sort_order);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_category_id uuid references public.product_categories (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 600),
  price_cents integer check (price_cents >= 0 and price_cents <= 100000000),
  photo_path text check (char_length(photo_path) <= 300),
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_business_id_idx on public.products (business_id, sort_order);
create index products_product_category_id_idx on public.products (product_category_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status public.subscription_status not null default 'pending',
  price_cents integer not null check (price_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0), -- reservado para cupons
  provider text not null default 'manual' check (provider ~ '^[a-z0-9_-]+$'),
  provider_ref text,
  starts_at timestamptz,
  ends_at timestamptz,
  requested_by uuid references auth.users (id) on delete set null,
  activated_by uuid references auth.users (id) on delete set null,
  activated_at timestamptz,
  canceled_at timestamptz,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);
create index subscriptions_business_id_idx on public.subscriptions (business_id);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index subscriptions_status_idx on public.subscriptions (status, ends_at);
create unique index subscriptions_one_pending_idx on public.subscriptions (business_id) where status = 'pending';

create table public.featured_businesses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index featured_businesses_business_id_idx on public.featured_businesses (business_id, ends_at);

create table public.metric_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  event_type public.metric_event_type not null,
  session_hash text not null check (char_length(session_hash) between 8 and 128),
  day date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metric_events_dedup unique nulls not distinct (business_id, product_id, event_type, session_hash, day)
);
create index metric_events_business_day_idx on public.metric_events (business_id, day);
create index metric_events_product_id_idx on public.metric_events (product_id) where product_id is not null;

create table public.business_metrics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  day date not null,
  page_views integer not null default 0 check (page_views >= 0),
  whatsapp_clicks integer not null default 0 check (whatsapp_clicks >= 0),
  phone_clicks integer not null default 0 check (phone_clicks >= 0),
  product_views integer not null default 0 check (product_views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, day)
);

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);
create index admin_audit_log_actor_id_idx on public.admin_audit_log (actor_id);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity, entity_id);

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, window_start)
);

-- updated_at automático
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','states','reserved_slugs','cities','neighborhoods','categories','plans',
    'businesses','business_hours','business_photos','product_categories','products','subscriptions',
    'featured_businesses','metric_events','business_metrics','admin_audit_log','rate_limits'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
