-- Promove a primeira conta a administrador principal.
-- Execute no SQL Editor do Supabase (ou psql) APÓS a pessoa se cadastrar pelo app.
-- Depois disso, novos papéis são concedidos pela tela /admin/usuarios.
update public.profiles
   set role = 'super_admin'
 where email = lower('SEU-EMAIL@DOMINIO');
