# Perto+

Guia de comércio local: o morador escolhe cidade e bairro, encontra estabelecimentos por categoria, busca ou mapa e fala direto com o comerciante pelo WhatsApp ou telefone. Comerciantes cadastram o negócio de graça e podem assinar o plano **Vitrine** (logo, capa, galeria, cardápio/catálogo e estatísticas detalhadas).

> O nome é provisório e vem de `app/config/site.ts`.

## Stack
React Router v7 (modo framework, SSR) · TypeScript · Vite · Tailwind CSS 4 · componentes no padrão shadcn/ui (Radix) · Lucide · Supabase (Postgres, Auth, Storage, RLS) · TanStack Query · React Hook Form + Zod · Leaflet/OpenStreetMap · Vitest · Playwright.

## Rodando localmente
Pré-requisitos: Node 20+, Docker.

```bash
npm install
npm run db:start                # sobe o Supabase local (Docker)
cp .env.example .env            # preencha com as chaves de `npx supabase status`
npm run db:reset                # migrations + dados de demonstração
npm run dev                     # http://localhost:5173
```

E-mails locais (confirmação de cadastro, recuperação de senha): http://127.0.0.1:54324

### Contas de teste (somente local)
| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@perto.local | `Perto+Admin123` |
| Comerciante gratuito | gratuito@perto.local | `Perto+Teste123` |
| Comerciante Vitrine | vitrine@perto.local | `Perto+Teste123` |

### Testes
```bash
npm run typecheck && npm run lint
npm test            # unitários
npm run test:rls    # permissões (anônimo, comerciante A, comerciante B, admin)
npm run test:e2e    # recria o banco local e roda Playwright (celular e desktop)
```

## Documentação
- `docs/PLANO.md` — arquitetura, modelo de dados, rotas
- `docs/SETUP.md` — o que configurar no Supabase de produção
- `docs/DEPLOY.md` — deploy no Vercel
- `docs/DECISOES.md` — decisões tomadas
- `docs/PROGRESSO.md` — o que está pronto e o que falta
- `CLAUDE.md` — comandos e convenções para quem for mexer no código
