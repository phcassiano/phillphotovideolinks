#!/bin/bash
# Monta o instalador do Assistente de Seleção (roda num Mac com Xcode ou as ferramentas de linha
# de comando). Gera em ../dist:
#   AssistenteSelecao-<versão>.pkg  instalador (instala para todos os usuários do Mac)
#   AssistenteSelecao-<versão>.zip  plugin pronto, para quem preferir adicionar à mão
set -euo pipefail
cd "$(dirname "$0")/.."
RAIZ="$(pwd)"

VERSAO=$(sed -n 's/.*VERSION = { major = \([0-9]*\), minor = \([0-9]*\), revision = \([0-9]*\).*/\1.\2.\3/p' \
  AssistenteSelecao.lrplugin/Info.lua)
[ -n "$VERSAO" ] || { echo "Não achei a versão em Info.lua"; exit 1; }
echo "Versão $VERSAO"

TRABALHO="$(mktemp -d)"
trap 'rm -rf "$TRABALHO"' EXIT
DIST="$RAIZ/dist"
rm -rf "$DIST"; mkdir -p "$DIST"

# 1. Programa de análise universal (Apple Silicon + Intel)
echo "Compilando…"
for ARQ in arm64 x86_64; do
  swiftc -O -target "$ARQ-apple-macos11" helper/Sources/*.swift -o "$TRABALHO/assistente-$ARQ"
done
lipo -create "$TRABALHO/assistente-arm64" "$TRABALHO/assistente-x86_64" -output "$TRABALHO/assistente-analise"
# Assinatura ad hoc (sem certificado): exigida para rodar em Apple Silicon
codesign --force --sign - "$TRABALHO/assistente-analise"
lipo -info "$TRABALHO/assistente-analise"

# 2. Plugin completo
PLUGIN="$TRABALHO/plugin/AssistenteSelecao.lrplugin"
mkdir -p "$(dirname "$PLUGIN")"
rsync -a --exclude 'bin/assistente-analise' --exclude '.gitkeep' AssistenteSelecao.lrplugin/ "$PLUGIN/"
mkdir -p "$PLUGIN/bin"
cp "$TRABALHO/assistente-analise" "$PLUGIN/bin/"
chmod 755 "$PLUGIN/bin/assistente-analise"
"$PLUGIN/bin/assistente-analise" --versao

# 3. Zip (plugin pronto + instrução)
( cd "$TRABALHO/plugin" && cp "$RAIZ/instalador/recursos/LEIA-ME.txt" . \
  && ditto -c -k --sequesterRsrc . "$DIST/AssistenteSelecao-$VERSAO.zip" )

# 4. Pacote .pkg: instala na pasta de módulos do Lightroom (todos os usuários),
#    de onde o Lightroom Classic carrega o plugin sozinho.
CARGA="$TRABALHO/carga"
DESTINO="$CARGA/Library/Application Support/Adobe/Lightroom/Modules"
mkdir -p "$DESTINO"
cp -R "$PLUGIN" "$DESTINO/"
pkgbuild --root "$CARGA" --install-location / \
  --identifier com.phillcassiano.assistenteselecao --version "$VERSAO" \
  --scripts instalador/scripts --ownership recommended \
  "$TRABALHO/componente.pkg"

sed "s/__VERSAO__/$VERSAO/g" instalador/distribuicao.xml > "$TRABALHO/distribuicao.xml"
productbuild --distribution "$TRABALHO/distribuicao.xml" --resources instalador/recursos \
  --package-path "$TRABALHO" "$DIST/AssistenteSelecao-$VERSAO.pkg"

echo "$VERSAO" > "$DIST/VERSAO"
ls -lh "$DIST"
