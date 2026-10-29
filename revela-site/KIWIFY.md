# Vendas do Revela na Kiwify

Passo a passo para criar o produto e ligar as vendas ao servidor do Revela. Os nomes dos
menus podem mudar um pouco conforme a versão do painel da Kiwify.

## 1. Criar o produto

**Produtos → Criar produto**

| Campo | O que colocar |
|---|---|
| Nome | Revela: tethering no tablet para fotógrafos |
| Tipo | Assinatura (cobrança recorrente) |
| Categoria | Software / Aplicativos (ou Fotografia) |
| Descrição curta | Suas fotos no tablet na hora do clique, já com o seu preset do Lightroom. Mostre, aprove e entregue para o cliente no próprio ensaio, sem notebook e sem internet. |
| Página de vendas | https://revela.phillcassiano.com/assinar |
| E-mail de suporte | o seu |

Descrição longa (cole na descrição do produto):

> O Revela transforma o seu tablet Android num monitor de aprovação: cada foto sai da câmera
> e aparece na tela grande em segundos, já com o seu preset do Lightroom.
>
> • Sony, Canon e Nikon pelo cabo USB; qualquer câmera com FTP pelo Wi-Fi
> • Presets do Lightroom (.xmp, .dng, .zip) aplicados na hora
> • Zoom de foco a 100%, estrelas, favoritas, esconder e apagar
> • Entrega por QR code (sem internet), slideshow para TV e marca d'água
>
> Requisitos: tablet ou celular Android 10+ com USB-C. Não funciona em iPad.
> Depois da compra você recebe o link do app e a sua chave de ativação pelo WhatsApp ou e-mail.

## 2. Planos (ofertas) da assinatura

| Plano | Preço | Recorrência |
|---|---|---|
| Revela Mensal | R$ 39,00 | Mensal |
| Revela Anual | R$ 348,00 | Anual |

O nome do plano anual precisa conter **"Anual"** (o servidor usa isso, junto com a
recorrência, para dar 1 ano de validade).

## 3. Checkout

- Peça o **telefone (WhatsApp)** do comprador: é com ele que o /admin monta o link do WhatsApp.
- **Página de obrigado / redirecionamento após a compra:**
  https://revela.phillcassiano.com/obrigado
- **Entrega do produto:** link externo para a mesma página de obrigado (a chave vai por
  WhatsApp ou e-mail, pelo /admin).
- Garantia: 7 dias.

## 4. Webhook (liga a Kiwify ao servidor do Revela)

**Apps → Webhooks → Criar webhook**

| Campo | O que colocar |
|---|---|
| Nome | Revela |
| URL | o endereço com `?k=` que foi passado por mensagem (é secreto, não está neste arquivo) |
| Produto | Revela |
| Eventos | Compra aprovada, Assinatura renovada, Compra reembolsada, Chargeback, Assinatura cancelada |

Se a Kiwify mostrar um **token** do webhook, ele pode ser cadastrado no Vercel como
`REVELA_KIWIFY_TOKEN`: aí o servidor também confere a assinatura de cada notificação.

## 5. Botões do site

Com o produto criado, copie os links de checkout de cada plano e cole em
`assets/config.js` (`checkoutMensal` e `checkoutAnual`), depois publique o site.

## O que acontece numa venda

1. A Kiwify avisa o servidor (`/api/kiwify`), que cria a chave do cliente.
2. A venda aparece em **/admin → Vendas** com os botões **WhatsApp** e **E-mail**, já com a
   mensagem, o link do app e a chave.
3. O cliente cola a chave no app; na primeira vez ela é ligada ao tablet dele (precisa de internet).
4. Cada renovação estende a validade sozinha (o app atualiza quando tem internet).
5. Reembolso ou chargeback cancelam a chave; o app bloqueia quando tiver internet.
