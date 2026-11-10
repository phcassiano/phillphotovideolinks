# Modo cortes: pasta de vídeos → clipes virais prontos

Objetivo: o usuário aponta uma pasta com gameplays, lives ou reacts (ex.: GTA 6), e a skill
entrega N cortes verticais com estes elementos:
- **teaser** de 1,6 s com o pico ("ESPERA ESSA 👀") e efeito de rebobinar até o começo
- **título-gancho** fixo no topo, com selo do tipo (😱 GRITO, 🤯 REAÇÃO, 💥 AÇÃO, 😂 RISADA) e "PARTE 1/5"
- **legenda karaokê** de 1 a 3 palavras, com contorno grosso e a palavra falada destacada
- **zoom de impacto + tremida + flash + emoji + som de boom** em cada pico
- **barra de progresso** (retenção) e marca d'água com o @ do canal
- **CTA animado** no final ("COMENTA *CORTES*" com a caixa de comentário digitando)
- áudio normalizado em -14 LUFS (o padrão das redes)
- opcional: **compilado 16:9 "TOP N"** para o YouTube, com contagem #5 → #1

## Passo a passo

### 1. Projeto
```bash
bash <skill>/scripts/novo-projeto.sh ./cortes-gta
cd ./cortes-gta
```

### 2. Análise automática
```bash
node <skill>/scripts/analisar.mjs "/caminho/da/pasta/videos" --cortes=8 --duracao=30
```
Opções: `--min=15 --max=60` (limites em s), `--modelo=base` (whisper da análise; use `tiny`
para lives de muitas horas), `--idioma=pt`, `--sem-cenas` (mais rápido).

Tempo aproximado num computador comum: 1 h de live leva de 5 a 10 min (o resultado fica em cache em `.analise/`).

Saída: `analise.json` com `candidatos[]` (`id`, `arquivo`, `inicio`, `fim`, `pico`, `picos`,
`nota`, `tipo`, `sinais`, `trecho` falado) e `.analise/thumb-XX.jpg`.

### 3. Curadoria (é aqui que você agrega valor)
Para cada candidato, **leia o `trecho`** e **olhe a thumbnail** (Read na imagem). Descarte:
- trechos sem contexto (a pessoa só está explicando um menu, um loading)
- duplicados (o mesmo acontecimento em 2 candidatos)
- momentos com conteúdo impróprio para a plataforma

Para os que sobrarem, escreva:
- **título-gancho** de até 45 caracteres, em CAIXA ALTA no render, com 1 trecho `*destacado*`.
  Fórmulas: "ELE NÃO ESPERAVA *ISSO*", "O *FINAL* DESSA PERSEGUIÇÃO", "*3 MINUTOS* PRA CONSEGUIR ISSO",
  "NINGUÉM VIU *ESSE DETALHE*", "A *PIOR* DECISÃO DA LIVE"
- **emoji** do pico
- ajuste de `inicio`/`fim` se o trecho começa no meio de uma frase ou termina antes da reação

Mostre ao usuário a lista para aprovar (como um cartão "N momentos para aprovar"):

| # | tempo | tipo | título | por quê |
|---|---|---|---|---|
| 1 | 07:15 (0:41) | REAÇÃO | A CIDADE INTEIRA *APARECE* | streamer grita e para tudo |

Pergunte também: **@ do canal**, **palavra do CTA**, **layout** e se quer o **compilado**.

### 4. Layout
| layout | quando |
|---|---|
| `blur` (padrão) | gameplay sem facecam: vídeo no meio, fundo desfocado, título em cima e legenda embaixo |
| `split` | live com facecam: jogo em cima e rosto embaixo (é o que mais retém em react) |
| `crop` | tela cheia recortando o centro (ação centralizada, sem HUD importante nas laterais) |

Para o `split`, descubra onde está a facecam: gere um frame
(`ffmpeg -ss 60 -i video.mp4 -frames:v 1 frame.jpg`), olhe a imagem e estime o retângulo
em frações (x, y, w, h de 0 a 1). Ex.: facecam no canto inferior direito ≈ `{ "x": 0.72, "y": 0.66, "w": 0.27, "h": 0.32 }`.
`jogo` (opcional) recorta a área do jogo do mesmo jeito (ex.: tirar o chat lateral).

### 5. cortes.json
```json
{
  "tema": "neon-city",
  "handle": "@seucanal",
  "layout": "split",
  "facecam": { "x": 0.72, "y": 0.66, "w": 0.27, "h": 0.32 },
  "teaser": true,
  "cta": { "verb": "Comenta", "word": "CORTES" },
  "partes": false,
  "musica": null,
  "musicaVolume": 0.12,
  "modeloLegenda": "small",
  "idioma": "pt",
  "compilado": { "titulo": "Melhores momentos" },
  "cortes": [
    { "id": 3, "titulo": "Ele *não acreditou* no final", "emoji": "😱" },
    { "id": 1, "titulo": "A cidade inteira *apareceu*", "emoji": "🤯", "inicio": 431.2, "fim": 468.0 },
    { "id": 5, "titulo": "O carro *voou* da ponte", "emoji": "💥", "layout": "blur" }
  ]
}
```
Por item, também dá pra sobrescrever: `tag`, `picos` (s relativos ao corte), `teaser`, `cta` (`null` tira), `jogo` e `facecam`.
Use `"modeloLegenda": "medium"` se a fala tiver muita gíria ou barulho (fica mais lento e mais preciso).

### 6. Preparar e renderizar
```bash
node <skill>/scripts/preparar-cortes.mjs          # recorta, normaliza o áudio e transcreve cada corte
bash <skill>/scripts/render.sh . --cortes-previa  # 3 frames por corte: confira título, legenda e CTA
bash <skill>/scripts/render.sh . --cortes         # out/cortes/corte-XX.mp4 (+ compilado-youtube.mp4)
```
Antes do render final, **olhe as prévias**: título cortado, legenda em cima de algo importante
ou facecam mal enquadrada se corrigem no `cortes.json`, rodando `preparar-cortes.mjs` de novo.

Para corrigir uma palavra errada na legenda sem transcrever de novo, edite direto
`cortes/corte-XX.props.json` → `words[].text` e renderize.

### 7. Entrega
Para cada corte, entregue:
- o arquivo `out/cortes/corte-XX.mp4`
- a **legenda do post**: gancho + contexto curto + CTA + 3 a 5 hashtags (ex.: #gta6 #gtavi #cortes #gameplay #fyp)
- um **horário sugerido** e a ordem de postagem (comece pelo de maior nota)

## Dicas de viralização aplicadas por padrão
- Os primeiros 1,6 s mostram o clímax (teaser), o que segura o swipe.
- O título fica fixo o tempo todo: quem chega no meio entende o contexto.
- A legenda é grande e curta (o público assiste sem som), com a palavra falada destacada.
- O zoom e o som no pico reforçam o momento.
- O corte termina logo depois da reação, sem "enrolação" no final, e o CTA pede comentário (sinal forte pro algoritmo).
- Duração de 20 a 45 s: completa mais vezes e conta replays.

## Direitos
Cortes de streamers/jogos usam conteúdo de terceiros. Lembre o usuário de trabalhar com
autorização do streamer (muitos têm programa oficial de cortes) e seguir as regras de cada
plataforma. Isso vale também para monetização.
