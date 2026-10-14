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
