#!/bin/bash
# tests/ai_functions_smoke.sh — emulator smoke test for Task C4
# (seatAiPlayers / advanceAiTurn Cloud Functions).
#
# Rebuilds the functions bundle, boots the auth/database/functions emulators via
# `firebase emulators:exec` (same pattern as tests/functions_smoke_test.sh), and inside
# that sandbox runs functions/scripts/ai_smoke_assert.mjs (kept under functions/ so it can
# resolve the `firebase-admin` import from functions/node_modules), which:
#   - signs up a host, creates a room
#   - calls seatAiPlayers({ roomId, count: 3 }) and asserts seated == [ai_1, ai_2, ai_3]
#   - uses the firebase-admin SDK (bypasses security rules) to independently verify
#     rooms/{roomId}/players (ai_1..ai_3, role "ai"), rooms/{roomId}/aiPlayers (3 personas),
#     and roomMembers/{roomId} (ai_1..ai_3 = true)
#   - starts a 4-player game (host + 3 AI) and calls advanceAiTurn({ phase: "night" }),
#     asserting actions >= 1
#
# The night phase never calls generateSpeech()/the Anthropic API (see
# functions/ai/orchestrator.mjs), so no real ANTHROPIC_API_KEY is required — the
# advanceAiTurn callable is bound to the ANTHROPIC_API_KEY secret and needs *some* value
# to boot under the emulator, so functions/.secret.local supplies a dummy one.
# functions/.secret.local is gitignored; never put a real key there or anywhere in the repo.
#
# Exits non-zero on any failure.
set -e
cd "$(dirname "$0")/.."

if [ ! -f functions/.secret.local ]; then
  echo "ERROR: functions/.secret.local is missing (needed so advanceAiTurn's" >&2
  echo "ANTHROPIC_API_KEY secret binding can boot in the emulator). See" >&2
  echo "functions/.secret.local.example or create one with a dummy value; never a real key." >&2
  exit 1
fi

npm --prefix functions run build

firebase emulators:exec \
  --project jinro-bb5a5 \
  --only functions,database,auth \
  "node functions/scripts/ai_smoke_assert.mjs"
