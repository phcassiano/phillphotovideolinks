#!/bin/bash
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Não encontrei o Python. Instale em https://www.python.org/downloads/ e abra de novo."
  read -r -p "Aperte Enter para fechar."
  exit 1
fi
python3 cortes-ajudante.py
