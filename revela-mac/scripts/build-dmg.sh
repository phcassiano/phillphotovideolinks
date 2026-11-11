#!/bin/bash
# Gera build/Revela.dmg: compila (Apple Silicon e Intel), monta o Revela.app, assina sem
# conta de desenvolvedor (assinatura local, "ad-hoc") e empacota com atalho para Aplicativos.
# Rodar num Mac (ou no GitHub Actions): ./scripts/build-dmg.sh [versão]
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-0.1.0}"
BUILD="${GITHUB_RUN_NUMBER:-1}"

swift build -c release --arch arm64 --arch x86_64
BIN="$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)/Revela"

APP=build/Revela.app
rm -rf build && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Revela"
sed -e "s/VERSION/$VERSION/" -e "s/BUILD/$BUILD/" Resources/Info.plist > "$APP/Contents/Info.plist"

# Ícone: todos os tamanhos que o macOS pede, a partir do PNG de 1024.
ICONSET=build/AppIcon.iconset
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s Resources/AppIcon-1024.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) Resources/AppIcon-1024.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"

STAGE=build/dmg
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Aplicativos"
hdiutil create -volname "Revela" -srcfolder "$STAGE" -ov -format UDZO build/Revela.dmg
echo "Pronto: build/Revela.dmg ($VERSION, build $BUILD)"
