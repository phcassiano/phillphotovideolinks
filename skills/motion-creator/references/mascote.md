# Mascote

O mascote é um personagem da marca que aparece no canto das cenas, pula na CTA, anda no
mapa e pode protagonizar uma cena (`type: "mascot"`). Ele aumenta o reconhecimento: as
pessoas lembram do "bonequinho".

## As 5 perguntas (faça numa mensagem só)
1. Qual a **personalidade** da marca? (divertida, séria, ousada, fofa)
2. Qual **cor** representa a marca? (hex ou nome)
3. Formato preferido: **cubo** (geek/tech), **gota** (fofo/orgânico) ou **fantasma** (misterioso/divertido)?
4. Algum **acessório**? boné, óculos, coroa, fone (ou nenhum)
5. De que **lado** ele fica? (esquerda/direita)

Se o usuário mandar uma **imagem de referência** de mascote, extraia a cor e o formato
mais próximo e proponha 3 combinações:

```json
{ "enabled": true, "shape": "cubo", "color": "#ff6a3d", "accessory": "fone", "side": "right" }
{ "enabled": true, "shape": "gota", "color": "#3fd0c9", "accessory": "oculos", "side": "left" }
{ "enabled": true, "shape": "fantasma", "color": "#b388ff", "accessory": "coroa", "side": "right" }
```

Renderize uma prévia das 3 numa cena `mascot` (uma por vez, com `render.sh --previa`) e deixe
o usuário escolher.

## Poses
`idle` (respira), `pula` (comemora), `acena` (dá oi / CTA) e `anda` (jornada).
Use `mascotPose` dentro de `props` em qualquer cena.

## Mascote 100% personalizado
Se o usuário tiver o mascote em PNG (fundo transparente), coloque em `public/mascote.png` e
use uma cena `photo` com `frame: "full"` só para apresentar. Para ele aparecer em todas as cenas,
troque o SVG em `src/components/Mascot.tsx` por um `<Img src={staticFile("mascote.png")} />` mantendo
as transformações de pulo/respiração.
