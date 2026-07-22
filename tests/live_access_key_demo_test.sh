#!/usr/bin/env bash

set -euo pipefail

demo="live_access_key_demo.html"

test -f "$demo"
grep -q 'qrcode-generator@1.4.4/qrcode.js' "$demo"
grep -q 'data-create-access-key' "$demo"
grep -q 'data-access-key-preview' "$demo"
grep -q 'generateDemoInviteToken' "$demo"
grep -q 'renderAccessKeyQr' "$demo"
grep -q 'Firebase room creation contract' "$demo"
test "$(grep -c 'data-template-token=' "$demo")" -eq 5
grep -q 'prefers-reduced-motion' live_access_key.css

echo "live_access_key_demo checks passed"
