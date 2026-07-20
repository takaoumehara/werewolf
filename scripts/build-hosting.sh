#!/bin/bash
# Firebase Hosting 用の public/ を組み立てる。
# アプリ(mobile_app.html)と、それが参照する最小限のアセットだけを集める。
# 生成物 public/ は .gitignore 済み(ビルド成果物)。
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$ROOT/public"

rm -rf "$OUT"
mkdir -p "$OUT/game-client" "$OUT/backgrounds-72" \
  "$OUT/00_transparent-illustrations-72-a-refined" "$OUT/gz" "$OUT/logos/concept-v2"

cp "$ROOT/mobile_app.html" "$OUT/index.html"
cp "$ROOT/design-system.css" "$OUT/"
cp "$ROOT/game-client/firebase-config.js" "$OUT/game-client/"
cp "$ROOT/game-client/firebase-game-client.mjs" "$OUT/game-client/"
cp "$ROOT"/backgrounds-72/*.png "$OUT/backgrounds-72/"
cp "$ROOT"/00_transparent-illustrations-72-a-refined/*.png "$OUT/00_transparent-illustrations-72-a-refined/"
cp "$ROOT"/gz/*.png "$OUT/gz/"
cp "$ROOT/logos/concept-v2/recorder_a.png" "$OUT/logos/concept-v2/"

echo "built public/ ($(du -sh "$OUT" | cut -f1))"
