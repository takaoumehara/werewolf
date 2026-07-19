#!/usr/bin/env bash

set -euo pipefail

editor="card_position_editor.html"

test -f "$editor"
test -f "card_gallery.html"
! rg -q '<script type="module">' "$editor"
! rg -q '^\s*import ' "$editor"
rg -q 'const DEFAULT_POSITION' "$editor"
rg -q -- '--card-width: 360px' "$editor"
rg -q -- '--card-height: 640px' "$editor"
rg -q 'class="role-name-japanese"' "$editor"
rg -q 'class="role-name-english-rt"' "$editor"
rg -q 'class="role-name-english-vertical"' "$editor"
rg -q 'function japaneseTitle' "$editor"
rg -q 'ruby-position: over' "$editor"
rg -q "font-size: 38px" "$editor"
rg -q "font-size: 18px" "$editor"
rg -q "font-size:32px;letter-spacing:-2px" "$editor"
rg -q '00_transparent-illustrations-72-a-refined' "$editor"
rg -q 'backgrounds-72' "$editor"
rg -q 'id="editor-grid"' "$editor"
rg -q 'id="scale-input"' "$editor"
rg -q 'id="x-input"' "$editor"
rg -q 'id="y-input"' "$editor"
rg -q 'id="copy-all"' "$editor"
rg -q 'id="reset-selected"' "$editor"
rg -q 'id="reset-all"' "$editor"
rg -q 'id="language-ja"' "$editor"
rg -q 'id="language-en"' "$editor"
rg -q 'aria-live="polite"' "$editor"
rg -q 'pointerdown' "$editor"
rg -q "addEventListener\('wheel'" "$editor"
rg -q 'navigator.clipboard.writeText' "$editor"
rg -q 'serializePositions' "$editor"
rg -q 'const REFINED_POSITIONS' "$editor"
rg -F -q 'knights: { scale: 1.42, x: -2.36, y: -5.99 }' "$editor"
rg -q 'const REFINED_POSITIONS' card_gallery.html
rg -q 'const REFINED_POSITIONS' card_viewer.html
rg -q 'refined-positioned' card_viewer.html
rg -q 'href="card_position_editor.html"' card_gallery.html

echo "card position editor UI checks passed"
