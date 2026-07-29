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
# 中国語簡体字の混入チェック(代表字)。C ロケールの grep はバイト単位で
# CJK 継続バイトに誤マッチするため、文字単位で走査できる python3 を使う。
if ! python3 -c "
import sys
data = open('mobile_app.html', encoding='utf-8').read()
# 簡体字だけに現れる字形を並べる。日本語でも使う字(置・当・来など)を入れると
# 正常な本文を誤検出するので、必ず簡体字専用の字形だけにすること。
sys.exit(1 if any(ch in data for ch in '们你请确认设说给对这个话时间为现关开门员长车马见东书让过还进') else 0)
"; then echo "FAIL: Chinese chars found"; FAIL=1; fi
# public/index.html は Firebase Hosting の配信元。mobile_app.html を直して
# ここへ同期し忘れると、修正が本番に出ないまま「直った」ことになる。
if ! cmp -s mobile_app.html public/index.html; then
  echo "FAIL: public/index.html が mobile_app.html と一致しません(cp mobile_app.html public/index.html を実行してください)"
  FAIL=1
fi

[ $FAIL -eq 0 ] && echo "OK: mobile_app_test passed"
exit $FAIL
