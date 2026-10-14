# Roast Room: guia de uso (PT-BR)

Projeto original: https://github.com/nateherkai/roast-room (MIT), commit `f5e7b63`.
Testado: o servidor da sala sobe em http://localhost:4730, a página carrega sem erros, as 3 sessões de exemplo aparecem em **Past sessions** e o verificador de citações roda.

## O que é

Sete "conselheiros" de IA (Bezos, Paul Graham, Hormozi, Gary Vee, Dan Martell, Gino Wickman, Buffett) debatem uma decisão de negócio sua e entregam um veredito com nota e PDF. O debate roda **dentro do Claude Code**; a "sala" (site local) só mostra o debate ao vivo.

## O que você precisa no seu computador (ação humana)

1. **Node.js 20 ou mais novo**: baixe em https://nodejs.org (versão LTS) e instale. Confira no terminal: `node -v` (deve mostrar v20 ou maior).
2. **Git**: https://git-scm.com/downloads (no Mac já vem; no Windows instale o "Git for Windows").
3. **Claude Code** logado na sua conta Claude (o plano cobre, não precisa de chave de API):
   - Mac/Linux: `curl -fsSL https://claude.ai/install.sh | bash`
   - Windows (PowerShell): `irm https://claude.ai/install.ps1 | iex`
   - Depois rode `claude` uma vez e faça login.

Não há `npm install`: o projeto não tem dependências.

## Baixar o projeto

```bash
git clone -b claude/roast-room-setup-zw5m62 https://github.com/phcassiano/phillphotovideolinks.git
cd phillphotovideolinks/roast-room
```

(Ou use o original: `git clone https://github.com/nateherkai/roast-room.git && cd roast-room`.)

**Importante:** sempre trabalhe de dentro da pasta `roast-room`, porque é lá que ficam a skill `/roast-room` e os agentes (`.claude/`).

## Usar

1. **Terminal 1** (na pasta `roast-room`): `npm start` e abra http://localhost:4730 no navegador. Deixe aberto.
2. **Terminal 2** (na mesma pasta): `claude`
3. Digite `/roast-room` seguido da sua decisão. Exemplo:
   ```
   /roast-room Faturo R$30 mil/mês com fotografia e vídeo, 10 clientes fixos a R$3 mil.
   Devo subir para R$4.500 para todos, só para novos clientes, ou manter?
   Tenho R$20 mil em caixa. Sucesso é R$40 mil/mês até março. Estou inclinado a subir para todos.
   ```
4. Responda às perguntas do "Chair" e acompanhe o debate na sala.
5. No final, clique em **Download PDF** na sala. O relatório completo também fica em `sessions/<data>-<decisao>/verdict.md`.

Dica: pode escrever em português. Inclua as opções, seus números, limites, o que é sucesso e para onde você está inclinado.

### Variações
- `/roast-room --quick ...` → 4 conselheiros, 2 rodadas (gasta bem menos do seu plano).
- `/roast-room --seats hormozi,buffett ...` → só os conselheiros escolhidos.
- `/roast-room ask hormozi ...` → uma resposta de um conselheiro só.

Um conselho completo são cerca de 21 execuções de sub-agentes e consome bastante do limite do plano. Use `--quick` em decisões menores.

## Opcional: rodar conselhos direto pela sala (cobra na API)

Só se quiser digitar a decisão no navegador em vez do Claude Code:
1. Crie uma chave em https://console.anthropic.com/settings/keys (precisa de créditos na API, cobrados à parte do plano).
2. Copie `.env.example` para `.env` e preencha:
   ```
   ANTHROPIC_API_KEY=sua-chave
   COUNCIL_RUNNER=api
   ```
3. Reinicie o `npm start`. Para testar a chave: `npm run smoke` (faz 1 chamada pequena).

Nunca faça commit do `.env` (ele já está no `.gitignore`).

## Problemas comuns
- **Porta 4730 ocupada**: feche o outro `npm start` (Ctrl+C).
- **`/roast-room` não aparece no Claude Code**: você abriu o `claude` fora da pasta `roast-room`. Saia e rode de dentro dela.
- **`node: command not found`**: instale o Node.js e abra um terminal novo.
