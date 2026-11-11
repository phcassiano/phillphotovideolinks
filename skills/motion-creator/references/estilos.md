# Estilos (temas)

Defina em `"theme"` no `video.json`. Cada cena pode trocar com `"theme"` próprio, por exemplo
um flashback no estilo `analogico` no meio de um vídeo `neon-city`.

| tema | visual | quando usar |
|---|---|---|
| `neon-city` | cidade 2.5D synthwave, sol listrado, grade neon, roxo/rosa/laranja | games, tecnologia, lançamentos, criadores, "hype" |
| `analogico` | papel/filme quente, granulado forte, scanlines, fonte de máquina | nostalgia, história, "antes e depois", storytelling |
| `quadro` | lousa verde com giz, moldura de madeira | educação, explicações, aulas, dicas |
| `pop` | claro, blocos coloridos arredondados | varejo, beleza, lifestyle, público amplo |
| `luxo` | preto e dourado, feixes de luz, partículas | alto padrão, imóveis, joias, fotografia premium, mentorias |
| `mapa` | mapa azul com ruas e grade | viagens, logística, delivery, "minha jornada", eventos |

Dica: as cenas `route` combinam com o tema `mapa`, as cenas `photo` (polaroid) com `analogico`
e `luxo`, e `counter`/`chart` com `neon-city`.

## Criar um tema novo (a partir de uma referência)
Quando o usuário mandar uma imagem/vídeo de referência de estilo:
1. Extraia de 3 a 5 cores dominantes (céu escuro → claro, cor de destaque, acento).
2. Escolha o cenário base mais próximo (`city`, `paper`, `board`, `blocks`, `velvet`, `map`).
3. Adicione uma entrada em `THEMES` (`template/src/theme.ts`) e o nome em `ThemeName` (`src/types.ts`).
4. Ajuste `glow` (0 = plano, 1 = neon forte), `grain` e `scanlines`.
5. Faça a prévia (`render.sh --previa`) e compare lado a lado com a referência.

Campos do tema: `sky[3]` (gradiente do fundo), `primary` (neon/destaque), `secondary`, `accent`,
`text`, `ink` (texto em cartão claro), `card`, `highlight[2]` (gradiente da palavra destacada),
`fontDisplay`, `fontBody`, `backdrop`, `glow`, `grain` e `scanlines`.
