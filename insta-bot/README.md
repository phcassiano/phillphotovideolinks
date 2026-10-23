# Robô do Instagram (estilo ManyChat)

Responde sozinho os comentários e as mensagens de direct do **@phill.photovideodf**, e tem um painel para você gerenciar tudo.

- **Automações por palavra-chave**: alguém comenta "QUERO" → o robô responde no comentário ("Te mandei no direct, @maria!") **e** manda o link no direct, com botão.
- Pode valer para **todos os posts** ou só para os que você escolher.
- Automações de **direct**: alguém escreve "câmera" → recebe o link. Também dá para criar uma mensagem de boas-vindas para qualquer direct (no máximo 1 vez a cada 12 h por pessoa).
- **Respostas com IA (Claude)**: o que não bate com nenhuma palavra-chave a IA responde, usando só o que você escreveu sobre você. Se não souber ou o assunto for sério, ela não inventa: marca a conversa como **precisa de você**.
- **Comentários**: veja os comentários de cada post e responda, mande direct, oculte ou apague, tudo pelo painel.
- **Direct**: caixa de entrada com as conversas, para responder pelo painel.
- **Atividade**: histórico do que o robô fez, com os erros, e números do dia.
- O token do Instagram é **renovado sozinho** toda semana.

Usa só a **API oficial da Meta** (a mesma do ManyChat), então não tem risco de bloqueio por automação "pirata".

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Painel (abre em `https://seu-projeto.vercel.app/`) |
| `api/webhook.js` | Recebe comentários e mensagens da Meta e aplica as automações |
| `api/admin.js` | API do painel (protegida por senha) |
| `api/cron.js` | Renova o token toda segunda-feira |
| `api/_ig.js`, `api/_db.js` | Instagram e Redis |
| `api/_ai.js` | Respostas com IA (SDK oficial da Anthropic, `package.json`) |
| `privacidade.html` | Política de privacidade (a Meta exige o link) |
| `test/simulate.js` | Teste sem internet: `cd insta-bot && npm install && node test/simulate.js` |

## Como colocar no ar (uns 30 minutos)

### 1. Conta do Instagram
- A conta precisa ser **profissional** (Criador de conteúdo ou Empresa). No app: Configurações → Tipo de conta e ferramentas.
- Libere as mensagens para ferramentas: no app, **Configurações → Mensagens e respostas ao story → Controles de mensagem → Ferramentas conectadas → Permitir acesso às mensagens**. Sem isso o robô não manda direct.

### 2. Vercel (servidor)
1. Em vercel.com → **Add New… → Project**, importe `phcassiano/phillphotovideolinks` (pode ser um projeto novo, separado do Nós Dois).
2. **Root Directory**: `insta-bot`. Framework: **Other**. Sem comando de build. **Deploy**.
3. Aba **Storage** → crie um **Upstash Redis** (grátis) ou o **Redis** do Vercel e conecte ao projeto.
4. **Settings → Environment Variables**:

| Nome | Valor |
|---|---|
| `ADMIN_PASSWORD` | Senha do painel (mínimo 10 caracteres) |
| `IG_VERIFY_TOKEN` | Qualquer palavra que você inventar, ex.: `phill-robo-2026` |
| `IG_APP_SECRET` | Vem do passo 3 |
| `IG_ACCESS_TOKEN` | Vem do passo 3 |
| `CRON_SECRET` | Qualquer texto longo e aleatório (o Vercel usa para chamar a renovação do token) |
| `ANTHROPIC_API_KEY` | Opcional, para as respostas com IA. Crie em [console.anthropic.com](https://console.anthropic.com) → API Keys (precisa de créditos na conta) |

5. Depois de preencher, **Redeploy**.

### 3. App na Meta
1. Em [developers.facebook.com](https://developers.facebook.com/apps) → **Criar app** → caso de uso **"Gerenciar mensagens e conteúdo no Instagram"** (tipo Empresa).
2. No app, vá em **Instagram → Configuração da API com login do Instagram**.
3. Copie a **Chave secreta do app do Instagram** → é o `IG_APP_SECRET`.
4. Em **Gerar tokens de acesso**, adicione a conta @phill.photovideodf, faça login e clique em **Gerar token** → é o `IG_ACCESS_TOKEN`. As permissões precisam incluir `instagram_business_basic`, `instagram_business_manage_comments` e `instagram_business_manage_messages`.
5. Em **Configurar webhooks**:
   - URL de callback: `https://seu-projeto.vercel.app/api/webhook`
   - Token de verificação: o mesmo `IG_VERIFY_TOKEN`
   - Clique em **Verificar e salvar** e depois **assine** os campos `comments` e `messages`.
   - Ligue a chave **Assinaturas de webhook** da conta na lista de contas.
6. Em **Configurações do app → Básico**, cole a URL da política: `https://seu-projeto.vercel.app/privacidade` (antes, troque os trechos amarelos do `privacidade.html` pelos seus dados).
7. Mude o app de **Desenvolvimento** para **Ao vivo** (chave no topo da página).

> Enquanto o app está em Desenvolvimento, a Meta só manda os eventos de quem tem função no app (você e testadores). Para funcionar com todos os seguidores o app precisa estar **Ao vivo**. Se a Meta pedir **Análise do app** (App Review) para as permissões de comentários e mensagens, ela costuma pedir um vídeo curto mostrando o painel em uso e a política de privacidade; leva alguns dias.

### 4. Testar
1. Abra `https://seu-projeto.vercel.app/`, entre com a `ADMIN_PASSWORD`. A aba **Início** mostra o que falta configurar (bolinhas verdes = ok).
2. Em **Automações**, clique em **Usar modelo "Comenta QUERO"**, coloque o link no botão e salve.
3. Com **outra conta** do Instagram, comente "quero" num post. Em segundos aparece a resposta e o direct. A aba **Atividade** mostra o que aconteceu (e o erro, se algo falhar).

## Respostas com IA
1. Coloque a `ANTHROPIC_API_KEY` no Vercel e faça Redeploy.
2. No painel, aba **IA**: escreva quem você é, o que vende, os links, o que **não** fazer (ex.: "não dou desconto pelo direct") e o tom. Quanto mais completo, melhor.
3. Use **Testar** para ver como ela responderia (nada é enviado), ajuste o texto e ligue.

Como ela se comporta:
- **Palavra-chave sempre ganha.** A IA só entra no que nenhuma automação pegou (e antes da regra "qualquer texto").
- Responde direct (com o histórico da conversa) e, se você ligar, comentários com uma frase pública curta. Elogios e emojis ela deixa passar.
- Não sabe ou é assunto sério (reclamação, parceria, negociação, pedido para falar com você) → não responde, marca **precisa de você** na aba Direct e fica 24 h quieta com essa pessoa. O botão **Devolver para a IA** libera antes.
- Você respondeu alguém (pelo painel ou pelo app do Instagram) → a IA fica 24 h sem falar com essa pessoa, para não atropelar você.
- Limites: até 8 respostas por pessoa por hora e o máximo por dia que você escolher (padrão 200). Tudo aparece na aba **Atividade**.

Custo: usa o Claude Opus 5.5 (`claude-opus-5-5`) com esforço baixo, uns poucos centavos de real por resposta. Para gastar bem menos, defina `AI_MODEL=claude-haiku-5-5` no Vercel (mais simples, porém bem mais barato).

## Regras da Meta (valem para o ManyChat também)
- **Direct por comentário**: 1 mensagem por comentário, em até 7 dias depois do comentário.
- **Direct normal**: só dá para responder em até **24 horas** depois da última mensagem da pessoa. O painel avisa quando passou.
- O robô não manda mensagem para quem nunca falou com a conta (a Meta não deixa).
- Não abuse: respostas iguais em massa podem ser limitadas pelo Instagram. Por isso a resposta pública aceita várias versões e o robô sorteia uma.

## Variáveis opcionais
| Nome | Para quê |
|---|---|
| `IG_GRAPH_VERSION` | Versão da API (padrão `v24.0`) |
| `AI_MODEL` | Modelo da IA (padrão `claude-opus-5-5`) |

## O que dá para adicionar depois
- Só mandar o link para quem **segue** a conta (a Meta informa isso depois que a pessoa responde o direct).
- Sequências (mandar outra mensagem quando a pessoa clica no botão) e respostas a **menções em stories**.
