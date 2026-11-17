-- Perto+ · Dados-base necessários em produção (planos, slugs reservados,
-- primeira cidade e categorias). Dados de demonstração ficam em seed.sql.

insert into public.reserved_slugs (slug) values
  ('explorar'), ('categorias'), ('mapa'), ('estabelecimento'), ('anuncie'), ('planos'),
  ('login'), ('cadastro'), ('termos'), ('privacidade'), ('painel'), ('admin'), ('api'),
  ('auth'), ('logout'), ('sair'), ('conta'), ('busca'), ('buscar'), ('sobre'), ('contato'),
  ('ajuda'), ('recuperar-senha'), ('redefinir-senha'), ('sitemap-xml'), ('robots-txt'),
  ('assets'), ('demo'), ('icons'), ('static'), ('public'), ('manifest-webmanifest'), ('sw-js'),
  ('favicon-ico'), ('www'), ('app'), ('blog')
on conflict (slug) do nothing;

insert into public.plans (
  code, name, description, features, price_cents, billing_interval, max_products, max_photos,
  can_logo, can_cover, can_description, can_instagram, can_gallery, can_products,
  can_detailed_stats, highlight_in_listing, is_default, is_public, sort_order
) values
(
  'gratuito', 'Gratuito', 'Para aparecer nas buscas do seu bairro.',
  array['Cadastro do estabelecimento', 'Nome comercial e categoria', 'Endereço e posição no mapa',
        'Telefone e WhatsApp', 'Horário de funcionamento', 'Presença nas buscas',
        'Totais de visitas e cliques dos últimos 30 dias'],
  0, 'none', 0, 0,
  false, false, false, false, false, false, false, false, true, true, 1
),
(
  'vitrine', 'Vitrine', 'Sua loja completa na palma da mão do bairro.',
  array['Tudo do plano Gratuito', 'Logo e foto de capa', 'Descrição completa e Instagram',
        'Galeria com até 12 fotos', 'Catálogo ou cardápio com preços (até 100 itens)',
        'Destaque visual na listagem', 'Estatísticas detalhadas por período e por produto'],
  1990, 'month', 100, 12,
  true, true, true, true, true, true, true, true, false, true, 2
)
on conflict (code) do nothing;

insert into public.states (country_code, name, uf, slug)
values ('BR', 'Distrito Federal', 'DF', 'distrito-federal')
on conflict do nothing;

insert into public.cities (state_id, name, slug, latitude, longitude, sort_order)
select s.id, 'Brasília', 'brasilia', -15.7939, -47.8828, 1
from public.states s where s.uf = 'DF'
on conflict (slug) do nothing;

insert into public.neighborhoods (city_id, name, slug, latitude, longitude, sort_order)
select c.id, n.name, n.slug, n.lat, n.lng, n.ord
from public.cities c
cross join (values
  ('Sobradinho', 'sobradinho', -15.6533, -47.7915, 1),
  ('Sobradinho II', 'sobradinho-ii', -15.6427, -47.8224, 2),
  ('Grande Colorado', 'grande-colorado', -15.6795, -47.8411, 3),
  ('Planaltina', 'planaltina', -15.6214, -47.6528, 4)
) as n(name, slug, lat, lng, ord)
where c.slug = 'brasilia'
on conflict (city_id, slug) do nothing;

-- Categorias principais
insert into public.categories (name, slug, icon, uses_menu_layout, sort_order) values
  ('Alimentação', 'alimentacao', 'utensils', true, 1),
  ('Saúde', 'saude', 'heart-pulse', false, 2),
  ('Moda', 'moda', 'shirt', false, 3),
  ('Beleza e estética', 'beleza-e-estetica', 'sparkles', false, 4),
  ('Serviços automotivos', 'servicos-automotivos', 'car', false, 5),
  ('Construção e reformas', 'construcao-e-reformas', 'hammer', false, 6),
  ('Assistência técnica', 'assistencia-tecnica', 'wrench', false, 7),
  ('Pet shops', 'pet-shops', 'paw-print', false, 8),
  ('Academias e esportes', 'academias-e-esportes', 'dumbbell', false, 9),
  ('Serviços profissionais', 'servicos-profissionais', 'briefcase', false, 10),
  ('Outros', 'outros', 'store', false, 11)
on conflict (slug) do nothing;

-- Subcategorias
insert into public.categories (parent_id, name, slug, icon, uses_menu_layout, sort_order)
select p.id, s.name, s.slug, s.icon, s.menu, s.ord
from (values
  ('alimentacao', 'Restaurantes', 'restaurantes', 'utensils-crossed', true, 1),
  ('alimentacao', 'Lanchonetes', 'lanchonetes', 'sandwich', true, 2),
  ('alimentacao', 'Pizzarias', 'pizzarias', 'pizza', true, 3),
  ('alimentacao', 'Açaiterias', 'acaiterias', 'ice-cream-bowl', true, 4),
  ('alimentacao', 'Mercados', 'mercados', 'shopping-basket', false, 5),
  ('saude', 'Farmácias', 'farmacias', 'pill', false, 1),
  ('moda', 'Vestuário', 'vestuario', 'shirt', false, 1),
  ('moda', 'Calçados', 'calcados', 'footprints', false, 2),
  ('beleza-e-estetica', 'Salões de beleza', 'saloes-de-beleza', 'sparkles', false, 1),
  ('beleza-e-estetica', 'Barbearias', 'barbearias', 'scissors', false, 2)
) as s(parent_slug, name, slug, icon, menu, ord)
join public.categories p on p.slug = s.parent_slug
on conflict (slug) do nothing;
