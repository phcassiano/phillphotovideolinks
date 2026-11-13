# Painel: central do negócio

Painel privado para organizar o negócio de foto e vídeo, em uma página (`index.html`) mais uma função da Vercel (`api/data.js`) que guarda os dados no Redis.

## Telas
- **Hoje**: metas da semana e do mês, a receber, em negociação, alertas (pagamento atrasado, entrega atrasada, backup incompleto, orçamento sem resposta há 3 dias, aniversários de clientes), sessões e prazos dos próximos 7 dias, pagamentos e tarefas do dia.
- **Trabalhos**: quadro Agendado → Captação feita → Backup → Seleção do cliente → Edição → Entrega → Concluído, com arrastar e soltar, prazos, parcelas (sinal/saldo), backup HD1/HD2/nuvem, link da galeria e mensagens prontas para WhatsApp.
- **Orçamentos**: funil Lead → Enviado → Negociando → Fechado/Perdido, itens puxados da tabela de preços, PDF com a sua marca, mensagens de envio e follow-up, conversão em trabalho.
- **Clientes**: CRM com origem, aniversário, data especial e histórico de trabalhos.
- **Financeiro**: entradas (os pagamentos marcados como recebidos entram sozinhos), despesas por categoria, lucro, gráfico de 6 meses, a receber e contas a pagar.
- **Tabela de preços**: pacotes com preço, o que inclui e prazo de entrega. Os exemplos vêm sem valor, para você preencher.
- **Prompts e notas**: banco de prompts com categorias, notas coloridas e tarefas.
- **Ajustes**: dados do negócio (vão no PDF), metas, listas, tema e backup em JSON.

## Publicar na Vercel (projeto separado)
1. Em vercel.com → **Add New… → Project**, importe `phcassiano/phillphotovideolinks`.
2. Em **Root Directory**, escolha `painel`. Framework: **Other**, sem comando de build.
3. Em **Settings → Environment Variables**, crie `PAINEL_SENHA` com uma senha forte (mínimo 10 caracteres).
4. Aba **Storage** → crie/conecte um banco **Upstash Redis** (ou o Redis oficial). Pode ser um banco novo ou o mesmo do Nós Dois: as chaves do painel começam com `painel:`.
5. **Redeploy**.
6. Em **Settings → Domains**, adicione `painel.phillcassiano.com` e crie o CNAME que a Vercel indicar.

Sem o Redis ou a senha, o painel abre em **modo local** (dados só naquele navegador). Quando você configurar o servidor depois, o que foi criado no modo local é enviado na primeira entrada.

## Segurança
- Todas as leituras e gravações exigem a senha. 10 senhas erradas bloqueiam o IP por 1 hora.
- A página tem `noindex` (não aparece no Google).
- Para trocar a senha, mude `PAINEL_SENHA` na Vercel e faça redeploy; os aparelhos conectados pedem a senha nova.
