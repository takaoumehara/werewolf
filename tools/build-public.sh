#!/bin/bash
# tools/build-public.sh — Firebase Hosting へ出す public/ を組み立てる
#
# 原画(00_transparent-illustrations-72-a-*/ と backgrounds-72/、計450MB)は
# 配信しない。表示に使うのは tools/build-thumbnails.py が作る
#   thumbs/ 長辺400px  … 一覧のセル
#   cards/  長辺1200px … カードを大きく見せる場面
# だけ。原画はリポジトリに残す（サムネイルを作り直すため）。
set -eu
cd "$(dirname "$0")/.."

[ -d thumbs ] && [ -d cards ] || { echo "thumbs/ か cards/ がありません。先に python3 tools/build-thumbnails.py を実行してください" >&2; exit 1; }

rm -rf public
mkdir -p public

# 画面本体。mobile_app.html が正本で、public/index.html はその写し。
cp mobile_app.html public/index.html
for f in making.html making_of_card_design.html card_gallery.html card_viewer.html \
         card_position_editor.html card_position_editor.mjs \
         live_access_key_demo.html live_access_key.css live_access_key.mjs \
         design-system.css; do
  [ -f "$f" ] && cp "$f" public/
done

# 画像・音・スクリプト
cp -R thumbs cards icons logos game-client public/
[ -d design-development ] && cp -R design-development public/
[ -d gz ] && cp -R gz public/

echo "public/ を作成しました:"
du -sh public
