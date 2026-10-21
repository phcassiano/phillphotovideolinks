-- =============================================================================
-- Radar de Imprensa — dados de referência (necessários também em produção)
-- Editorias, unidades da federação, capitais e parâmetros globais.
-- Códigos IBGE: conferir periodicamente com https://www.ibge.gov.br/explica/codigos-dos-municipios.php
-- =============================================================================

-- Editorias principais
insert into public.editorial_categories (name, slug, sort_order) values
  ('Política', 'politica', 10),
  ('Economia', 'economia', 20),
  ('Cultura', 'cultura', 30),
  ('Cidades', 'cidades', 40),
  ('Polícia', 'policia', 50),
  ('Esportes', 'esportes', 60),
  ('Saúde', 'saude', 70),
  ('Educação', 'educacao', 80),
  ('Tecnologia', 'tecnologia', 90),
  ('Meio Ambiente', 'meio-ambiente', 100),
  ('Entretenimento', 'entretenimento', 110),
  ('Justiça', 'justica', 120),
  ('Internacional', 'internacional', 130)
on conflict (slug) do nothing;

-- Subeditorias
insert into public.editorial_categories (name, slug, parent_id, sort_order)
select s.name, s.slug, p.id, s.sort_order
from (values
  ('politica', 'Política Nacional', 'politica-nacional', 1),
  ('politica', 'Política Local', 'politica-local', 2),
  ('politica', 'Congresso Nacional', 'congresso-nacional', 3),
  ('politica', 'Eleições', 'eleicoes', 4),
  ('economia', 'Mercado Financeiro', 'mercado-financeiro', 1),
  ('economia', 'Agronegócio', 'agronegocio', 2),
  ('economia', 'Negócios', 'negocios', 3),
  ('cultura', 'Música', 'musica', 1),
  ('cultura', 'Cinema', 'cinema', 2),
  ('cultura', 'Literatura', 'literatura', 3),
  ('cultura', 'Artes Visuais', 'artes-visuais', 4),
  ('cidades', 'Mobilidade Urbana', 'mobilidade-urbana', 1),
  ('cidades', 'Habitação', 'habitacao', 2),
  ('policia', 'Segurança Pública', 'seguranca-publica', 1),
  ('esportes', 'Futebol', 'futebol', 1),
  ('saude', 'Saúde Pública', 'saude-publica', 1),
  ('educacao', 'Educação Básica', 'educacao-basica', 1),
  ('educacao', 'Ensino Superior', 'ensino-superior', 2),
  ('tecnologia', 'Inovação e Startups', 'inovacao-startups', 1),
  ('meio-ambiente', 'Clima', 'clima', 1),
  ('entretenimento', 'Televisão', 'televisao', 1),
  ('entretenimento', 'Celebridades', 'celebridades', 2),
  ('justica', 'Tribunais Superiores', 'tribunais-superiores', 1),
  ('internacional', 'América Latina', 'america-latina', 1)
) as s(parent_slug, name, slug, sort_order)
join public.editorial_categories p on p.slug = s.parent_slug
on conflict (slug) do nothing;

-- Unidades da federação (city_name nulo = estado inteiro)
insert into public.locations (state_code, state_name, city_name, ibge_code) values
  ('RO', 'Rondônia', null, '11'), ('AC', 'Acre', null, '12'), ('AM', 'Amazonas', null, '13'),
  ('RR', 'Roraima', null, '14'), ('PA', 'Pará', null, '15'), ('AP', 'Amapá', null, '16'),
  ('TO', 'Tocantins', null, '17'), ('MA', 'Maranhão', null, '21'), ('PI', 'Piauí', null, '22'),
  ('CE', 'Ceará', null, '23'), ('RN', 'Rio Grande do Norte', null, '24'), ('PB', 'Paraíba', null, '25'),
  ('PE', 'Pernambuco', null, '26'), ('AL', 'Alagoas', null, '27'), ('SE', 'Sergipe', null, '28'),
  ('BA', 'Bahia', null, '29'), ('MG', 'Minas Gerais', null, '31'), ('ES', 'Espírito Santo', null, '32'),
  ('RJ', 'Rio de Janeiro', null, '33'), ('SP', 'São Paulo', null, '35'), ('PR', 'Paraná', null, '41'),
  ('SC', 'Santa Catarina', null, '42'), ('RS', 'Rio Grande do Sul', null, '43'),
  ('MS', 'Mato Grosso do Sul', null, '50'), ('MT', 'Mato Grosso', null, '51'),
  ('GO', 'Goiás', null, '52'), ('DF', 'Distrito Federal', null, '53')
on conflict do nothing;

-- Capitais e alguns municípios de referência
insert into public.locations (state_code, state_name, city_name, ibge_code)
select s.state_code, s.state_name, c.city_name, c.ibge_code
from (values
  ('RO', 'Porto Velho', '1100205'), ('AC', 'Rio Branco', '1200401'), ('AM', 'Manaus', '1302603'),
  ('RR', 'Boa Vista', '1400100'), ('PA', 'Belém', '1501402'), ('AP', 'Macapá', '1600303'),
  ('TO', 'Palmas', '1721000'), ('MA', 'São Luís', '2111300'), ('PI', 'Teresina', '2211001'),
  ('PI', 'Parnaíba', '2207702'), ('CE', 'Fortaleza', '2304400'), ('RN', 'Natal', '2408102'),
  ('PB', 'João Pessoa', '2507507'), ('PE', 'Recife', '2611606'), ('AL', 'Maceió', '2704302'),
  ('SE', 'Aracaju', '2800308'), ('BA', 'Salvador', '2927408'), ('MG', 'Belo Horizonte', '3106200'),
  ('ES', 'Vitória', '3205309'), ('RJ', 'Rio de Janeiro', '3304557'), ('RJ', 'Niterói', '3303302'),
  ('SP', 'São Paulo', '3550308'), ('SP', 'Campinas', '3509502'), ('PR', 'Curitiba', '4106902'),
  ('SC', 'Florianópolis', '4205407'), ('RS', 'Porto Alegre', '4314902'),
  ('MS', 'Campo Grande', '5002704'), ('MT', 'Cuiabá', '5103403'), ('GO', 'Goiânia', '5208707'),
  ('DF', 'Brasília', '5300108')
) as c(state_code, city_name, ibge_code)
join public.locations s on s.state_code = c.state_code and s.city_name is null
on conflict do nothing;

-- Parâmetros globais (sem segredos)
insert into public.app_settings (key, value, description) values
  ('verification.interval_days', '30', 'Intervalo aproximado entre verificações periódicas de cada perfil (dias)'),
  ('verification.batch_size', '10', 'Quantidade de perfis processados por execução do verificador'),
  ('verification.schedule_limit', '200', 'Máximo de verificações agendadas por rodada diária'),
  ('verification.spread_hours', '20', 'Janela (horas) para distribuir as verificações agendadas'),
  ('verification.max_attempts', '3', 'Tentativas antes de marcar uma verificação como falha'),
  ('verification.outdated_after_days', '180', 'Dias sem confirmação para um registro confirmado ser marcado como desatualizado'),
  ('verification.allow_demo_apply', '0', 'Permite aplicar propostas do provedor demonstrativo (somente desenvolvimento: 1)'),
  ('rate_limit.search_per_minute', '60', 'Buscas por minuto por usuário'),
  ('rate_limit.profile_views_per_minute', '60', 'Perfis visualizados por minuto por usuário'),
  ('rate_limit.contact_profiles_per_day', '300', 'Perfis distintos com contatos consultados por dia por usuário'),
  ('rate_limit.exports_per_hour', '10', 'Exportações de mailing por hora por usuário'),
  ('rate_limit.suggestions_per_day', '20', 'Sugestões de correção por dia por usuário'),
  ('search.max_offset', '1000', 'Máximo de resultados navegáveis por busca (proteção contra varredura)'),
  ('export.max_rows', '500', 'Máximo de registros por exportação de mailing')
on conflict (key) do nothing;
