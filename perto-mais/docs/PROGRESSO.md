# Progresso

## Etapas
| # | Etapa | Situação |
|---|---|---|
| 1 | Fundação (schema, RLS, seed, tipos, layout) | ✅ |
| 2 | Navegação pública | ✅ |
| 3 | Mapa | ✅ |
| 4 | Comerciante | ✅ |
| 5 | Vitrine e planos | ✅ |
| 6 | Administração | ✅ |
| 7 | SEO, PWA, desempenho, acessibilidade | ✅ |
| 8 | Finalização | ✅ (falta só o que depende de você, abaixo) |

## Pronto
**Banco** — 19 tabelas com RLS negando por padrão, enums/checks/índices (GIN de busca, trigram, filtros), slugs únicos sem acento com sufixo, slugs reservados, horários com vários intervalos e virada de meia-noite (America/Sao_Paulo), plano vigente pela data (vencer oculta sem apagar), limites de plano no banco, imagens restritas à pasta da própria loja, métricas só via servidor com deduplicação por sessão/dia, auditoria de toda escrita de admin, limite de taxa.

**Público (SSR)** — home, seletor cidade/bairro com busca e geolocalização só no toque (cookie), categorias em dois níveis, `/:cidade`, `/:cidade/:bairro`, `/:cidade/:bairro/:categoria`, `/explorar` (busca com acento/erro de digitação), filtros (próximos, abertos, recentes, destaque, vitrine), paginação, estado vazio com chamada para anunciar, página do estabelecimento (cardápio ou catálogo, galeria, horários, mapa, rota, compartilhar), WhatsApp com mensagem padrão e por produto, aviso de demonstração, mapa com clusters e filtro, anuncie, planos, termos e privacidade (rascunhos).

**Comerciante** — cadastro com confirmação de e-mail, login, recuperação de senha, painel (situação, plano, estatísticas — gratuito vê só totais de 30 dias), edição com pino no mapa, horários, logo/capa/galeria (WebP comprimido no navegador), produtos e seções, solicitação/cancelamento de assinatura, exclusão de conta.

**Admin** — visão geral (inclui receita recorrente mensal), moderação (aprovar, rejeitar com motivo, suspender, editar, destacar por período, remover conteúdo, excluir), assinaturas (ativar com datas, criar, cancelar), usuários, cidades/bairros, categorias, planos, registro de ações.

**SEO/PWA** — title, description, canonical, Open Graph com imagem, JSON-LD LocalBusiness e BreadcrumbList, noindex em combinações vazias/filtros/demonstração, sitemap do banco, robots, manifest, ícones, service worker (só casco e estáticos; offline com página própria).

**Qualidade** — typecheck, lint e build limpos; 22 testes unitários, 28 de RLS (4 perfis), 52 cenários E2E executados (celular e desktop; os que alteram dados rodam uma vez) incluindo auditoria axe sem violações graves; LCP medido < 1 s em 4G simulado (servidor local).

## Depende de você
1. **Projeto Supabase de produção** — siga `docs/SETUP.md` (ou me autorize a criar pela integração).
2. **Deploy** — `docs/DEPLOY.md` (Vercel, *Root Directory* `perto-mais`).
3. **SMTP próprio** para os e-mails de confirmação (o padrão do Supabase tem limite baixo).
4. **Revisão jurídica** de `/termos` e `/privacidade` e um e-mail de contato real em `app/config/site.ts`.
5. **Nome definitivo** — trocar em `app/config/site.ts` e rodar `npm run brand:build`.

## Limitações conhecidas
- Painel trata uma conta = um estabelecimento (o banco aceita vários).
- Ao remover conteúdo pelo admin, o arquivo continua no Storage (fica inacessível pela página).
- LCP medido localmente; vale repetir com o PageSpeed Insights depois do deploy.
