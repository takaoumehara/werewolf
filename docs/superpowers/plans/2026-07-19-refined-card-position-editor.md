# Refined Card Position Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a desktop gallery editor where all 25 Refined transparent characters can be dragged and scaled over their final backgrounds, then copied as one JSON configuration.

**Architecture:** Add a dedicated `card_position_editor.html` so editing tools do not complicate the public gallery. Put transform validation and serialization in `card_position_editor.mjs` for direct Node tests; the HTML module consumes those functions and owns DOM, pointer, wheel, keyboard, language, clipboard, and local-session state. Add one unobtrusive link from the existing gallery to the editor.

**Tech Stack:** Static HTML/CSS, browser ES modules, Pointer Events, Clipboard API, Node.js built-in test runner, shell regression checks.

## Global Constraints

- Render only artwork from `00_transparent-illustrations-72-a-refined`.
- Render role backgrounds from `backgrounds-72`, always enabled.
- Keep card dimensions and typography fixed; transforms affect only the character layer.
- Support Japanese and English labels.
- Optimize the editor for desktop mouse and keyboard use.
- Export all 25 role transforms as formatted JSON with `{ "scale": number, "x": number, "y": number }` values.
- Preserve unrelated dirty-worktree files.

---

### Task 1: Tested transform model

**Files:**
- Create: `card_position_editor.mjs`
- Create: `tests/card_position_editor_core.test.mjs`

**Interfaces:**
- Produces: `createPositionMap(roleIds) -> Record<string, Position>`
- Produces: `updatePosition(map, roleId, patch) -> Record<string, Position>`
- Produces: `resetPosition(map, roleId) -> Record<string, Position>`
- Produces: `serializePositions(map, roleIds) -> string`
- `Position` shape: `{ scale: number, x: number, y: number }`

- [ ] **Step 1: Write the failing core tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPositionMap,
  resetPosition,
  serializePositions,
  updatePosition
} from '../card_position_editor.mjs';

test('creates independent baseline transforms for every role', () => {
  assert.deepEqual(createPositionMap(['knights', 'werewolf']), {
    knights: { scale: 1, x: 0, y: 0 },
    werewolf: { scale: 1, x: 0, y: 0 }
  });
});

test('normalizes transform values and does not mutate the input map', () => {
  const initial = createPositionMap(['knights']);
  const updated = updatePosition(initial, 'knights', { scale: 3, x: -120.555, y: 4.444 });
  assert.deepEqual(initial.knights, { scale: 1, x: 0, y: 0 });
  assert.deepEqual(updated.knights, { scale: 2.5, x: -100, y: 4.44 });
});

test('resets one role and serializes roles in gallery order', () => {
  const moved = updatePosition(createPositionMap(['b', 'a']), 'b', { scale: 1.08, x: -3, y: 2 });
  assert.deepEqual(resetPosition(moved, 'b').b, { scale: 1, x: 0, y: 0 });
  assert.equal(serializePositions(moved, ['b', 'a']), `{
  "b": { "scale": 1.08, "x": -3, "y": 2 },
  "a": { "scale": 1, "x": 0, "y": 0 }
}`);
});
```

- [ ] **Step 2: Run the core test and verify RED**

Run: `node --test tests/card_position_editor_core.test.mjs`

Expected: FAIL because `card_position_editor.mjs` does not exist.

- [ ] **Step 3: Implement the transform model**

```js
export const DEFAULT_POSITION = Object.freeze({ scale: 1, x: 0, y: 0 });

const round = value => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalize = position => ({
  scale: round(clamp(Number(position.scale), 0.5, 2.5)),
  x: round(clamp(Number(position.x), -100, 100)),
  y: round(clamp(Number(position.y), -100, 100))
});

export function createPositionMap(roleIds) {
  return Object.fromEntries(roleIds.map(roleId => [roleId, { ...DEFAULT_POSITION }]));
}

export function updatePosition(map, roleId, patch) {
  if (!map[roleId]) throw new Error(`Unknown role: ${roleId}`);
  return { ...map, [roleId]: normalize({ ...map[roleId], ...patch }) };
}

export function resetPosition(map, roleId) {
  return updatePosition(map, roleId, DEFAULT_POSITION);
}

export function serializePositions(map, roleIds) {
  const lines = roleIds.map(roleId => {
    const value = normalize(map[roleId]);
    return `  ${JSON.stringify(roleId)}: { "scale": ${value.scale}, "x": ${value.x}, "y": ${value.y} }`;
  });
  return `{\n${lines.join(',\n')}\n}`;
}
```

- [ ] **Step 4: Run the core test and verify GREEN**

Run: `node --test tests/card_position_editor_core.test.mjs`

Expected: 3 tests pass, 0 fail.

### Task 2: Desktop gallery editor

**Files:**
- Create: `card_position_editor.html`
- Create: `tests/card_position_editor_ui_test.sh`
- Consume: `card_position_editor.mjs`

**Interfaces:**
- Consumes: transform model exports from Task 1.
- Produces: DOM elements `#editor-grid`, `#scale-input`, `#x-input`, `#y-input`, `#copy-all`, `#reset-selected`, `#reset-all`, `#language-ja`, `#language-en`, and `#editor-status`.

- [ ] **Step 1: Write the failing UI contract test**

```bash
#!/usr/bin/env bash
set -euo pipefail

editor="card_position_editor.html"
test -f "$editor"
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
rg -q 'wheel' "$editor"
rg -q 'navigator.clipboard.writeText' "$editor"
rg -q 'serializePositions' "$editor"
echo "card position editor UI checks passed"
```

- [ ] **Step 2: Run the UI contract test and verify RED**

Run: `bash tests/card_position_editor_ui_test.sh`

Expected: FAIL because `card_position_editor.html` does not exist.

- [ ] **Step 3: Build the fixed Refined gallery and editing panel**

Create a desktop page with a sticky right panel and a responsive multi-column gallery. Define the same 25 role IDs used by `card_gallery.html`, including the `magician_c` filename mapping. Each card must contain:

```html
<div class="editor-card" data-role-id="knights" tabindex="0">
  <div class="editor-card__background"></div>
  <img class="editor-card__character" draggable="false" alt="" />
  <div class="editor-card__name" aria-hidden="true"></div>
  <div class="editor-card__selection">EDITING</div>
</div>
```

Apply character transforms only through:

```js
character.style.transform = `translate3d(${position.x}%, ${position.y}%, 0) scale(${position.scale})`;
```

Use Pointer Events for dragging, prevent the wheel default only while it is over the selected card, and update the model through `updatePosition`. Use input events for all three numeric controls. Arrow keys change X/Y by `1`; Shift + arrow changes them by `10`.

Copy the complete ordered JSON with:

```js
const output = serializePositions(positionMap, roles.map(role => role.id));
await navigator.clipboard.writeText(output);
announce('全25枚の位置設定をコピーしました');
```

If clipboard writing fails, show the JSON in a readonly textarea and select it so manual copy remains possible. Reset-selected and reset-all must ask for no modal confirmation because both operations only affect in-memory editor state.

- [ ] **Step 4: Run UI and core tests and verify GREEN**

Run:

```bash
node --test tests/card_position_editor_core.test.mjs
bash tests/card_position_editor_ui_test.sh
bash tests/card_transparent_variants_test.sh
```

Expected: all checks pass.

### Task 3: Gallery entry point and final verification

**Files:**
- Modify: `card_gallery.html`
- Modify: `tests/card_position_editor_ui_test.sh`
- Test: `tests/card_position_editor_core.test.mjs`

**Interfaces:**
- Consumes: `card_position_editor.html` from Task 2.
- Produces: a visible link from the gallery to the editor.

- [ ] **Step 1: Extend the UI contract test with the entry-point expectation**

```bash
rg -q 'href="card_position_editor.html"' card_gallery.html
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `bash tests/card_position_editor_ui_test.sh`

Expected: FAIL because the gallery does not link to the editor.

- [ ] **Step 3: Add the gallery editor link**

Add this adjacent to the gallery title/filter area without changing existing filter behavior:

```html
<a class="position-editor-link" href="card_position_editor.html">POSITION EDITOR</a>
```

Style it as a compact secondary action using the gallery's existing red title color and visible keyboard focus.

- [ ] **Step 4: Run complete verification**

Run:

```bash
node --test tests/card_position_editor_core.test.mjs
bash tests/card_position_editor_ui_test.sh
bash tests/card_transparent_variants_test.sh
node -e 'const fs=require("fs"); for (const file of ["card_gallery.html","card_viewer.html","card_position_editor.html"]) { const html=fs.readFileSync(file,"utf8"); for (const match of html.matchAll(/<script(?: type="module")?>([\\s\\S]*?)<\\/script>/g)) new Function(match[1].replace(/^\\s*import[^;]+;\\s*/m,"")); console.log(`${file}: inline JavaScript syntax OK`); }'
git diff --check
```

Expected: all tests pass, all inline scripts parse, and `git diff --check` emits no output.

### Task 4: Commit the completed editor

**Files:**
- Add: `card_position_editor.html`
- Add: `card_position_editor.mjs`
- Add: `tests/card_position_editor_core.test.mjs`
- Add: `tests/card_position_editor_ui_test.sh`
- Modify: `card_gallery.html`
- Add: `docs/superpowers/plans/2026-07-19-refined-card-position-editor.md`

**Interfaces:**
- Consumes: verified output from Tasks 1–3.
- Produces: one reviewable local Git commit; pushing remains a separate explicit user action.

- [ ] **Step 1: Stage only editor-related files**

```bash
git add -- card_position_editor.html card_position_editor.mjs card_gallery.html tests/card_position_editor_core.test.mjs tests/card_position_editor_ui_test.sh docs/superpowers/plans/2026-07-19-refined-card-position-editor.md
```

- [ ] **Step 2: Review staged scope**

Run: `git diff --cached --name-status`

Expected: only the six editor-related paths listed above.

- [ ] **Step 3: Commit**

```bash
git commit -m "Add refined card position editor"
```

Expected: a local commit on the current branch. Do not push unless the user explicitly asks.
