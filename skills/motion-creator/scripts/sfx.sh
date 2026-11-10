#!/usr/bin/env bash
# Gera efeitos sonoros simples (sem direitos autorais) com ffmpeg.
# Uso: bash scripts/sfx.sh <pasta-do-projeto>
set -euo pipefail
DIR="${1:-.}/public/sfx"
mkdir -p "$DIR"
# whoosh: ruído rosa com filtro varrendo + fade
ffmpeg -v error -y -f lavfi -i "anoisesrc=color=pink:duration=0.45:amplitude=0.9" \
  -af "highpass=f=300,lowpass=f=4000,afade=t=in:d=0.12,afade=t=out:st=0.18:d=0.27,volume=1.4" "$DIR/whoosh.wav"
# pop: seno curto descendo
ffmpeg -v error -y -f lavfi -i "sine=frequency=880:duration=0.12" \
  -af "afade=t=out:st=0.02:d=0.1,volume=0.8" "$DIR/pop.wav"

# boom: grave descendo + ruído (impacto no pico dos cortes)
ffmpeg -v error -y -f lavfi -i "aevalsrc='0.9*sin(2*PI*(110-80*t)*t)*exp(-5*t)+0.25*(random(0)-0.5)*exp(-14*t)':s=44100:d=0.7" \
  -af "lowpass=f=1800,volume=1.6" "$DIR/boom.wav"
echo "boom ok"
echo "SFX gerados em $DIR"
