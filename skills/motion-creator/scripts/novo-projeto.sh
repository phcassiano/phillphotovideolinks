#!/usr/bin/env bash
# Cria uma pasta de projeto de vídeo a partir do template.
# Uso: bash scripts/novo-projeto.sh <pasta-destino>
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?informe a pasta de destino, ex.: ./meu-video}"
if [ -e "$DEST/package.json" ]; then
  echo "Já existe um projeto em $DEST. Só vou atualizar dependências."
else
  mkdir -p "$DEST"
  # copia tudo menos node_modules/out
  (cd "$SKILL_DIR/template" && tar --exclude=node_modules --exclude=out -cf - .) | (cd "$DEST" && tar -xf -)
fi
cd "$DEST"
command -v node >/dev/null || { echo "Instale o Node.js 18+ (https://nodejs.org)"; exit 1; }
command -v ffmpeg >/dev/null || echo "Aviso: ffmpeg não encontrado (o Remotion usa o dele; só os SFX e a transcrição precisam)."
npm install --no-audit --no-fund
[ -f public/sfx/whoosh.wav ] || bash "$SKILL_DIR/scripts/sfx.sh" . || true
echo "Projeto pronto em $(pwd). Edite video.json e rode scripts/render.sh"
