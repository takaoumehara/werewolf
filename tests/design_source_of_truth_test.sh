#!/usr/bin/env bash

set -euo pipefail

for entrypoint in AGENTS.md CLAUDE.md GEMINI.md; do
  test -f "$entrypoint"
  rg -q 'AI_CONTEXT\.md' "$entrypoint"
  rg -q 'ユーザーの最新指示' "$entrypoint"
done

test -f AI_CONTEXT.md
test -f design/README.md
test -f design/current-card-design.md
test -f design/refined-position-calibration.json
test -f design/design-system.md
test -f world-theme.md

rg -q 'design/README\.md' AI_CONTEXT.md
rg -q 'current-card-design\.md' design/README.md
rg -q 'refined-position-calibration\.json' design/README.md
rg -q 'design-system\.md' design/README.md
rg -q 'world-theme\.md' design/README.md

rg -q 'Style: `Refined`' design/current-card-design.md
rg -q 'Mode: `Transparent`' design/current-card-design.md
rg -q 'Background: `ON`' design/current-card-design.md
rg -q '00_transparent-illustrations-72-a-refined' design/current-card-design.md
rg -q 'backgrounds-72' design/current-card-design.md
rg -q '日本語／英語を切り替え可能' design/current-card-design.md
rg -q 'card_viewer\.html' design/current-card-design.md
rg -q 'card_position_editor\.html' design/current-card-design.md

if rg -n --glob '*.md' --glob '*.json' '(AIza[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' AGENTS.md CLAUDE.md GEMINI.md AI_CONTEXT.md design; then
  echo 'Potential secret found in AI/design documentation' >&2
  exit 1
fi

node <<'NODE'
const fs = require('fs');
const positions = JSON.parse(fs.readFileSync('design/refined-position-calibration.json', 'utf8'));
const ids = Object.keys(positions);
if (ids.length !== 25) throw new Error(`Expected 25 positions, found ${ids.length}`);
for (const [roleId, position] of Object.entries(positions)) {
  const keys = Object.keys(position).sort();
  if (keys.join(',') !== 'scale,x,y') {
    throw new Error(`${roleId} must contain exactly scale, x, and y`);
  }
  for (const key of keys) {
    if (typeof position[key] !== 'number' || !Number.isFinite(position[key])) {
      throw new Error(`${roleId}.${key} must be a finite number`);
    }
  }
}
console.log('design source-of-truth checks passed');
NODE
