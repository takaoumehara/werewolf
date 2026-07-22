#!/usr/bin/env bash

set -euo pipefail

mockup="qr_pass_mockup.html"

test -f "$mockup"
grep -q 'name="viewport"' "$mockup"
grep -q 'class="qr-quiet-zone"' "$mockup"
grep -q 'alt="城塞記録網へ接続するQRコード"' "$mockup"
grep -q 'GATE72' "$mockup"
grep -q 'navigator.share' "$mockup"
grep -q 'prefers-reduced-motion' "$mockup"

echo "qr_pass_mockup checks passed"
