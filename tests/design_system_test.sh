#!/bin/bash
# tests/design_system_test.sh — design-system.css static checks
set -u
cd "$(dirname "$0")/.."
FAIL=0
check() { # $1=pattern $2=desc
  if ! grep -q -- "$1" design-system.css; then echo "FAIL: $2 ($1)"; FAIL=1; fi
}
[ -f design-system.css ] || { echo "FAIL: design-system.css missing"; exit 1; }
for t in --p-soot --p-charcoal --p-moonlight --p-werewolf --sp-1 --r-card --tap-min --t-phase --font-mono --fs-timer; do
  check "$t" "token $t"
done
for ph in day night dawn verdict finished; do
  check "data-phase=\"$ph\"" "phase $ph"
done
for c in .btn--hold .privacy-cover .hold-to-reveal .phase-header .conn-banner .reconnect-overlay .qr-panel .code-input .waiting-count; do
  check "$c" "component $c"
done
check "prefers-reduced-motion" "reduced motion support"
# 秘密トークンが公開スコープ(:root)に居ないこと
if grep -A40 '^:root' design-system.css | grep -q 'secret-faction'; then
  echo "FAIL: secret token leaked into :root"; FAIL=1
fi
[ $FAIL -eq 0 ] && echo "OK: design_system_test passed"
exit $FAIL
