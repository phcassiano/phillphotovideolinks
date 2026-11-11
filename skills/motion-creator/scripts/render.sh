#!/usr/bin/env bash
# Renderiza o vídeo do projeto.
# Uso:
#   bash scripts/render.sh <pasta>              -> out/video.mp4
#   bash scripts/render.sh <pasta> --previa     -> out/previa/cena-XX.png (frame do meio de cada cena, 50%)
#   bash scripts/render.sh <pasta> --carrossel  -> out/carrossel/slide-XX.png (1080x1350, frame final de cada cena)
set -euo pipefail
DIR="${1:?informe a pasta do projeto}"
MODE="${2:-}"
cd "$DIR"
CORES=$(node -e "console.log(Math.max(1, Math.floor(require('os').cpus().length/2)))")
CONC="${CONCURRENCY:-$CORES}"
mkdir -p out

# lista de [inicio, duracao] em frames por cena
FRAMES=$(node -e '
const s=require("./video.json"); const fps=s.fps||30; let c=0;
console.log(s.scenes.map(x=>{const d=Math.max(1,Math.round(x.duration*fps)); const r=c+","+d; c+=d; return r}).join(" "));
')

if [ "$MODE" = "--cortes" ] || [ "$MODE" = "--cortes-previa" ]; then
  # modo cortes: renderiza cada cortes/corte-XX.props.json (+ compilado, se existir)
  npx remotion bundle --out-dir=out/.bundle --log=error >/dev/null
  mkdir -p out/cortes out/cortes-previa
  for props in cortes/corte-*.props.json; do
    name=$(basename "$props" .props.json)
    if [ "$MODE" = "--cortes-previa" ]; then
      # 3 quadros: início (título), pico (zoom) e fim (CTA)
      dur=$(node -e "const p=require('./$props');console.log(Math.round(((p.teaser?1.6:0)+p.duration)*30))")
      pk=$(node -e "const p=require('./$props');console.log(Math.round(((p.teaser?1.6:0)+(p.picos?.[0]??p.duration/2)+0.3)*30))")
      for f in 60 "$pk" $((dur-20)); do
        npx remotion still out/.bundle Corte "out/cortes-previa/$name-f$f.png" --props="$props" --frame="$f" --scale=0.5 --log=error
      done
    else
      echo "▶ $name"
      npx remotion render out/.bundle Corte "out/cortes/$name.mp4" --props="$props" --concurrency="$CONC" --log=error
    fi
  done
  if [ "$MODE" = "--cortes" ] && [ -f cortes/compilado.props.json ]; then
    echo "▶ compilado"
    npx remotion render out/.bundle Compilado out/cortes/compilado-youtube.mp4 --props=cortes/compilado.props.json --concurrency="$CONC" --log=error
  fi
  ls -1 out/cortes out/cortes-previa 2>/dev/null || true
elif [ "$MODE" = "--previa" ] || [ "$MODE" = "--carrossel" ]; then
  npx remotion bundle --out-dir=out/.bundle --log=error >/dev/null
  i=1
  for fd in $FRAMES; do
    start=${fd%,*}; dur=${fd#*,}
    n=$(printf "%02d" $i)
    if [ "$MODE" = "--previa" ]; then
      mkdir -p out/previa
      npx remotion still out/.bundle MotionVideo "out/previa/cena-$n.png" --frame=$((start + dur*6/10)) --scale=0.5 --log=error
    else
      mkdir -p out/carrossel
      npx remotion still out/.bundle MotionVideo "out/carrossel/tmp-$n.png" --frame=$((start + dur - 8)) --log=error
      # recorta 1080x1350 (4:5) centralizado para feed/carrossel
      ffmpeg -v error -y -i "out/carrossel/tmp-$n.png" -vf "crop=1080:1350:0:285" "out/carrossel/slide-$n.png" && rm "out/carrossel/tmp-$n.png"
    fi
    i=$((i+1))
  done
  ls -1 out/previa out/carrossel 2>/dev/null || true
else
  npx remotion render MotionVideo out/video.mp4 --concurrency="$CONC"
  echo "Pronto: $(pwd)/out/video.mp4"
fi
