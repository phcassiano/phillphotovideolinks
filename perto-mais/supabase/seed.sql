-- ARQUIVO GERADO por scripts/demo/build.mjs — edite data.mjs e rode `npm run demo:build`.
-- Somente para desenvolvimento local: cria contas de teste com senhas conhecidas
-- e dados de demonstração (is_demo = true). Não rode em produção.
-- Para remover os dados de demonstração: npm run demo:remove

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000001', 'authenticated', 'authenticated', 'admin@perto.local', extensions.crypt('Perto+Admin123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Admin de Teste","phone_e164":null}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', jsonb_build_object('sub', '00000000-0000-4000-a000-000000000001', 'email', 'admin@perto.local', 'email_verified', true), 'email', now(), now(), now())
on conflict do nothing;
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-a000-000000000001', 'admin') on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000002', 'authenticated', 'authenticated', 'gratuito@perto.local', extensions.crypt('Perto+Teste123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Comerciante Gratuito","phone_e164":"+5561955550002"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', jsonb_build_object('sub', '00000000-0000-4000-a000-000000000002', 'email', 'gratuito@perto.local', 'email_verified', true), 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000003', 'authenticated', 'authenticated', 'vitrine@perto.local', extensions.crypt('Perto+Teste123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Comerciante Vitrine","phone_e164":"+5561955550003"}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000003', jsonb_build_object('sub', '00000000-0000-4000-a000-000000000003', 'email', 'vitrine@perto.local', 'email_verified', true), 'email', now(), now(), now())
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000004', 'authenticated', 'authenticated', 'demonstracao@perto.local', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"demo":true}'::jsonb, '{"full_name":"Dono Demonstração","phone_e164":null}'::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000004', jsonb_build_object('sub', '00000000-0000-4000-a000-000000000004', 'email', 'demonstracao@perto.local', 'email_verified', true), 'email', now(), now(), now())
on conflict do nothing;

-- Pizzaria Forno da Praça
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000003', 'pizzaria-forno-da-praca', 'Pizzaria Forno da Praça', c.id, ci.id, n.id, 'Quadra 8, Área Especial 12, Loja 3', -15.6521, -47.7899, '+556135550101', '+5561955550101', 'fornodapraca.demo', 'Pizzas de fermentação natural assadas no forno a lenha, com massa fina e borda crocante. Atendemos no salão, retirada e entrega no bairro.', array['pizza', 'delivery', 'forno a lenha', 'calzone']::text[], '/demo/pizzaria-forno-da-praca/logo.webp', '/demo/pizzaria-forno-da-praca/capa.webp', 'approved', now() - interval '40 days', true, now() - interval '45 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'pizzarias' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '18:00', '00:30'), (2, '18:00', '00:30'), (3, '18:00', '00:30'), (4, '18:00', '00:30'), (5, '18:00', '00:30'), (6, '18:00', '00:30')) as h(weekday, opens_at, closes_at)
where b.slug = 'pizzaria-forno-da-praca';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000003', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'pizzaria-forno-da-praca' and p.code = 'vitrine';
insert into public.featured_businesses (business_id, starts_at, ends_at)
select id, now() - interval '1 day', now() + interval '60 days' from public.businesses where slug = 'pizzaria-forno-da-praca';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/pizzaria-forno-da-praca/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'pizzaria-forno-da-praca';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/pizzaria-forno-da-praca/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'pizzaria-forno-da-praca';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/pizzaria-forno-da-praca/foto-3.webp', 'Detalhes (demonstração)', 3 from public.businesses where slug = 'pizzaria-forno-da-praca';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Pizzas', 1 from public.businesses where slug = 'pizzaria-forno-da-praca';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Pizza Margherita', 'Molho de tomate, muçarela, manjericão fresco.', 4990, '/demo/pizzaria-forno-da-praca/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pizzas'
where b.slug = 'pizzaria-forno-da-praca';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Pizza Calabresa', 'Calabresa fatiada, cebola roxa e azeitonas.', 4790, '/demo/pizzaria-forno-da-praca/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pizzas'
where b.slug = 'pizzaria-forno-da-praca';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Pizza Quatro Queijos', 'Muçarela, provolone, parmesão e gorgonzola.', 5490, '/demo/pizzaria-forno-da-praca/produto-1-3.webp', true, false, 3
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pizzas'
where b.slug = 'pizzaria-forno-da-praca';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Bebidas', 2 from public.businesses where slug = 'pizzaria-forno-da-praca';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Suco natural 500 ml', 'Laranja, maracujá ou limão.', 1200, '/demo/pizzaria-forno-da-praca/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Bebidas'
where b.slug = 'pizzaria-forno-da-praca';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Refrigerante lata', null, 700, '/demo/pizzaria-forno-da-praca/produto-2-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Bebidas'
where b.slug = 'pizzaria-forno-da-praca';

-- Açaí Ponto Roxo
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'acai-ponto-roxo', 'Açaí Ponto Roxo', c.id, ci.id, n.id, 'Quadra 10, Conjunto B, Loja 7', -15.656, -47.7948, null, '+5561955550102', null, 'Açaí batido na hora com mais de 20 complementos. Monte o seu copo do seu jeito.', array['açaí', 'acai', 'sorvete', 'cupuaçu']::text[], '/demo/acai-ponto-roxo/logo.webp', '/demo/acai-ponto-roxo/capa.webp', 'approved', now() - interval '39 days', true, now() - interval '44 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'acaiterias' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '13:00', '22:30'), (1, '13:00', '22:30'), (2, '13:00', '22:30'), (3, '13:00', '22:30'), (4, '13:00', '22:30'), (5, '13:00', '22:30'), (6, '13:00', '22:30')) as h(weekday, opens_at, closes_at)
where b.slug = 'acai-ponto-roxo';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'acai-ponto-roxo' and p.code = 'vitrine';
insert into public.featured_businesses (business_id, starts_at, ends_at)
select id, now() - interval '1 day', now() + interval '60 days' from public.businesses where slug = 'acai-ponto-roxo';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/acai-ponto-roxo/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'acai-ponto-roxo';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/acai-ponto-roxo/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'acai-ponto-roxo';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Copos de açaí', 1 from public.businesses where slug = 'acai-ponto-roxo';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Açaí 300 ml', 'Com dois complementos à escolha.', 1400, '/demo/acai-ponto-roxo/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Copos de açaí'
where b.slug = 'acai-ponto-roxo';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Açaí 500 ml', 'Com três complementos à escolha.', 2000, '/demo/acai-ponto-roxo/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Copos de açaí'
where b.slug = 'acai-ponto-roxo';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Açaí 700 ml', 'Com quatro complementos à escolha.', 2600, '/demo/acai-ponto-roxo/produto-1-3.webp', true, false, 3
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Copos de açaí'
where b.slug = 'acai-ponto-roxo';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Extras', 2 from public.businesses where slug = 'acai-ponto-roxo';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Cupuaçu 300 ml', 'Creme de cupuaçu batido na hora.', 1500, '/demo/acai-ponto-roxo/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Extras'
where b.slug = 'acai-ponto-roxo';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Leite em pó extra', null, 300, '/demo/acai-ponto-roxo/produto-2-2.webp', false, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Extras'
where b.slug = 'acai-ponto-roxo';

-- Restaurante Tempero de Casa
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'restaurante-tempero-de-casa', 'Restaurante Tempero de Casa', c.id, ci.id, n.id, 'Quadra Central, Bloco 5, Loja 2', -15.6546, -47.792, '+556135550103', '+5561955550103', null, 'Comida caseira feita todo dia: self-service no almoço e marmitas para levar. Feijoada aos sábados.', array['almoço', 'self-service', 'marmita', 'comida caseira']::text[], '/demo/restaurante-tempero-de-casa/logo.webp', '/demo/restaurante-tempero-de-casa/capa.webp', 'approved', now() - interval '38 days', true, now() - interval '43 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'restaurantes' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '11:00', '15:00'), (0, '18:00', '23:00'), (2, '11:00', '15:00'), (2, '18:00', '23:00'), (3, '11:00', '15:00'), (3, '18:00', '23:00'), (4, '11:00', '15:00'), (4, '18:00', '23:00'), (5, '11:00', '15:00'), (5, '18:00', '23:00'), (6, '11:00', '15:00'), (6, '18:00', '23:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'restaurante-tempero-de-casa';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'restaurante-tempero-de-casa' and p.code = 'vitrine';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/restaurante-tempero-de-casa/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'restaurante-tempero-de-casa';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/restaurante-tempero-de-casa/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'restaurante-tempero-de-casa';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/restaurante-tempero-de-casa/foto-3.webp', 'Detalhes (demonstração)', 3 from public.businesses where slug = 'restaurante-tempero-de-casa';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Pratos', 1 from public.businesses where slug = 'restaurante-tempero-de-casa';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Prato executivo', 'Arroz, feijão, salada e uma proteína do dia.', 2490, '/demo/restaurante-tempero-de-casa/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pratos'
where b.slug = 'restaurante-tempero-de-casa';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Feijoada completa', 'Somente aos sábados. Serve 1 pessoa.', 3490, '/demo/restaurante-tempero-de-casa/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pratos'
where b.slug = 'restaurante-tempero-de-casa';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Marmita média', 'Monte com 4 acompanhamentos.', 2200, '/demo/restaurante-tempero-de-casa/produto-1-3.webp', true, false, 3
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pratos'
where b.slug = 'restaurante-tempero-de-casa';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Sobremesas', 2 from public.businesses where slug = 'restaurante-tempero-de-casa';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Pudim de leite', 'Fatia.', 900, '/demo/restaurante-tempero-de-casa/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Sobremesas'
where b.slug = 'restaurante-tempero-de-casa';

-- Farmácia Bem Viver
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000002', 'farmacia-bem-viver', 'Farmácia Bem Viver', c.id, ci.id, n.id, 'Quadra 8, Conjunto A, Loja 1', -15.651, -47.787, '+556135550104', '+5561955550104', null, null, array['remédio', 'drogaria', 'medicamento', 'perfumaria']::text[], null, null, 'approved', now() - interval '37 days', true, now() - interval '42 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'farmacias' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '07:00', '23:00'), (1, '07:00', '23:00'), (2, '07:00', '23:00'), (3, '07:00', '23:00'), (4, '07:00', '23:00'), (5, '07:00', '23:00'), (6, '07:00', '23:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'farmacia-bem-viver';

-- Barbearia Navalha Fina
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'barbearia-navalha-fina', 'Barbearia Navalha Fina', c.id, ci.id, n.id, 'Quadra 6, Bloco C, Loja 10', -15.6575, -47.788, null, '+5561955550105', 'navalhafina.demo', 'Cortes clássicos e modernos, barba com toalha quente e ambiente climatizado. Atendimento por ordem de chegada ou horário marcado pelo WhatsApp.', array['corte', 'barba', 'cabelo masculino']::text[], '/demo/barbearia-navalha-fina/logo.webp', '/demo/barbearia-navalha-fina/capa.webp', 'approved', now() - interval '36 days', true, now() - interval '41 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'barbearias' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (2, '09:00', '19:00'), (3, '09:00', '19:00'), (4, '09:00', '19:00'), (5, '09:00', '19:00'), (6, '09:00', '19:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'barbearia-navalha-fina';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'barbearia-navalha-fina' and p.code = 'vitrine';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/barbearia-navalha-fina/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'barbearia-navalha-fina';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/barbearia-navalha-fina/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'barbearia-navalha-fina';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Serviços', 1 from public.businesses where slug = 'barbearia-navalha-fina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Corte masculino', 'Tesoura ou máquina.', 4000, '/demo/barbearia-navalha-fina/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Serviços'
where b.slug = 'barbearia-navalha-fina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Barba completa', 'Com toalha quente.', 3500, '/demo/barbearia-navalha-fina/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Serviços'
where b.slug = 'barbearia-navalha-fina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Corte + barba', null, 6500, '/demo/barbearia-navalha-fina/produto-1-3.webp', true, true, 3
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Serviços'
where b.slug = 'barbearia-navalha-fina';

-- Mercadinho Bom Preço
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'mercadinho-bom-preco', 'Mercadinho Bom Preço', c.id, ci.id, n.id, 'Quadra 12, Conjunto D, Loja 4', -15.659, -47.7965, '+556135550106', '+5561955550106', null, null, array['mercado', 'hortifruti', 'padaria', 'bebidas']::text[], null, null, 'approved', now() - interval '35 days', true, now() - interval '40 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'mercados' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '08:00', '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'), (5, '08:00', '18:00'), (6, '08:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'mercadinho-bom-preco';

-- Pet Shop Patas Felizes
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'pet-shop-patas-felizes', 'Pet Shop Patas Felizes', c.id, ci.id, n.id, 'Quadra 14, Bloco A, Loja 5', -15.6502, -47.798, null, '+5561955550107', null, 'Banho e tosa com hora marcada, rações e acessórios. Buscamos e levamos seu pet no bairro.', array['banho', 'tosa', 'ração', 'veterinário']::text[], '/demo/pet-shop-patas-felizes/logo.webp', '/demo/pet-shop-patas-felizes/capa.webp', 'approved', now() - interval '34 days', true, now() - interval '39 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'pet-shops' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '08:00', '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'), (5, '08:00', '18:00'), (6, '08:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'pet-shop-patas-felizes';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'pet-shop-patas-felizes' and p.code = 'vitrine';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/pet-shop-patas-felizes/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'pet-shop-patas-felizes';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/pet-shop-patas-felizes/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'pet-shop-patas-felizes';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Banho e tosa', 1 from public.businesses where slug = 'pet-shop-patas-felizes';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Banho porte pequeno', null, 4500, '/demo/pet-shop-patas-felizes/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Banho e tosa'
where b.slug = 'pet-shop-patas-felizes';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Banho e tosa porte médio', null, 8000, '/demo/pet-shop-patas-felizes/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Banho e tosa'
where b.slug = 'pet-shop-patas-felizes';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Produtos', 2 from public.businesses where slug = 'pet-shop-patas-felizes';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Ração premium 3 kg', 'Adultos, sabor frango.', 8990, '/demo/pet-shop-patas-felizes/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Produtos'
where b.slug = 'pet-shop-patas-felizes';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Petisco natural', 'Pacote 100 g.', 1590, '/demo/pet-shop-patas-felizes/produto-2-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Produtos'
where b.slug = 'pet-shop-patas-felizes';

-- Oficina Roda Viva
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'oficina-roda-viva', 'Oficina Roda Viva', c.id, ci.id, n.id, 'Setor de Oficinas, Lote 22', -15.662, -47.785, null, '+5561955550108', null, null, array['mecânico', 'troca de óleo', 'alinhamento']::text[], null, null, 'pending', null, true, now() - interval '38 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'servicos-automotivos' and ci.slug = 'brasilia' and n.slug = 'sobradinho'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '08:00', '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'), (5, '08:00', '18:00'), (6, '08:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'oficina-roda-viva';

-- Lanchonete Sabor da Esquina
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'lanchonete-sabor-da-esquina', 'Lanchonete Sabor da Esquina', c.id, ci.id, n.id, 'AR 13, Conjunto 4, Loja 1', -15.6432, -47.821, null, '+5561955550109', null, 'Do café da manhã ao lanche da noite: pão na chapa, salgados assados e hambúrguer artesanal.', array['lanche', 'hambúrguer', 'pastel', 'café da manhã']::text[], '/demo/lanchonete-sabor-da-esquina/logo.webp', '/demo/lanchonete-sabor-da-esquina/capa.webp', 'approved', now() - interval '32 days', true, now() - interval '37 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'lanchonetes' and ci.slug = 'brasilia' and n.slug = 'sobradinho-ii'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '07:00', '20:00'), (2, '07:00', '20:00'), (3, '07:00', '20:00'), (4, '07:00', '20:00'), (5, '07:00', '20:00'), (6, '07:00', '20:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'lanchonete-sabor-da-esquina';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'lanchonete-sabor-da-esquina' and p.code = 'vitrine';
insert into public.featured_businesses (business_id, starts_at, ends_at)
select id, now() - interval '1 day', now() + interval '60 days' from public.businesses where slug = 'lanchonete-sabor-da-esquina';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/lanchonete-sabor-da-esquina/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'lanchonete-sabor-da-esquina';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/lanchonete-sabor-da-esquina/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'lanchonete-sabor-da-esquina';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Lanches', 1 from public.businesses where slug = 'lanchonete-sabor-da-esquina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'X-Tudo artesanal', 'Pão brioche, blend 150 g, ovo, bacon e salada.', 2890, '/demo/lanchonete-sabor-da-esquina/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Lanches'
where b.slug = 'lanchonete-sabor-da-esquina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Misto quente', null, 900, '/demo/lanchonete-sabor-da-esquina/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Lanches'
where b.slug = 'lanchonete-sabor-da-esquina';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Salgados', 2 from public.businesses where slug = 'lanchonete-sabor-da-esquina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Coxinha de frango', null, 650, '/demo/lanchonete-sabor-da-esquina/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Salgados'
where b.slug = 'lanchonete-sabor-da-esquina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Esfirra de carne', null, 600, '/demo/lanchonete-sabor-da-esquina/produto-2-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Salgados'
where b.slug = 'lanchonete-sabor-da-esquina';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Bebidas', 3 from public.businesses where slug = 'lanchonete-sabor-da-esquina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Café coado', null, 400, '/demo/lanchonete-sabor-da-esquina/produto-3-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Bebidas'
where b.slug = 'lanchonete-sabor-da-esquina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Vitamina de banana', '400 ml.', 1000, '/demo/lanchonete-sabor-da-esquina/produto-3-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Bebidas'
where b.slug = 'lanchonete-sabor-da-esquina';

-- Salão Beleza Natural
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'salao-beleza-natural', 'Salão Beleza Natural', c.id, ci.id, n.id, 'AR 9, Conjunto 2, Casa 15', -15.6401, -47.825, null, '+5561955550110', 'belezanatural.demo', 'Cortes, coloração, tratamentos capilares e manicure. Produtos veganos e atendimento acolhedor.', array['cabelo', 'manicure', 'escova', 'progressiva']::text[], '/demo/salao-beleza-natural/logo.webp', '/demo/salao-beleza-natural/capa.webp', 'approved', now() - interval '31 days', true, now() - interval '36 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'saloes-de-beleza' and ci.slug = 'brasilia' and n.slug = 'sobradinho-ii'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (2, '09:00', '19:00'), (3, '09:00', '19:00'), (4, '09:00', '19:00'), (5, '09:00', '19:00'), (6, '09:00', '19:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'salao-beleza-natural';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'salao-beleza-natural' and p.code = 'vitrine';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/salao-beleza-natural/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'salao-beleza-natural';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/salao-beleza-natural/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'salao-beleza-natural';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/salao-beleza-natural/foto-3.webp', 'Detalhes (demonstração)', 3 from public.businesses where slug = 'salao-beleza-natural';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Cabelo', 1 from public.businesses where slug = 'salao-beleza-natural';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Corte feminino', null, 7000, '/demo/salao-beleza-natural/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Cabelo'
where b.slug = 'salao-beleza-natural';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Escova', null, 5000, '/demo/salao-beleza-natural/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Cabelo'
where b.slug = 'salao-beleza-natural';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Hidratação', null, 6000, '/demo/salao-beleza-natural/produto-1-3.webp', true, false, 3
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Cabelo'
where b.slug = 'salao-beleza-natural';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Unhas', 2 from public.businesses where slug = 'salao-beleza-natural';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Manicure e pedicure', null, 5500, '/demo/salao-beleza-natural/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Unhas'
where b.slug = 'salao-beleza-natural';

-- Ateliê Fio e Agulha
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'atelie-fio-e-agulha', 'Ateliê Fio e Agulha', c.id, ci.id, n.id, 'AR 17, Conjunto 8, Loja 3', -15.6455, -47.8188, null, '+5561955550111', null, 'Moda feminina feita no bairro e ajustes de roupa em até 48 horas.', array['roupa', 'costura', 'ajustes', 'moda feminina']::text[], '/demo/atelie-fio-e-agulha/logo.webp', '/demo/atelie-fio-e-agulha/capa.webp', 'approved', now() - interval '30 days', true, now() - interval '35 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'vestuario' and ci.slug = 'brasilia' and n.slug = 'sobradinho-ii'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '08:00', '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'), (5, '08:00', '18:00'), (6, '08:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'atelie-fio-e-agulha';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'atelie-fio-e-agulha' and p.code = 'vitrine';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/atelie-fio-e-agulha/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'atelie-fio-e-agulha';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/atelie-fio-e-agulha/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'atelie-fio-e-agulha';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Peças', 1 from public.businesses where slug = 'atelie-fio-e-agulha';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Vestido midi de linho', 'Tamanhos P ao GG.', 18900, '/demo/atelie-fio-e-agulha/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Peças'
where b.slug = 'atelie-fio-e-agulha';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Blusa de tricô', null, 9900, '/demo/atelie-fio-e-agulha/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Peças'
where b.slug = 'atelie-fio-e-agulha';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Ajustes', 2 from public.businesses where slug = 'atelie-fio-e-agulha';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Barra de calça', null, 2000, '/demo/atelie-fio-e-agulha/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Ajustes'
where b.slug = 'atelie-fio-e-agulha';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Ajuste de cintura', null, 3500, '/demo/atelie-fio-e-agulha/produto-2-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Ajustes'
where b.slug = 'atelie-fio-e-agulha';

-- Academia Movimento Total
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'academia-movimento-total', 'Academia Movimento Total', c.id, ci.id, n.id, 'AR 21, Lote 1', -15.638, -47.827, '+556135550112', '+5561955550112', null, null, array['musculação', 'funcional', 'pilates']::text[], null, null, 'approved', now() - interval '29 days', true, now() - interval '34 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'academias-e-esportes' and ci.slug = 'brasilia' and n.slug = 'sobradinho-ii'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '05:30', '23:00'), (2, '05:30', '23:00'), (3, '05:30', '23:00'), (4, '05:30', '23:00'), (5, '05:30', '23:00'), (6, '08:00', '14:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'academia-movimento-total';

-- Assistência Celular Conecta
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'assistencia-celular-conecta', 'Assistência Celular Conecta', c.id, ci.id, n.id, 'AR 13, Conjunto 1, Loja 9', -15.644, -47.823, null, '+5561955550113', null, null, array['celular', 'tela', 'bateria', 'conserto']::text[], null, null, 'pending', null, true, now() - interval '33 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'assistencia-tecnica' and ci.slug = 'brasilia' and n.slug = 'sobradinho-ii'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '08:00', '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'), (5, '08:00', '18:00'), (6, '08:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'assistencia-celular-conecta';

-- Restaurante Sabores do Cerrado
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'restaurante-sabores-do-cerrado', 'Restaurante Sabores do Cerrado', c.id, ci.id, n.id, 'Rua 3, Lote 40', -15.6801, -47.842, '+556135550114', '+5561955550114', 'saboresdocerrado.demo', 'Cozinha do Cerrado com ingredientes da região: galinhada com pequi, arroz com guariroba e doces de baru.', array['pequi', 'galinhada', 'comida goiana', 'almoço']::text[], '/demo/restaurante-sabores-do-cerrado/logo.webp', '/demo/restaurante-sabores-do-cerrado/capa.webp', 'approved', now() - interval '27 days', true, now() - interval '32 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'restaurantes' and ci.slug = 'brasilia' and n.slug = 'grande-colorado'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '11:00', '15:00'), (0, '18:00', '23:00'), (2, '11:00', '15:00'), (2, '18:00', '23:00'), (3, '11:00', '15:00'), (3, '18:00', '23:00'), (4, '11:00', '15:00'), (4, '18:00', '23:00'), (5, '11:00', '15:00'), (5, '18:00', '23:00'), (6, '11:00', '15:00'), (6, '18:00', '23:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'restaurante-sabores-do-cerrado';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'restaurante-sabores-do-cerrado' and p.code = 'vitrine';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/restaurante-sabores-do-cerrado/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'restaurante-sabores-do-cerrado';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/restaurante-sabores-do-cerrado/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'restaurante-sabores-do-cerrado';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/restaurante-sabores-do-cerrado/foto-3.webp', 'Detalhes (demonstração)', 3 from public.businesses where slug = 'restaurante-sabores-do-cerrado';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Pratos', 1 from public.businesses where slug = 'restaurante-sabores-do-cerrado';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Galinhada com pequi', 'Serve 2 pessoas.', 6900, '/demo/restaurante-sabores-do-cerrado/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pratos'
where b.slug = 'restaurante-sabores-do-cerrado';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Arroz com guariroba', 'Acompanha frango caipira.', 5400, '/demo/restaurante-sabores-do-cerrado/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pratos'
where b.slug = 'restaurante-sabores-do-cerrado';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Sobremesas', 2 from public.businesses where slug = 'restaurante-sabores-do-cerrado';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Doce de baru', null, 1200, '/demo/restaurante-sabores-do-cerrado/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Sobremesas'
where b.slug = 'restaurante-sabores-do-cerrado';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Pamonha doce', null, 900, '/demo/restaurante-sabores-do-cerrado/produto-2-2.webp', false, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Sobremesas'
where b.slug = 'restaurante-sabores-do-cerrado';

-- Calçados Passo Certo
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'calcados-passo-certo', 'Calçados Passo Certo', c.id, ci.id, n.id, 'Avenida Principal, Loja 15', -15.678, -47.8395, null, '+5561955550115', null, null, array['tênis', 'sapato', 'sandália', 'chinelo']::text[], null, null, 'approved', now() - interval '26 days', true, now() - interval '31 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'calcados' and ci.slug = 'brasilia' and n.slug = 'grande-colorado'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '08:00', '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'), (5, '08:00', '18:00'), (6, '08:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'calcados-passo-certo';

-- Reforma Fácil Materiais
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'reforma-facil-materiais', 'Reforma Fácil Materiais', c.id, ci.id, n.id, 'Rua 8, Galpão 2', -15.6822, -47.844, '+556135550116', '+5561955550116', null, null, array['material de construção', 'tinta', 'cimento', 'pedreiro']::text[], null, null, 'approved', now() - interval '25 days', true, now() - interval '30 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'construcao-e-reformas' and ci.slug = 'brasilia' and n.slug = 'grande-colorado'
on conflict (slug) do nothing;

-- Contabilidade Prumo
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'contabilidade-prumo', 'Contabilidade Prumo', c.id, ci.id, n.id, 'Rua 5, Sala 204', -15.677, -47.843, null, '+5561955550117', null, null, array['contador', 'MEI', 'imposto de renda']::text[], null, null, 'pending', null, true, now() - interval '29 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'servicos-profissionais' and ci.slug = 'brasilia' and n.slug = 'grande-colorado'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (1, '08:00', '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'), (5, '08:00', '18:00'), (6, '08:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'contabilidade-prumo';

-- Pizzaria Massa Fina
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'pizzaria-massa-fina', 'Pizzaria Massa Fina', c.id, ci.id, n.id, 'Setor Tradicional, Quadra 4, Loja 8', -15.62, -47.651, null, '+5561955550118', null, 'Pizzas de massa fina, esfihas abertas e rodízio às sextas-feiras.', array['pizza', 'esfiha', 'delivery']::text[], '/demo/pizzaria-massa-fina/logo.webp', '/demo/pizzaria-massa-fina/capa.webp', 'approved', now() - interval '23 days', true, now() - interval '28 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'pizzarias' and ci.slug = 'brasilia' and n.slug = 'planaltina'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '18:00', '00:30'), (2, '18:00', '00:30'), (3, '18:00', '00:30'), (4, '18:00', '00:30'), (5, '18:00', '00:30'), (6, '18:00', '00:30')) as h(weekday, opens_at, closes_at)
where b.slug = 'pizzaria-massa-fina';
insert into public.subscriptions (business_id, plan_id, status, price_cents, provider, starts_at, ends_at, requested_by, activated_at, notes)
select b.id, p.id, 'active', p.price_cents, 'manual', now() - interval '10 days', now() + interval '355 days', '00000000-0000-4000-a000-000000000004', now() - interval '10 days', 'Demonstração'
from public.businesses b, public.plans p where b.slug = 'pizzaria-massa-fina' and p.code = 'vitrine';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/pizzaria-massa-fina/foto-1.webp', 'Nosso espaço (demonstração)', 1 from public.businesses where slug = 'pizzaria-massa-fina';
insert into public.business_photos (business_id, path, caption, sort_order)
select id, '/demo/pizzaria-massa-fina/foto-2.webp', 'Atendimento (demonstração)', 2 from public.businesses where slug = 'pizzaria-massa-fina';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Pizzas', 1 from public.businesses where slug = 'pizzaria-massa-fina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Pizza Portuguesa', null, 4590, '/demo/pizzaria-massa-fina/produto-1-1.webp', true, true, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pizzas'
where b.slug = 'pizzaria-massa-fina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Pizza Frango com Catupiry', null, 4790, '/demo/pizzaria-massa-fina/produto-1-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Pizzas'
where b.slug = 'pizzaria-massa-fina';
insert into public.product_categories (business_id, name, sort_order)
select id, 'Esfihas', 2 from public.businesses where slug = 'pizzaria-massa-fina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Esfiha de carne', null, 550, '/demo/pizzaria-massa-fina/produto-2-1.webp', true, false, 1
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Esfihas'
where b.slug = 'pizzaria-massa-fina';
insert into public.products (business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order)
select b.id, pc.id, 'Esfiha de queijo', null, 550, '/demo/pizzaria-massa-fina/produto-2-2.webp', true, false, 2
from public.businesses b join public.product_categories pc on pc.business_id = b.id and pc.name = 'Esfihas'
where b.slug = 'pizzaria-massa-fina';

-- Drogaria Saúde Popular
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'drogaria-saude-popular', 'Drogaria Saúde Popular', c.id, ci.id, n.id, 'Setor Central, Quadra 2, Loja 1', -15.623, -47.6545, '+556135550119', '+5561955550119', null, null, array['remédio', 'farmácia popular', 'genéricos']::text[], null, null, 'approved', now() - interval '22 days', true, now() - interval '27 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'farmacias' and ci.slug = 'brasilia' and n.slug = 'planaltina'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '07:00', '23:00'), (1, '07:00', '23:00'), (2, '07:00', '23:00'), (3, '07:00', '23:00'), (4, '07:00', '23:00'), (5, '07:00', '23:00'), (6, '07:00', '23:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'drogaria-saude-popular';

-- Pastelaria Feira Livre
insert into public.businesses (owner_id, slug, name, category_id, city_id, neighborhood_id, address_line, latitude, longitude, phone_e164, whatsapp_e164, instagram, description, keywords, logo_path, cover_path, status, approved_at, is_demo, created_at)
select '00000000-0000-4000-a000-000000000004', 'pastelaria-feira-livre', 'Pastelaria Feira Livre', c.id, ci.id, n.id, 'Feira Permanente, Box 31', -15.6195, -47.656, null, '+5561955550120', null, null, array['pastel', 'caldo de cana', 'feira']::text[], null, null, 'approved', now() - interval '21 days', true, now() - interval '26 days'
from public.categories c, public.cities ci join public.neighborhoods n on n.city_id = ci.id
where c.slug = 'lanchonetes' and ci.slug = 'brasilia' and n.slug = 'planaltina'
on conflict (slug) do nothing;
insert into public.business_hours (business_id, weekday, opens_at, closes_at)
select b.id, h.weekday, h.opens_at::time, h.closes_at::time from public.businesses b,
(values (0, '07:00', '13:00'), (3, '07:00', '13:00'), (6, '07:00', '13:00')) as h(weekday, opens_at, closes_at)
where b.slug = 'pastelaria-feira-livre';

insert into public.business_metrics (business_id, day, page_views, whatsapp_clicks, phone_clicks, product_views)
select b.id, d::date,
  (abs(hashtext(b.slug || d::text)) % 25) + 3,
  (abs(hashtext(b.slug || d::text || 'w')) % 8),
  (abs(hashtext(b.slug || d::text || 'p')) % 3),
  case when exists (select 1 from public.products p where p.business_id = b.id) then (abs(hashtext(b.slug || d::text || 'v')) % 12) else 0 end
from public.businesses b, generate_series((now() at time zone 'America/Sao_Paulo')::date - 29, (now() at time zone 'America/Sao_Paulo')::date - 1, interval '1 day') d
where b.is_demo and b.status = 'approved'
on conflict (business_id, day) do nothing;
