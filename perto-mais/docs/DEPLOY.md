# Deploy no Vercel

1. Conclua `docs/SETUP.md` (projeto Supabase + migrations).
2. No Vercel: **Add New → Project** e importe o repositório.
3. **Root Directory**: `perto-mais`. Framework: React Router (detectado). Build: `npm run build`. Node 20+.
4. **Environment Variables** (Production e Preview): `SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `METRICS_SALT`.
5. Deploy. O preset `@vercel/react-router` entra automaticamente quando o build roda no Vercel (`react-router.config.ts`).
6. Domínio: em **Settings → Domains**, adicione o seu e atualize `SITE_URL` e as URLs de autenticação no Supabase.
7. Google: envie `https://seu-dominio.com.br/sitemap.xml` no Search Console.

## Outro provedor com SSR
O build gera um servidor Node padrão:
```bash
npm ci && npm run build
PORT=3000 npm start      # lê o .env se existir; em produção, defina as variáveis no ambiente
```
Funciona em Render, Railway, Fly.io ou uma VPS. Coloque um proxy com HTTPS na frente.

## Atualizações de banco
Novas migrations: `npx supabase db push` (com o projeto linkado) **antes** de publicar o código que depende delas.

## Dados de demonstração
O seed é só local. Se algum dia houver dados de demonstração em produção, remova com `npm run demo:remove` (usa a service role do `.env`).
