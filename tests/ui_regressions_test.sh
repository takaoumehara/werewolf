#!/bin/bash
# tests/ui_regressions_test.sh — 2026-08-02 の「遊べるようにする」作業の回帰テスト
#
# 守るもの(どれも実際に壊れていた):
#   1. 生存者ストリップが卓の画面でだけ出る
#   2. ルールのドロワーが二重スクロールになっていない
#   3. 図鑑のサムネが枠からはみ出さない(顔が切れない)
#   4. 「はじめての人へ」が4枚あり、最後まで進むと閉じる
#   5. 間の画面(夜/朝/評決)が自動で進まない
#   6. トップバーが画面ごとに切り替わる
#
# 必要なもの: python3 と Chromium。CHROME 環境変数でパスを差し替えられる。
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-8912}"
if [ -n "${CHROME:-}" ]; then
  BROWSER="$CHROME"
else
  BROWSER=""
  for c in /opt/pw-browsers/chromium-*/chrome-linux/chrome \
           /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell \
           "$(command -v chromium || true)" \
           "$(command -v chromium-browser || true)" \
           "$(command -v google-chrome || true)" \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
    [ -n "$c" ] && [ -x "$c" ] && { BROWSER="$c"; break; }
  done
fi
if [ -z "$BROWSER" ]; then
  echo "SKIP: ui_regressions_test — Chromium が見つかりません(CHROME=... で指定可)" >&2
  exit 0
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
PROFILE="$(mktemp -d)"
trap 'kill "$SERVER_PID" 2>/dev/null; rm -rf "$PROFILE"' EXIT
for _ in $(seq 1 40); do
  python3 -c "
import socket,sys
s=socket.socket(); s.settimeout(0.2)
sys.exit(0 if s.connect_ex(('127.0.0.1', $PORT))==0 else 1)
" && break
  sleep 0.25
done

DOM="$("$BROWSER" --headless --disable-gpu --no-sandbox --user-data-dir="$PROFILE" \
  --virtual-time-budget=20000 --window-size=1200,900 --dump-dom \
  "http://127.0.0.1:$PORT/tests/viewport-harness/ui.html?w=393&h=712" 2>/dev/null)"
RESULT="$(printf '%s' "$DOM" | perl -0777 -ne 'print $1 if /<pre id="out">UI_START(.*?)UI_END<\/pre>/s')"

if [ -z "$RESULT" ]; then
  echo "FAIL: ハーネスが結果を返しませんでした"
  exit 1
fi

python3 - "$RESULT" <<'PY'
import html, json, sys
data = json.loads(html.unescape(sys.argv[1]))
if data.get("pending"):
    print("FAIL: ハーネスが起動しませんでした(アプリ側の JS エラーの可能性)")
    sys.exit(1)
for p in data["problems"]:
    print("FAIL: " + p)
print("図鑑のサムネ {} 件を確認".format(data.get("thumbCount", 0)))
sys.exit(1 if data["problems"] else 0)
PY
STATUS=$?

[ $STATUS -eq 0 ] && echo "OK: ui_regressions_test passed"
exit $STATUS
