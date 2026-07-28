#!/bin/bash
# tests/viewport_fit_test.sh — 実機の高さで主要ボタンが画面内に残るかの回帰テスト
#
# 監査 docs/2026-07-28-mobile-desktop-audit.md の A章。デザイン確認は 852pt
# (iPhone 15 Pro 全画面)で行われたが、実機の Safari はアドレスバーと
# ツールバーを引いた 690〜712pt で動く。この差で s09 の「確認して閉じる」など
# 主要ボタンが折り返しの下へ沈んでいた。
#
# 判定は2つだけ:
#   1. 各画面の主要ボタン(.btn--primary の最後)の下端が画面内にあること
#   2. タップ対象の高さが 44pt を下回らないこと
#
# 必要なもの: python3 と Chromium。CHROME 環境変数でパスを差し替えられる。
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-8908}"
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
  echo "SKIP: viewport_fit_test — Chromium が見つかりません(CHROME=... で指定可)" >&2
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

FAIL=0
# 690 = Safari 初回(URLバー大) / 712 = Safari 通常
for H in 690 712; do
  DOM="$("$BROWSER" --headless --disable-gpu --no-sandbox --user-data-dir="$PROFILE" \
    --virtual-time-budget=14000 --window-size=1200,900 --dump-dom \
    "http://127.0.0.1:$PORT/tests/viewport-harness/fit.html?w=393&h=$H" 2>/dev/null)"
  RESULT="$(printf '%s' "$DOM" | perl -0777 -ne 'print $1 if /<pre id="out">FIT_START(.*?)FIT_END<\/pre>/s')"
  if [ -z "$RESULT" ]; then
    echo "FAIL: h=$H でハーネスが結果を返しませんでした"
    FAIL=1
    continue
  fi
  python3 - "$RESULT" "$H" <<'PY' || FAIL=1
import html, json, sys
data = json.loads(html.unescape(sys.argv[1]))
height = int(sys.argv[2])
problems = []
for screen in data["screens"]:
    if not screen["ctaVisible"]:
        problems.append(
            "{}: 主要ボタン「{}」の下端が {}pt(画面は {}pt)".format(
                screen["id"], screen["ctaLabel"], screen["ctaBottom"], height))
for target in data["smallTargets"]:
    problems.append("{}: タップ対象「{}」の高さが {}pt".format(
        target["screen"], target["text"] or target["id"], target["h"]))
for p in problems:
    print("FAIL: h={} {}".format(height, p))
print("h={}: {}/{} 画面で主要ボタンが画面内".format(
    height,
    sum(1 for s in data["screens"] if s["ctaVisible"]),
    len(data["screens"])))
sys.exit(1 if problems else 0)
PY
done

[ $FAIL -eq 0 ] && echo "OK: viewport_fit_test passed"
exit $FAIL
