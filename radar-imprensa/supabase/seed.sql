-- =============================================================================
-- Radar de Imprensa — seed DEMONSTRATIVO (somente desenvolvimento)
-- -----------------------------------------------------------------------------
-- Todos os nomes, veículos e contatos são FICTÍCIOS. Os domínios usam o TLD
-- reservado ".example" (RFC 2606) e os telefones usam o DDD inexistente "00".
-- Não há dados pessoais reais neste arquivo.
-- =============================================================================

-- Em desenvolvimento, permite aprovar propostas do provedor demonstrativo.
update public.app_settings set value = '1' where key = 'verification.allow_demo_apply';

-- -----------------------------------------------------------------------------
-- Veículos fictícios
-- -----------------------------------------------------------------------------
insert into public.media_outlets (id, name, website, outlet_type, headquarters_city_id)
select o.id::uuid, o.name, o.website, o.outlet_type::public.outlet_type, l.id
from (values
  ('20000000-0000-4000-8000-000000000001', 'Portal Exemplo Piauí', 'https://portal-exemplo-pi.example', 'portal', '2211001'),
  ('20000000-0000-4000-8000-000000000002', 'Gazeta Fictícia do Piauí', 'https://gazeta-ficticia.example', 'jornal', '2211001'),
  ('20000000-0000-4000-8000-000000000003', 'TV Modelo Teresina', 'https://tv-modelo.example', 'tv', '2211001'),
  ('20000000-0000-4000-8000-000000000004', 'Rádio Amostra FM', 'https://radio-amostra.example', 'radio', '2207702'),
  ('20000000-0000-4000-8000-000000000005', 'Diário Exemplo Carioca', 'https://diario-exemplo-carioca.example', 'jornal', '3304557'),
  ('20000000-0000-4000-8000-000000000006', 'Portal Cultura Exemplo RJ', 'https://cultura-exemplo-rj.example', 'portal', '3304557'),
  ('20000000-0000-4000-8000-000000000007', 'Revista Ilustrativa Nacional', 'https://revista-ilustrativa.example', 'revista', '3550308'),
  ('20000000-0000-4000-8000-000000000008', 'Agência Fictícia de Notícias', 'https://agencia-ficticia.example', 'agencia', '5300108'),
  ('20000000-0000-4000-8000-000000000009', 'Portal Brasília Exemplo', 'https://brasilia-exemplo.example', 'portal', '5300108'),
  ('20000000-0000-4000-8000-000000000010', 'Canal Independente Exemplo', 'https://canal-independente.example', 'independente', '3550308'),
  ('20000000-0000-4000-8000-000000000011', 'Jornal Exemplo Paulista', 'https://jornal-exemplo-paulista.example', 'jornal', '3550308'),
  ('20000000-0000-4000-8000-000000000012', 'TV Exemplo Rio', 'https://tv-exemplo-rio.example', 'tv', '3304557'),
  ('20000000-0000-4000-8000-000000000013', 'Portal Amazônia Exemplo', 'https://amazonia-exemplo.example', 'portal', '1501402')
) as o(id, name, website, outlet_type, ibge)
left join public.locations l on l.ibge_code = o.ibge;

-- -----------------------------------------------------------------------------
-- Jornalistas fictícios
-- -----------------------------------------------------------------------------
insert into public.journalists
  (id, full_name, professional_name, biography, professional_status, verification_status,
   last_verified_at, last_checked_at, last_evidence_at, next_check_at, is_hidden)
values
  ('10000000-0000-4000-8000-000000000001', 'Ana Exemplo Ribeiro', 'Ana Ribeiro',
   'Repórter fictícia de política estadual (registro demonstrativo).', 'ativo', 'confirmado',
   now() - interval '10 days', now() - interval '10 days', now() - interval '10 days', now() + interval '20 days', false),
  ('10000000-0000-4000-8000-000000000002', 'Bruno Fictício Lima', null,
   'Editor fictício de política (registro demonstrativo).', 'ativo', 'provavel',
   null, now() - interval '40 days', now() - interval '40 days', now() - interval '2 days', false),
  ('10000000-0000-4000-8000-000000000003', 'Carla Modelo Sousa', null, null, 'ativo', 'nao_verificado',
   null, null, null, now() - interval '1 day', false),
  ('10000000-0000-4000-8000-000000000004', 'Diego Teste Andrade', null,
   'Ex-repórter de política no Piauí, hoje na cultura carioca (fictício).', 'ativo', 'confirmado',
   now() - interval '30 days', now() - interval '30 days', now() - interval '30 days', now() + interval '1 day', false),
  ('10000000-0000-4000-8000-000000000005', 'Elisa Exemplo Moraes', null, null, 'ativo', 'confirmado',
   now() - interval '5 days', now() - interval '5 days', now() - interval '5 days', now() + interval '25 days', false),
  ('10000000-0000-4000-8000-000000000006', 'Fábio Fictício Costa', null, null, 'ativo', 'desatualizado',
   now() - interval '400 days', now() - interval '200 days', now() - interval '400 days', now() - interval '3 days', false),
  ('10000000-0000-4000-8000-000000000007', 'Gabriela Modelo Nunes', 'Gabi Nunes',
   'Editora fictícia de economia e colunista independente.', 'ativo', 'confirmado',
   now() - interval '15 days', now() - interval '15 days', now() - interval '15 days', now() + interval '15 days', false),
  ('10000000-0000-4000-8000-000000000008', 'Heitor Teste Barros', null, null, 'ativo', 'confirmado',
   now() - interval '20 days', now() - interval '20 days', now() - interval '20 days', now() + interval '10 days', false),
  ('10000000-0000-4000-8000-000000000009', 'Íris Exemplo Prado', null, null, 'ativo', 'em_revisao',
   now() - interval '90 days', now() - interval '3 days', now() - interval '3 days', now() + interval '27 days', false),
  ('10000000-0000-4000-8000-000000000010', 'João Fictício Mendes', null, null, 'ativo', 'nao_verificado',
   null, null, null, null, false),
  ('10000000-0000-4000-8000-000000000011', 'Karina Modelo Teixeira', null, null, 'ativo', 'provavel',
   null, now() - interval '60 days', now() - interval '60 days', now() - interval '30 days', false),
  ('10000000-0000-4000-8000-000000000012', 'Lucas Teste Farias', null, null, 'ativo', 'confirmado',
   now() - interval '8 days', now() - interval '8 days', now() - interval '8 days', now() + interval '22 days', false),
  -- Homônimo: outra pessoa com o mesmo nome da ficha 1 (NÃO deve ser unificada automaticamente)
  ('10000000-0000-4000-8000-000000000013', 'Ana Exemplo Ribeiro', null,
   'Repórter fictícia de educação em São Paulo; homônima da ficha de Teresina.', 'ativo', 'nao_verificado',
   null, null, null, null, false),
  -- Provável duplicidade da ficha 1 (mesmo veículo, mesma assinatura)
  ('10000000-0000-4000-8000-000000000014', 'Ana E. Ribeiro', 'Ana Ribeiro', null, 'desconhecido', 'nao_verificado',
   null, null, null, null, false),
  ('10000000-0000-4000-8000-000000000015', 'Marina Exemplo Duarte', null, null, 'ativo', 'nao_verificado',
   null, null, null, now() - interval '5 days', false),
  ('10000000-0000-4000-8000-000000000016', 'Nelson Fictício Rocha', null,
   'Jornalista independente fictício de tecnologia.', 'freelancer', 'provavel',
   null, now() - interval '12 days', now() - interval '12 days', now() + interval '18 days', false),
  ('10000000-0000-4000-8000-000000000017', 'Olívia Modelo Pires', null, null, 'ativo', 'confirmado',
   now() - interval '2 days', now() - interval '2 days', now() - interval '2 days', now() + interval '28 days', false),
  ('10000000-0000-4000-8000-000000000018', 'Paulo Teste Viana', null,
   'Correspondente estadual fictício.', 'ativo', 'provavel',
   null, now() - interval '25 days', now() - interval '25 days', now() + interval '5 days', false),
  -- Perfil oculto por oposição ao tratamento: nunca aparece nas buscas
  ('10000000-0000-4000-8000-000000000019', 'Rafael Exemplo Oculto', null, null, 'ativo', 'confirmado',
   now() - interval '10 days', now() - interval '10 days', now() - interval '10 days', null, true),
  ('10000000-0000-4000-8000-000000000020', 'Sofia Exemplo Campos', null, null, 'ativo', 'confirmado',
   now() - interval '7 days', now() - interval '7 days', now() - interval '7 days', now() + interval '23 days', false);

-- -----------------------------------------------------------------------------
-- Vínculos (função auxiliar temporária)
-- -----------------------------------------------------------------------------
create function pg_temp.emp(
  p_journalist int, p_outlet int, p_ibge text, p_title text, p_slugs text[],
  p_current boolean, p_start date, p_end date, p_status public.verification_status
) returns uuid language plpgsql as $$
declare
  v_id uuid;
begin
  insert into public.journalist_employments
    (journalist_id, media_outlet_id, location_id, job_title, is_current, start_date, end_date,
     verification_status, last_verified_at)
  values (
    ('10000000-0000-4000-8000-' || lpad(p_journalist::text, 12, '0'))::uuid,
    ('20000000-0000-4000-8000-' || lpad(p_outlet::text, 12, '0'))::uuid,
    (select id from public.locations where ibge_code = p_ibge),
    p_title, p_current, p_start, p_end, p_status,
    case when p_status = 'confirmado' then now() - interval '10 days' end)
  returning id into v_id;
  insert into public.journalist_employment_categories (employment_id, category_id)
  select v_id, c.id from public.editorial_categories c where c.slug = any (p_slugs);
  return v_id;
end;
$$;

select pg_temp.emp(1, 1, '2211001', 'Repórter', array['politica', 'politica-local'], true, '2021-03-01', null, 'confirmado');
select pg_temp.emp(2, 2, '2211001', 'Editor de Política', array['politica'], true, '2019-01-15', null, 'provavel');
select pg_temp.emp(3, 3, '2211001', 'Repórter', array['cidades', 'policia'], true, null, null, 'nao_verificado');
-- Diego: vínculo ANTIGO de política no Piauí e vínculo ATUAL de cultura no Rio
select pg_temp.emp(4, 1, '2211001', 'Repórter de Política', array['politica'], false, '2018-02-01', '2024-06-30', 'confirmado');
select pg_temp.emp(4, 5, '3304557', 'Repórter de Cultura', array['cultura'], true, '2024-08-01', null, 'confirmado');
select pg_temp.emp(5, 6, '3304557', 'Repórter de Cultura', array['cultura', 'musica'], true, '2022-05-01', null, 'confirmado');
select pg_temp.emp(6, 5, '3303302', 'Crítico de Cinema', array['cultura', 'cinema'], true, '2015-01-01', null, 'desatualizado');
-- Gabriela: dois vínculos simultâneos
select pg_temp.emp(7, 7, '3550308', 'Editora de Economia', array['economia', 'mercado-financeiro'], true, '2020-01-01', null, 'confirmado');
select pg_temp.emp(7, 10, '3550308', 'Colunista', array['economia', 'negocios'], true, '2023-03-01', null, 'confirmado');
select pg_temp.emp(8, 8, '5300108', 'Correspondente', array['politica', 'congresso-nacional'], true, '2017-07-01', null, 'confirmado');
select pg_temp.emp(9, 9, '5300108', 'Repórter', array['politica-nacional'], true, '2021-01-01', null, 'em_revisao');
select pg_temp.emp(10, 4, '2207702', 'Apresentador', array['esportes', 'futebol'], true, null, null, 'nao_verificado');
select pg_temp.emp(11, 11, '3550308', 'Repórter de Saúde', array['saude', 'saude-publica'], true, '2020-09-01', null, 'provavel');
select pg_temp.emp(12, 12, '3304557', 'Repórter', array['policia', 'seguranca-publica'], true, '2019-04-01', null, 'confirmado');
select pg_temp.emp(13, 11, '3550308', 'Repórter de Educação', array['educacao', 'educacao-basica'], true, '2022-02-01', null, 'nao_verificado');
select pg_temp.emp(14, 1, '2211001', 'Repórter', array['politica'], false, '2020-01-01', '2021-02-28', 'nao_verificado');
select pg_temp.emp(15, 1, '2211001', 'Repórter de Economia', array['economia'], true, null, null, 'nao_verificado');
select pg_temp.emp(16, 10, '3550308', 'Jornalista Independente', array['tecnologia', 'inovacao-startups'], true, '2021-06-01', null, 'provavel');
select pg_temp.emp(17, 8, '5300108', 'Editora Internacional', array['internacional', 'america-latina'], true, '2018-01-01', null, 'confirmado');
-- Paulo: correspondente com atuação no estado inteiro (localidade = UF)
select pg_temp.emp(18, 1, '22', 'Correspondente Estadual', array['politica'], true, '2023-01-01', null, 'provavel');
select pg_temp.emp(19, 2, '2211001', 'Repórter', array['politica'], true, '2020-01-01', null, 'confirmado');
select pg_temp.emp(20, 13, '1501402', 'Repórter', array['meio-ambiente', 'clima'], true, '2022-01-01', null, 'confirmado');

-- -----------------------------------------------------------------------------
-- Evidências fictícias (URLs em domínios reservados)
-- -----------------------------------------------------------------------------
insert into public.source_evidence
  (journalist_id, related_entity_type, source_url, source_title, observed_at, evidence_type,
   evidence_summary, confidence_score, review_status)
values
  ('10000000-0000-4000-8000-000000000001', 'journalist', 'https://portal-exemplo-pi.example/equipe',
   'Expediente — Portal Exemplo Piauí', now() - interval '10 days', 'expediente',
   'Página de expediente fictícia lista Ana Ribeiro como repórter de política.', 0.9, 'aceita'),
  ('10000000-0000-4000-8000-000000000001', 'journalist', 'https://portal-exemplo-pi.example/politica/materia-exemplo-1',
   'Matéria assinada (fictícia)', now() - interval '12 days', 'assinatura_materia',
   'Matéria fictícia de política assinada por Ana Ribeiro.', 0.8, 'aceita'),
  ('10000000-0000-4000-8000-000000000014', 'journalist', 'https://portal-exemplo-pi.example/politica/materia-exemplo-1',
   'Matéria assinada (fictícia)', now() - interval '400 days', 'assinatura_materia',
   'A mesma assinatura fictícia aparece associada a esta ficha.', 0.6, 'pendente'),
  ('10000000-0000-4000-8000-000000000004', 'journalist', 'https://diario-exemplo-carioca.example/cultura/equipe',
   'Equipe de Cultura — Diário Exemplo Carioca', now() - interval '30 days', 'perfil_institucional',
   'Perfil institucional fictício confirma atuação em cultura no Rio.', 0.9, 'aceita'),
  ('10000000-0000-4000-8000-000000000005', 'journalist', 'https://cultura-exemplo-rj.example/equipe',
   'Equipe — Portal Cultura Exemplo RJ', now() - interval '5 days', 'expediente',
   'Expediente fictício.', 0.9, 'aceita'),
  ('10000000-0000-4000-8000-000000000008', 'journalist', 'https://agencia-ficticia.example/correspondentes',
   'Correspondentes — Agência Fictícia', now() - interval '20 days', 'perfil_institucional',
   'Lista fictícia de correspondentes em Brasília.', 0.9, 'aceita');

-- -----------------------------------------------------------------------------
-- Contatos profissionais fictícios
-- -----------------------------------------------------------------------------
insert into public.journalist_contacts
  (journalist_id, contact_type, contact_value, is_primary, visibility, professional_purpose,
   verification_status, last_verified_at, source_id)
values
  ('10000000-0000-4000-8000-000000000001', 'email_profissional', 'ana.ribeiro@portal-exemplo-pi.example', true, 'assinantes',
   'Pautas de política estadual', 'confirmado', now() - interval '10 days',
   (select id from public.source_evidence where source_url = 'https://portal-exemplo-pi.example/equipe')),
  ('10000000-0000-4000-8000-000000000001', 'telefone_profissional', '+55 (00) 90000-0001', false, 'assinantes',
   'Redação', 'confirmado', now() - interval '10 days', null),
  ('10000000-0000-4000-8000-000000000002', 'email_profissional', 'politica@gazeta-ficticia.example', true, 'restrito',
   null, 'provavel', null, null),
  ('10000000-0000-4000-8000-000000000004', 'email_profissional', 'diego.andrade@diario-exemplo-carioca.example', true, 'assinantes',
   'Pautas de cultura', 'confirmado', now() - interval '30 days', null),
  ('10000000-0000-4000-8000-000000000005', 'email_profissional', 'cultura@cultura-exemplo-rj.example', true, 'assinantes',
   'Redação de cultura', 'confirmado', now() - interval '5 days', null),
  ('10000000-0000-4000-8000-000000000005', 'formulario_contato', 'https://cultura-exemplo-rj.example/contato', false, 'assinantes',
   'Envio de releases', 'confirmado', now() - interval '5 days', null),
  ('10000000-0000-4000-8000-000000000007', 'email_profissional', 'economia@revista-ilustrativa.example', true, 'assinantes',
   'Pautas de economia', 'confirmado', now() - interval '15 days', null),
  ('10000000-0000-4000-8000-000000000008', 'email_profissional', 'heitor.barros@agencia-ficticia.example', true, 'assinantes',
   'Cobertura do Congresso', 'confirmado', now() - interval '20 days', null),
  ('10000000-0000-4000-8000-000000000012', 'telefone_profissional', '+55 (00) 90000-0012', true, 'assinantes',
   'Plantão da redação', 'confirmado', now() - interval '8 days', null),
  ('10000000-0000-4000-8000-000000000019', 'email_profissional', 'oculto@gazeta-ficticia.example', true, 'oculto',
   null, 'confirmado', now() - interval '10 days', null),
  ('10000000-0000-4000-8000-000000000020', 'email_profissional', 'sofia.campos@amazonia-exemplo.example', true, 'assinantes',
   'Meio ambiente', 'confirmado', now() - interval '7 days', null);

-- -----------------------------------------------------------------------------
-- Temas e identificadores
-- -----------------------------------------------------------------------------
insert into public.topics (name) values
  ('Assembleia Legislativa'), ('Orçamento público'), ('Lei de incentivo à cultura'),
  ('Cinema nacional'), ('Mercado de capitais'), ('Segurança pública'), ('Mudanças climáticas'),
  ('Startups'), ('Diplomacia'), ('Futebol regional');

insert into public.journalist_topics (journalist_id, topic_id, origin)
select j.id::uuid, t.id, 'admin'
from (values
  ('10000000-0000-4000-8000-000000000001', 'Assembleia Legislativa'),
  ('10000000-0000-4000-8000-000000000001', 'Orçamento público'),
  ('10000000-0000-4000-8000-000000000004', 'Lei de incentivo à cultura'),
  ('10000000-0000-4000-8000-000000000005', 'Lei de incentivo à cultura'),
  ('10000000-0000-4000-8000-000000000006', 'Cinema nacional'),
  ('10000000-0000-4000-8000-000000000007', 'Mercado de capitais'),
  ('10000000-0000-4000-8000-000000000008', 'Orçamento público'),
  ('10000000-0000-4000-8000-000000000012', 'Segurança pública'),
  ('10000000-0000-4000-8000-000000000016', 'Startups'),
  ('10000000-0000-4000-8000-000000000017', 'Diplomacia'),
  ('10000000-0000-4000-8000-000000000020', 'Mudanças climáticas'),
  ('10000000-0000-4000-8000-000000000010', 'Futebol regional')
) as j(id, topic)
join public.topics t on t.name = j.topic;

insert into public.journalist_identifiers (journalist_id, identifier_type, identifier_value) values
  ('10000000-0000-4000-8000-000000000001', 'registro_profissional', 'EXEMPLO-0001/PI'),
  ('10000000-0000-4000-8000-000000000013', 'registro_profissional', 'EXEMPLO-0002/SP');
