# Client ↔ Firebase Wiring — Report (Increments 1 & 2)

## What `game-client/firebase-game-client.mjs` exposes

`createGameClient({ config, useEmulator })` returns:

- `ready` — Promise resolving `{ uid }` once anonymous sign-in completes (triggered immediately on client creation).
- `createRoom({ displayName, maxPlayers })` → `{ roomId, code, expiresAt }` (calls `createSnapRoom`).
- `joinRoom({ code, displayName })` → `{ roomId }` (calls `joinSnapRoom`).
- `startGame({ roleIds, seed })` → `{ ok, revision }` (calls `startWerewolfGame`; requires a roomId already set by create/join).
- `send({ type, payload })` → `{ revision }` (calls `dispatchWerewolfCommand`; generates `commandId` as `` `${uid}:${type}:${Date.now()}:${counter}` ``; **never sends `actorId`** — the server derives it from `auth.uid`). Wired for Increment 3's use.
- `renameSelf(displayName)` — **one addition beyond the plan's literal interface list.** Writes `rooms/{roomId}/players/{uid}/name` directly via RTDB `update()`. Needed because the screen flow is s02(部屋をつくる)→s03(code shown)→s04(name entered)→s05, so `createRoom` must fire before the display name is known. The security rules already whitelist self-writes to `players/$uid/name`, so this is a safe, rules-consistent way to fill in the real name after room creation.
- `onMeta(cb)` / `onPlayers(cb)` / `onPublic(cb)` / `onSelf(cb)` → unsubscribe function. Each subscribes to `onValue` on `rooms/{roomId}/meta`, `.../players`, `.../game/public`, `.../game/privateViews/{uid}` respectively. Callbacks can be registered **before** a roomId exists (they queue and get rebound automatically once `createRoom`/`joinRoom` resolves — implemented via a listener registry that rebinds all registered callbacks whenever the internal roomId changes).
- `uid`, `roomId` — getters reflecting current auth/room state.

CDN imports: Firebase Web SDK v10.13.2 modular (`firebase-app.js`, `firebase-auth.js`, `firebase-database.js`, `firebase-functions.js`). `getFunctions(app, 'us-central1')`. Emulator mode connects to `127.0.0.1:9099/9000/5001` per the plan.

`node --check game-client/firebase-game-client.mjs` passes (syntax only; CDN specifiers aren't resolved by Node, as expected).

## Live vs. demo mode selection

- `?demo=1` in the URL → **demo mode**: the classic `<script>` IIFE behaves exactly as before (mock `PLAYERS`, dev-drawer jump/role/view, `roomCode` mock, etc.). The new `<script type="module">` block **returns immediately without importing `firebase-game-client.mjs`**, so demo mode makes zero extra network requests — fully offline-safe, unchanged from before this change.
- No `?demo=1` → **live mode** (new default). The module script dynamically imports the client + config, calls `createGameClient`, stores it on `window.liveClient`, and resolves a handshake promise (`window.__liveClientReady` / `window.__setLiveClient`) so the classic script can safely reference the client regardless of load order (module scripts are deferred; the classic script always runs first and just awaits the handshake at call time).
- `?emu=1` → connects to the local emulator suite instead of production (`useEmulator: true`).
- Dev drawer now has a "モード" section with デモ/ライブ buttons that reload the page with/without `?demo=1` (simplest, listener-safe way to satisfy "or dev-drawer toggle" without juggling live Firebase listeners mid-session).

## Screens wired (s01–s09)

- **s01** はじめる → s02 (unchanged).
- **s02** 部屋をつくる → `handleChooseHost()`: sets `appState.view='host'`, navigates to s03, then (live only) calls `createRoom({ displayName: '記録係', maxPlayers: 12 })` and re-renders s03 with the real code once it resolves. 部屋に入る → `handleChoosePlayer()`: just navigates to s03 (no server call yet — code hasn't been typed).
- **s03**: host branch shows the **real** pairing code + QR (`buildFakeQrSvg` unchanged, now seeded with the live code) and a live participant count fed by `onPlayers`. Player branch renders the same code-input boxes, now blank instead of prefilled with mock data. "次へ" → `handleS03Next()` captures the typed code into `pendingJoinCode` (live + player-view only) before navigating to s04.
- **s04**: "この名前で進む" → `handleS04Next()`. Host: `client.renameSelf(displayName)`. Participant: `client.joinRoom({ code: pendingJoinCode, displayName })`, then `attachLiveSubscriptions()` (host already attached it right after `createRoom`). On failure, shows a toast and stays on s04.
- **s05** lobby: renders from `onPlayers` in real time (name, host/participant badge, connected status). Host's "開始" button is disabled until `latestPlayers.length >= MIN_PLAYERS` (3, matching the server's `MIN_PLAYERS`). No "ready" toggle in live mode — the RTDB player record has no `ready` field server-side (only `id/name/role/connected/joinedAt/lastSeenAt`), so implementing a UI-only ready toggle would be misleading; deferred/noted rather than faked.
- **s06** GM mode select: unchanged (purely local `gmMode` state; no server call in this increment).
- **s07** composition: live mode recomputes the default composition (人狼2/予言者1/騎士団1/市民rest) sized to the current live player count every time s07 is entered. "この構成で進む" → `handleS07Next()`: validates `sum(counts) === latestPlayers.length` (toasts and blocks if not — existing +/- steppers let the host fix it), builds `roleIds`, and calls `startGame({ roleIds, seed: Date.now() % 2147483647 })`.
- **s08 → s09 auto-advance**: any client sitting on s05/s06/s07 auto-jumps to s08 when `onMeta` reports `status: 'playing'`. From s08, once `onSelf` delivers a self view with a `roleId`, the client auto-advances to s09 (covers both host and participants; the manual "役職を確認する" button on s08 still works as a no-op-safe fallback).
- **s09** role reveal: subscribes to `onSelf`; renders the canonical card via the **unchanged** `buildCardWrapper`/`renderCardIntoSlot` using `latestSelf.roleId`. Faction class and the victory-condition text key off `latestSelf.team`, which is exactly `"citizen" | "werewolf" | "fox"` — the same enum `roles.mjs` and the existing `VICTORY_TEXT_BY_CAMP` map already use, so no translation layer was needed. Hold-to-reveal, `visibilitychange` auto-cover, and `prefers-reduced-motion` are untouched. If `onSelf` hasn't delivered data yet, shows a "役職の到着を待っています" placeholder instead of a stale/mock card.

Night/day/vote/reconnect (s10–s20) are **not** wired — explicitly Increment 3 per the plan.

## How the bridge works

- The classic `<script>` IIFE is unchanged in its demo-mode code paths; every render function that needed a live branch (`renderS03`, `renderS05`, `renderS09`) gets an `if (MODE === 'live') { ...; return; }` guard at the top, with the original demo logic left completely untouched below it.
- Button `onclick`s that need to branch by mode were changed from inline literals (e.g. `onclick="showScreen('s04')"`) to named handlers (`handleS03Next()`, etc.) defined once in the IIFE; in demo mode these handlers just do what the old inline code did.
- A `<script type="module">` block (placed after the classic script, before `</body>`) owns all direct Firebase imports and only runs its body when not in demo mode. It hands the client to the classic script via `window.liveClient` + a resolve-once promise handshake, so there's no race regardless of script execution order.
- `composition` changed from `const` to `let` so live mode can reset it to `computeDefaultComposition(playerCount)` on each s07 entry.

## Test output

```
$ bash tests/design_system_test.sh
OK: design_system_test passed

$ bash tests/mobile_app_test.sh
OK: mobile_app_test passed

$ (cd game-engine && node --test test/*.test.mjs)
# tests 30
# pass 30
# fail 0
```

## Bug found and fixed along the way (blocking Increment 2)

`startWerewolfGame` was throwing `INTERNAL` against the emulator: `game-engine/src/engine.mjs`'s `toPublicView()` set `revealedRoleId: state.revealedRoles?.[id]`, which evaluates to `undefined` (not `null`) for any player who hasn't used a reveal ability. `structuredClone` in `firebase-adapter-contract.mjs` preserves that `undefined` as a real object key, and the Realtime Database Admin SDK **rejects `update()` calls containing `undefined` anywhere in the payload** — so every `startWerewolfGame` call failed before writing anything.

Fixed with a one-line change: `revealedRoleId: ... : (state.revealedRoles?.[id] ?? null)`. Verified via:
1. `node --test test/*.test.mjs` in `game-engine/` — 30/30 still pass (no test asserted the old `undefined` behavior).
2. Rebuilt the functions bundle (`npm run build` in `functions/`) and re-ran an extended emulator smoke test (`tmp/fb_smoke_increment2.sh`, gitignored) covering `createSnapRoom` → 2×`joinSnapRoom` → `startWerewolfGame` → direct RTDB reads with per-user ID tokens:
   - `startWerewolfGame` now returns `{"ok":true,"revision":0}`.
   - `rooms/{roomId}/game/public` has no `roleId`/`revealedRoleId` keys at all (RTDB drops `null` leaves on write — this is actually the cleanest possible confirmation that "public view has no roles").
   - Each player's `privateViews/{uid}/self` has a distinct, correct `roleId`/`team` (host=prophet, guest1=citizen, guest2=werewolf in this run).
   - Reading another player's `privateViews/{otherUid}` with your own token returns `{"error":"Permission denied"}`, confirming the RTDB rules correctly enforce per-user isolation.

**This fix is committed locally in `game-engine/src/engine.mjs` and rebuilt into `functions/lib/index.mjs`, but it has NOT been deployed to production** (`firebase deploy --only functions --project jinro-bb5a5` was blocked by the permission system as an unrequested production deploy — correctly, since redeploying wasn't part of this task's ask). **Production `jinro-bb5a5` currently has the pre-fix code**, meaning any real device hitting "この構成で進む" in live mode today will get a toast error ("開始できませんでした。") until someone runs `firebase deploy --only functions --project jinro-bb5a5`. This is the single concern that should be resolved before a live two-phone test.

## Deferred to Increment 3

- s10–s20: night action submission, morning reveal, discussion timer sync, vote casting/tie-break/execution result, win + full-roster reveal, rematch, and reconnect — none of these call `send()`/`onPublic()` yet. The `send()` method and `onPublic` subscription are already implemented and exercised structurally (unit-level) but not wired into any screen.
- Host-driven computer-GM phase advancement (`BEGIN_NIGHT`/`RESOLVE_NIGHT`/`START_VOTE`/`RESOLVE_VOTE`/`END_DAY` timers) — not started.
- Idempotent retry / revision-conflict retry / illegal-command error surfacing in the UI — not started (Increment 4).
