# Site do Revela

Landing page (`/`) e página de vendas (`/assinar`), em HTML estático, publicadas no Vercel.

- Preços e links dos botões de compra: `assets/config.js`.
- Capturas do app: geradas em `sony-tether/design/` (ScreenshotTest) e convertidas para `assets/`.
- No ar: https://revela.phillcassiano.com (projeto "revela" no Vercel; o endereço antigo revela-beta-nine.vercel.app continua valendo para os apps já instalados).
- Publicar de novo: `npx vercel deploy --prod` nesta pasta (precisa de um token do Vercel).

## Assinatura, vendas e teste grátis

Servidor em `api/` (funções do Vercel) com banco no Supabase (projeto buscaleads, esquema
`revela`, acessado só pelas funções `revela_*`, que exigem o segredo do servidor).

| Rota | O que faz |
|---|---|
| `/api/kiwify?k=…` | Webhook da Kiwify: venda cria a chave, renovação estende, reembolso/chargeback cancelam |
| `/api/vendas` | Lista para o `/admin → Vendas`, com links de WhatsApp e e-mail (exige a senha) |
| `/api/licenca` | Chave manual (cortesia, venda fora da Kiwify) |
| `/api/ativar` | O app ativa a chave (liga ao 1º tablet) e busca renovações |
| `/api/trial` | Registra o teste grátis por tablet (reinstalar não zera) |
| `/api/revogadas` | Chaves canceladas, que o app bloqueia |

Chaves são assinadas com ECDSA P-256 (`REVELA_CHAVE_PRIVADA`, secreta no Vercel) e
conferidas no app com a chave pública (`License.kt`). Teste grátis: 3 dias.

Variáveis no Vercel: `REVELA_CHAVE_PRIVADA`, `REVELA_ADMIN_SENHA`, `REVELA_DB_SEGREDO`,
`REVELA_SUPABASE_URL`, `REVELA_SUPABASE_CHAVE`, `REVELA_KIWIFY_K` e, opcional,
`REVELA_KIWIFY_TOKEN`. Teste do fluxo: `node test/fluxo.test.js`. Kiwify: `KIWIFY.md`.

Guarde a chave privada fora do Vercel (lá ela é secreta e não dá para ler de volta). Se ela se
perder, só uma versão nova do app com outra chave pública resolve.
