# Configuração do Supabase de produção

O app foi desenvolvido e testado com o Supabase local (Docker). Para colocar no ar você precisa de um projeto Supabase seu. São ~20 minutos.

## 1. Criar o projeto
1. Em https://supabase.com/dashboard, **New project**. Região sugerida: **South America (São Paulo)**.
2. Guarde a senha do banco.
3. Em **Project Settings → API**, anote: `Project URL`, `anon public key` e `service_role key` (esta é secreta).

> Se preferir, posso criar o projeto pela integração do Supabase conectada a esta sessão — me peça. Criar um projeto pode gerar cobrança na sua organização, por isso não fiz sem sua autorização.

## 2. Aplicar o banco (migrations)
No computador, dentro de `perto-mais/`:
```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>     # o ref está na URL do painel
npx supabase db push                                  # aplica supabase/migrations/*
```
Isso cria tabelas, regras, RLS, bucket de imagens, planos (Gratuito e Vitrine R$ 19,90), categorias, Brasília e os 4 bairros iniciais.
**Não rode `supabase/seed.sql` em produção**: ele cria contas de teste com senhas públicas.

## 3. Autenticação
Em **Authentication → URL Configuration**:
- **Site URL**: `https://seu-dominio.com.br`
- **Redirect URLs**: `https://seu-dominio.com.br/**` (e a URL de preview do Vercel, se for usar)

Em **Authentication → Providers → Email**: deixe **Confirm email** ligado.

Em **Authentication → Email Templates**:
- **Confirm signup**: assunto “Confirme seu e-mail”; corpo = conteúdo de `supabase/templates/confirmation.html`
- **Reset password**: assunto “Redefinir sua senha”; corpo = conteúdo de `supabase/templates/recovery.html`

(Os templates usam o link `/auth/confirmar?token_hash=…`, que é o que o app espera.)

**SMTP próprio (recomendado):** o e-mail padrão do Supabase envia poucas mensagens por hora. Em **Project Settings → Authentication → SMTP Settings**, configure um provedor (Resend, Brevo, Amazon SES etc.) com um remetente do seu domínio.

## 4. Variáveis de ambiente
Use no Vercel (ver `docs/DEPLOY.md`) e no `.env` local se for rodar scripts contra produção:

| Variável | Valor |
|---|---|
| `SITE_URL` | `https://seu-dominio.com.br` (sem barra no fim) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key — **só no servidor** |
| `METRICS_SALT` | texto aleatório longo (ex.: `openssl rand -hex 32`) |

## 5. Primeiro administrador
1. Crie sua conta pelo próprio site em `/cadastro` (ou em **Authentication → Users → Add user** no painel, marcando “Auto confirm”).
2. Promova a admin, com as variáveis de produção no `.env`:
   ```bash
   npm run admin:create -- seu-email@dominio.com
   ```
   Ou, no **SQL Editor**:
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'seu-email@dominio.com';
   ```
Não existe forma de virar admin pelo site.

## 6. Conferência rápida
- `/` carrega com Brasília e as categorias.
- Cadastre um negócio de teste, confirme o e-mail, aprove em `/admin/estabelecimentos` e veja a página pública.
- Em **Advisors → Security** o Supabase vai apontar a view `public_businesses` como *security definer*: é intencional (ela expõe só negócios aprovados e esconde o dono e os campos de plano vencido).
