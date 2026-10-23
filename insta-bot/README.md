# Robô do Instagram (estilo ManyChat)

Responde sozinho os comentários e as mensagens de direct do **@phill.photovideodf**, e tem um painel para você gerenciar tudo.

- **Automações por palavra-chave**: alguém comenta "QUERO" → o robô responde no comentário ("Te mandei no direct, @maria!") **e** manda o link no direct, com botão.
- Pode valer para **todos os posts** ou só para os que você escolher.
- Automações de **direct**: alguém escreve "câmera" → recebe o link. Também dá para criar uma mensagem de boas-vindas para qualquer direct (no máximo 1 vez a cada 12 h por pessoa).
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
| `privacidade.html` | Política de privacidade (a Meta exige o link) |
| `test/simulate.js` | Teste sem internet: `node insta-bot/test/simulate.js` |

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

## Regras da Meta (valem para o ManyChat também)
- **Direct por comentário**: 1 mensagem por comentário, em até 7 dias depois do comentário.
- **Direct normal**: só dá para responder em até **24 horas** depois da última mensagem da pessoa. O painel avisa quando passou.
- O robô não manda mensagem para quem nunca falou com a conta (a Meta não deixa).
- Não abuse: respostas iguais em massa podem ser limitadas pelo Instagram. Por isso a resposta pública aceita várias versões e o robô sorteia uma.

## Variáveis opcionais
| Nome | Para quê |
|---|---|
| `IG_GRAPH_VERSION` | Versão da API (padrão `v24.0`) |

## O que dá para adicionar depois
- Só mandar o link para quem **segue** a conta (a Meta informa isso depois que a pessoa responde o direct).
- Respostas com **IA** (Claude) para dúvidas que não batem com nenhuma palavra-chave.
- Sequências (mandar outra mensagem quando a pessoa clica no botão) e respostas a **menções em stories**.
