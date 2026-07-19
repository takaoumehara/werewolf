#!/bin/bash
# tests/mobile_app_test.sh — mobile_app.html static checks
set -u
cd "$(dirname "$0")/.."
FAIL=0
check() { if ! grep -q -- "$1" mobile_app.html; then echo "FAIL: $2 ($1)"; FAIL=1; fi }
[ -f mobile_app.html ] || { echo "FAIL: mobile_app.html missing"; exit 1; }
check 'design-system.css' "links design system"
for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20; do
  check "id=\"s$i\"" "screen s$i"
done
for s in 'REFINED_POSITIONS' 'rolesData' 'role-name-japanese' 'Cinzel Decorative' 'LINE Seed JP'; do
  check "$s" "card fidelity: $s"
done
check '00_transparent-illustrations-72-a-refined' "refined char assets"
check 'backgrounds-72' "bg assets"
check 'magician_ver_c.png' "magician_c exception"
check 'visibilitychange' "app-switcher privacy"
check 'prefers-reduced-motion' "reduced motion"
check '接続を復旧しています' "recorder reconnect copy"
check '選択を記録しました' "recorder sync copy"
check 'あと' "waiting count copy"
# 中国語簡体字の混入チェック(代表字)
if grep -qE '[们你请确认设置说]' mobile_app.html; then echo "FAIL: Chinese chars found"; FAIL=1; fi
[ $FAIL -eq 0 ] && echo "OK: mobile_app_test passed"
exit $FAIL
