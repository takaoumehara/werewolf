#!/bin/bash
# tests/functions_smoke_test.sh — full live-loop simulation on the Firebase emulator suite.
#
# Rebuilds the functions bundle, boots the auth/database/functions emulators via
# `firebase emulators:exec`, and inside that sandbox runs tests/functions_smoke_test.mjs,
# which signs up a host + 5 guests, creates/joins a room, starts a 6-player game, and drives
# the full night -> day -> vote loop (the same command sequence as the mobile_app.html host
# driver) until a winner is reached. Exits non-zero on any failure.
set -e
cd "$(dirname "$0")/.."

npm --prefix functions run build

firebase emulators:exec \
  --project jinro-bb5a5 \
  --only functions,database,auth \
  "node tests/functions_smoke_test.mjs"
