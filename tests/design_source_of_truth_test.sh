#!/usr/bin/env bash

set -euo pipefail

test -f AI_CONTEXT.md
test -f design/README.md
test -f design/current-card-design.md
test -f design/refined-position-calibration.json

rg -q 'design/README.md' AI_CONTEXT.md
rg -q 'current-card-design.md' design/README.md
rg -q 'Refined' design/current-card-design.md
rg -q 'Transparent' design/current-card-design.md
rg -q 'Background: `ON`' design/current-card-design.md
rg -q 'card_position_editor.html' design/current-card-design.md

node <<'NODE'
const fs = require('fs');
const positions = JSON.parse(fs.readFileSync('design/refined-position-calibration.json', 'utf8'));
const ids = Object.keys(positions);
if (ids.length !== 25) throw new Error(`Expected 25 positions, found ${ids.length}`);
for (const [roleId, position] of Object.entries(positions)) {
  for (const key of ['scale', 'x', 'y']) {
    if (typeof position[key] !== 'number' || !Number.isFinite(position[key])) {
      throw new Error(`${roleId}.${key} must be a finite number`);
    }
  }
}
console.log('design source-of-truth checks passed');
NODE
