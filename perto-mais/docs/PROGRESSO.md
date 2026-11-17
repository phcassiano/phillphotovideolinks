# Progresso

## Etapas
| # | Etapa | Situação |
|---|---|---|
| 1 | Fundação (schema, RLS, seed, tipos, layout) | ✅ pronta |
| 2 | Navegação pública | ✅ pronta |
| 3 | Mapa | ✅ pronta |
| 4 | Comerciante | ⏳ em andamento |
| 5 | Vitrine e planos | ⬜ |
| 6 | Administração | ⬜ |
| 7 | SEO, PWA, desempenho, acessibilidade | ⬜ (parte já feita: meta/OG/JSON-LD, manifest, ícones) |
| 8 | Finalização | ⬜ |

## Pronto
- Banco: 19 tabelas, enums, checks, índices (GIN de busca e trigram), RLS em todas, Storage com política por dono, auditoria de ações de admin, limites de plano no banco, métricas por RPC só do servidor, slugs únicos sem acento, slugs reservados.
- Seed local: Brasília + 4 bairros, 16 categorias (2 níveis), 20 estabelecimentos (3 pendentes, 10 com Vitrine e produtos), imagens próprias em `public/demo`, métricas de 30 dias, contas de teste.
- Público: home, seletor de cidade/bairro com busca e "Usar minha localização" (só no toque), cookie da localização, categorias, `/:cidade`, `/:cidade/:bairro`, `/:cidade/:bairro/:categoria`, `/explorar` com busca (acentos e erros leves), filtros (próximos, abertos, recentes, destaque, vitrine), paginação, estados vazios, página do estabelecimento (cardápio/catálogo, galeria, horários, mapa, rota, compartilhar), WhatsApp com mensagem padrão, aviso de demonstração, métricas de visualização/cliques/produto.
- Mapa: Leaflet + OSM carregado sob demanda, agrupamento, filtro por categoria, resumo ao tocar no pino.
- Páginas: anuncie, planos (do banco), termos e privacidade (rascunhos marcados).
- Testes: 22 unitários, 26 de RLS (4 perfis), 12 E2E (mobile e desktop).

## Falta
- Etapas 4 a 8 (cadastro/login, painel, produtos, assinatura, admin, sitemap/robots/service worker, revisão final).

## Depende de você
- Criar o projeto Supabase de produção (ou autorizar que eu crie pela integração) — ver `docs/SETUP.md` (será entregue na etapa 8; o passo a passo local já está no `CLAUDE.md`).
- Revisão jurídica dos textos de termos e privacidade.
- E-mail de contato real em `app/config/site.ts` (`contactEmail`).
