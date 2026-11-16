#!/bin/bash
# Gera build/Sexta-feira.dmg (arrastar para Aplicativos).
set -euo pipefail
cd "$(dirname "$0")"

./build.sh

APP="build/Sexta-feira.app"
DMG="build/Sexta-feira.dmg"
STAGE="build/dmg"

rm -rf "$STAGE" "$DMG"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

hdiutil create -volname "Sexta-feira" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
rm -rf "$STAGE"
echo "✅ DMG pronto: $(pwd)/$DMG"
