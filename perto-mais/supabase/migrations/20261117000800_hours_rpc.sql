-- Substitui todos os horários de um estabelecimento em uma transação.
-- SECURITY INVOKER: as políticas de RLS de business_hours continuam valendo.
create or replace function public.set_business_hours(p_business_id uuid, p_hours jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 28 then
    raise exception 'Lista de horários inválida.' using errcode = '22023';
  end if;
  delete from public.business_hours where business_id = p_business_id;
  insert into public.business_hours (business_id, weekday, opens_at, closes_at)
  select p_business_id, (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time
  from jsonb_array_elements(p_hours) as h;
end;
$$;
revoke execute on function public.set_business_hours(uuid, jsonb) from public, anon;
