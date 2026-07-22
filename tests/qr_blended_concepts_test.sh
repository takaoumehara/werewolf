#!/usr/bin/env bash

set -euo pipefail

concepts="qr_blended_concepts.html"

test -f "$concepts"
grep -q 'concept--key-head' "$concepts"
grep -q 'concept--keyhole' "$concepts"
grep -q 'concept--engraving' "$concepts"
grep -q 'Recommended for launch' "$concepts"
test "$(grep -c '城塞記録網へ接続するQRコード' "$concepts")" -eq 3
test "$(grep -c 'class="qr-quiet-zone"' "$concepts")" -eq 3
test "$(grep -c 'api.qrserver.com/v1/create-qr-code' "$concepts")" -eq 3
grep -q 'prefers-reduced-motion' "$concepts"

echo "qr_blended_concepts checks passed"
