# Deploy: Supabase + Vercel

## 1. Supabase

1. Crie um projeto (região São Paulo, `sa-east-1`, recomendada para latência e residência de dados).
2. Aplique as migrations:
   ```bash
   npx supabase link --project-ref SEU_REF
   npx supabase db push
   ```
   Elas criam extensões (`pg_trgm`, `unaccent`, `pgcrypto`), tabelas, RLS, RPCs, dados de referência (editorias, UFs,
   capitais) e, se `pg_cron` estiver disponível, os agendamentos SQL diários.
3. **Não** rode `seed.sql` em produção: ele contém dados fictícios e libera a aprovação de propostas demonstrativas
   (`verification.allow_demo_apply = 1`).
4. Em **Authentication → URL Configuration**, defina o *Site URL* (ex.: `https://radar.exemplo.com.br`) e adicione
   `https://SEU-DOMINIO/auth/confirm` às URLs de redirecionamento.
5. Em **Authentication → Providers → Email**, mantenha a confirmação de e-mail ativa e senha mínima de 10 caracteres.
6. Em **API settings**, confirme que só os schemas `public` e `graphql_public` estão expostos.

## 2. Vercel

1. Importe o repositório e defina **Root Directory = `radar-imprensa`**.
2. Variáveis de ambiente (Production e Preview):

| Variável | Observação |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Fixadas no build**: altere e faça novo deploy |
| `NEXT_PUBLIC_SITE_URL` | URL pública do app |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | Canal do encarregado de dados |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente servidor; usada pelo endpoint de cron |
| `CRON_SECRET` | 32+ caracteres (`openssl rand -hex 32`) |
| `VERIFICATION_PROVIDER` | `none` (padrão), `demo` (somente teste) ou `brave` |
| `BRAVE_SEARCH_API_KEY` | Apenas se `VERIFICATION_PROVIDER=brave` |
| `FEATURE_PAUTA_MATCHING` | `false` no MVP |

3. Faça o deploy. Sem as variáveis do Supabase, o app sobe e mostra `/configuracao-necessaria`.

## 3. Processamento agendado das verificações

As tarefas puramente SQL (agendar vencidas, marcar desatualizados, limpar limites) já são criadas pela migration
`20261020000800_scheduled_jobs.sql`. O processamento dos lotes (que chama provedores externos) roda no app; há duas formas de
dispará-lo.

### Opção A — Edge Function + Supabase Cron (recomendada)

```bash
npx supabase functions deploy verification-dispatch
npx supabase secrets set APP_URL=https://SEU-DOMINIO CRON_SECRET=O_MESMO_DA_VERCEL
```

No SQL Editor, guarde a URL e a chave no Vault e agende a cada 15 minutos (lotes de 10 perfis):

```sql
select vault.create_secret('https://SEU_REF.supabase.co', 'project_url');
select vault.create_secret('SUA_SERVICE_ROLE_KEY', 'service_role_key');

select cron.schedule(
  'radar-processar-verificacoes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/verification-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{"batchSize": 10}'::jsonb
  );
  $$
);
```

Requer as extensões `pg_net` e `pg_cron` habilitadas (Database → Extensions). Com ~30 dias por perfil e lotes de 10 a cada
15 minutos, a capacidade é de ~28.800 perfis por mês. Ajuste `verification.batch_size` em `/admin/configuracoes`.

### Opção B — agendador externo

Qualquer agendador pode chamar:

```bash
curl -X POST https://SEU-DOMINIO/api/cron/verificacoes \
  -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" -d '{"batchSize":10}'
```

(O Vercel Cron do plano gratuito executa no máximo uma vez por dia, o que só é suficiente para bases pequenas.)

## 4. Pós-deploy

1. Cadastre-se e rode `scripts/promote-admin.sql` com o seu e-mail.
2. Em `/admin/configuracoes`, revise limites de uso e confirme `verification.allow_demo_apply = 0`.
3. Importe dados reais apenas com fonte e base legal documentadas (ver `docs/LGPD.md`).
4. Revise e complete a política de privacidade e os termos com assessoria jurídica.
