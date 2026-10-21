# Testes

| Suíte | Comando | O que cobre | Resultado nesta entrega |
| --- | --- | --- | --- |
| Unitários | `npm test` | filtros/URL, permissões, CSV (parse, mapeamento, validação, deduplicação, exportação segura), identidade, política de confiança, verificador (extrator, resolvedor, detector, serviço, provedores demonstrativo e Brave com `fetch` simulado), pautas | 69 passando |
| Banco | `npm run test:db` | RLS em todas as tabelas, escalonamento de privilégio, isolamento de mailings/favoritos/interações, busca combinada (editoria × localização × tipo, vínculos antigos, ocultos), limites de uso, contatos e exportação, propostas com histórico, titulares, LGPD, verificação periódica de ponta a ponta, unificação/separação, importação | 63 passando |
| E2E | `npm run test:e2e` | fluxo completo do assessor (cadastro, login, busca, perfil, contatos, favorito, mailing, exportação CSV) e do administrador (importação, verificação, revisão, duplicidades, configurações, cron) | 8 passando, estável em execuções repetidas |

## Como os testes de banco funcionam

`scripts/db-local.mjs` recria o banco `radar_imprensa_test` num PostgreSQL real com
[`tests/db/supabase-shim.sql`](../tests/db/supabase-shim.sql), que reproduz o mínimo do Supabase (papéis `anon`,
`authenticated` e `service_role`, `auth.users`, `auth.uid()` a partir de `request.jwt.claims`). Em seguida aplica todas as
migrations e o seed. Cada teste roda numa transação desfeita ao final e executa SQL como o PostgREST faria
(`set local role authenticated` + claims JWT).

Requisitos: PostgreSQL 15+ com `pg_trgm` e `unaccent` (pacote contrib) e a variável `DATABASE_URL_TEST`.

## Como o E2E funciona

Sem Docker, o Supabase completo não roda localmente. O E2E monta um ambiente equivalente para o app:

- PostgreSQL com shim, migrations e seed;
- **PostgREST real** (o mesmo componente da API REST do Supabase);
- `tests/e2e/stack/auth-gateway.mjs`: gateway **de teste** que expõe `/rest/v1` (proxy para o PostgREST) e emula os endpoints
  de Auth usados pelo app (`signup`, `token`, `user`, `logout`), com JWT HS256;
- o app em modo produção (`next build && next start`) e o Chromium via Playwright.

Requisitos extras: binário `postgrest` (v12) no PATH ou em `POSTGREST_BIN`, e Chromium do Playwright (`CHROMIUM_PATH`).

O gateway de Auth é uma emulação mínima: ele não testa o Supabase Auth real (envio de e-mails, confirmação, rotação de tokens).
Valide esse fluxo num projeto Supabase de homologação.
