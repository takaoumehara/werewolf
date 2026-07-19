#!/usr/bin/env bash

set -euo pipefail

editor="card_position_editor.html"

test -f "$editor"
test -f "card_gallery.html"
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
rg -q 'href="card_position_editor.html"' card_gallery.html

echo "card position editor UI checks passed"
