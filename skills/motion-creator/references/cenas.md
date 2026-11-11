# Catálogo de cenas

## Estrutura do `video.json`

```jsonc
{
  "title": "Nome do vídeo",
  "fps": 30, "width": 1080, "height": 1920,
  "theme": "neon-city",                 // ver estilos.md
  "mascot": { "enabled": true, "shape": "cubo", "color": "#ff6a3d", "side": "right", "accessory": "nenhum" },
  "progress": { "enabled": true, "total": 4 },   // selo ★★☆☆ 2/4
  "sfx": true,                          // whoosh nas trocas de cena
  "music": "trilha.mp3", "musicVolume": 0.4,     // opcional (arquivo em public/)
  "voiceover": "voz.mp3",               // opcional
  "words": [ { "text": "olha", "start": 0.12, "end": 0.4 } ],  // opcional: legenda karaokê
  "scenes": [ /* ... */ ]
}
```

### Campos de toda cena

| campo | tipo | descrição |
|---|---|---|
| `type` | string | tipo da cena (tabela abaixo) |
| `duration` | número | segundos (2 a 4 é o ideal) |
| `caption` | string | legenda. ` / ` quebra linha, `*x*` destaca |
| `captionPosition` | `top` \| `middle` \| `bottom` | padrão `bottom` |
| `step` | número | acende o selo de progresso (1..total) |
| `mascot` | bool | mostra/esconde o mascote nesta cena |
| `theme` | string | troca o tema só nesta cena |
| `props` | objeto | props do tipo de cena e as **props comuns** abaixo |

**Props comuns (dentro de `props`)**
- `bg`: `skyline` (horizonte com sol), `street` (rua em perspectiva), `dark` (fundo desfocado, bom atrás de cartões) ou `none`
- `camera`: `push` (zoom lento, padrão), `pull`, `rise` (sobe) ou `tilt` (inclina)
- `mascotPose`: `idle`, `pula`, `acena` ou `anda`; `mascotSize` (px); `mascotY` (distância da base); `mascotLook`: `frente`, `cima` ou `lado`

## Tipos de cena

### Texto e impacto
| type | props | uso |
|---|---|---|
| `hook` | `kicker?`, `title`, `sub?`, `size?` | frase de abertura gigante |
| `countdown` | `from`, `to`, `label`, `sub?` | "9 DIAS", "30 SEGUNDOS"; bom com `bg:"street"` |
| `board` | `text`, `sub?`, `y?` | letreiro split-flap ("19 NOV", "1º DA FILA") |
| `lock` | `title`, `sub?`, `size?` | algo bloqueado / "ainda não saiu" |
| `reveal` | `badge`, `title?`, `sub?` | grande revelação com fogos e holofotes |
| `cta` | `verb?`, `word` | "COMENTA *PALAVRA*" com caixa de comentário digitando + coração |

### Dados e prova
| type | props | uso |
|---|---|---|
| `counter` | `value`, `from?`, `label?`, `badge?`, `prefix?`, `suffix?` | número subindo em placas dentro de anel neon (views, vendas, R$) |
| `chart` | `points[]`, `peakLabel?`, `from?`, `to?`, `title?` | gráfico neon se desenhando com marcação no pico |
| `checklist` | `title`, `subtitle?`, `items[{time?, tag?, text}]` | cartão com itens sendo aprovados ✓ |
| `coins` | `label?`, `stacks?[]` | pilhas de moedas subindo ("PAGA MAIS") |
| `compare` | `left{title,value,sub?}`, `right{...}` | antes × depois (esquerda riscada, direita destacada) |
| `steps` | `title?`, `items[]` | passo a passo numerado acendendo |

### Objetos e mídia
| type | props | uso |
|---|---|---|
| `tag` | `label`, `value` | etiqueta pendurada balançando ("LANÇADO / 2013", preço) |
| `calendar` | `header?`, `pages[]`, `footer?` | folhinha que vira; páginas anteriores ganham ✗ e a última ganha um círculo |
| `chat` | `title?`, `messages[{from:"eu"\|"ia"\|nome, text}]` | conversa aparecendo (pedido → resposta) |
| `cards` | `count?`, `labels?[]`, `images?[]`, `title?` | telas/cards em leque ("5 cortes prontos") |
| `photo` | `src`, `frame?: polaroid\|neon\|full`, `label?`, `zoom?: in\|out` | foto em movimento (Ken Burns) |
| `video` | `src`, `startFrom?`, `muted?`, `frame?: full\|phone` | você na câmera / clipe |
| `route` | `from`, `to`, `stops?[]` | mapa com rota sendo traçada |
| `mascot` | `pose?`, `say?`, `size?` | mascote protagonista com balão de fala |
| `headline` | `source`, `title`, `date?` | manchete de notícia |

Arquivos (`src`, `images`) são caminhos dentro de `public/` (ex.: `"fotos/1.jpg"`) ou URLs `https://`.

## Exemplo completo (25 s, neon-city)

```json
{
  "theme": "neon-city",
  "mascot": { "enabled": true, "color": "#ff6a3d" },
  "progress": { "enabled": true, "total": 3 },
  "sfx": true,
  "scenes": [
    { "type": "countdown", "duration": 2.4, "props": { "from": 9, "to": 1, "label": "DIAS", "sub": "para o lançamento", "bg": "street" }, "mascot": false },
    { "type": "lock", "duration": 2.6, "props": { "title": "Ainda não saiu." }, "caption": "e já é a *maior oportunidade*", "mascot": false },
    { "type": "chat", "duration": 3.2, "step": 1, "props": { "messages": [ { "from": "eu", "text": "corta essa live em 5 partes" }, { "from": "ia", "text": "Pronto! 5 cortes de 30s." } ] }, "mascot": false },
    { "type": "checklist", "duration": 3.6, "step": 2, "props": { "title": "5 momentos para aprovar", "items": [ { "time": "00:42", "tag": "GRITO", "text": "o susto · 0:38" }, { "time": "07:15", "tag": "REAÇÃO", "text": "a virada · 0:41" } ] } },
    { "type": "counter", "duration": 3.2, "step": 3, "props": { "value": 3700000, "label": "views em 1 corte", "badge": "POSTADO HÁ 2 MESES" }, "mascot": false },
    { "type": "reveal", "duration": 2.8, "props": { "badge": "6", "title": "Imagina", "sub": "o próximo." }, "mascot": false },
    { "type": "cta", "duration": 3.2, "props": { "word": "CORTES" } }
  ]
}
```
