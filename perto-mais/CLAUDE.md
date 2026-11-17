# Perto+ — guia para agentes e devs

Guia de comércio local. React Router v7 (modo framework, SSR) + Supabase. Detalhes em `docs/PLANO.md`.
Tudo roda a partir desta pasta (`perto-mais/`); a raiz do repositório hospeda outros projetos.

## Comandos
| | |
|---|---|
| `npm run dev` | servidor de desenvolvimento (http://localhost:5173) |
| `npm run build` / `npm start` | build de produção / servir o build |
| `npm run typecheck` | gera tipos de rota e roda `tsc` |
| `npm run lint` | ESLint |
| `npm test` | testes unitários (Vitest) |
| `npm run test:rls` | testes de permissão contra o Supabase local (precisa de `npm run db:start`) |
| `npm run test:e2e` | Playwright (sobe o app sozinho; precisa do Supabase local) |
| `npm run db:start` / `db:stop` | Supabase local (Docker) |
| `npm run db:reset` | recria o banco local: migrations + `supabase/seed.sql` |
| `npm run db:types` | regenera `app/types/database.ts` a partir do banco local |
| `npm run demo:build` | regenera `supabase/seed.sql` e `public/demo/*` a partir de `scripts/demo/data.mjs` |
| `npm run demo:remove` | remove todos os dados de demonstração (usa service role) |
| `npm run admin:create -- email@x.com` | promove um usuário existente a admin |
| `npm run brand:build` | regenera ícones e imagem OG a partir de `app/config/site.ts` |

Antes de fechar qualquer etapa: `npm run typecheck && npm run lint && npm test && npm run test:rls && npm run build`.

## Convenções
- Nome/slogan/mensagens da marca: só em `app/config/site.ts`. Nunca escreva "Perto+" em outro lugar.
- Cidades, bairros, categorias, planos e preços vêm do banco. Nada disso fixo no código.
- Regras de negócio e permissões vivem no banco (RLS, triggers, funções). A UI só reflete.
  Toda tabela nova: RLS habilitada + políticas + teste em `tests/rls/`.
- Migrations novas em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`; nunca edite uma migration já aplicada em produção. Depois: `npm run db:types`.
- Mensagens de erro do banco são em português e usam `hint = 'plan_limit'` / `'email_not_confirmed'` para a UI reconhecer.
- `service_role` só em `app/lib/supabase/admin.server.ts` e `scripts/`. Arquivos `*.server.ts` nunca vão para o cliente.
- Páginas públicas: loader no servidor + `meta` via `seo()` (`app/lib/seo.ts`). Painéis: loader só checa sessão; dados via TanStack Query com o cliente do navegador.
- Formulários: React Hook Form + schema Zod em `app/lib/schemas/`, o mesmo schema revalida na action.
- Imagens: comprimir com `compressToWebp` antes do upload; caminho `<business_id>/<tipo>/<uuid>.webp` no bucket `business-media`.
- Caminhos que começam com `/demo/` são imagens estáticas de demonstração (`mediaUrl` resolve os dois casos).
- Telefones sempre em E.164 (`toE164BR`). WhatsApp via `whatsappLink()`.
- Textos de interface em português do Brasil; botões com área de toque ≥ 44 px; estados de carregando/vazio/erro/sucesso.
- Cores: use os tokens do tema (`bg-brand-700` para botões com texto branco; `brand` puro só para destaque/ícones).

## Decisões de arquitetura
Ver `docs/DECISOES.md`. Progresso em `docs/PROGRESSO.md`.
