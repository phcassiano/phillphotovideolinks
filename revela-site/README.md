# Site do Revela

Landing page (`/`) e página de vendas (`/assinar`), em HTML estático, publicadas no Vercel.

- Preços e links dos botões de compra: `assets/config.js`.
- Capturas do app: geradas em `sony-tether/design/` (ScreenshotTest) e convertidas para `assets/`.
- No ar: https://revela-beta-nine.vercel.app (projeto "revela" no Vercel).
- Publicar de novo: `npx vercel deploy --prod` nesta pasta (precisa de um token do Vercel).

## Chaves de ativação (assinatura)

O app tem 7 dias de teste grátis e depois pede uma chave. A chave é assinada pelo
servidor (`api/licenca.js`) com a chave privada guardada no Vercel
(`REVELA_CHAVE_PRIVADA`, secreta) e conferida no app com a chave pública
(`License.kt`). Ninguém consegue fabricar uma chave só com o app.

- **Gerar uma chave:** abra `/admin`, preencha o nome, o plano e o código do tablet
  (aparece no app, em Assinatura) e use a senha de administrador (`REVELA_ADMIN_SENHA`).
  "Copiar mensagem para o cliente" já monta o texto para o WhatsApp.
- **Validade:** mensal = 31 dias, anual = 366 dias, cortesia = 30 dias, sempre +5 dias
  de folga para a renovação. Renovar = gerar uma chave nova.
- **Cancelar uma chave** (reembolso, uso indevido): ponha o id dela em
  `licencas/revogadas.json` e publique o site. O app baixa a lista uma vez por dia
  quando tem internet.
- **Guarde a chave privada** fora do Vercel (ela é secreta lá e não dá para ler de
  volta). Se ela se perder, só uma versão nova do app com outra chave pública resolve.
