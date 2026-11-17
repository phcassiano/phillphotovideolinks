#!/bin/bash
# Instala ou remove o ajudante da Sexta-feira (precisa rodar como root).
#   install-helper.sh install <caminho-do-binario-SextaFeiraHelper>
#   install-helper.sh uninstall
set -e
LABEL="com.local.sextafeira.helper"
BIN="/Library/PrivilegedHelperTools/$LABEL"
PLIST="/Library/LaunchDaemons/$LABEL.plist"
SHARED="/Users/Shared/SextaFeira"

if [[ $EUID -ne 0 ]]; then
  echo "Rode com sudo." >&2
  exit 1
fi

case "$1" in
  install)
    SRC="$2"
    [[ -f "$SRC" ]] || { echo "Binário do ajudante não encontrado: $SRC" >&2; exit 1; }
    launchctl bootout "system/$LABEL" 2>/dev/null || true
    mkdir -p /Library/PrivilegedHelperTools
    cp "$SRC" "$BIN"
    chown root:wheel "$BIN"
    chmod 755 "$BIN"
    xattr -c "$BIN" 2>/dev/null || true
    cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>$BIN</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<true/>
	<key>StandardErrorPath</key>
	<string>/var/log/sextafeira-helper.log</string>
</dict>
</plist>
PL
    chown root:wheel "$PLIST"
    chmod 644 "$PLIST"
    mkdir -p "$SHARED"
    chmod 1777 "$SHARED"
    launchctl bootstrap system "$PLIST"
    echo "Ajudante instalado."
    ;;
  uninstall)
    # Ao parar, o ajudante religa a carga e devolve a ventoinha ao automático.
    launchctl bootout "system/$LABEL" 2>/dev/null || true
    rm -f "$BIN" "$PLIST"
    echo "Ajudante removido."
    ;;
  *)
    echo "Uso: $0 install <binario> | uninstall" >&2
    exit 1
    ;;
esac
