-- =============================================================================
-- Radar de Imprensa — candidatos a duplicidade para a prévia de importação
-- =============================================================================
create or replace function public.import_duplicate_candidates(
  p_names text[],
  p_emails text[] default '{}'
)
returns table (id uuid, full_name text, outlet_names text[], emails text[])
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform app_private.require_admin();
  if cardinality(coalesce(p_names, '{}')) > 5000 then
    raise exception 'Máximo de 5000 nomes por consulta' using errcode = '22023';
  end if;
  perform set_config('pg_trgm.similarity_threshold', '0.5', true);

  return query
  with names as (
    select distinct public.f_normalize(n) as n from unnest(coalesce(p_names, '{}')) n where public.f_normalize(n) is not null
  ),
  matched as (
    select distinct j.id
    from public.journalists j
    join names on j.search_name % names.n or j.search_name like names.n || '%'
    where j.merged_into_id is null
    union
    select distinct c.journalist_id
    from public.journalist_contacts c
    where lower(c.contact_value) = any (select lower(e) from unnest(coalesce(p_emails, '{}')) e)
  )
  select j.id, j.full_name,
    coalesce((select array_agg(distinct o.name) from public.journalist_employments e
               join public.media_outlets o on o.id = e.media_outlet_id where e.journalist_id = j.id), '{}'),
    coalesce((select array_agg(lower(c.contact_value)) from public.journalist_contacts c
               where c.journalist_id = j.id and c.contact_type = 'email_profissional'), '{}')
  from public.journalists j
  where j.id in (select m.id from matched m)
  limit 20000;
end;
$$;

revoke execute on function public.import_duplicate_candidates(text[], text[]) from anon, public;
grant execute on function public.import_duplicate_candidates(text[], text[]) to authenticated, service_role;
