-- Perto+ · Regras de negócio: papéis, slugs, planos, horários, guardas e auditoria

---------------------------------------------------------------------------
-- Papéis
---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  )
$$;

-- Verdadeiro para service_role, postgres (migrations/seed) e admins.
-- Funções SECURITY DEFINER rodam como postgres e por isso também são privilegiadas:
-- cada uma valida suas próprias permissões antes de escrever.
create or replace function public.is_privileged()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user not in ('anon', 'authenticated') or public.is_admin()
$$;

-- Cria perfil e papel de comerciante para todo novo usuário do Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := new.raw_user_meta_data ->> 'phone_e164';
begin
  insert into public.profiles (id, full_name, phone_e164)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    case when v_phone ~ '^\+[1-9][0-9]{7,14}$' then v_phone end
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'merchant') on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

---------------------------------------------------------------------------
-- Slugs
---------------------------------------------------------------------------
-- Gera slug único em uma tabela; com p_scope_column, a unicidade é por escopo.
create or replace function public.unique_slug(
  p_table regclass,
  p_value text,
  p_exclude_id uuid default null,
  p_scope_column text default null,
  p_scope_value uuid default null
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_base text := coalesce(nullif(public.slugify(p_value), ''), 'item');
  v_candidate text;
  v_n integer := 1;
  v_exists boolean;
begin
  v_base := left(v_base, 80);
  v_candidate := v_base;
  loop
    if p_scope_column is null then
      execute format('select exists(select 1 from %s where slug = $1 and id is distinct from $2)', p_table)
        into v_exists using v_candidate, p_exclude_id;
    else
      execute format('select exists(select 1 from %s where slug = $1 and id is distinct from $2 and %I = $3)', p_table, p_scope_column)
        into v_exists using v_candidate, p_exclude_id, p_scope_value;
    end if;
    exit when not v_exists;
    v_n := v_n + 1;
    v_candidate := v_base || '-' || v_n;
  end loop;
  return v_candidate;
end;
$$;

create or replace function public.cities_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.unique_slug('public.cities', new.name, new.id);
  else
    new.slug := public.slugify(new.slug);
  end if;
  if exists (select 1 from public.reserved_slugs r where r.slug = new.slug) then
    raise exception 'O endereço "%" é reservado pelo sistema. Escolha outro.', new.slug using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger cities_before_write before insert or update on public.cities
  for each row execute function public.cities_before_write();

create or replace function public.neighborhoods_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.unique_slug('public.neighborhoods', new.name, new.id, 'city_id', new.city_id);
  else
    new.slug := public.slugify(new.slug);
  end if;
  return new;
end;
$$;
create trigger neighborhoods_before_write before insert or update on public.neighborhoods
  for each row execute function public.neighborhoods_before_write();

create or replace function public.categories_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.unique_slug('public.categories', new.name, new.id);
  else
    new.slug := public.slugify(new.slug);
  end if;
  -- no máximo dois níveis
  if new.parent_id is not null then
    if exists (select 1 from public.categories p where p.id = new.parent_id and p.parent_id is not null) then
      raise exception 'Subcategorias só podem ficar dentro de uma categoria principal.' using errcode = '23514';
    end if;
    if exists (select 1 from public.categories c where c.parent_id = new.id) then
      raise exception 'Uma categoria com subcategorias não pode virar subcategoria.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger categories_before_write before insert or update on public.categories
  for each row execute function public.categories_before_write();

---------------------------------------------------------------------------
-- Planos
---------------------------------------------------------------------------
-- Plano vigente: assinatura ativa dentro do período; senão, o plano padrão (gratuito).
create or replace function public.business_plan(p_business_id uuid)
returns public.plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.plans p
  where p.id = coalesce(
    (
      select s.plan_id from public.subscriptions s
      where s.business_id = p_business_id
        and s.status = 'active'
        and now() >= s.starts_at and now() < s.ends_at
      order by s.ends_at desc
      limit 1
    ),
    (select d.id from public.plans d where d.is_default limit 1)
  )
$$;

create or replace function public.business_has(p_business_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case p_feature
      when 'logo' then p.can_logo
      when 'cover' then p.can_cover
      when 'description' then p.can_description
      when 'instagram' then p.can_instagram
      when 'gallery' then p.can_gallery
      when 'products' then p.can_products
      when 'detailed_stats' then p.can_detailed_stats
      when 'highlight' then p.highlight_in_listing
      else false
    end
    from public.business_plan(p_business_id) p
  ), false)
$$;

---------------------------------------------------------------------------
-- Horários (aberto/fechado no fuso da cidade, padrão America/Sao_Paulo)
---------------------------------------------------------------------------
create or replace function public.is_open_at(p_business_id uuid, p_at timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with tz as (
    select coalesce(c.timezone, 'America/Sao_Paulo') as zone
    from public.businesses b join public.cities c on c.id = b.city_id
    where b.id = p_business_id
  ), t as (
    select extract(dow from (p_at at time zone tz.zone))::int as dow,
           (p_at at time zone tz.zone)::time as tm
    from tz
  )
  select case
    when not exists (select 1 from public.business_hours h where h.business_id = p_business_id) then null
    else exists (
      select 1 from public.business_hours h, t
      where h.business_id = p_business_id and (
        (h.weekday = t.dow and (
          (h.closes_at > h.opens_at and t.tm >= h.opens_at and t.tm < h.closes_at)
          or (h.closes_at < h.opens_at and t.tm >= h.opens_at)
        ))
        or (h.weekday = (t.dow + 6) % 7 and h.closes_at < h.opens_at and t.tm < h.closes_at)
      )
    )
  end
$$;

create or replace function public.email_confirmed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from auth.users u where u.id = p_user_id and u.email_confirmed_at is not null)
$$;
revoke execute on function public.email_confirmed(uuid) from public, anon;

---------------------------------------------------------------------------
-- Estabelecimentos: slug, busca e guardas
---------------------------------------------------------------------------
create or replace function public.business_search_vector(p_business public.businesses)
returns tsvector
language sql
stable
security definer
set search_path = ''
as $$
  select
    setweight(to_tsvector('public.pt_unaccent', coalesce(p_business.name, '')), 'A') ||
    setweight(to_tsvector('public.pt_unaccent', coalesce(array_to_string(p_business.keywords, ' '), '')), 'B') ||
    setweight(to_tsvector('public.pt_unaccent', coalesce((
      select c.name || ' ' || coalesce(pc.name, '')
      from public.categories c left join public.categories pc on pc.id = c.parent_id
      where c.id = p_business.category_id
    ), '')), 'B') ||
    setweight(to_tsvector('public.pt_unaccent', coalesce(p_business.description, '')), 'C') ||
    setweight(to_tsvector('public.pt_unaccent', coalesce((
      select n.name from public.neighborhoods n where n.id = p_business.neighborhood_id
    ), '')), 'D')
$$;

create or replace function public.businesses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_privileged boolean := public.is_privileged();
begin
  if tg_op = 'INSERT' then
    if not v_privileged then
      new.owner_id := (select auth.uid());
      new.status := 'pending';
      new.status_reason := null;
      new.approved_at := null;
      new.is_demo := false;
      new.slug := null;
    end if;
    if new.slug is null or new.slug = '' then
      new.slug := public.unique_slug('public.businesses', new.name, new.id);
    end if;
  else
    if not v_privileged then
      if new.owner_id is distinct from old.owner_id
        or new.status is distinct from old.status
        or new.status_reason is distinct from old.status_reason
        or new.approved_at is distinct from old.approved_at
        or new.is_demo is distinct from old.is_demo
        or new.slug is distinct from old.slug then
        raise exception 'Você não pode alterar status, dono, slug ou marcação de demonstração.' using errcode = '42501';
      end if;
    end if;
  end if;

  -- bairro precisa pertencer à cidade
  if not exists (select 1 from public.neighborhoods n where n.id = new.neighborhood_id and n.city_id = new.city_id) then
    raise exception 'O bairro não pertence à cidade informada.' using errcode = '23514';
  end if;

  -- limites de plano (campos da Vitrine) para quem não é privilegiado
  if not v_privileged then
    if new.logo_path is not null and (tg_op = 'INSERT' or new.logo_path is distinct from old.logo_path)
      and not public.business_has(new.id, 'logo') then
      raise exception 'Logo está disponível apenas no plano Vitrine.' using errcode = 'P0001', hint = 'plan_limit';
    end if;
    if new.cover_path is not null and (tg_op = 'INSERT' or new.cover_path is distinct from old.cover_path)
      and not public.business_has(new.id, 'cover') then
      raise exception 'Capa está disponível apenas no plano Vitrine.' using errcode = 'P0001', hint = 'plan_limit';
    end if;
    if coalesce(new.description, '') <> '' and (tg_op = 'INSERT' or new.description is distinct from old.description)
      and not public.business_has(new.id, 'description') then
      raise exception 'Descrição completa está disponível apenas no plano Vitrine.' using errcode = 'P0001', hint = 'plan_limit';
    end if;
    if new.instagram is not null and (tg_op = 'INSERT' or new.instagram is distinct from old.instagram)
      and not public.business_has(new.id, 'instagram') then
      raise exception 'Instagram está disponível apenas no plano Vitrine.' using errcode = 'P0001', hint = 'plan_limit';
    end if;
  end if;

  -- publicar exige e-mail confirmado do dono
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    if not public.email_confirmed(new.owner_id) then
      raise exception 'O dono ainda não confirmou o e-mail; não é possível aprovar.' using errcode = 'P0001', hint = 'email_not_confirmed';
    end if;
    new.approved_at := coalesce(new.approved_at, now());
    new.status_reason := null;
  end if;

  new.search_vector := public.business_search_vector(new);
  return new;
end;
$$;
create trigger businesses_before_write before insert or update on public.businesses
  for each row execute function public.businesses_before_write();

-- Comerciante reenviando um cadastro rejeitado para análise.
create or replace function public.resubmit_business(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.businesses
     set status = 'pending', status_reason = null
   where id = p_business_id
     and owner_id = (select auth.uid())
     and status = 'rejected';
  if not found then
    raise exception 'Cadastro não encontrado ou não está rejeitado.' using errcode = 'P0002';
  end if;
end;
$$;

---------------------------------------------------------------------------
-- Vitrine: produtos, categorias de produto e fotos respeitam o plano
---------------------------------------------------------------------------
create or replace function public.enforce_vitrine_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_count integer;
begin
  if current_user not in ('anon', 'authenticated') then
    return new; -- service_role / seed
  end if;
  v_plan := public.business_plan(new.business_id);

  if tg_table_name in ('products', 'product_categories') then
    if not v_plan.can_products then
      raise exception 'Catálogo e cardápio estão disponíveis apenas no plano Vitrine.' using errcode = 'P0001', hint = 'plan_limit';
    end if;
    if tg_table_name = 'products' and tg_op = 'INSERT' then
      select count(*) into v_count from public.products where business_id = new.business_id;
      if v_count >= v_plan.max_products then
        raise exception 'Seu plano permite até % produtos.', v_plan.max_products using errcode = 'P0001', hint = 'plan_limit';
      end if;
    end if;
    if tg_table_name = 'products' and new.product_category_id is not null and not exists (
      select 1 from public.product_categories pc where pc.id = new.product_category_id and pc.business_id = new.business_id
    ) then
      raise exception 'Categoria de produto inválida.' using errcode = '23514';
    end if;
  elsif tg_table_name = 'business_photos' then
    if not v_plan.can_gallery then
      raise exception 'Galeria de fotos está disponível apenas no plano Vitrine.' using errcode = 'P0001', hint = 'plan_limit';
    end if;
    if tg_op = 'INSERT' then
      select count(*) into v_count from public.business_photos where business_id = new.business_id;
      if v_count >= v_plan.max_photos then
        raise exception 'Seu plano permite até % fotos.', v_plan.max_photos using errcode = 'P0001', hint = 'plan_limit';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id then
    raise exception 'Não é possível mover itens entre estabelecimentos.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger products_enforce_limits before insert or update on public.products
  for each row execute function public.enforce_vitrine_limits();
create trigger product_categories_enforce_limits before insert or update on public.product_categories
  for each row execute function public.enforce_vitrine_limits();
create trigger business_photos_enforce_limits before insert or update on public.business_photos
  for each row execute function public.enforce_vitrine_limits();

create or replace function public.business_hours_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.business_id is distinct from old.business_id then
    raise exception 'Não é possível mover horários entre estabelecimentos.' using errcode = '42501';
  end if;
  if (select count(*) from public.business_hours where business_id = new.business_id and weekday = new.weekday and id <> new.id) >= 4 then
    raise exception 'No máximo 4 intervalos por dia.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger business_hours_guard before insert or update on public.business_hours
  for each row execute function public.business_hours_guard();

---------------------------------------------------------------------------
-- Leitura pública
---------------------------------------------------------------------------
-- View pública: apenas aprovados, sem dados do dono, campos da Vitrine
-- mascarados quando o plano vigente não os inclui. Roda com os privilégios
-- do dono da view (por isso filtra tudo explicitamente).
create view public.public_businesses
with (security_barrier = true)
as
select
  b.id,
  b.slug,
  b.name,
  b.category_id,
  c.slug as category_slug,
  c.name as category_name,
  c.icon as category_icon,
  coalesce(c.uses_menu_layout or pc.uses_menu_layout, false) as uses_menu_layout,
  pc.id as parent_category_id,
  pc.slug as parent_category_slug,
  pc.name as parent_category_name,
  b.city_id,
  ci.slug as city_slug,
  ci.name as city_name,
  st.uf as state_uf,
  b.neighborhood_id,
  n.slug as neighborhood_slug,
  n.name as neighborhood_name,
  b.address_line,
  b.address_complement,
  b.postal_code,
  b.latitude,
  b.longitude,
  b.phone_e164,
  b.whatsapp_e164,
  case when pl.can_instagram then b.instagram end as instagram,
  case when pl.can_description then b.description end as description,
  case when pl.can_logo then b.logo_path end as logo_path,
  case when pl.can_cover then b.cover_path end as cover_path,
  pl.code as plan_code,
  (not pl.is_default) as has_vitrine,
  pl.highlight_in_listing as is_highlighted,
  pl.can_products as shows_products,
  pl.can_gallery as shows_gallery,
  exists (
    select 1 from public.featured_businesses f
    where f.business_id = b.id and now() >= f.starts_at and now() < f.ends_at
  ) as is_featured,
  public.is_open_at(b.id) as is_open_now,
  b.is_demo,
  b.approved_at,
  b.created_at,
  b.updated_at
from public.businesses b
join public.categories c on c.id = b.category_id
left join public.categories pc on pc.id = c.parent_id
join public.cities ci on ci.id = b.city_id
join public.states st on st.id = ci.state_id
join public.neighborhoods n on n.id = b.neighborhood_id
cross join lateral public.business_plan(b.id) pl
where b.status = 'approved';

-- Busca/listagem pública. Devolve ids ordenados + total; os dados vêm da view.
create or replace function public.search_businesses(
  p_city text default null,
  p_neighborhood text default null,
  p_category text default null,
  p_query text default null,
  p_open_now boolean default false,
  p_featured boolean default false,
  p_vitrine boolean default false,
  p_sort text default 'relevance',
  p_lat double precision default null,
  p_lng double precision default null,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (id uuid, distance_km double precision, rank real, total_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(public.immutable_unaccent(lower(coalesce(p_query, '')))), '');
  v_tsq tsquery;
begin
  if v_q is not null then
    v_tsq := websearch_to_tsquery('public.pt_unaccent', v_q);
  end if;
  return query
  with base as (
    select
      b.id,
      public.distance_km(p_lat, p_lng, b.latitude, b.longitude) as dist,
      case when v_q is null then 0::real
        else (coalesce(ts_rank(b.search_vector, v_tsq), 0)
              + extensions.strict_word_similarity(v_q, public.immutable_unaccent(lower(b.name))))::real
      end as rnk,
      exists (select 1 from public.featured_businesses f
              where f.business_id = b.id and now() >= f.starts_at and now() < f.ends_at) as featured,
      not (public.business_plan(b.id)).is_default as vitrine,
      b.approved_at
    from public.businesses b
    join public.cities ci on ci.id = b.city_id
    join public.neighborhoods n on n.id = b.neighborhood_id
    join public.categories c on c.id = b.category_id
    left join public.categories pc on pc.id = c.parent_id
    where b.status = 'approved'
      and (p_city is null or ci.slug = p_city)
      and (p_neighborhood is null or n.slug = p_neighborhood)
      and (p_category is null or c.slug = p_category or pc.slug = p_category)
      and (v_q is null
           or b.search_vector @@ v_tsq
           or extensions.strict_word_similarity(v_q, public.immutable_unaccent(lower(b.name))) >= 0.5
           or public.immutable_unaccent(lower(b.name)) like '%' || v_q || '%'
           or public.immutable_unaccent(lower(c.name)) like '%' || v_q || '%')
      and (not p_open_now or public.is_open_at(b.id) is true)
  ), filtered as (
    select * from base
    where (not p_featured or base.featured)
      and (not p_vitrine or base.vitrine)
  )
  select f.id, f.dist, f.rnk, count(*) over ()
  from filtered f
  order by
    case when p_sort = 'nearest' then f.dist end asc nulls last,
    case when p_sort = 'recent' then f.approved_at end desc nulls last,
    case when p_sort = 'relevance' and v_q is not null then f.rnk end desc nulls last,
    f.featured desc,
    f.vitrine desc,
    f.approved_at desc nulls last,
    f.id
  limit least(greatest(p_limit, 1), 60)
  offset greatest(p_offset, 0);
end;
$$;

-- Contagem pública por categoria em um bairro (usada para noindex e chips).
create or replace function public.category_counts(p_city text, p_neighborhood text default null)
returns table (category_id uuid, parent_id uuid, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.parent_id, count(*)
  from public.businesses b
  join public.cities ci on ci.id = b.city_id
  join public.neighborhoods n on n.id = b.neighborhood_id
  join public.categories c on c.id = b.category_id
  where b.status = 'approved'
    and ci.slug = p_city
    and (p_neighborhood is null or n.slug = p_neighborhood)
  group by c.id, c.parent_id
$$;

---------------------------------------------------------------------------
-- Métricas (somente o servidor chama, com service_role)
---------------------------------------------------------------------------
create or replace function public.track_event(
  p_business_id uuid,
  p_event_type public.metric_event_type,
  p_session_hash text,
  p_product_id uuid default null,
  p_viewer_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_rows integer;
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select owner_id into v_owner from public.businesses where id = p_business_id and status = 'approved';
  if v_owner is null then
    return false;
  end if;
  if p_viewer_id is not null and (p_viewer_id = v_owner) then
    return false; -- visita do próprio dono
  end if;
  if (p_event_type = 'product_view') <> (p_product_id is not null) then
    return false;
  end if;
  if p_product_id is not null and not exists (
    select 1 from public.products where id = p_product_id and business_id = p_business_id
  ) then
    return false;
  end if;

  insert into public.metric_events (business_id, product_id, event_type, session_hash, day)
  values (p_business_id, p_product_id, p_event_type, p_session_hash, v_day)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false; -- já contado nesta sessão hoje
  end if;

  insert into public.business_metrics as m (business_id, day, page_views, whatsapp_clicks, phone_clicks, product_views)
  values (
    p_business_id, v_day,
    (p_event_type = 'page_view')::int,
    (p_event_type = 'whatsapp_click')::int,
    (p_event_type = 'phone_click')::int,
    (p_event_type = 'product_view')::int
  )
  on conflict (business_id, day) do update set
    page_views = m.page_views + excluded.page_views,
    whatsapp_clicks = m.whatsapp_clicks + excluded.whatsapp_clicks,
    phone_clicks = m.phone_clicks + excluded.phone_clicks,
    product_views = m.product_views + excluded.product_views;
  return true;
end;
$$;

-- Janela fixa de limite de taxa. Retorna true se ainda está dentro do limite.
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end;
$$;

-- Estatísticas do painel. Plano sem estatísticas detalhadas recebe só os
-- totais dos últimos 30 dias, independentemente do período pedido.
create or replace function public.business_stats(
  p_business_id uuid,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_detailed boolean;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_from date;
  v_to date;
  v_result jsonb;
begin
  if not exists (
    select 1 from public.businesses
    where id = p_business_id and (owner_id = (select auth.uid()) or public.is_admin())
  ) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  v_detailed := public.business_has(p_business_id, 'detailed_stats');
  if v_detailed then
    v_to := least(coalesce(p_to, v_today), v_today);
    v_from := greatest(coalesce(p_from, v_to - 29), v_to - 365);
  else
    v_to := v_today;
    v_from := v_today - 29;
  end if;

  select jsonb_build_object(
    'detailed', v_detailed,
    'from', v_from,
    'to', v_to,
    'totals', (
      select jsonb_build_object(
        'page_views', coalesce(sum(page_views), 0),
        'whatsapp_clicks', coalesce(sum(whatsapp_clicks), 0),
        'phone_clicks', coalesce(sum(phone_clicks), 0),
        'product_views', coalesce(sum(product_views), 0)
      )
      from public.business_metrics
      where business_id = p_business_id and day between v_from and v_to
    ),
    'daily', case when v_detailed then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day::date,
        'page_views', coalesce(m.page_views, 0),
        'whatsapp_clicks', coalesce(m.whatsapp_clicks, 0),
        'phone_clicks', coalesce(m.phone_clicks, 0),
        'product_views', coalesce(m.product_views, 0)
      ) order by d.day), '[]'::jsonb)
      from generate_series(v_from, v_to, interval '1 day') as d(day)
      left join public.business_metrics m on m.business_id = p_business_id and m.day = d.day::date
    ) end,
    'products', case when v_detailed then (
      select coalesce(jsonb_agg(jsonb_build_object('product_id', x.product_id, 'name', x.name, 'views', x.views) order by x.views desc), '[]'::jsonb)
      from (
        select e.product_id, p.name, count(*) as views
        from public.metric_events e join public.products p on p.id = e.product_id
        where e.business_id = p_business_id and e.event_type = 'product_view' and e.day between v_from and v_to
        group by e.product_id, p.name
      ) x
    ) end
  ) into v_result;
  return v_result;
end;
$$;

---------------------------------------------------------------------------
-- Assinaturas (fluxo manual)
---------------------------------------------------------------------------
create or replace function public.request_subscription(p_business_id uuid, p_plan_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_id uuid;
begin
  if not exists (select 1 from public.businesses where id = p_business_id and owner_id = (select auth.uid())) then
    raise exception 'Estabelecimento não encontrado.' using errcode = '42501';
  end if;
  select * into v_plan from public.plans where code = p_plan_code and is_active and is_public and not is_default;
  if v_plan.id is null then
    raise exception 'Plano indisponível.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.subscriptions where business_id = p_business_id and status = 'pending') then
    raise exception 'Já existe uma solicitação em análise.' using errcode = '23505';
  end if;
  insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, requested_by)
  values (p_business_id, v_plan.id, 'pending', v_plan.price_cents, 'manual', (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cancel_subscription_request(p_subscription_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions s
     set status = 'canceled', canceled_at = now()
    from public.businesses b
   where s.id = p_subscription_id
     and s.status = 'pending'
     and b.id = s.business_id
     and b.owner_id = (select auth.uid());
  if not found then
    raise exception 'Solicitação não encontrada.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_activate_subscription(
  p_subscription_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  update public.subscriptions
     set status = 'active', starts_at = p_starts_at, ends_at = p_ends_at,
         activated_by = (select auth.uid()), activated_at = now(),
         notes = coalesce(p_notes, notes)
   where id = p_subscription_id and status in ('pending', 'active');
  if not found then
    raise exception 'Assinatura não encontrada.' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('subscription.activate', 'subscriptions', p_subscription_id,
    jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at, 'notes', p_notes));
end;
$$;

create or replace function public.admin_grant_subscription(
  p_business_id uuid,
  p_plan_code text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  select * into v_plan from public.plans where code = p_plan_code and not is_default;
  if v_plan.id is null then
    raise exception 'Plano inválido.' using errcode = 'P0002';
  end if;
  insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, activated_by, activated_at, notes)
  values (p_business_id, v_plan.id, 'active', v_plan.price_cents, 'manual', p_starts_at, p_ends_at, (select auth.uid()), now(), p_notes)
  returning id into v_id;
  perform public.log_admin_action('subscription.grant', 'subscriptions', v_id,
    jsonb_build_object('business_id', p_business_id, 'plan', p_plan_code, 'starts_at', p_starts_at, 'ends_at', p_ends_at));
  return v_id;
end;
$$;

create or replace function public.admin_cancel_subscription(p_subscription_id uuid, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  update public.subscriptions
     set status = 'canceled', canceled_at = now(), notes = coalesce(p_notes, notes)
   where id = p_subscription_id and status in ('pending', 'active');
  if not found then
    raise exception 'Assinatura não encontrada.' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('subscription.cancel', 'subscriptions', p_subscription_id, jsonb_build_object('notes', p_notes));
end;
$$;

-- Marca como expiradas as assinaturas vencidas (o plano vigente já é
-- calculado pela data; isto só mantém o status coerente para relatórios).
create or replace function public.expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  update public.subscriptions set status = 'expired' where status = 'active' and ends_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

---------------------------------------------------------------------------
-- Administração
---------------------------------------------------------------------------
create or replace function public.log_admin_action(p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Auditoria genérica: toda escrita feita por um admin nas tabelas abaixo.
create or replace function public.audit_admin_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_changes jsonb := '{}';
  k text;
begin
  if not public.is_admin() then
    return null;
  end if;
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old) - 'search_vector';
    perform public.log_admin_action(tg_table_name || '.delete', tg_table_name, (v_row ->> 'id')::uuid, jsonb_build_object('before', v_row));
  elsif tg_op = 'INSERT' then
    v_row := to_jsonb(new) - 'search_vector';
    perform public.log_admin_action(tg_table_name || '.insert', tg_table_name, (v_row ->> 'id')::uuid, jsonb_build_object('after', v_row));
  else
    v_row := to_jsonb(new) - 'search_vector' - 'updated_at';
    v_old := to_jsonb(old) - 'search_vector' - 'updated_at';
    for k in select jsonb_object_keys(v_row) loop
      if v_row -> k is distinct from v_old -> k then
        v_changes := v_changes || jsonb_build_object(k, jsonb_build_object('from', v_old -> k, 'to', v_row -> k));
      end if;
    end loop;
    if v_changes <> '{}'::jsonb then
      perform public.log_admin_action(tg_table_name || '.update', tg_table_name, (v_row ->> 'id')::uuid, v_changes);
    end if;
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'states','cities','neighborhoods','categories','plans','businesses','business_hours',
    'business_photos','product_categories','products','featured_businesses','user_roles','profiles'
  ] loop
    execute format('create trigger audit_admin_write after insert or update or delete on public.%I for each row execute function public.audit_admin_write()', t);
  end loop;
end $$;

create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'businesses_total', (select count(*) from public.businesses),
    'businesses_by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.businesses group by status) s),
    'businesses_premium', (select count(*) from public.businesses b where not (public.business_plan(b.id)).is_default),
    'businesses_free', (select count(*) from public.businesses b where (public.business_plan(b.id)).is_default),
    'users_total', (select count(*) from auth.users),
    'neighborhoods_total', (select count(*) from public.neighborhoods where is_active),
    'whatsapp_clicks_30d', (select coalesce(sum(whatsapp_clicks), 0) from public.business_metrics where day > v_today - 30),
    'page_views_30d', (select coalesce(sum(page_views), 0) from public.business_metrics where day > v_today - 30),
    'new_businesses_30d', (select count(*) from public.businesses where created_at > now() - interval '30 days'),
    'subscriptions_active', (select count(*) from public.subscriptions where status = 'active' and now() between starts_at and ends_at),
    'subscriptions_pending', (select count(*) from public.subscriptions where status = 'pending'),
    'mrr_cents', (
      select coalesce(sum(
        case p.billing_interval when 'year' then (s.price_cents - s.discount_cents) / 12 else (s.price_cents - s.discount_cents) end
      ), 0)
      from public.subscriptions s join public.plans p on p.id = s.plan_id
      where s.status = 'active' and now() between s.starts_at and s.ends_at
    )
  );
end;
$$;

-- Lista de usuários para o admin (auth.users não é exposto pela API).
create or replace function public.admin_list_users(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, email text, full_name text, phone_e164 text, roles public.app_role[],
  email_confirmed_at timestamptz, created_at timestamptz, last_sign_in_at timestamptz,
  businesses_count bigint, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, p.full_name, p.phone_e164,
    coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = u.id), '{}'),
    u.email_confirmed_at, u.created_at, u.last_sign_in_at,
    (select count(*) from public.businesses b where b.owner_id = u.id),
    count(*) over ()
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p_search is null or p_search = ''
     or u.email ilike '%' || p_search || '%'
     or p.full_name ilike '%' || p_search || '%'
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

-- E-mail confirmado do dono (o admin vê antes de aprovar).
create or replace function public.admin_business_owner(p_business_id uuid)
returns table (owner_id uuid, email text, full_name text, phone_e164 text, email_confirmed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores.' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, p.full_name, p.phone_e164, u.email_confirmed_at
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  left join public.profiles p on p.id = u.id
  where b.id = p_business_id;
end;
$$;
