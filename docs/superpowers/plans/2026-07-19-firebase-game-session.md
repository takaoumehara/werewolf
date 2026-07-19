# Firebase Game Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 複数の携帯電話がQR／6文字コードで同じ部屋へ参加し、秘密役職を漏らさず既存ゲームエンジンをFirebase上で進行できるサーバー権威のセッション基盤を作る。

**Architecture:** Callable Functionsがルーム作成、参加、ゲーム開始、ゲームコマンドを検証し、Realtime Database transaction内で権威状態を更新する。クライアントは公開ビュー、自分専用ビュー、players、metaだけを購読し、Functions sourceはesbuildで既存game-engineをbundleする。

**Tech Stack:** Node.js 20、JavaScript ES modules、Firebase Functions v2、Firebase Admin SDK、Realtime Database、Firebase Anonymous Auth、App Check、esbuild、Node test runner、Firebase Emulator Suite。

## Global Constraints

- 公開 `workshopRooms` を使わず、サーバー権威の `rooms` / `roomMembers` / `pairingCodes` を使う。
- room IDとsecurity-sensitive tokenに `Math.random()` を使わない。
- `actorId` はCallable本文ではなく `request.auth.uid` から決定する。
- クライアントへroom親read、`authoritative`、完全events、processedCommands、joinStateを許可しない。
- `game/public` はmember全員、`game/privateViews/{uid}` は本人だけがreadできる。
- Functions sourceへ画像フォルダを含めず、esbuildがgame-engineをbundleする。
- 既存の未コミット画像、`mobile_app.html`、QRコード関連ファイルを変更・ステージしない。
- すべての新しい振る舞いはテストを先に失敗させてから実装する。

---

### Task 1: Firebase backend scaffold と room domain

**Files:**
- Create: `firebase.json`
- Create: `database.rules.json`
- Create: `firebase-backend/package.json`
- Create: `firebase-backend/src/room-domain.mjs`
- Create: `firebase-backend/test/room-domain.test.mjs`

**Interfaces:**
- Produces: `normalizePairingCode(raw)`
- Produces: `createPairingCode({ randomInt, isTaken, attempts })`
- Produces: `buildRoomRecords({ roomId, code, uid, name, maxPlayers, now, expiresAt })`
- Produces: `joinLedger(current, { uid, maxPlayers })`

- [ ] **Step 1: backend packageと失敗するroom domainテストを作る**

```json
{
  "name": "werewolf-firebase-backend",
  "private": true,
  "type": "module",
  "main": "lib/index.mjs",
  "engines": { "node": "20" },
  "scripts": {
    "build": "esbuild src/functions.mjs --bundle --platform=node --target=node20 --format=esm --packages=external --outfile=lib/index.mjs",
    "test": "node --test test/*.test.mjs",
    "test:rules": "firebase --config ../firebase.json emulators:exec --only database \"node --test test/database-rules.test.mjs\""
  },
  "dependencies": {
    "firebase-admin": "^13.4.0",
    "firebase-functions": "^6.4.0"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^4.0.1",
    "esbuild": "^0.25.6",
    "firebase": "^11.10.0",
    "firebase-tools": "^14.11.0"
  }
}
```

```json
{
  "functions": [{
    "source": "firebase-backend",
    "codebase": "werewolf-game",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
  }],
  "database": { "rules": "database.rules.json" },
  "emulators": {
    "functions": { "port": 5001 },
    "database": { "port": 9000 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizePairingCode, createPairingCode, buildRoomRecords, joinLedger }
  from "../src/room-domain.mjs";

test("pairing codeを安全な6文字へ正規化する", () => {
  assert.equal(normalizePairingCode(" ab-cd2 "), "ABCD2");
  assert.throws(() => normalizePairingCode("ABC"), /6 characters/i);
});

test("衝突時にcodeを再生成する", async () => {
  const values = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
  const code = await createPairingCode({
    randomInt: () => values.shift(),
    isTaken: async (candidate) => candidate === "AAAAAA",
    attempts: 2,
  });
  assert.equal(code, "BBBBBB");
});

test("同じuidの再参加はcountを増やさない", () => {
  const first = joinLedger({ count: 1, members: { host: true } }, { uid: "p2", maxPlayers: 3 });
  const second = joinLedger(first, { uid: "p2", maxPlayers: 3 });
  assert.equal(first.count, 2);
  assert.equal(second.count, 2);
});
```

- [ ] **Step 2: REDを確認する**

Run: `node --test firebase-backend/test/room-domain.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND` for `room-domain.mjs`。

- [ ] **Step 3: room domainを実装する**

```js
import { randomInt as cryptoRandomInt } from "node:crypto";

export const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizePairingCode(raw) {
  const code = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) throw new TypeError("Pairing code must be 6 characters");
  return code;
}

export async function createPairingCode({
  randomInt = cryptoRandomInt,
  isTaken,
  attempts = 8,
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const code = Array.from({ length: 6 }, () =>
      PAIRING_ALPHABET[randomInt(PAIRING_ALPHABET.length)]).join("");
    if (!(await isTaken(code))) return code;
  }
  throw new Error("Unable to allocate pairing code");
}

export function joinLedger(current, { uid, maxPlayers }) {
  const ledger = current ?? { count: 0, members: {} };
  if (ledger.members?.[uid]) return structuredClone(ledger);
  if (ledger.count >= maxPlayers) throw new Error("Room is full");
  return { count: ledger.count + 1, members: { ...ledger.members, [uid]: true } };
}

export function buildRoomRecords({ roomId, code, uid, name, maxPlayers, now, expiresAt }) {
  return {
    roomId,
    code,
    room: {
      meta: { hostId: uid, status: "waiting", createdAt: now, updatedAt: now,
        participantCount: 1, maxPlayers },
      players: { [uid]: { id: uid, name, role: "host", connected: true,
        joinedAt: now, lastSeenAt: now } },
      joinState: { count: 1, members: { [uid]: true } },
    },
    pairing: { roomId, hostId: uid, createdAt: now, expiresAt, maxPlayers },
  };
}
```

- [ ] **Step 4: GREENと全engine回帰を確認する**

Run: `node --test firebase-backend/test/room-domain.test.mjs && npm test --prefix game-engine`

Expected: room testsと30 engine testsがPASS。

- [ ] **Step 5: コミットする**

```bash
git add firebase.json database.rules.json firebase-backend/package.json firebase-backend/src/room-domain.mjs firebase-backend/test/room-domain.test.mjs
git commit -m "feat: add Firebase room domain"
```

### Task 2: Server-authoritative game session service

**Files:**
- Create: `firebase-backend/src/game-session-service.mjs`
- Create: `firebase-backend/test/game-session-service.test.mjs`

**Interfaces:**
- Consumes: `createGame`, `dispatch`, `toPublicView`, `toPlayerView`
- Consumes: `createCommandEnvelope`, `buildPersistencePatch`
- Produces: `startGameSession(input)`
- Produces: `applyGameSessionCommand(input) -> { game, commandResult, duplicate }`

**Persistence invariants:**
- 返却するgame subtreeは再帰的にFirebase/JSON互換へ正規化する。objectの`undefined`は省略し、arrayの`undefined`は`null`にする。非有限数、特殊object、循環参照は拒否する。
- `events` / `publicEvents`はevent ID keyed recordとして既存logへ追記し、上書きと不正keyを拒否する。
- 公開`DAY_STARTED`は`round`のみ。襲撃対象・護衛成否はserver-onlyに保つ。
- member判定はown propertyのみ。receiptは常に正確な`{ revision, phase }`へ縮約する。
- RTDBが削除するempty object / empty array / `null`はdispatch前にauthoritative schemaへhydrateし、duplicate viewも復元した現在stateから再生成する。
- 棄権voteはcommandでは`null`/省略を受け、authoritative `pendingVotes`ではnon-empty player IDと衝突しない空文字列sentinelへ変換してvoter keyを維持する。

- [ ] **Step 1: host/member/secret/idempotencyの失敗テストを書く**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { startGameSession, applyGameSessionCommand } from "../src/game-session-service.mjs";

const players = {
  p1: { id: "p1", name: "A" }, p2: { id: "p2", name: "B" },
  p3: { id: "p3", name: "C" }, p4: { id: "p4", name: "D" },
};

test("hostだけがgame sessionを開始できる", () => {
  assert.throws(() => startGameSession({
    roomId: "r1", callerUid: "p2", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  }), /host/i);
});

test("waiting以外のroomとrole数不一致を拒否する", () => {
  const input = {
    roomId: "r1", callerUid: "p1", players,
    roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  };
  assert.throws(() => startGameSession({
    ...input, roomMeta: { hostId: "p1", status: "playing" },
  }), /waiting/i);
  assert.throws(() => startGameSession({
    ...input, roomMeta: { hostId: "p1", status: "waiting" },
    roleIds: ["citizen", "citizen", "werewolf"],
  }), /role|player|match/i);
});

test("公開patchへ役職を漏らさず本人viewへだけ保存する", () => {
  const game = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  assert.equal(JSON.stringify(game.public).includes("werewolf"), false);
  assert.equal(JSON.stringify(game.publicEvents).includes("werewolf"), false);
  assert.equal(typeof game.privateViews.p1.self.roleId, "string");
});

test("memberでないcallerと不正command IDと古いrevisionを拒否する", () => {
  const started = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  const baseRequest = { commandId: "c1", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };
  assert.throws(() => applyGameSessionCommand({
    game: started, callerUid: "outsider", request: baseRequest, now: 101,
  }), /member/i);
  assert.throws(() => applyGameSessionCommand({
    game: started, callerUid: "p1", request: { ...baseRequest, commandId: "bad.id" }, now: 101,
  }), /command ID/i);
  assert.throws(() => applyGameSessionCommand({
    game: started, callerUid: "p1",
    request: { ...baseRequest, expectedRevision: started.authoritative.revision - 1 }, now: 101,
  }), /revision/i);
});

test("同じcommand idは一度だけ適用される", () => {
  const started = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  const request = { commandId: "c1", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };
  const first = applyGameSessionCommand({ game: started, callerUid: "p1", request, now: 101 });
  const second = applyGameSessionCommand({ game: first.game, callerUid: "p1", request, now: 102 });
  assert.equal(second.game.authoritative.revision, first.game.authoritative.revision);
  assert.deepEqual(second.commandResult, first.commandResult);
  assert.deepEqual(first.game.processedCommands.c1, first.commandResult);
  assert.deepEqual(Object.keys(first.game.processedCommands.c1).sort(), ["phase", "revision"]);
  assert.equal(second.duplicate, true);
});

test("後続command後に古いcommandを再送しても現在状態を巻き戻さない", () => {
  const started = startGameSession({
    roomId: "r1", callerUid: "p1", roomMeta: { hostId: "p1", status: "waiting" },
    players, roleIds: ["citizen", "citizen", "citizen", "werewolf"],
    gmMode: "computer", seed: 7, now: 100,
  });
  const firstRequest = { commandId: "c1", type: "BEGIN_NIGHT", payload: {},
    expectedRevision: started.authoritative.revision };
  const first = applyGameSessionCommand({
    game: started, callerUid: "p1", request: firstRequest, now: 101,
  });
  const advanced = applyGameSessionCommand({
    game: first.game, callerUid: "p1",
    request: { commandId: "c2", type: "RESOLVE_NIGHT", payload: {},
      expectedRevision: first.game.authoritative.revision },
    now: 102,
  });
  const retry = applyGameSessionCommand({
    game: advanced.game, callerUid: "p1", request: firstRequest, now: 103,
  });
  assert.equal(retry.game.authoritative.revision, advanced.game.authoritative.revision);
  assert.equal(retry.game.public.phase, advanced.game.public.phase);
  assert.deepEqual(retry.commandResult, first.commandResult);
  assert.equal(retry.duplicate, true);
});
```

- [ ] **Step 2: REDを確認する**

Run: `node --test firebase-backend/test/game-session-service.test.mjs`

Expected: missing module failure。

- [ ] **Step 3: game session serviceを実装する**

```js
import { createGame, dispatch, toPublicView, toPlayerView }
  from "../../game-engine/src/engine.mjs";
import { createCommandEnvelope, buildPersistencePatch }
  from "../../game-engine/src/firebase-adapter-contract.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function startGameSession({
  roomId, callerUid, roomMeta, players, roleIds, gmMode, seed, now,
}) {
  assert(roomMeta.hostId === callerUid, "Only the host may start the game");
  assert(roomMeta.status === "waiting", "Room is not waiting");
  const roster = Object.values(players).map((player) => ({
    id: player.id, displayName: player.name, joinedAt: player.joinedAt ?? now,
  }));
  let state = createGame({ gameId: roomId, players: roster, roleIds, gmMode,
    seed, hostId: roomMeta.hostId });
  ({ state } = dispatch(state, { id: "start", actorId: callerUid, type: "START_GAME",
    payload: {}, expectedRevision: state.revision, now }));
  const patch = buildPersistencePatch({ state, events: state.history,
    toPublicView, toPlayerView });
  return normalizeStoredGame({ ...patch, processedCommands: {} });
}

export function applyGameSessionCommand({ game, callerUid, request, now }) {
  assert(Object.hasOwn(game.privateViews ?? {}, callerUid), "Caller is not a game member");
  const command = createCommandEnvelope({
    id: request.commandId, actorId: callerUid, type: request.type,
    payload: request.payload ?? {}, expectedRevision: request.expectedRevision, now,
  });
  assert(/^[A-Za-z0-9_-]{1,128}$/.test(command.id), "Invalid command ID");
  const authoritative = hydrateAuthoritativeState(game.authoritative);
  const processedCommands = normalizeProcessedCommands(game.processedCommands ?? {});
  if (Object.hasOwn(processedCommands, command.id)) {
    const commandResult = compactReceipt(processedCommands[command.id]);
    const currentViews = buildPersistencePatch({ state: authoritative, events: [],
      toPublicView, toPlayerView });
    return {
      game: normalizeStoredGame({
        ...game,
        public: currentViews.public,
        privateViews: currentViews.privateViews,
        authoritative,
        processedCommands,
      }),
      commandResult,
      duplicate: true,
    };
  }
  const result = dispatch(authoritative, command);
  const patch = buildPersistencePatch({ state: result.state, events: result.events,
    toPublicView, toPlayerView });
  const commandResult = { revision: patch.public.revision, phase: patch.public.phase };
  Object.defineProperty(processedCommands, command.id, {
    value: structuredClone(commandResult), enumerable: true,
    configurable: true, writable: true,
  });
  return {
    game: normalizeStoredGame({
      ...patch,
      events: appendEventLog(game.events, patch.events),
      publicEvents: appendEventLog(game.publicEvents, patch.publicEvents),
      processedCommands,
    }),
    commandResult: structuredClone(commandResult),
    duplicate: false,
  };
}
```

上のsampleで使う`normalizeStoredGame`、`normalizeProcessedCommands`、`compactReceipt`、
`appendEventLog`、`hydrateAuthoritativeState`はproduction実装の保存境界helperであり、すべて
新しいplain object/arrayを作って入力をmutationしないこと。hydrateは`pendingActions`、
`pendingVotes`、`history`、`roleState`の全初期sub-map / nullable field、各playerの`flags` / `death`、
top-level nullable fieldを`createGame` schemaどおりに復元すること。

- [ ] **Step 4: GREENを確認する**

Run: `node --test firebase-backend/test/game-session-service.test.mjs && npm test --prefix game-engine`

Expected: all PASS。

- [ ] **Step 5: コミットする**

```bash
git add firebase-backend/src/game-session-service.mjs firebase-backend/test/game-session-service.test.mjs
git commit -m "feat: add authoritative game session service"
```

### Task 3: Callable Functions adapters

**Files:**
- Create: `firebase-backend/src/functions.mjs`
- Create: `firebase-backend/src/firebase-room-repository.mjs`
- Create: `firebase-backend/test/functions-contract.test.mjs`
- Modify: `firebase.json`

**Interfaces:**
- Produces callables: `createSnapRoom`, `joinSnapRoom`, `startWerewolfGame`, `dispatchWerewolfCommand`
- Repository transaction target: `rooms/{roomId}/game`

**Correctness and security invariants:**
- `request.auth.uid`だけをcaller/actorとして使用し、bodyの`actorId`は無視する。未認証、validation、conflict、expired/full等は安定した`HttpsError` codeへ変換する。
- 全callableでApp Checkを強制する。入力はplain recordとして検証し、name、maxPlayers、roomId、code、roleIds、gmMode、commandId、type、payload、expectedRevisionを境界で制限する。
- pairing codeはread-then-writeだけで確保せず、`pairingCodes/{code}` transactionで空きを原子的に予約する。競合時は暗号学的乱数で再生成し、途中失敗時は自分のreservationだけを条件付きで解放する。
- room作成はuid単位の短時間rate-limit ledgerをserver-only pathへtransaction保存する。
- joinはroom transaction内でstatus、TTL、capacity、既存uidを再検証する。同じuidの再参加はcountを増やさず、その後のmulti-location updateで`roomMembers`とplayer recordを修復できる。
- transaction updaterはpure/deterministicにする。時刻、seed、IDはtransaction外で一度だけ生成し、外側のmutable responseへ依存せずcommitted snapshotから応答を導く。
- startはhost、waiting、4〜30人、role数一致を同じroom transaction内で検証し、gameとstatusを一緒にcommitする。
- dispatchは`rooms/{roomId}/game`だけをtransactionし、Task 2のhydrate、compact receipt、duplicate非巻戻しをそのまま使う。
- fake RTDBはtransaction retry、collision、aborted commit、multi-location updateを再現し、rate limit、atomic code reservation、full/ended/expired/idempotent rejoin、host/role validation、duplicate commandをunit testする。
- buildはNode 20 ESMでgame-engine relative importsをbundleし、画像フォルダや秘密ファイルを成果物へ含めない。

- [ ] **Step 1: exported callable namesとactor bindingの失敗テストを書く**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createFunctionHandlers } from "../src/functions.mjs";

test("auth.uidをactorとしてcommand serviceへ渡す", async () => {
  const calls = [];
  const handlers = createFunctionHandlers({
    dispatchCommand: async (input) => { calls.push(input); return { revision: 2 }; },
  });
  await handlers.dispatchWerewolfCommand({
    auth: { uid: "server-uid" },
    data: { roomId: "r1", actorId: "spoofed", commandId: "c1",
      type: "CAST_VOTE", payload: { targetId: "p2" }, expectedRevision: 1 },
  });
  assert.equal(calls[0].callerUid, "server-uid");
  assert.equal(calls[0].request.actorId, undefined);
});
```

- [ ] **Step 2: REDを確認する**

Run: `node --test firebase-backend/test/functions-contract.test.mjs`

Expected: missing module failure。

- [ ] **Step 3: dependency-injected handlersとFirebase exportsを実装する**

```js
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { createFirebaseRoomRepository } from "./firebase-room-repository.mjs";

initializeApp();

function requireUid(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  return request.auth.uid;
}

export function createFunctionHandlers(services) {
  return {
    createSnapRoom: (request) => services.createRoom({
      callerUid: requireUid(request), input: request.data,
    }),
    joinSnapRoom: (request) => services.joinRoom({
      callerUid: requireUid(request), input: request.data,
    }),
    startWerewolfGame: (request) => services.startGame({
      callerUid: requireUid(request), input: request.data,
    }),
    dispatchWerewolfCommand: (request) => services.dispatchCommand({
      callerUid: requireUid(request),
      request: {
        roomId: request.data.roomId, commandId: request.data.commandId,
        type: request.data.type, payload: request.data.payload,
        expectedRevision: request.data.expectedRevision,
      },
    }),
  };
}

const services = createFirebaseRoomRepository({ database: getDatabase() });
const handlers = createFunctionHandlers(services);
export const createSnapRoom = onCall({ enforceAppCheck: true }, handlers.createSnapRoom);
export const joinSnapRoom = onCall({ enforceAppCheck: true }, handlers.joinSnapRoom);
export const startWerewolfGame = onCall({ enforceAppCheck: true }, handlers.startWerewolfGame);
export const dispatchWerewolfCommand =
  onCall({ enforceAppCheck: true }, handlers.dispatchWerewolfCommand);
```

- [ ] **Step 3a: Admin SDK repositoryを実装する**

```js
import { randomInt, randomUUID } from "node:crypto";
import { createPairingCode, buildRoomRecords, joinLedger, normalizePairingCode }
  from "./room-domain.mjs";
import { startGameSession, applyGameSessionCommand }
  from "./game-session-service.mjs";

function cleanName(value) {
  const name = String(value ?? "").trim().slice(0, 30);
  if (!name) throw new Error("Player name is required");
  return name;
}

function cleanMaxPlayers(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 4 || count > 30) {
    throw new Error("maxPlayers must be between 4 and 30");
  }
  return count;
}

export function createFirebaseRoomRepository({ database, now = Date.now }) {
  return {
    async createRoom({ callerUid, input }) {
      const timestamp = now();
      const code = await createPairingCode({
        randomInt,
        isTaken: async (candidate) =>
          (await database.ref(`pairingCodes/${candidate}`).get()).exists(),
      });
      const records = buildRoomRecords({
        roomId: randomUUID(), code, uid: callerUid, name: cleanName(input.name),
        maxPlayers: cleanMaxPlayers(input.maxPlayers), now: timestamp,
        expiresAt: timestamp + 5 * 60 * 1000,
      });
      await database.ref().update({
        [`rooms/${records.roomId}`]: records.room,
        [`roomMembers/${records.roomId}/${callerUid}`]: true,
        [`pairingCodes/${records.code}`]: records.pairing,
      });
      return { roomId: records.roomId, code: records.code,
        expiresAt: records.pairing.expiresAt };
    },

    async joinRoom({ callerUid, input }) {
      const code = normalizePairingCode(input.code);
      const pairing = (await database.ref(`pairingCodes/${code}`).get()).val();
      if (!pairing || pairing.expiresAt < now()) throw new Error("Pairing code expired");
      const roomId = pairing.roomId;
      const ledgerRef = database.ref(`rooms/${roomId}/joinState`);
      const transaction = await ledgerRef.transaction((current) =>
        joinLedger(current, { uid: callerUid, maxPlayers: pairing.maxPlayers }));
      if (!transaction.committed) throw new Error("Unable to join room");
      const count = transaction.snapshot.val().count;
      const timestamp = now();
      await database.ref().update({
        [`roomMembers/${roomId}/${callerUid}`]: true,
        [`rooms/${roomId}/players/${callerUid}`]: {
          id: callerUid, name: cleanName(input.name), role: "participant",
          connected: true, joinedAt: timestamp, lastSeenAt: timestamp,
        },
        [`rooms/${roomId}/meta/participantCount`]: count,
        [`rooms/${roomId}/meta/updatedAt`]: timestamp,
      });
      return { roomId };
    },

    async startGame({ callerUid, input }) {
      const roomRef = database.ref(`rooms/${input.roomId}`);
      let response;
      const transaction = await roomRef.transaction((room) => {
        if (!room) return;
        const timestamp = now();
        const session = startGameSession({
          roomId: input.roomId, callerUid, roomMeta: room.meta,
          players: room.players, roleIds: input.roleIds, gmMode: input.gmMode,
          seed: randomInt(1, 0x7fffffff), now: timestamp,
        });
        response = { roomId: input.roomId, revision: session.public.revision };
        return {
          ...room,
          meta: { ...room.meta, status: "playing", updatedAt: timestamp },
          game: session,
        };
      });
      if (!transaction.committed) throw new Error("Unable to start game");
      return response;
    },

    async dispatchCommand({ callerUid, request }) {
      const gameRef = database.ref(`rooms/${request.roomId}/game`);
      let response;
      const transaction = await gameRef.transaction((game) => {
        if (!game) return;
        const result = applyGameSessionCommand({ game, callerUid, request, now: now() });
        response = result.commandResult;
        return result.game;
      });
      if (!transaction.committed) throw new Error("Game command conflict");
      return response;
    },
  };
}
```

- [ ] **Step 4: unit testsとbundle buildを確認する**

Run: `npm --prefix firebase-backend test && npm --prefix firebase-backend run build`

Expected: tests PASS and `firebase-backend/lib/index.mjs` generated。

- [ ] **Step 5: コミットする**

```bash
git add firebase.json firebase-backend/src/functions.mjs firebase-backend/src/firebase-room-repository.mjs firebase-backend/test/functions-contract.test.mjs
git commit -m "feat: expose Firebase game callables"
```

### Task 4: Realtime Database security rules

**Files:**
- Modify: `database.rules.json`
- Create: `firebase-backend/test/database-rules.test.mjs`

**Interfaces:**
- Member read: `rooms/{roomId}/meta`, `players`, `game/public`, `game/publicEvents`
- Self read: `rooms/{roomId}/game/privateViews/{uid}`
- Server-only: pairingCodes, roomMembers, joinState, authoritative, events, processedCommands

- [ ] **Step 1: rules emulatorの許可／拒否テストを書く**

```js
import test, { before, after } from "node:test";
import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails }
  from "@firebase/rules-unit-testing";
import { ref, get, set } from "firebase/database";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "werewolf-rules-test",
    database: { rules: fs.readFileSync("../database.rules.json", "utf8") },
  });
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), "roomMembers/r1/p1"), true);
    await set(ref(context.database(), "rooms/r1/game/public"), { phase: "night" });
    await set(ref(context.database(), "rooms/r1/game/privateViews/p1"), { roleId: "werewolf" });
    await set(ref(context.database(), "rooms/r1/game/privateViews/p2"), { roleId: "citizen" });
    await set(ref(context.database(), "rooms/r1/game/authoritative"), { secret: true });
  });
});
after(async () => env.cleanup());

test("memberはpublicと自分のprivateだけ読める", async () => {
  const db = env.authenticatedContext("p1").database();
  await assertSucceeds(get(ref(db, "rooms/r1/game/public")));
  await assertSucceeds(get(ref(db, "rooms/r1/game/privateViews/p1")));
  await assertFails(get(ref(db, "rooms/r1/game/privateViews/p2")));
  await assertFails(get(ref(db, "rooms/r1/game/authoritative")));
});
```

- [ ] **Step 2:rulesを拒否状態で実行する**

Run: `npm --prefix firebase-backend run test:rules`

Expected: public/self reads fail until rules are implemented。

- [ ] **Step 3:最小権限ルールを実装する**

```json
{
  "rules": {
    "pairingCodes": { ".read": false, ".write": false },
    "roomMembers": { ".read": false, ".write": false },
    "rooms": {
      "$roomId": {
        ".read": false,
        ".write": false,
        "meta": {
          ".read": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).val() === true",
          ".write": false
        },
        "players": {
          ".read": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).val() === true",
          "$uid": {
            ".write": false,
            "name": { ".write": "auth != null && auth.uid === $uid && root.child('roomMembers').child($roomId).child(auth.uid).val() === true" },
            "connected": { ".write": "auth != null && auth.uid === $uid && root.child('roomMembers').child($roomId).child(auth.uid).val() === true" },
            "lastSeenAt": { ".write": "auth != null && auth.uid === $uid && root.child('roomMembers').child($roomId).child(auth.uid).val() === true" }
          }
        },
        "joinState": { ".read": false, ".write": false },
        "game": {
          "public": {
            ".read": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).val() === true",
            ".write": false
          },
          "publicEvents": {
            ".read": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).val() === true",
            ".write": false
          },
          "privateViews": {
            "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": false }
          },
          "authoritative": { ".read": false, ".write": false },
          "events": { ".read": false, ".write": false },
          "processedCommands": { ".read": false, ".write": false }
        }
      }
    }
  }
}
```

- [ ] **Step 4: GREENを確認する**

Run: `npm --prefix firebase-backend run test:rules`

Expected: all rules tests PASS。

- [ ] **Step 5: コミットする**

```bash
git add database.rules.json firebase-backend/test/database-rules.test.mjs
git commit -m "feat: protect Firebase game session data"
```

### Task 5: Mobile Firebase client contract

**Files:**
- Create: `game-client/package.json`
- Create: `game-client/firebase-game-client.mjs`
- Create: `game-client/test/firebase-game-client.test.mjs`

**Interfaces:**
- Produces: `createFirebaseGameClient(dependencies)`
- Subscribes separately to meta, players, public, publicEvents, and self private view

- [ ] **Step 1: auth/callable/subscription/presenceの失敗テストを書く**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createFirebaseGameClient } from "../firebase-game-client.mjs";

test("room親ではなく許可された5 pathだけを購読する", async () => {
  const paths = [];
  const client = createFirebaseGameClient({
    uid: () => "p1",
    ensureAuth: async () => {},
    call: async () => ({ data: {} }),
    subscribe: (path) => { paths.push(path); return () => {}; },
    setPresence: async () => {},
  });
  client.subscribeRoom("r1", {});
  assert.deepEqual(paths, [
    "rooms/r1/meta", "rooms/r1/players", "rooms/r1/game/public",
    "rooms/r1/game/publicEvents", "rooms/r1/game/privateViews/p1",
  ]);
  assert.equal(paths.includes("rooms/r1"), false);
});

test("command actorIdを送らない", async () => {
  const calls = [];
  const client = createFirebaseGameClient({
    uid: () => "p1", ensureAuth: async () => {},
    call: async (name, data) => { calls.push({ name, data }); return { data: {} }; },
    subscribe: () => () => {}, setPresence: async () => {},
  });
  await client.dispatchCommand({ roomId: "r1", commandId: "c1", type: "CAST_VOTE",
    payload: { targetId: "p2" }, expectedRevision: 3 });
  assert.equal(calls[0].data.actorId, undefined);
});
```

- [ ] **Step 2: REDを確認する**

Run: `node --test game-client/test/firebase-game-client.test.mjs`

Expected: missing module failure。

- [ ] **Step 3: dependency-injected clientを実装する**

```js
export function createFirebaseGameClient({
  uid, ensureAuth, call, subscribe, setPresence,
}) {
  const unsubscribers = new Set();
  async function invoke(name, data) {
    await ensureAuth();
    return (await call(name, data)).data;
  }
  return {
    createRoom: (input) => invoke("createSnapRoom", input),
    joinRoom: (input) => invoke("joinSnapRoom", input),
    startGame: (input) => invoke("startWerewolfGame", input),
    dispatchCommand: (input) => invoke("dispatchWerewolfCommand", input),
    subscribeRoom(roomId, callbacks) {
      const paths = [
        ["meta", callbacks.onMeta], ["players", callbacks.onPlayers],
        ["game/public", callbacks.onPublic], ["game/publicEvents", callbacks.onPublicEvents],
        [`game/privateViews/${uid()}`, callbacks.onPrivate],
      ];
      for (const [suffix, handler] of paths) {
        const unsubscribe = subscribe(`rooms/${roomId}/${suffix}`, handler ?? (() => {}));
        unsubscribers.add(unsubscribe);
      }
      return () => this.dispose();
    },
    setPresence: (input) => setPresence({ ...input, uid: uid() }),
    dispose() {
      for (const unsubscribe of unsubscribers) unsubscribe();
      unsubscribers.clear();
    },
  };
}
```

- [ ] **Step 4: GREENを確認する**

Run: `node --test game-client/test/firebase-game-client.test.mjs`

Expected: all client contract tests PASS。

- [ ] **Step 5: コミットする**

```bash
git add game-client
git commit -m "feat: add mobile Firebase game client"
```

### Task 6: Integration verification and documentation

**Files:**
- Modify: `game-engine/README.md`
- Create: `firebase-backend/README.md`
- Modify: `docs/superpowers/plans/2026-07-19-firebase-game-session.md`

**Interfaces:**
- Documents emulator commands, deploy prerequisites, security boundaries, and mobile integration.

- [ ] **Step 1: 全unit testsとbuildを実行する**

Run:

```bash
npm test --prefix game-engine
npm --prefix firebase-backend test
npm --prefix firebase-backend run build
node --test game-client/test/*.test.mjs
```

Expected: all tests PASS and Functions bundle succeeds。

- [ ] **Step 2: Emulator rules testsを実行する**

Run: `npm --prefix firebase-backend run test:rules`

Expected: all permission tests PASS。

- [ ] **Step 3: 既存カード／デザイン回帰を確認する**

Run:

```bash
node --test tests/card_position_editor_core.test.mjs tests/live_access_key_core.test.mjs
bash tests/design_source_of_truth_test.sh
bash tests/design_system_test.sh
```

Expected: all PASS。

- [ ] **Step 4: READMEへ実行手順を記載する**

```md
## Local verification

1. `npm install --prefix firebase-backend`
2. `npm --prefix firebase-backend test`
3. `npm --prefix firebase-backend run test:rules`
4. `npm --prefix firebase-backend run build`

Production deploy requires a user-selected Firebase project, Anonymous Auth,
Realtime Database, App Check, and `.firebaserc`. Do not point tests at a
production database.
```

- [ ] **Step 5: diffとstage対象を監査する**

Run: `git diff --check && git status --short`

Expected: engine/Firebase/client/docsだけが対象で、画像・API key・既存mobile app変更を含まない。

- [ ] **Step 6: コミットする**

```bash
git add firebase-backend/README.md game-engine/README.md docs/superpowers/plans/2026-07-19-firebase-game-session.md
git commit -m "docs: document Firebase game sessions"
```
