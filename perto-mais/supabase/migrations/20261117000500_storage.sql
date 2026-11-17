-- Perto+ · Storage: imagens dos estabelecimentos
-- Caminho: <business_id>/<tipo>/<arquivo>.webp — a primeira pasta define o dono.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-media', 'business-media', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_business_folder(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.businesses b
    where b.id::text = (storage.foldername(p_object_name))[1]
      and b.owner_id = (select auth.uid())
  )
$$;

-- Bucket público: a leitura por URL pública não depende de política.
-- Listar arquivos fica restrito ao dono e ao admin.
create policy business_media_read on storage.objects for select to authenticated
  using (bucket_id = 'business-media' and public.can_manage_business_folder(name));

create policy business_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'business-media' and public.can_manage_business_folder(name));

create policy business_media_update on storage.objects for update to authenticated
  using (bucket_id = 'business-media' and public.can_manage_business_folder(name))
  with check (bucket_id = 'business-media' and public.can_manage_business_folder(name));

create policy business_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'business-media' and public.can_manage_business_folder(name));
