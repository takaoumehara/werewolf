# Client ↔ Firebase Wiring Implementation Plan

> Execute with subagent-driven-development. Preserve the 4a look, JS behavior hooks, and canonical cards.

**Goal:** Make `mobile_app.html` a real multi-device game client on the live Firebase backend (project jinro-bb5a5), while keeping a local/demo mode for design review.

**Architecture:** A `game-client/firebase-game-client.mjs` ES module wraps Firebase Web SDK (v10 modular, CDN) + the 4 callables + RTDB subscriptions, exposing a small `GameClient` interface. `mobile_app.html` loads it and runs in **live mode** (default) or **demo mode** (`?demo=1` or dev-drawer toggle = the current mock flow). One device = one player.

## Global Constraints
- Firebase Web SDK v10 modular from `https://www.gstatic.com/firebasejs/10.x`. Config from `game-client/firebase-config.js`. Emulator via `?emu=1`.
- Anonymous auth on load. `actorId` never sent from client (server uses auth.uid).
- Canonical card rendering unchanged. 4a design unchanged. Keep both tests green.
- Demo mode keeps the existing mock + dev drawer intact (`?demo=1` behaves like today).
- Region us-central1. Callables: createSnapRoom / joinSnapRoom / startWerewolfGame / dispatchWerewolfCommand.

## GameClient interface (game-client/firebase-game-client.mjs)
createGameClient({ config, useEmulator }) returns an object with:
- ready: Promise resolving { uid }
- createRoom({ displayName, maxPlayers }) -> { roomId, code }
- joinRoom({ code, displayName }) -> { roomId }
- startGame({ roleIds, seed }) -> { revision }
- send({ type, payload }) -> result (generates commandId; actorId is server-side)
- onMeta(cb)/onPlayers(cb)/onPublic(cb)/onSelf(cb) -> unsubscribe (onValue)
- uid, roomId

Subscriptions: meta=rooms/{roomId}/meta, players=rooms/{roomId}/players, public=rooms/{roomId}/game/public, self=rooms/{roomId}/game/privateViews/{uid}.

## Increment 1 — Auth + create/join + live lobby
Two phones anon-sign-in; one creates a room (real code), other joins by code, both see live player list on s05.

## Increment 2 — Start game + role reveal
s06 GM + s07 composition -> startGame; s09 renders canonical card from onSelf(self.roleId), hold-to-reveal, victory from self.team. public view has no roles.

## Increment 3 — Night + day + vote loop
Host client drives phase advances (BEGIN_NIGHT/RESOLVE_NIGHT/START_VOTE/RESOLVE_VOTE/END_DAY) in computer-GM mode via timers + public counts. s11 night action -> SUBMIT_NIGHT_ACTION; s13 morning reveal; s14 timer; s15 CAST_VOTE; s16 tie; s17 result; s18 win+roster (canonical mini cards); s19 rematch; s20 reconnect via onValue.

## Increment 4 — Harden + deploy + tests
Idempotent retries, illegal command errors, revision-conflict retry. tests/functions_smoke_test.sh (emulator full round). Redeploy functions+rules. Final prod end-to-end verification. Keep tests green.
