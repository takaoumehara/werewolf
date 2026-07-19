# 人狼ゲーム・エンジン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FirebaseやUIから独立した決定論的な人狼ゲームエンジンを作り、6役職のプレイ可能なコアループ、秘密ビュー、コンピューターGM／人間GMの進行契約を提供する。

**Architecture:** `game-engine/src` に純粋なJavaScript ES modulesを置く。コマンドを検証してイベントを生成するReducer型エンジンと、役職ごとのルールレジストリを分離し、Firebase Cloud Functionsは後からアダプターとして接続する。サーバー完全状態から公開ビューとプレイヤー別秘密ビューを導出する。

**Tech Stack:** Node.js built-in test runner、JavaScript ES modules、外部依存なし。既存の静的HTML、カード画像、Firebase招待コードは変更しない。

## Global Constraints

- 役職名・陣営・説明文は `card_viewer.html` を正本にする。
- 勝敗・死亡・役職判定は決定論的エンジンだけが決める。
- クライアントへ完全な状態を返さない。
- `Math.random()` とクライアント時刻を権威処理に使わない。
- 各コマンドは `id` と `expectedRevision` で冪等性・排他性を担保する。
- 既存の未コミット画像・秘密ファイル・無関係なHTML変更はステージしない。

---

### Task 1: エンジン契約と失敗するテストを作る

**Files:**
- Create: `game-engine/package.json`
- Create: `game-engine/test/engine.test.mjs`

**Interfaces:**
- Test imports `createGame`, `dispatch`, `toPublicView`, and `toPlayerView` from `../src/engine.mjs`.
- Test imports `ROLE_IDS` from `../src/roles.mjs`.

- [ ] **Step 1: テストを作成する**

次の動作をテストに固定する。

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, toPublicView, toPlayerView } from "../src/engine.mjs";

const players = [
  { id: "p1", displayName: "A" },
  { id: "p2", displayName: "B" },
  { id: "p3", displayName: "C" },
  { id: "p4", displayName: "D" },
  { id: "p5", displayName: "E" },
  { id: "p6", displayName: "F" },
];

function command(state, actorId, type, payload = {}) {
  return { id: `${state.revision + 1}-${actorId}-${type}`, actorId, type, payload,
    expectedRevision: state.revision, now: 1_000 + state.revision };
}

test("同じseedと役職束は同じ役職配布になる", () => {
  const a = createGame({ gameId: "g1", players, seed: 42,
    roleIds: ["citizen", "werewolf", "prophet", "knights", "necromancer", "twins"] });
  const b = createGame({ gameId: "g1", players, seed: 42,
    roleIds: ["citizen", "werewolf", "prophet", "knights", "necromancer", "twins"] });
  assert.deepEqual(a.players, b.players);
});

test("ゲーム開始から夜行動、襲撃、防御、朝まで進められる", () => {
  let state = createGame({ gameId: "g1", players, seed: 42,
    roleIds: ["citizen", "werewolf", "prophet", "knights", "necromancer", "twins"] });
  ({ state } = dispatch(state, command(state, "p1", "START_GAME")));
  assert.equal(state.phase, "role_reveal");
  ({ state } = dispatch(state, command(state, "p1", "BEGIN_NIGHT")));
  assert.equal(state.phase, "night");
  const wolf = Object.values(state.players).find(p => p.roleId === "werewolf");
  const guard = Object.values(state.players).find(p => p.roleId === "knights");
  const target = Object.values(state.players).find(p => p.id !== wolf.id && p.id !== guard.id);
  ({ state } = dispatch(state, command(state, wolf.id, "SUBMIT_NIGHT_ACTION",
    { kind: "attack", targetId: target.id })));
  ({ state } = dispatch(state, command(state, guard.id, "SUBMIT_NIGHT_ACTION",
    { kind: "protect", targetId: target.id })));
  ({ state } = dispatch(state, command(state, "p1", "RESOLVE_NIGHT")));
  assert.equal(state.phase, "day");
  assert.equal(state.players[target.id].alive, true);
});

test("秘密ビューは自分の役職を含むが他人の役職を漏らさない", () => {
  const state = createGame({ gameId: "g1", players, seed: 42,
    roleIds: ["citizen", "werewolf", "prophet", "knights", "necromancer", "twins"] });
  const view = toPlayerView(state, "p1");
  assert.equal(view.self.roleId, state.players.p1.roleId);
  assert.equal(view.players.p2.roleId, undefined);
  assert.equal(toPublicView(state).players.p1.roleId, undefined);
});

test("古いrevisionのコマンドは状態を変更しない", () => {
  const state = createGame({ gameId: "g1", players, seed: 42,
    roleIds: ["citizen", "werewolf", "prophet", "knights", "necromancer", "twins"] });
  assert.throws(() => dispatch(state, { id: "x", actorId: "p1", type: "START_GAME",
    payload: {}, expectedRevision: 99, now: 1_000 }), /revision/i);
});
```

- [ ] **Step 2: テストが正しく失敗することを確認する**

Run: `node --test game-engine/test/engine.test.mjs`

Expected: `ERR_MODULE_NOT_FOUND` または同等の「engine.mjsが存在しない」失敗。テストが通る場合は実装が先に存在しているため、テストAPIを確認してから進める。

- [ ] **Step 3: 最小のpackage設定を追加する**

`game-engine/package.json` に `{ "private": true, "type": "module", "scripts": { "test": "node --test test/*.test.mjs" } }` を置く。

- [ ] **Step 4: テストを再実行して未実装失敗を確認する**

Run: `node --test game-engine/test/engine.test.mjs`

Expected: `../src/engine.mjs` が未実装で失敗する。

- [ ] **Step 5: コミットする**

```bash
git add game-engine/package.json game-engine/test/engine.test.mjs
git commit -m "test: define werewolf engine core contract"
```

### Task 2: 状態生成、決定論的乱数、コマンド検証を実装する

**Files:**
- Create: `game-engine/src/random.mjs`
- Create: `game-engine/src/roles.mjs`
- Create: `game-engine/src/engine.mjs`
- Test: `game-engine/test/engine.test.mjs`

**Interfaces:**
- `createGame(options) -> GameState`
- `dispatch(state, command) -> { state, events }`
- `ROLE_IDS`, `getRoleDefinition(roleId)`

- [ ] **Step 1: deterministic shuffleと初期状態のテストを追加する**
- [ ] **Step 2: テストを実行し、初期状態APIが未実装で失敗することを確認する**
- [ ] **Step 3: xorshift系のseed付きshuffleと6役職のregistryを実装する**
- [ ] **Step 4: `START_GAME`、`BEGIN_NIGHT`、revision検証を最小実装する**
- [ ] **Step 5: テストを実行してPASSを確認する**
- [ ] **Step 6: コミットする**

### Task 3: 夜行動の受付と決定順序を実装する

**Files:**
- Modify: `game-engine/src/engine.mjs`
- Modify: `game-engine/src/roles.mjs`
- Test: `game-engine/test/engine.test.mjs`
- Create: `game-engine/test/night-resolution.test.mjs`

**Interfaces:**
- `SUBMIT_NIGHT_ACTION` accepts `{ kind: "attack" | "protect" | "divine" | "medium", targetId }`.
- `RESOLVE_NIGHT` resolves all submitted actions once and returns a `day` state.

- [ ] **Step 1: 人狼の襲撃成功、騎士団の保護、予言結果、霊媒結果の失敗テストを書く**
- [ ] **Step 2: テストが期待した理由で失敗することを確認する**
- [ ] **Step 3: 生存者・役職・対象・フェーズを検証する**
- [ ] **Step 4: 防御を襲撃より先に適用し、結果イベントを記録する**
- [ ] **Step 5: 予言者・霊媒師の結果を秘密通知へ保存する**
- [ ] **Step 6: 全テストを実行してPASSを確認する**
- [ ] **Step 7: コミットする**

### Task 4: 昼、投票、処刑、勝敗判定を実装する

**Files:**
- Modify: `game-engine/src/engine.mjs`
- Create: `game-engine/test/vote-and-win.test.mjs`

**Interfaces:**
- `START_VOTE`, `CAST_VOTE`, `RESOLVE_VOTE`, `END_DAY`.
- `winner: { teams, reason } | null` is set only after all death reactions.

- [ ] **Step 1: 過半数条件、同票処刑なし、人狼勝利、市民勝利の失敗テストを書く**
- [ ] **Step 2: テストを実行して失敗を確認する**
- [ ] **Step 3: 投票対象と重複送信を検証する**
- [ ] **Step 4: 投票を安定順で集計し、同票を処刑なしにする**
- [ ] **Step 5: 市民・人狼・妖狐・アンドロイドの勝利判定を実装する**
- [ ] **Step 6: テストを実行してPASSを確認する**
- [ ] **Step 7: コミットする**

### Task 5: 公開ビューと秘密ビューを実装する

**Files:**
- Create: `game-engine/src/views.mjs`
- Modify: `game-engine/src/engine.mjs`
- Create: `game-engine/test/views.test.mjs`

**Interfaces:**
- `toPublicView(state) -> PublicView`
- `toPlayerView(state, playerId) -> PlayerView`

- [ ] **Step 1: 他人の役職、未公開投票、夜行動が漏れないテストを書く**
- [ ] **Step 2: テストを実行して失敗を確認する**
- [ ] **Step 3: 公開・個人・勝利後ビューを実装する**
- [ ] **Step 4: テストを実行してPASSを確認する**
- [ ] **Step 5: コミットする**

### Task 6: Firebaseアダプター契約と利用例を文書化する

**Files:**
- Create: `game-engine/README.md`
- Create: `game-engine/src/firebase-adapter-contract.mjs`
- Create: `game-engine/test/firebase-adapter-contract.test.mjs`

**Interfaces:**
- Adapter must expose `loadAuthoritativeState`, `saveTransition`, and `dispatchCommand` boundaries without importing Firebase in the engine.

- [ ] **Step 1: commandId冪等性、transaction境界、private view分離の契約テストを書く**
- [ ] **Step 2: テストが未実装で失敗することを確認する**
- [ ] **Step 3: Firebase SDK非依存の契約関数とREADMEの接続例を実装する**
- [ ] **Step 4: 全テストを実行する**
- [ ] **Step 5: 静的検査とサンプルゲームの通し実行を行う**
- [ ] **Step 6: コミットする**

#### 実装済み契約（Task 2〜6）

```js
const state = createGame({ gameId, players, seed, roleIds, gmMode, hostId });
const transition = dispatch(state, {
  id: "command-1", actorId: hostId, type: "START_GAME", payload: {},
  expectedRevision: state.revision, now: serverNow,
});
```

`random.mjs` のseed付きshuffleと `state.eventSequence` により、役職配布とイベントIDを
再現可能にする。`roles.mjs` の `createRoleRegistry(extraDefinitions)` は組み込み25役職
へ追加定義を登録し、重複IDを拒否する。夜アクションは `attack`, `protect`, `divine`,
`medium`, `trap`, `swap`, `calm`, `oracle`, `choose_copy`, `relay` を受け付ける。

```js
const patch = buildPersistencePatch({
  state: transition.state,
  events: transition.events,
  toPublicView,
  toPlayerView,
});
// patch.events: サーバー専用、patch.publicEvents: ルーム配信用
```

公開ビューは役職と内部死因を隠し、個人ビューだけが自分の役職・結果・仲間・行動状態を
持つ。`applyCommandOnce` はcommand IDと結果を台帳へ保存して再送を冪等化する。

### Task 7: 完了監査

**Files:**
- Modify: `docs/superpowers/specs/2026-07-19-werewolf-game-engine-design.md` only if behavior decisions changed.
- Modify: `docs/superpowers/plans/2026-07-19-werewolf-game-engine.md` to check completed steps.

- [ ] **Step 1: `node --test game-engine/test/*.test.mjs` を実行する**
- [ ] **Step 2: 代表的なゲームを作成し、開始→夜→朝→投票→勝敗を確認する**
- [ ] **Step 3: 公開ビューに秘密情報がないことを確認する**
- [ ] **Step 4: 既存カード/UIテストを実行する**
- [ ] **Step 5: `git diff --check` とステージ対象を確認する**
- [ ] **Step 6: 完了した要件だけを報告する**
