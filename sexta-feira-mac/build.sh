#!/bin/bash
# Compila o app e monta o pacote "Sexta-feira.app".
#   ./build.sh            -> gera build/Sexta-feira.app
#   ./build.sh --install  -> também copia para /Applications e abre
set -euo pipefail
cd "$(dirname "$0")"

echo "▶︎ Compilando (release)…"
swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"

APP="build/Sexta-feira.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/SextaFeira" "$APP/Contents/MacOS/SextaFeira"
cp "$BIN_DIR/SextaFeiraHelper" "$APP/Contents/MacOS/SextaFeiraHelper"
cp Resources/Info.plist "$APP/Contents/Info.plist"
cp Resources/install-helper.sh "$APP/Contents/Resources/install-helper.sh"
chmod +x "$APP/Contents/Resources/install-helper.sh"

echo "▶︎ Assinando localmente (ad-hoc)…"
codesign --force --sign - "$APP/Contents/MacOS/SextaFeiraHelper"
codesign --force --sign - "$APP"

echo "✅ Pronto: $APP"

if [[ "${1:-}" == "--install" ]]; then
  pkill -x SextaFeira 2>/dev/null || true
  rm -rf "/Applications/Sexta-feira.app"
  cp -R "$APP" /Applications/
  open "/Applications/Sexta-feira.app"
  echo "✅ Instalado em /Applications e aberto."
fi
