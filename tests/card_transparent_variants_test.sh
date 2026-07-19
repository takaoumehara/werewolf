#!/usr/bin/env bash

set -euo pipefail

gallery="card_gallery.html"
viewer="card_viewer.html"

test -f "$gallery"
test -f "$viewer"

# The gallery must expose both new artwork styles as background composites.
grep -q "transFolder: '00_transparent-illustrations-72-a-lifelike'" "$gallery"
grep -q "transFolder: '00_transparent-illustrations-72-a-refined'" "$gallery"
grep -q "compositeViewerVersion: 'lifelike-trans'" "$gallery"
grep -q "compositeViewerVersion: 'refined-trans'" "$gallery"
grep -q "applyBlueScreenTransparency" "$gallery"

# The detail viewer must preserve the chosen composite instead of falling back to Ver.A2.
grep -q 'value="lifelike-trans"' "$viewer"
grep -q 'value="refined-trans"' "$viewer"
grep -q "00_transparent-illustrations-72-a-lifelike" "$viewer"
grep -q "00_transparent-illustrations-72-a-refined" "$viewer"
grep -q "applyBlueScreenTransparency" "$viewer"

# Every gallery role must have both supplied character files and a matching background.
node <<'NODE'
const fs = require('fs');
const gallery = fs.readFileSync('card_gallery.html', 'utf8');
const ids = [...gallery.matchAll(/^\s*id:\s*"([^"]+)",/gm)].map(match => match[1]);

if (ids.length !== 25) throw new Error(`Expected 25 roles, found ${ids.length}`);

for (const [label, folder] of Object.entries({
  lifelike: '00_transparent-illustrations-72-a-lifelike',
  refined: '00_transparent-illustrations-72-a-refined',
  background: 'backgrounds-72'
})) {
  const missing = ids.filter(id => {
    const file = id === 'magician_c'
      ? (label === 'background' ? 'magician_bg.png' : 'magician_ver_c.png')
      : (label === 'background' ? `${id}_bg.png` : `${id}_ver_a.png`);
    return !fs.existsSync(`${folder}/${file}`);
  });
  if (missing.length) throw new Error(`${label} missing: ${missing.join(', ')}`);
}
NODE

echo "card transparent variant checks passed"
