#!/bin/bash
# ============================================================
# Instalador macOS (DUPLO CLIQUE) dos paineis Alpha.
# Instala qualquer pasta com.alpha.* que estiver JUNTO deste arquivo
# (serve p/ Ondulado e Flexivel). Liga o PlayerDebugMode (CSXS 9..12).
# Se o Mac bloquear: botao direito > Abrir, ou rode:  bash install.command
# ============================================================
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
SRC=$(find "$DIR" -maxdepth 1 -type d -name 'com.alpha.*' | head -1)
if [ -z "$SRC" ]; then echo "ERRO: pasta com.alpha.* nao esta junto deste instalador."; exit 1; fi
NAME=$(basename "$SRC")

echo "Instalando $NAME (macOS)..."
for v in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1
done
killall cfprefsd >/dev/null 2>&1 || true

DST="$HOME/Library/Application Support/Adobe/CEP/extensions/$NAME"
rm -rf "$DST"
mkdir -p "$DST"
cp -R "$SRC/." "$DST/"

echo "OK! $NAME instalado em: $DST"
echo "Reinicie o Illustrator: Janela > Extensoes"
