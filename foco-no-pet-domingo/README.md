# Foco no Pet · Reels "Seu pet na capa" (Remotion)

Reels 1080×1920, 30 fps, 21 s, H.264 + efeitos sonoros (sem música, para você colocar um áudio em alta no Instagram).
Objetivo: vender ensaios e agendamentos para o próximo domingo. Saída: `out/foco-no-pet-domingo.mp4`.

| Tempo | Cena | Função |
|---|---|---|
| 0–3 s | Título "FOCO" de revista no topo, o cane corso logo abaixo e, sobre o peito: "Domingo agora seu pet vira capa **de revista** 📸" | Gancho: flash de câmera e promessa clara |
| 3–10,5 s | 5 capas (título no topo, a foto inteira sem corte no meio, chamada embaixo) da revista "FOCO no Pet" entrando no ritmo (ESTILO, SORRISO, OLHAR, ATITUDE, TOCA AQUI) | Prova visual e desejo; formato que o pessoal compartilha |
| 10,5–14 s | Como garantir: 1. chama no WhatsApp · 2. escolhe o horário de domingo · 3. seu pet vira capa | Tira a fricção |
| 14–17 s | Calendário carimbando: "Neste DOMINGO 18/10 · ⏰ A partir das 7h · 📍 Parque dos Jequitibás, Sobradinho-DF · agenda aberta, horários por ordem de agendamento" | Urgência sem inventar números |
| 17–21 s | Capa vazia "SEU PET AQUI?" + "Comenta **CAPA** 👇 que a gente te manda os horários" + WhatsApp | Comentário com palavra-chave (impulsiona o alcance) e contato direto |

## Toda semana
Edite **`src/config.ts`**: troque `domingo` (ex.: `'25/10'`), `horario` e `local` e, se quiser, as capas, os textos, as cores ou os tempos. Depois:

```bash
npm install          # uma vez
npm run studio       # assistir e ajustar no navegador
npm run stills       # PNG do meio de cada cena em out/stills/ (com e sem guias de safe zone)
npm run render       # gera os efeitos (public/sfx.wav) e out/foco-no-pet-domingo.mp4
```
Para trocar fotos: coloque em `public/photos/` e aponte em `CONFIG.hook.photo` / `CONFIG.capas[].photo`; ajuste `focus` (0 a 1) se o rosto sair cortado.

Safe zones do Reels respeitadas: nada nos 220 px do topo, nos 420 px da base (legenda e botões) nem nos 130 px da direita (curtir, comentar, compartilhar).

## Legenda sugerida
> Domingo agora seu pet vira capa de revista 📸🐾
>
> Ensaio Foco no Pet neste domingo (18/10), a partir das 7h, no Parque dos Jequitibás em Sobradinho-DF. Agenda aberta, horários por ordem de agendamento.
>
> 👇 Comenta **CAPA** que a gente te manda os horários
> 📲 Ou chama no WhatsApp (61) 99989-0604
>
> Marca quem tem um pet que merece ser capa! 🐶
>
> #FocoNoPet #EnsaioPet #FotografiaPet #PetLovers #Cachorro #DogsOfInstagram #Sobradinho #Brasilia #DF

---

# Reels de VENDA · "2.000 fotos e nenhuma pra parede" (`FocoNoPetVenda`)

23 s, cortes secos no ritmo, efeitos sonoros. Objetivo: **agendamento e fechamento** para o domingo.
Saída: `out/foco-no-pet-venda.mp4` · Render: `npm run render:venda` · Copy e fotos: `src/venda/config.ts` (data, horário, local e WhatsApp vêm do `src/config.ts`).

| Tempo | Cena | Gatilho |
|---|---|---|
| 0–3,2 s | Rolo da câmera rolando, "📱 2.347 fotos": "Você tem 2.000 fotos do seu pet no celular… e **NENHUMA** pra pendurar na parede." | Dor universal + identificação |
| 3,2–5,8 s | "Foto de celular 😩": TREMIDA · ESCURA · CORTOU A ORELHA, com X vermelho | Agitação |
| 5,8–7,2 s | "Agora olha isso 👇" | Virada / curiosidade |
| 7,2–12,2 s | 3 clipes animados com Veo (1 s cada) intercalados com 5 fotos (0,4 s cada), inteiras e sem texto no rosto, com selos: estúdio montado no parque · fundo colorido · luz profissional · todo porte, toda raça | Prova e desejo |
| 12,2–15,8 s | Domingo 18/10 · ⏰ a partir das 7h · 📍 Parque dos Jequitibás · Sobradinho-DF | Oferta concreta |
| 15,8–18 s | "Quem chama primeiro escolhe o horário ⏳" | Urgência verdadeira |
| 18–19,8 s | Cane corso animado (Veo) + "Seu pet não vai ser filhote pra sempre. A foto vai. 🐾" | Emoção |
| 19,8–23,4 s | "Garanta o horário do seu pet" + WhatsApp + "ou comenta QUERO" | Ação |

## Legenda
> Você tem 2.000 fotos do seu pet no celular… e quantas dá pra pendurar na parede? 😅
>
> Domingo agora (18/10) tem ensaio Foco no Pet no Parque dos Jequitibás, em Sobradinho, a partir das 7h. Estúdio montado no parque, fundo colorido e luz profissional, pra pet de todo porte e toda raça. 📸🐾
>
> ⏳ Quem chama primeiro escolhe o horário.
> 📲 WhatsApp (61) 99989-0604, ou comenta **QUERO** que a gente te chama.
>
> Seu pet não vai ser filhote pra sempre. A foto vai. 🧡
>
> #FocoNoPet #EnsaioPet #FotografiaPet #ParqueDosJequitibas #Sobradinho #SobradinhoDF #Brasilia #PetLovers #DogsOfInstagram

## Scripts de atendimento (para fechar)
**1. Quem comentou QUERO (direct):**
> Oi! 😍 Vi que você quer o ensaio do seu pet! É neste domingo (18/10), a partir das 7h, no Parque dos Jequitibás em Sobradinho. Qual o nome e a raça do seu pet? Já te passo os horários livres 📸

**2. Depois que a pessoa responde (ofereça duas opções, não uma pergunta aberta):**
> Que lindo(a), [nome do pet]! 🐶 Tenho [horário A] ou [horário B] no domingo. Qual fica melhor pra vocês? Os primeiros horários costumam ser os mais tranquilos, com o parque mais vazio.

**3. Fechamento:**
> Perfeito! Pra garantir o horário de [horário], é só [forma de confirmação/sinal]. Assim que confirmar, já deixo o [nome do pet] na agenda ✅

**4. Quem sumiu (sábado à tarde):**
> Oi! Passando pra avisar que ainda dá tempo de garantir o ensaio do [nome do pet] amanhã no Parque dos Jequitibás 📸 Quer que eu reserve um horário?

> Preencha `[forma de confirmação/sinal]` com a regra real de vocês (Pix de sinal, confirmação por mensagem etc.).

## Clipes animados com IA (Veo 3.1)
Os clipes em `public/clips/` (p01 lulu, p04 golden, p06 shih tzu, p13 cane corso) foram gerados com o **Veo 3.1 Fast** (Gemini API) a partir das fotos do ensaio, 4 s cada, só com movimento sutil (respirar, piscar, virar a cabeça). Na montagem cada clipe fica 1 s na tela; o do cane corso aparece no fechamento.

### Como gerar mais clipes
A montagem aceita clipes no lugar das fotos: salve o `.mp4` em `public/clips/` e troque, em `src/venda/config.ts`, `{ photo: 'photos/p13.jpg' }` por `{ video: 'clips/p13.mp4' }`. A foto continua inteira na tela, com a mesma foto desfocada nas laterais.

Prompt sugerido no Flow/Veo (modo *imagem para vídeo*, 9:16, use a foto como primeiro quadro):
> Keep the exact same dog, studio backdrop, lighting and framing from the image. The dog gently pants with its tongue out, blinks once and slightly tilts its head, ears moving naturally. Static camera, no zoom, no new objects, photorealistic, 4 seconds.

Fotos que mais ganham com animação: `p13` (cane corso deitado), `p01` (lulu de óculos), `p04` (golden), `p06` (shih tzu), `p09` (lulu "toca aqui").

---

# Reels "Se o seu pet pudesse falar" (`FocoNoPetFala`): engraçado + emocional

23 s · `npm run render:fala` → `out/foco-no-pet-fala.mp4` · Falas, clipes e tempos em `src/fala/config.ts`.
Os pets "falam" em balões ("🔊 tradução do latido"), sempre acima deles, sem cobrir o rosto. Clipes novos do Veo 3.1: `fala-p04` (golden "falando"), `fala-p05` (lulu num bocejo dramático), `fala-p12` (cane corso com olhar pidão).

| Tempo | Pet | Fala |
|---|---|---|
| 0–3 s | Golden mexendo a boca | "Humano, a gente precisa conversar. 😤" |
| 3–6,2 s | Lulu de óculos | "Você tira 300 fotos minhas por dia…" → o clipe treme e borra ("📱 foto de celular") → "…e TODAS saem tremidas. 😑" |
| 6,2–9 s | Lulu bocejando | "Eu sou um MODELO. 💅" → "Mereço um ensaio de verdade." |
| 9–11,8 s | Shih tzu | "Domingo tem estúdio no Parque dos Jequitibás…" → "…e eu já treinei a pose. 😌" |
| 11,8–16 s | Cane corso olhando pra câmera (tela escurece) | "Eu cresço rápido, sabia? 🥺" → "Um dia eu não vou mais caber no seu colo." → "Mas essa foto vai durar pra sempre. 🤍" |
| 16–19,4 s | (pedido) | "Me leva? 🥺" · Domingo 18/10 · ⏰ a partir das 7h · 📍 Parque dos Jequitibás · Sobradinho-DF |
| 19,4–23,4 s | (chamada) | "Marca o humano que me deve esse ensaio 😂" · WhatsApp · "ou comenta EU QUERO 🐾" · "Quem chama primeiro escolhe o horário ⏳" |

## Legenda
> Ele pediu pra eu postar isso. 🐶📝
>
> "Humano, você tira 300 fotos minhas por dia e todas saem tremidas. Eu sou um MODELO." 💅
>
> Domingo agora (18/10) tem ensaio Foco no Pet no Parque dos Jequitibás, em Sobradinho, a partir das 7h. 📸
> Porque eles crescem rápido demais… e um dia não cabem mais no colo. 🥺🤍
>
> 📲 WhatsApp (61) 99989-0604, ou comenta **EU QUERO** que a gente te chama.
> ⏳ Quem chama primeiro escolhe o horário.
>
> Marca o humano que tá devendo esse ensaio pro pet 😂👇
>
> #FocoNoPet #EnsaioPet #FotografiaPet #SeMeuCachorroFalasse #ParqueDosJequitibas #Sobradinho #SobradinhoDF #Brasilia #PetLovers #DogsOfInstagram
