#!/bin/bash
# Instala (ou atualiza) a Sexta-feira, remove o Pulso e instala o ajudante de bateria e ventoinha.
# Uso no Terminal do Mac:
#   curl -fsSL https://raw.githubusercontent.com/phcassiano/phillphotovideolinks/ccr-25491ce5-f2q1mg/sexta-feira-mac/instalar.sh | bash
set -euo pipefail

DMG_URL="https://github.com/phcassiano/phillphotovideolinks/releases/download/sexta-feira-latest/Sexta-feira.dmg"
APP="/Applications/Sexta-feira.app"
TRASH="$HOME/.Trash"
TMP="$(mktemp -d)"
trap 'hdiutil detach -quiet "$TMP/mnt" 2>/dev/null || true; rm -rf "$TMP"' EXIT

echo "🔐 Vou pedir sua senha do Mac (para remover o Pulso e instalar o ajudante)."
sudo -v

echo "⬇️  Baixando a Sexta-feira…"
curl -fL --progress-bar "$DMG_URL" -o "$TMP/Sexta-feira.dmg"

# ---------- Pulso ----------
echo "🧹 Removendo o Pulso (se estiver instalado)…"
osascript -e 'tell application "Pulso" to quit' >/dev/null 2>&1 || true
pkill -ix pulso 2>/dev/null || true

PULSO_BID=""
for candidate in "/Applications/Pulso.app" "$HOME/Applications/Pulso.app"; do
  if [[ -d "$candidate" ]]; then
    PULSO_BID="$(defaults read "$candidate/Contents/Info" CFBundleIdentifier 2>/dev/null || true)"
    mv "$candidate" "$TRASH/Pulso-$(date +%s).app" 2>/dev/null || sudo rm -rf "$candidate"
    echo "   • app Pulso enviado para o Lixo"
  fi
done

# Ajudantes / agentes do Pulso (o ajudante dele pode ter deixado a carga travada)
for f in $(sudo find /Library/LaunchDaemons /Library/PrivilegedHelperTools -maxdepth 1 -iname '*pulso*' 2>/dev/null); do
  if [[ "$f" == *.plist ]]; then
    sudo launchctl bootout system "$f" 2>/dev/null || true
  fi
  sudo rm -f "$f"
  echo "   • removido: $f"
done
for f in $(find "$HOME/Library/LaunchAgents" -maxdepth 1 -iname '*pulso*' 2>/dev/null); do
  launchctl bootout "gui/$(id -u)" "$f" 2>/dev/null || true
  rm -f "$f"
  echo "   • removido: $f"
done

# Restos em ~/Library
LIB="$HOME/Library"
for d in "Application Support" "Caches" "Preferences" "Containers" "Saved Application State" "HTTPStorages" "WebKit" "Logs" "Group Containers"; do
  [[ -d "$LIB/$d" ]] || continue
  while IFS= read -r -d '' item; do
    mv "$item" "$TRASH/" 2>/dev/null || rm -rf "$item"
    echo "   • resto enviado para o Lixo: ${item/#$HOME/~}"
  done < <(find "$LIB/$d" -maxdepth 1 \( -iname '*pulso*' ${PULSO_BID:+-o -iname "*$PULSO_BID*"} \) -print0 2>/dev/null)
done

# ---------- Sexta-feira ----------
echo "📦 Instalando a Sexta-feira…"
osascript -e 'tell application "Sexta-feira" to quit' >/dev/null 2>&1 || true
pkill -x SextaFeira 2>/dev/null || true
sleep 1
mkdir -p "$TMP/mnt"
hdiutil attach -nobrowse -quiet "$TMP/Sexta-feira.dmg" -mountpoint "$TMP/mnt"
rm -rf "$APP"
cp -R "$TMP/mnt/Sexta-feira.app" /Applications/
hdiutil detach -quiet "$TMP/mnt"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo "🔧 Instalando o ajudante (limite de carga real, ventoinha, purge)…"
sudo /bin/bash "$APP/Contents/Resources/install-helper.sh" install "$APP/Contents/MacOS/SextaFeiraHelper"

echo "🚀 Abrindo a Sexta-feira…"
open "$APP"
echo "✅ Pronto! Configure o limite de carga na aba Bateria."
