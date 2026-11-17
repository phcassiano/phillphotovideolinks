-- Imagens enviadas pelo comerciante precisam estar na pasta do próprio negócio
-- (<business_id>/...). Evita apontar para arquivos de outra loja.
create or replace function public.media_path_ok(p_business_id uuid, p_path text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_path is null or p_path like p_business_id::text || '/%'
$$;

create or replace function public.guard_media_paths()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if tg_table_name = 'businesses' then
    if (new.logo_path is distinct from old.logo_path and not public.media_path_ok(new.id, new.logo_path))
      or (new.cover_path is distinct from old.cover_path and not public.media_path_ok(new.id, new.cover_path)) then
      raise exception 'Imagem inválida.' using errcode = '42501';
    end if;
  elsif tg_table_name = 'business_photos' then
    if (tg_op = 'INSERT' or new.path is distinct from old.path) and not public.media_path_ok(new.business_id, new.path) then
      raise exception 'Imagem inválida.' using errcode = '42501';
    end if;
  elsif tg_table_name = 'products' then
    if (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path) and not public.media_path_ok(new.business_id, new.photo_path) then
      raise exception 'Imagem inválida.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger businesses_guard_media before update on public.businesses
  for each row execute function public.guard_media_paths();
create trigger business_photos_guard_media before insert or update on public.business_photos
  for each row execute function public.guard_media_paths();
create trigger products_guard_media before insert or update on public.products
  for each row execute function public.guard_media_paths();
