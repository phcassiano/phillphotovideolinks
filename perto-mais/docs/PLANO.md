# Perto+ — Plano do MVP

> Nome provisório. Tudo que for marca (nome, slogan, mensagem do WhatsApp, cores de manifest) vem de `app/config/site.ts`.

## 1. Arquitetura

```
Navegador ──► React Router v7 (modo framework, SSR) ──► Supabase (Postgres + Auth + Storage + RLS)
                 │  loaders/actions no servidor           ▲
                 │  @supabase/ssr (sessão por cookie)      │ anon key (cliente e servidor)
                 │  rotas /api/* (métricas, uploads)      │ service_role (só servidor/scripts)
                 └─ painéis: TanStack Query no cliente ───┘
```

- **Páginas públicas** (`/`, listagens, estabelecimento, categorias, planos…) renderizam no servidor: o loader busca no Supabase com a sessão do cookie e devolve `meta` (title, description, canonical, Open Graph) e JSON-LD. É isso que o Google e o WhatsApp leem.
- **Painéis** (`/painel/*`, `/admin/*`): o loader do servidor só verifica sessão e papel (redireciona se não puder entrar); os dados são lidos e escritos no cliente com TanStack Query + supabase-js (RLS garante o que cada um pode fazer). Mutações que precisam de regra de servidor (cadastro, métricas, exclusão de conta) passam por `action`/rotas `/api/*` que revalidam com os **mesmos schemas Zod** usados no React Hook Form.
- **Regras de negócio no banco**: limites de plano, transições de status, proteção de campos sensíveis, deduplicação de métricas e auditoria são triggers/funções SQL. A interface só reflete.
- **Mapa** (Leaflet + OSM + markercluster) é carregado com `import()` dinâmico, só no cliente e só quando o mapa entra em tela.
- **PWA**: `manifest.webmanifest`, ícones e service worker próprio que faz cache do shell e de `/assets/*` (hash no nome). HTML de páginas e chamadas ao Supabase são *network-first* / não cacheados, para dados de estabelecimento nunca ficarem defasados.
- **Pagamentos**: interface `PaymentProvider` com implementação `manual` (o comerciante solicita, o admin confirma e ativa). Mercado Pago/Stripe entram depois como outra implementação + rota de webhook.

### Segredos
- Cliente recebe só `SUPABASE_URL` e `SUPABASE_ANON_KEY` (expostos via loader raiz, nunca `import.meta.env` com service role).
- `SUPABASE_SERVICE_ROLE_KEY` só em `app/lib/supabase/admin.server.ts` (o sufixo `.server` impede o bundle de cliente de importá-lo) e em `scripts/`.

## 2. Estrutura de pastas

```
perto-mais/
  app/
    config/site.ts            # nome, slogan, mensagem WhatsApp, URL base
    root.tsx  routes.ts  entry.server.tsx
    routes/                   # um arquivo por rota (public/, painel/, admin/, api/)
    components/ui/            # shadcn/ui
    components/               # cards, header, bottom-nav, mapa, etc.
    features/                 # lógica por domínio (business, products, metrics, location, plans…)
    lib/
      supabase/{server.ts,client.ts,admin.server.ts}
      schemas/                # Zod compartilhado cliente/servidor
      payments/               # PaymentProvider + manual
      phone.ts slug.ts whatsapp.ts seo.ts images.ts hours.ts
    types/database.ts         # gerado do banco (supabase gen types)
  public/                     # ícones, manifest, sw.js, imagens de demonstração
  supabase/
    config.toml
    migrations/               # versionadas
    seed.sql                  # dados-base + demonstração
  scripts/                    # create-admin, remove-demo, seed-users, gerar imagens demo
  tests/
    unit/                     # Vitest
    rls/                      # Vitest contra Supabase local, 4 perfis
    e2e/                      # Playwright
  docs/ PLANO.md PROGRESSO.md DECISOES.md SETUP.md DEPLOY.md
  CLAUDE.md
```

O app fica em `perto-mais/` porque a raiz do repositório já hospeda outros projetos (site de links, GitHub Pages). No Vercel, *Root Directory* = `perto-mais`.

## 3. Modelo de dados

Todas as tabelas: `id uuid` (PK, `gen_random_uuid()`), `created_at`, `updated_at` (trigger), RLS ligada e negando por padrão.

| Tabela | Campos principais |
|---|---|
| `profiles` | id = auth.users.id, full_name, phone |
| `user_roles` | user_id, role (`admin` \| `merchant`) — o usuário não escreve aqui |
| `states` | country_code, name, uf, slug |
| `cities` | state_id, name, slug (único, validado contra `reserved_slugs`), lat/lng, is_active |
| `reserved_slugs` | slug — rotas fixas que nenhuma cidade pode usar |
| `neighborhoods` | city_id, name, slug (único por cidade), lat/lng, sort_order, is_active |
| `categories` | parent_id (2 níveis), name, slug (único), icon (nome Lucide), sort_order, is_active |
| `plans` | code, name, price_cents, billing_interval, max_products, max_photos, can_logo, can_cover, can_description, can_instagram, can_gallery, can_products, can_detailed_stats, highlight_in_listing, is_public, sort_order |
| `businesses` | owner_id, slug, name, category_id, city_id, neighborhood_id, endereço, lat/lng, phone_e164, whatsapp_e164, instagram, description, logo_path, cover_path, keywords, status (`pending/approved/rejected/suspended`), status_reason, approved_at, is_demo, search_vector |
| `business_hours` | business_id, weekday (0–6), opens_at, closes_at — vários intervalos por dia; `closes_at <= opens_at` = vira a meia-noite |
| `business_photos` | business_id, path, caption, sort_order |
| `product_categories` | business_id, name, sort_order |
| `products` | business_id, product_category_id, name, description, price_cents, photo_path, is_available, is_featured, sort_order |
| `subscriptions` | business_id, plan_id, status (`pending/active/canceled/expired`), price_cents (cópia no momento), provider (`manual`), provider_ref, starts_at, ends_at, requested_by, activated_by, notes |
| `featured_businesses` | business_id, starts_at, ends_at, created_by |
| `metric_events` | business_id, product_id, event_type, session_hash, day — único por (negócio, produto, tipo, sessão, dia) |
| `business_metrics` | business_id, day, page_views, whatsapp_clicks, phone_clicks, product_views (agregado diário) |
| `admin_audit_log` | actor_id, action, entity, entity_id, details jsonb |
| `rate_limits` | key, window_start, hits — usado por cadastro e métricas |

Funções-chave (SQL): `is_admin()`, `business_plan(id)`, `business_has(id, feature)`, `is_open_at(id, ts)` (America/Sao_Paulo), `search_businesses(...)` (FTS português + unaccent + pg_trgm + filtros + distância + paginação), `track_event(...)` (só service_role), `request_subscription(...)`, `admin_set_business_status(...)`, `admin_activate_subscription(...)`, `admin_dashboard()`, `delete_my_account()`.

Leitura pública: view `public_businesses` (aprovados, sem owner_id, campos da Vitrine mascarados quando o plano vigente não os inclui, com `is_featured`, `has_vitrine`). Produtos/fotos públicos só de negócio aprovado com plano que os inclua.

Plano vigente = assinatura `active` com `now()` entre `starts_at` e `ends_at`; senão, gratuito. Vencer não apaga nada: o conteúdo só deixa de ser exposto.

## 4. Rotas

Públicas (SSR): `/`, `/explorar`, `/categorias`, `/mapa`, `/:cidade/:bairro`, `/:cidade/:bairro/:categoria`, `/estabelecimento/:slug`, `/anuncie`, `/planos`, `/login`, `/cadastro`, `/termos`, `/privacidade`, `/sitemap.xml`, `/robots.txt`.
Comerciante: `/painel`, `/painel/estabelecimento`, `/painel/produtos`, `/painel/assinatura` (+ `/painel/conta`).
Admin: `/admin`, `/admin/estabelecimentos`, `/admin/assinaturas`, `/admin/usuarios`, `/admin/cidades`, `/admin/categorias`, `/admin/planos`, `/admin/log`.
API: `/api/track`, `/api/location` (salva cookie), `/auth/callback`, `/logout`.

## 5. Ordem das etapas

1. **Fundação** — scaffold, CLAUDE.md, config do nome, tokens, layout/navegação, schema + RLS + seed + tipos, teste RLS base.
2. **Navegação pública** — localização (cookie), home, categorias, listagem com filtros e paginação, busca, página do estabelecimento, WhatsApp/telefone, métricas.
3. **Mapa** — Leaflet sob demanda, clusters, filtro por categoria.
4. **Comerciante** — cadastro, login, confirmação de e-mail, painel, edição, pino no mapa, horários, imagens (WebP no cliente).
5. **Vitrine e planos** — produtos, cardápio, limites no banco, solicitação de assinatura manual.
6. **Administração** — dashboard, aprovação, destaque, cadastros-base, assinaturas, log.
7. **SEO, PWA, desempenho, acessibilidade** — sitemap, robots, OG, JSON-LD, SW, auditoria de contraste.
8. **Finalização** — E2E, revisão de permissões, README, SETUP, DEPLOY.

Cada etapa fecha com build + typecheck + lint + testes verdes, telas checadas em 360/768/1280 px, `PROGRESSO.md` atualizado e commit.
