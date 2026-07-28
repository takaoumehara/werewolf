#!/bin/bash
# tests/live_selection_test.sh — 投票 / 夜行動の選択が再描画で失われないことの回帰テスト
#
# 監査 docs/2026-07-28-mobile-desktop-audit.md の C-1【P0】/ C-2【P1】に対応する。
# サーバから public が届くたびに renderS15Live / renderS11Live が走るため、
# 全再生成のままだとソロ AI 対戦で「押しても選べない」状態になる。
# 実ブラウザの DOM でしか判定できないので headless Chromium で実測する。
#
# 必要なもの: python3(同一オリジンで iframe を読むためのローカルサーバ) と Chromium。
# CHROME 環境変数でブラウザのパスを差し替えられる。
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-8901}"
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
  echo "SKIP: live_selection_test — Chromium が見つかりません(CHROME=... で指定可)" >&2
  exit 0
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null' EXIT
for _ in $(seq 1 40); do
  python3 -c "
import socket,sys
s=socket.socket()
s.settimeout(0.2)
sys.exit(0 if s.connect_ex(('127.0.0.1', $PORT))==0 else 1)
" && break
  sleep 0.25
done

PROFILE="$(mktemp -d)"
trap 'kill "$SERVER_PID" 2>/dev/null; rm -rf "$PROFILE"' EXIT
DOM="$("$BROWSER" --headless --disable-gpu --no-sandbox --user-data-dir="$PROFILE" \
  --virtual-time-budget=15000 --window-size=1200,900 --dump-dom \
  "http://127.0.0.1:$PORT/tests/live-selection-harness.html" 2>/dev/null)"

RESULT="$(printf '%s' "$DOM" | perl -0777 -ne 'print $1 if /<pre id="out">RESULT_START(.*?)RESULT_END<\/pre>/s')"
if [ -z "$RESULT" ]; then
  echo "FAIL: ハーネスが結果を返しませんでした(ブラウザ起動またはページ読み込みの失敗)"
  exit 1
fi

python3 - "$RESULT" <<'PY'
import html, json, sys
raw = html.unescape(sys.argv[1])
data = json.loads(raw)
if data.get("pending"):
    print("FAIL: ハーネスが完走しませんでした(iframe の読み込み待ちのまま)")
    sys.exit(1)
failed = [r for r in data["results"] if not r["ok"]]
for r in failed:
    print("FAIL: {}{}".format(r["name"], (" — " + r["detail"]) if r["detail"] else ""))
print("{}/{} checks passed".format(data["passed"], data["total"]))
sys.exit(1 if failed else 0)
PY
STATUS=$?
[ $STATUS -eq 0 ] && echo "OK: live_selection_test passed"
exit $STATUS
