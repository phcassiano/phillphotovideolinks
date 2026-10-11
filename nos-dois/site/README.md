# Nós Dois: site

App para casais em uma página (`index.html`) + uma função do Vercel (`api/space.js`) que guarda o espaço de cada casal no Upstash Redis.

## Publicar no Vercel
1. Em vercel.com → **Add New… → Project**, importe o repositório `phcassiano/phillphotovideolinks`.
2. Em **Root Directory**, escolha `nos-dois/site`. Framework: **Other**. Sem comando de build.
3. **Deploy.**
4. No projeto, aba **Storage** (ou **Marketplace**) → **Upstash Redis** → crie o banco (plano grátis) e **conecte ao projeto**. Isso cria as variáveis `KV_REST_API_URL` e `KV_REST_API_TOKEN` (ou `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`; o código aceita as duas).
5. Faça **Redeploy** para as variáveis valerem.

Sem o passo 4 o site funciona, mas salva só no aparelho (sem sincronizar o casal).

## Como funciona a dois
- Quem cria o espaço recebe um link de convite (`/#entrar-<id>-<chave>`) em **Ajustes → Usar a dois**.
- A outra pessoa abre o link, escolhe o próprio nome e os dois passam a ver tudo; o app sincroniza a cada 4 segundos.
- O servidor guarda só o hash da chave. Quem tiver o link entra no espaço: não publique o link.

## Limites atuais
- Sem login por conta: o acesso é pelo link secreto.
- Sem limite de requisições por IP; adicione se o site ficar público.
- Gestação e saúde são dados sensíveis pela LGPD: veja `../founder/ops.md` antes de divulgar.
