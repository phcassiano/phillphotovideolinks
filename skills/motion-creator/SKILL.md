---
name: motion-creator
description: Estúdio de vídeo curto viral com Remotion. (1) MODO CORTES - recebe uma pasta de vídeos (gameplay, lives, reacts, ex. GTA 6), encontra sozinho os melhores momentos (gritos, reações, ação), e entrega clipes verticais editados com teaser, título-gancho, legenda karaokê, zoom e som nos picos, CTA animado e compilado "TOP N" pro YouTube. (2) MODO MOTION - cria vídeos em motion graphics do roteiro ao MP4 (cenas animadas, mascote, legendas, trilha) e carrosséis PNG. Use SEMPRE que o usuário pedir cortes, clipes, "melhores momentos", "corta essa live", "faz cortes desses vídeos", "vídeo viral", "fazer um vídeo", "animar", "motion", "vídeo pra Reels/TikTok/Shorts", "legenda animada", "mascote", mesmo sem citar Remotion.
---

# Motion Creator

## Qual modo?
- O usuário tem **vídeos prontos** (pasta de gameplay/lives/reacts) e quer **cortes** → **MODO CORTES**.
  Siga `references/cortes.md` do começo ao fim. É o fluxo principal desta skill.
- O usuário quer um **vídeo criado do zero** (motion, explicativo, anúncio, a partir de roteiro ou áudio) → **MODO MOTION** (abaixo).
- Dá pra combinar: cortes com uma abertura de motion (renderize a cena de motion e junte com `ffmpeg concat`).

### Modo cortes em 6 comandos
```bash
bash <skill>/scripts/novo-projeto.sh ./cortes                  # 1. projeto
cd ./cortes
node <skill>/scripts/analisar.mjs "/pasta/dos/videos" --cortes=8   # 2. acha os melhores momentos → analise.json
#   3. VOCÊ lê os trechos + thumbs, escreve títulos, monta a tabela e o usuário APROVA → cortes.json
node <skill>/scripts/preparar-cortes.mjs                        # 4. recorta, normaliza áudio, transcreve
bash <skill>/scripts/render.sh . --cortes-previa                # 5. confere 3 frames por corte
bash <skill>/scripts/render.sh . --cortes                       # 6. out/cortes/corte-XX.mp4 (+ compilado)
```
Requisitos na máquina: Node 18+, ffmpeg, e compilador C (make/gcc ou Xcode CLT no Mac) para o whisper.cpp, que é instalado sozinho na 1ª vez.

---

## MODO MOTION

Você vira um estúdio de motion: o usuário pede, você escreve o roteiro, monta as cenas,
anima, legenda, coloca som e entrega o **MP4 vertical 1080×1920**. O usuário só **aprova**.

O motor é um projeto Remotion pronto em `template/`. Você **não escreve animação do zero**:
você escreve um `video.json` que descreve as cenas, e o motor desenha tudo. Só crie
componentes novos quando nenhuma cena do catálogo servir.

## Arquivos da skill

- `template/`: projeto Remotion (motor, temas, 21 tipos de cena, mascote, legendas, composições `Corte` e `Compilado`)
- `references/cortes.md`: **modo cortes** completo (análise, curadoria, layouts, cortes.json, entrega)
- `scripts/analisar.mjs` / `scripts/preparar-cortes.mjs`: pipeline do modo cortes
- `references/cenas.md`: catálogo de cenas com todas as props e exemplos. **Leia antes de montar o video.json.**
- `references/roteiro.md`: fórmula de roteiro viral (gancho, progresso, prova, CTA) e tempos
- `references/estilos.md`: os 6 temas e quando usar cada um, além de como criar um tema novo
- `references/mascote.md`: como definir o mascote em 5 perguntas
- `scripts/novo-projeto.sh`: copia o template para uma pasta de trabalho e instala tudo
- `scripts/render.sh`: renderiza MP4 (e, opcionalmente, PNGs de cada cena pra carrossel)
- `scripts/transcrever.mjs`: transcreve um áudio de voz com timestamps por palavra (whisper.cpp)
- `scripts/sfx.sh`: gera os efeitos sonoros (whoosh/pop) sem direitos autorais

## Os 4 jeitos de fazer

Pergunte (ou deduza da mensagem) qual é o caso:

1. **Do zero**: o usuário dá o tema/produto. Você escreve o roteiro e as cenas.
2. **Áudio de voz**: o usuário manda uma narração. Transcreva com `scripts/transcrever.mjs`,
   use as palavras com tempo em `words` (legenda karaokê) e distribua as cenas pela duração da fala.
3. **Você na câmera**: o usuário manda um vídeo falando. Use cenas `video` como base,
   transcreva o áudio para `words` e intercale cenas animadas (counter, chart, checklist...) como inserts.
4. **Escolha um nicho**: o usuário diz o nicho e você propõe **3 ideias** (gancho + ângulo + CTA).
   Ele escolhe uma e você segue o fluxo "do zero".

## Fluxo de trabalho (siga na ordem)

### 1. Briefing rápido
Descubra apenas o que falta (no máximo 3 perguntas, numa só mensagem):
- objetivo (vender, engajar, levar pro link, ganhar seguidor) e CTA (ex.: "comenta QUERO")
- público e tom
- duração (padrão: **20–35 s**), tema visual (padrão: `neon-city`), mascote sim ou não
- arquivos: logo, fotos, vídeo, narração, música (vão em `public/`)

Se o pedido já for claro, **não pergunte**. Assuma os padrões e siga.

### 2. Roteiro + mapa de cenas → aprovação
Siga `references/roteiro.md`. Entregue ao usuário uma tabela curta como esta:

| # | Tempo | Cena | O que aparece | Legenda |
|---|-------|------|---------------|---------|
| 1 | 0:00–0:02 | countdown | contagem 30→1 na rua neon | — |
| 2 | 0:02–0:05 | lock | "Editar ainda é difícil." + cadeado | horas no *After Effects* |

Pergunte: **"Aprova ou quer mudar alguma cena?"** Ajuste até aprovar. Esse é o único ponto
em que o usuário precisa trabalhar.

### 3. Montar o projeto
```bash
bash <skill>/scripts/novo-projeto.sh ./meu-video      # copia o template e instala dependências
```
Copie os arquivos do usuário para `./meu-video/public/`. Escreva `./meu-video/video.json`
seguindo `references/cenas.md`. Regras:
- `duration` em segundos. A soma dá a duração do vídeo. Cenas entre **2 e 4 s** (a retenção cai se passar disso).
- Legenda (`caption`): curta, no máximo 6 palavras por linha, quebre linha com ` / `, destaque com `*palavra*`.
- Use `step` (estrelas ★★☆☆ 2/4) quando o vídeo tiver uma sequência de passos, porque prende até o final.
- Varie os tipos de cena e não repita o mesmo tipo duas vezes seguidas.
- `mascot: false` em cenas cheias (counter, chart, checklist) para não poluir.
- Para modos de áudio/câmera: preencha `voiceover` e `words`, e não use `caption` nas cenas.

Valide antes de renderizar:
```bash
cd ./meu-video && npx tsc --noEmit
```

### 4. Prévia rápida (frames-chave)
Renderize um PNG do meio de cada cena e **olhe as imagens** antes do MP4 completo:
```bash
bash <skill>/scripts/render.sh ./meu-video --previa
```
Confira se o texto cortou, se elementos se sobrepõem (legenda × objeto), se há contraste e se o
texto ficou fora da área segura (topo 250 px e base 300 px são cobertos pela interface do Reels).
Corrija o `video.json` e repita.

### 5. Render final
```bash
bash <skill>/scripts/render.sh ./meu-video            # → ./meu-video/out/video.mp4
bash <skill>/scripts/render.sh ./meu-video --carrossel # extra: PNG 1080×1350 de cada cena
```
Entregue o MP4 (e os PNGs, se pedidos) e um resumo: duração, cenas, legenda sugerida para o
post com 3 a 5 hashtags, e a palavra do CTA.

## Som
- `"sfx": true` coloca um whoosh em cada troca de cena (gerado por `scripts/sfx.sh`, sem direitos autorais).
- Trilha: o usuário coloca um MP3 em `public/` e você define `"music": "trilha.mp3"` e `"musicVolume": 0.4`.
  **Nunca** baixe música com direitos autorais. Sugira bibliotecas livres (YouTube Audio Library,
  Pixabay Music) ou o áudio em alta do próprio app, adicionado na hora de postar.
- Narração: `"voiceover": "voz.mp3"` e use `"musicVolume": 0.15` para a música não brigar com a voz.

## Quando o catálogo não basta
Crie um componente novo em `src/scenes/` seguindo o padrão de `SceneProps` (recebe
`p`, `theme`, `dur`), registre em `SCENES` dentro de `src/Video.tsx` e documente as props.
Use `useCurrentFrame()` + `interpolate`/`spring`. Nunca use `Math.random()`, use `rand(seed)`
de `src/util.ts`, porque o render precisa ser determinístico. Nunca use animação CSS (`transition`, `@keyframes`).

## Problemas comuns
- **Chrome não encontrado / download bloqueado**: defina `REMOTION_BROWSER=/caminho/do/chrome`.
- **Render lento**: `--concurrency=N` em `render.sh` (padrão: metade dos núcleos). Prévia com `--scale=0.5`.
- **Fonte diferente**: as fontes vêm de `@fontsource` (offline). Para outra fonte, instale `@fontsource/<nome>`
  e importe em `src/Video.tsx`.
- **Licença**: o Remotion é gratuito para pessoas físicas e empresas de até 3 pessoas. Acima disso, é preciso licença paga (remotion.pro).

## Direitos e marcas
Nos vídeos de motion, não recrie logos ou artes de marcas de terceiros. Citar o nome do jogo/marca
em texto não tem problema. Nos cortes, a filmagem é de terceiros, então lembre o usuário de ter
autorização do criador original e seguir as regras da plataforma (ver `references/cortes.md`).
