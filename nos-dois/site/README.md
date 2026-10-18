# Nós Dois: site

App para casais em uma página (`index.html`) + uma função do Vercel (`api/space.js`) que guarda o espaço de cada casal no Upstash Redis.

## Publicar no Vercel
1. Em vercel.com → **Add New… → Project**, importe o repositório `phcassiano/phillphotovideolinks`.
2. Em **Root Directory**, escolha `nos-dois/site`. Framework: **Other**. Sem comando de build.
3. **Deploy.**
4. No projeto, aba **Storage** → crie um banco **Upstash** ou o **Redis** oficial e conecte ao projeto. O código aceita as variáveis do Upstash (`KV_REST_API_URL`/`KV_REST_API_TOKEN` ou `UPSTASH_REDIS_REST_*`) e qualquer `REDIS_URL` (inclusive com prefixo, como `kv_REDIS_URL`).
5. Faça **Redeploy** para as variáveis valerem.

Sem o passo 4 o site funciona, mas salva só no aparelho (sem sincronizar o casal).

## Como funciona a dois
- Quem cria o espaço recebe um link de convite (`/#entrar-<id>-<chave>`) em **Ajustes → Usar a dois**.
- A outra pessoa abre o link, escolhe o próprio nome e os dois passam a ver tudo; o app sincroniza a cada 4 segundos.
- O servidor guarda só o hash da chave. Quem tiver o link entra no espaço: não publique o link.

## Teste grátis, plano grátis e Premium

- Todo espaço **criado a partir desta versão** ganha 7 dias com tudo liberado. Espaços mais antigos seguem completos, sem prazo ("casal fundador").
- Quando o teste acaba, o casal fica no plano grátis: pergunta do dia, tarefas, listas, datas e avisos. As outras seções ficam com cadeado, e o servidor também recusa gravações nelas. Nada é apagado.
- Para liberar, o casal paga por Pix e recebe um **código de ativação** (`ND-XXXX-XXXX`, mensal ou anual). Um código vale uma vez e os meses se somam.
- Os códigos são gerados no painel **`/admin`**.

Variáveis de ambiente no Vercel (Settings › Environment Variables):

| Nome | Para quê |
|---|---|
| `NOS_DOIS_ADMIN_KEY` | Senha do painel `/admin` (mínimo 10 caracteres). Sem ela o painel não abre. |
| `NOS_DOIS_WHATSAPP` | Seu WhatsApp com DDI e DDD, ex.: `5511999990000`. Vira o botão "Falar no WhatsApp". |
| `NOS_DOIS_PIX` | Sua chave Pix, mostrada com botão de copiar. |

## Limites atuais
- Sem login por conta: o acesso é pelo link secreto.
- Sem limite de requisições por IP; adicione se o site ficar público.
- Gestação e saúde são dados sensíveis pela LGPD: veja `../founder/ops.md` antes de divulgar.
