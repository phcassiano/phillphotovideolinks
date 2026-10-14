# Foco no Pet · Reels viral (JavaScript)

Reels 1080×1920, 30 fps, 27 s, com motion graphics em Canvas 2D e só efeitos sonoros (sem trilha), sintetizados em JS e sincronizados com cada corte.

| Tempo | Cena | Gatilho de retenção |
|---|---|---|
| 0–2,5 s | Golden em tela cheia, "ISSO NÃO É IA." palavra a palavra com tremida, "São fotos REAIS do seu pet" | Gancho de quebra de padrão + "espera até o final 👀" |
| 2,5–12,5 s | 10 polaroids caindo e se empilhando sobre fundo laranja, flash de câmera e palavra de personalidade (ESTILOSO 😎, SORRISÃO 😁…) | Uma foto por segundo, contador 01/10 |
| 12,5–14,5 s | Sequência rápida em meia batida: foto inteira emoldurada sobre a mesma foto desfocada, "CADA PET É ÚNICO", respiro antes do drop | Aceleração |
| 14,5–20,5 s | Grade 4×3 com as 12 fotos inteiras e numeradas, "QUAL É O SEU FAVORITO?", roleta, "COMENTA O NÚMERO 👇" | Comentários |
| 20,5–27 s | Logo animada (obturador gira, pata, nome), "AGENDE O ENSAIO DO SEU PET", "LINK NA BIO", "Marca quem tem um pet assim 🐾" | CTA + marcação; a íris fecha e emenda no início (loop) |

## Arquivos
- `reel.js`: linha do tempo e todas as animações (`drawFrame(ctx, t)` é determinístico)
- `efeitos.js`: gera `efeitos-foco-no-pet.wav` com os efeitos sonoros (clique de câmera, impactos, whooshes, pops, roleta) nos mesmos tempos
- `index.html`: preview no navegador com play e barra de tempo
- `render.js`: renderiza quadro a quadro no Chromium (Playwright) e gera `foco-no-pet-reels.mp4` com ffmpeg
- `assets/`: fotos (extraídas do Reels anterior na altura total, sem o escurecimento e o selo antigos; `FOCUS` no `reel.js` marca o rosto de cada pet para o enquadramento), logo e fontes Anton e Montserrat (OFL)

## Como usar
```bash
npm install
npm run render     # gera os efeitos sonoros e o MP4
npm run preview    # abre http://localhost:8080 para assistir/ajustar
```
Para trocar textos, fotos ou tempos, edite `CARDS`, `RUSH`, `GRID` e `S` no `reel.js`.

---

# Modelo 2 · "Fim de semana" (`fds.js`)

Reels de conversão, 24 s, só efeitos sonoros. O objetivo é fazer a pessoa **comentar "FDS"** (para receber onde vocês vão estar no fim de semana) ou **chamar no direct para agendar**.

| Tempo | Cena | Por que funciona |
|---|---|---|
| 0–3 s | Cane corso em tela cheia: "SEU PET NÃO VAI SER FILHOTE PRA SEMPRE 🥺 …mas essa foto vai durar pra sempre ✨" | Gancho emocional, que gera compartilhamento e marcação |
| 3–9 s | **Celular vs Ensaio**: controle deslizante revela a foto profissional sobre a "foto de celular" (tremida, no escuro, cortou a cabeça) | Antes e depois prende a atenção e mostra o valor |
| 9–13 s | **Como funciona?** Estúdio montado no parque · fundo colorido e luz de estúdio · todo porte, toda raça · recordação pra vida toda | Tira as objeções sem prometer preço ou prazo |
| 13–17 s | Mural das fotos rolando: "SEU PET PODE SER O PRÓXIMO 📸" | Prova social |
| 17–24 s | "ESSE FIM DE SEMANA TEM ENSAIO · SÁB · DOM · QUER SABER ONDE? 📍" → "COMENTA 👇 FDS 🐾" digitando num comentário → "que a gente te manda ONDE vamos estar no fds" + "ou chama no DIRECT pra agendar" | Chamada com palavra-chave: o comentário impulsiona o alcance e vira contato |

> A "foto de celular" é a própria foto do ensaio estragada de propósito (desfoque, escuro, corte), só para ilustrar a comparação.

```bash
npm run render:fds   # gera efeitos-fds.wav e foco-no-pet-fds.mp4
```
Preview: abra `index.html?reel=fds`.

**Sugestão de legenda:** "Ele cresce rápido demais 🥺 Esse fim de semana tem ensaio Foco no Pet! Comenta FDS que a gente te manda onde vai estar 📍 ou chama no direct pra garantir o horário do seu pet 📸🐾"
