# Catálogo: catálogo digital para WhatsApp, para várias lojas

Uma plataforma só, com várias lojas. Cada loja tem o próprio link (`seudominio.com.br/nome-da-loja`), a própria logo e cores, produtos, estoque e pedidos. O cliente monta o carrinho e o pedido chega pronto no WhatsApp da loja.

## Páginas

| Endereço | Para quem | O que faz |
|---|---|---|
| `/` | Visitantes | Página de vendas da plataforma (botão leva ao seu WhatsApp). |
| `/<loja>` | Clientes da loja | Vitrine: banners, categorias, busca, favoritos, produto com tamanho/cor, carrinho e pedido pelo WhatsApp. |
| `/<loja>/pedido/<n>-<código>` | Cliente | Acompanhamento do pedido (o link vai na mensagem do WhatsApp). |
| `/painel` | Lojista | Pedidos, produtos (fotos, variações, estoque), categorias, aparência, dados da loja, números, divulgar (link, QR Code, PDF, planilha) e conta. |
| `/admin` | Você | Criar lojas, renovar mensalidade (+30 dias / +1 ano), pausar, trocar plano, gerar nova senha, abrir o painel de qualquer loja e excluir. |

## Publicar no Vercel

1. Em vercel.com → **Add New… → Project**, importe `phcassiano/phillphotovideolinks`.
2. **Root Directory:** `catalogo`. Framework: **Other**. Sem comando de build.
3. Aba **Storage** → crie um banco **Upstash Redis** (ou o Redis oficial) e conecte ao projeto.
4. Em **Settings → Environment Variables**:

| Nome | Para quê |
|---|---|
| `CATALOGO_ADMIN_KEY` | Senha do `/admin` (mínimo 10 caracteres). |
| `CATALOGO_MARCA` | Nome da sua plataforma (aparece na página inicial e no rodapé das lojas). |
| `CATALOGO_WHATSAPP` | Seu WhatsApp com 55 e DDD. Vira o botão de orçamento e o "Falar com o suporte" do painel. |

5. **Redeploy** e coloque o seu domínio em **Settings → Domains**.

## Rotina de uma loja nova

1. No `/admin`, preencha endereço, nome, WhatsApp e cor → **Criar loja**. Guarde a senha que aparece.
2. **Abrir painel** entra direto na loja: cadastre categorias, produtos, logo e banners.
3. Mande ao lojista o link da loja, o endereço `/painel`, o nome da loja e a senha.
4. Quando ele pagar a mensalidade, clique **+30 dias**. Um dia depois do vencimento sem renovação, a loja sai do ar sozinha (nada é apagado) e volta assim que você renovar.

## Frete com Melhor Envio

Cada lojista usa a própria conta do Melhor Envio (o frete sai com os descontos dele e ele compra as etiquetas por lá).

1. No Melhor Envio do lojista: **Integrações › Permissões de acesso › Gerar novo token**, com a permissão `shipping-calculate`.
2. No painel da loja, aba **Frete**: cole o token, informe o CEP de origem e a caixa padrão (peso e medidas), ligue e salve.
3. Em **Testar cotação**, confira os preços e desmarque as transportadoras que não quer oferecer.
4. Produtos com tamanho diferente da caixa padrão podem ter peso e medidas próprios no cadastro do produto.

Como funciona:
- O cliente calcula o frete na página do produto ou no checkout. O CEP também preenche o endereço (ViaCEP).
- O preço usado é o `custom_price` do Melhor Envio, mais o acréscimo da loja; o prazo ganha os dias para postar.
- "Frete grátis a partir de" deixa a opção mais barata de graça.
- No pedido, o servidor refaz a cotação (com cache de 30 minutos) e grava a transportadora, o prazo e o valor; nada vem do navegador.
- O token fica em `cat:sec:<loja>` e nunca vai para a loja nem para o painel (o painel mostra só os últimos caracteres).

Para testar sem conta: `node catalogo/dev/mock-melhorenvio.js` e rode o servidor com `MELHOR_ENVIO_BASE=http://localhost:3999`; use um token que comece com `teste`.

## Cupons

Aba **Cupons** do painel: porcentagem, valor fixo ou frete grátis, com compra mínima, limite de usos, datas de início e fim e categorias. O cliente aplica no carrinho; o link "Copiar link" (`/loja?cupom=CODIGO`) já deixa o código pronto. O servidor confere o cupom de novo no pedido e conta o uso de forma atômica; cancelar o pedido devolve o uso.

## Como os dados ficam guardados (Redis)

- `cat:m:<loja>` conta (senha com scrypt, plano, vencimento), `cat:s:<loja>` aparência e dados, `cat:c:<loja>` categorias.
- `cat:p:<loja>` produtos, `cat:o:<loja>` pedidos, `cat:st:<loja>:<dia>` números (guardados por 120 dias).
- Fotos: comprimidas no navegador (WebP, até 1400 px) e guardadas em `cat:i:<id>`; servidas em `/api/img/<id>` com cache longo na CDN. Cada loja pode ter até 4.000 imagens. No plano grátis do Upstash (256 MB) cabem perto de 2.000 fotos no total; com muitas lojas, migre as fotos para o Vercel Blob ou pague o plano do Redis.
- Preço e estoque do pedido são sempre conferidos no servidor. Cancelar um pedido devolve o estoque.

## Testar no computador

```bash
redis-server --port 6390 --save "" --daemonize yes
REDIS_URL=redis://127.0.0.1:6390 CATALOGO_ADMIN_KEY=chave-de-teste-123 PORT=3000 node catalogo/dev/server.js
```
Abra `http://localhost:3000/admin`, crie uma loja e use **Abrir painel**.

## Próximos passos (ainda não feitos)

- Área de atacado (plano Growth).
- Cobrança automática da mensalidade (Asaas ou Mercado Pago) em vez do "+30 dias" manual.
- Domínio próprio por loja (`loja.seudominio.com.br`).
- Fotos com fundo de estúdio por IA e cadastro de produtos pelo WhatsApp.
- Termos de uso e política de privacidade da plataforma (LGPD) antes de vender.
