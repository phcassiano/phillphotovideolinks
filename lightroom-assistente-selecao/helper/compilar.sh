#!/bin/bash
# Compila o programa de análise e coloca dentro do plugin.
# Requer as ferramentas de linha de comando da Apple:  xcode-select --install
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "Não achei o compilador Swift. Rode:  xcode-select --install  e tente de novo."
  exit 1
fi

DESTINO="../AssistenteSelecao.lrplugin/bin"
mkdir -p "$DESTINO"
echo "Compilando…"
swiftc -O -target "$(uname -m)-apple-macos11" Sources/*.swift -o "$DESTINO/assistente-analise"
chmod +x "$DESTINO/assistente-analise"
"$DESTINO/assistente-analise" --versao
echo "Pronto. Agora adicione a pasta AssistenteSelecao.lrplugin no Gerenciador de plug-ins do Lightroom."
