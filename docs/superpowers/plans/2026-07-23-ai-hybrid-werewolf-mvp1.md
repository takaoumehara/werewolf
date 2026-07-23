# AIハイブリッド型人狼 — MVP1 実装計画（パターンA・ソロAI対戦）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の対面スマホ人狼「月下ノ影 / GEKKA」に、決定論ブレイン＋LLM発話で動く AIプレイヤー を足し、「人間1 vs AI複数」のソロAI対戦（村人/人狼/占い師の3役職・人格2軸）を一気通貫で遊べるようにする。

**Architecture:** 2層アーキテクチャ。(1) AIの意思決定（誰に投票・誰を襲撃/占う）は **決定論コード `game-engine/src/ai-brain.mjs`**（Firebase非依存・純関数・TDD）で行う。(2) LLM（Claude Haiku）は「決まった結論をキャラの口調で言語化するだけ」。AIプレイヤーはサーバー（Cloud Functions・Admin SDK）が **authoritative 状態を読み**、AIの `actorId` で既存エンジンにコマンドを適用する。人間はスマホで普段どおり投票し、AIの発話は RTDB の `chat` を購読して s14 の議論画面に表示する。ソロは単一端末・全AI即着席。

**Tech Stack:** Node 22 ESM / Firebase Cloud Functions v2 (`onCall`) / Firebase Realtime Database (Admin SDK) / 既存 `game-engine`（26役職・決定論エンジン）/ 既存 `mobile_app.html`（単一ファイル・`showScreen` ルーティング）/ `design-system.css`（3層トークン）/ Claude Messages API (`claude-haiku-4-5-20251001`) / `node:test`。

**モデル割当の凡例（推奨・トークン節約のため）:**
- **Sol（≈Opus 4.8）** = 最難関の設計判断・ステートフルなオーケストレータ・視覚/マイクロインタラクション設計。ここだけに強力モデルを使う。
- **Terra（≈Sonnet）** = 仕様が固まった TDD 実装・純関数・統合配線。MVP1 の大半。
- **Luna（≈Haiku）** = データ定義・機械的な置換・定数追加。
各タスク見出しに `推奨モデル:` を記載。実行時（subagent-driven-development）はこの割当に従い、Sol の乱用を避ける。

---

## Global Constraints

以下は全タスクに暗黙で適用される。値は設計書（`docs/superpowers/specs/2026-07-23-ai-hybrid-werewolf-design.md`）から逐語コピー。

- **言語**: UI・コメント・チャット文言は日本語。中国語は一切禁止。スキーマキー/コード識別子/技術用語は英語のまま。
- **判断A（根幹）**: LLMに意思決定させない。投票先・襲撃先・占い先は必ず `ai-brain.mjs` の決定論コードが決める。LLMは言語化のみ。
- **ハルシネーション物理防御（ハード要件）**: AIが取れる対象は必ず「システムが生成した選択可能リスト（生存者・有効対象）」に限定する。LLMの言及対象も検証で弾く。死者告発・存在しない占い結果を物理的に発生させない。
- **秘匿**: AIの真の役職・狼仲間・システム用語（LLM/AI/プロンプト）を発話に出さない。`privateViews` は本人（と Admin SDK のサーバー）のみ読める。既存 `database.rules.json` の秘匿を壊さない。
- **actorId のなりすまし防止**: 既存 `dispatchWerewolfCommand` は `actorId = req.auth.uid` に固定（人間用）。AI用のサーバー権威経路は**別に新設**し、人間経路の `roomMembers` ゲート・uid固定は一切変更しない。
- **MVP1 スコープ厳守（YAGNI）**: 役職は `citizen`（村人）/ `werewolf`（人狼）/ `prophet`（占い師）の3つのみ。人格は `logic`・`aggression` の2軸のみ。二重マトリクス・主張台帳・カバーストーリー事前確定・亡霊・初心者プライマー・対面パターンBは MVP2/MVP3（本計画では作らない）。
- **アクセシビリティ**: 本計画で触れる/追加するUIは WCAG 2.2 AA（本文4.5:1・大字/UI/フォーカス3:1）必須、本文はAAA(7:1)目標。
- **既存エンジンの authoritative 状態の形は変更しない**（`game-engine` の30 unit testsを壊さない）。AIブレインの動的状態はエンジン外（`rooms/{roomId}/aiPlayers`）に持つ。
- **エンジンの役職ID逐語**: 村人=`"citizen"`、占い師=`"prophet"`（action `"divine"`）、人狼=`"werewolf"`（action `"attack"`）。チーム=`"citizen"|"werewolf"|"fox"`。
- **コミット**: 各タスク末尾で1コミット。TDD（失敗テスト→最小実装→通過）。DRY/YAGNI。

---

## File Structure（作成/変更するファイルと責務）

**新規（純ロジック・Firebase非依存）**
- `game-engine/src/ai-brain.mjs` — AI意思決定の決定論エンジン。信頼度算出・投票決定・夜行動決定。純関数。
- `game-engine/test/ai-brain.test.mjs` — 上記の `node:test` ユニットテスト。

**新規（Functions配下・Firebase結合）**
- `functions/ai/roster.mjs` — AIキャラのロスター（名前・一人称・口調サンプル・口癖・人格 `{logic, aggression}`）。データのみ。
- `functions/ai/prompt.mjs` — `buildSpeechPrompt(ctx)` 純関数。設計書 §4.2 のシステムプロンプト生成。
- `functions/ai/validate.mjs` — `validateUtterance(text, ctx)` 純関数。禁止語/対象妥当性/長さ検証（設計書 §4.3）。
- `functions/ai/llm.mjs` — `generateSpeech(prompt, apiKey)`。Claude Haiku を `fetch` で叩く。
- `functions/ai/orchestrator.mjs` — `runAiPhase({roomId, phase, ...})`。authoritative を読み、ブレイン→サーバー権威コマンド適用→検証付きLLM発話→`chat` 書込み。

**新規（テスト/ツール）**
- `tests/contrast_check.mjs` — `design-system.css` の色トークン対を解析し WCAG コントラスト比を計算、基準未満で `exit 1`。
- `game-engine/test/ai-orchestrator-context.test.mjs` — orchestrator の純粋部分（context 抽出）のテスト。

**変更**
- `functions/index.js` — `applyServerCommand()` ヘルパ（AI用サーバー権威dispatch）、`seatAiPlayers`・`advanceAiTurn` の onCall 追加、`ANTHROPIC_API_KEY` シークレット定義。
- `game-client/firebase-game-client.mjs` — `seatAiPlayers`・`advanceAiTurn`・`postChat` メソッド、`chat` 購読種別追加。
- `mobile_app.html` — s02 にソロ入口、新規 `s02b` ソロ設定画面、s14 にチャットUI、`hostDriver` に AIターン駆動フック。
- `design-system.css` — コントラスト是正・`:focus-visible` リング追加・タップ領域是正・チャットUIコンポーネント。
- `database.rules.json` — `rooms/{roomId}/game/chat` の read/write ルール、`aiPlayers` の read ルール。
- `tests/design_system_test.sh` — 末尾で `contrast_check.mjs` を呼ぶ1行追加。

**依存の向き**: `ai-brain.mjs`（純）← `orchestrator.mjs` ← `functions/index.js`。`prompt.mjs`/`validate.mjs`（純）← `orchestrator.mjs`。`llm.mjs` ← `orchestrator.mjs`。フロントは Functions を叩くだけ。

---

# Part A — AI決定論ブレイン（`game-engine/src/ai-brain.mjs`）

**なぜ最初か**: 判断A（LLMに意思決定させない）の心臓部。純関数・Firebase非依存で、既存 `game-engine/test/*.test.mjs` と同じ `node:test` でTDDできる。ここが緑になれば「AIの行動が破綻しない」骨格が保証され、以降は言語化と配線だけになる。

### Task A1: ブレインの信頼度算出 `computeTrust`

推奨モデル: **Terra**（仕様固定のTDD純関数）

**Files:**
- Create: `game-engine/src/ai-brain.mjs`
- Test: `game-engine/test/ai-brain.test.mjs`

**Interfaces:**
- Produces:
  - `computeTrust(input) -> { [playerId: string]: number }`（-100..+100。値が低いほど「黒＝人狼」と疑う）
  - `input` の形（全タスク共通・逐語）:
    ```
    {
      selfId: string,
      roleId: "citizen" | "prophet" | "werewolf",
      team: "citizen" | "werewolf",
      allyIds: string[],                                  // 狼仲間（狼のみ非空）
      divineResults: [{ targetId: string, result: "werewolf" | "human" }],
      alivePlayerIds: string[],                           // 自分含む生存者
      pendingVotes: { [voterId: string]: string | null }, // 現ラウンドの投票（未resolve時のみ有効）
      personality: { logic: number, aggression: number }, // 0..100
      seed: number
    }
    ```

- [ ] **Step 1: 失敗テストを書く**

`game-engine/test/ai-brain.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTrust } from "../src/ai-brain.mjs";

const base = {
  selfId: "p1",
  roleId: "citizen",
  team: "citizen",
  allyIds: [],
  divineResults: [],
  alivePlayerIds: ["p1", "p2", "p3", "p4"],
  pendingVotes: {},
  personality: { logic: 50, aggression: 50 },
  seed: 1,
};

test("占い師が『人狼』と占った相手の信頼度は最小(-100)になる", () => {
  const trust = computeTrust({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p3", result: "werewolf" }],
  });
  assert.equal(trust.p3, -100);
});

test("占い師が『人間』と占った相手は信頼が上がる(+40)", () => {
  const trust = computeTrust({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p2", result: "human" }],
  });
  assert.equal(trust.p2, 40);
});

test("狼から見た仲間の狼は信頼度が最大(+100)で守られる", () => {
  const trust = computeTrust({
    ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"],
  });
  assert.equal(trust.p2, 100);
});

test("自分に投票してきた相手への疑いが上がる(aggressionで増幅)", () => {
  const calm = computeTrust({ ...base, personality: { logic: 50, aggression: 0 },
    pendingVotes: { p2: "p1" } });
  const fierce = computeTrust({ ...base, personality: { logic: 50, aggression: 100 },
    pendingVotes: { p2: "p1" } });
  assert.ok(fierce.p2 < calm.p2, "aggression高の方が疑いが強い");
  assert.ok(calm.p2 < 0, "投票された相手は疑いがマイナス方向");
});

test("自分自身は信頼度マップに含めない", () => {
  const trust = computeTrust(base);
  assert.equal(trust.p1, undefined);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test game-engine/test/ai-brain.test.mjs`
Expected: FAIL（`computeTrust` is not a function / module not found）

- [ ] **Step 3: 最小実装**

`game-engine/src/ai-brain.mjs`:
```js
// AI決定論ブレイン（MVP1: 役職 citizen/prophet/werewolf・人格2軸 logic/aggression）。
// Firebase非依存の純関数。意思決定はすべてここ。LLMは言語化のみ（判断A）。

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 決定論の一様乱数[0,1)。Math.random は使わない（テスト再現性のため）。
function seededUnit(seed) {
  let s = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  s ^= s << 13; s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5; s >>>= 0;
  return s / 0xffffffff;
}

export function computeTrust(input) {
  const { selfId, team, allyIds, divineResults, alivePlayerIds, pendingVotes, personality } = input;
  const allySet = new Set(allyIds);
  const trust = {};
  for (const id of alivePlayerIds) {
    if (id === selfId) continue;
    trust[id] = 0;
  }
  // 占い結果（占い師の確定情報）
  for (const r of divineResults) {
    if (!(r.targetId in trust)) continue;
    if (r.result === "werewolf") trust[r.targetId] = -100;
    else trust[r.targetId] = clamp(trust[r.targetId] + 40, -100, 100);
  }
  // 狼は仲間を守る（表マトリクスは MVP2。MVP1は単純化して常に守る）
  if (team === "werewolf") {
    for (const id of allyIds) if (id in trust) trust[id] = 100;
  }
  // 疑い返し：自分に投票してきた相手を疑う（aggressionで増幅）
  for (const [voter, target] of Object.entries(pendingVotes)) {
    if (target === selfId && voter in trust && !allySet.has(voter)) {
      trust[voter] = clamp(trust[voter] - (10 + personality.aggression * 0.3), -100, 100);
    }
  }
  return trust;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test game-engine/test/ai-brain.test.mjs`
Expected: PASS（5 tests）

- [ ] **Step 5: コミット**

```bash
git add game-engine/src/ai-brain.mjs game-engine/test/ai-brain.test.mjs
git commit -m "feat(ai-brain): add deterministic trust computation (MVP1)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: 投票決定 `decideVote`

推奨モデル: **Terra**

**Files:**
- Modify: `game-engine/src/ai-brain.mjs`（`decideVote` を追記）
- Test: `game-engine/test/ai-brain.test.mjs`（追記）

**Interfaces:**
- Consumes: `computeTrust`（Task A1）
- Produces: `decideVote(input) -> { targetId: string | null }`。`input` は Task A1 と同一の形。狼は仲間へ投票しない。占い師は「黒」判定を最優先。`logic` が低いほどノイズで最適投票を外す。

- [ ] **Step 1: 失敗テストを書く**（`ai-brain.test.mjs` に追記）

```js
import { computeTrust, decideVote } from "../src/ai-brain.mjs";

test("占い師は『人狼』と占った相手に投票する", () => {
  const out = decideVote({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p3", result: "werewolf" }],
    personality: { logic: 100, aggression: 50 }, // logic高=ノイズ無しで確実
  });
  assert.equal(out.targetId, "p3");
});

test("狼は仲間には絶対投票しない", () => {
  for (let seed = 0; seed < 50; seed++) {
    const out = decideVote({
      ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"], seed,
    });
    assert.notEqual(out.targetId, "p2");
    assert.notEqual(out.targetId, "p1"); // 自分にも投票しない
  }
});

test("同じ入力・同じseedなら決定は再現する（決定論）", () => {
  const a = decideVote({ ...base, seed: 7 });
  const b = decideVote({ ...base, seed: 7 });
  assert.equal(a.targetId, b.targetId);
});

test("投票可能な生存者がいなければ targetId は null", () => {
  const out = decideVote({ ...base, alivePlayerIds: ["p1"] });
  assert.equal(out.targetId, null);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test game-engine/test/ai-brain.test.mjs`
Expected: FAIL（`decideVote` is not a function）

- [ ] **Step 3: 実装**（`ai-brain.mjs` に追記）

```js
// 投票可能な候補（自分と狼仲間を除く生存者）
function voteCandidates(input) {
  const allySet = new Set(input.allyIds);
  return input.alivePlayerIds.filter((id) => id !== input.selfId && !allySet.has(id));
}

export function decideVote(input) {
  const candidates = voteCandidates(input);
  if (candidates.length === 0) return { targetId: null };
  const trust = computeTrust(input);
  // 最も疑う相手（trust最小）。同値は id 昇順で決定論的に。
  const sorted = [...candidates].sort(
    (a, b) => (trust[a] ?? 0) - (trust[b] ?? 0) || a.localeCompare(b),
  );
  let choice = sorted[0];
  // logicが低いほどノイズで最適から外す（難易度スライダー）
  const noiseChance = (100 - input.personality.logic) / 200; // logic=0→0.5, 100→0
  if (seededUnit(input.seed) < noiseChance) {
    const idx = Math.floor(seededUnit(input.seed + 1) * candidates.length);
    choice = candidates[Math.min(idx, candidates.length - 1)];
  }
  return { targetId: choice };
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test game-engine/test/ai-brain.test.mjs`
Expected: PASS（9 tests）

- [ ] **Step 5: コミット**

```bash
git add game-engine/src/ai-brain.mjs game-engine/test/ai-brain.test.mjs
git commit -m "feat(ai-brain): add deterministic vote decision with logic-noise

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task A3: 夜行動決定 `decideNightAction`

推奨モデル: **Terra**

**Files:**
- Modify: `game-engine/src/ai-brain.mjs`
- Test: `game-engine/test/ai-brain.test.mjs`

**Interfaces:**
- Consumes: `computeTrust`, `voteCandidates`（内部）
- Produces: `decideNightAction(input) -> { kind: "attack" | "divine", targetId: string } | null`。
  - `werewolf` → `{ kind: "attack", targetId }`（狼仲間以外の生存者から）
  - `prophet` → `{ kind: "divine", targetId }`（自分と既占い者以外の生存者から）
  - `citizen` → `null`
  - エンジンの `NIGHT_ACTIONS`／`role.actions` と整合（`"attack"`/`"divine"` は実在アクション）。

- [ ] **Step 1: 失敗テストを書く**（追記）

```js
import { decideNightAction } from "../src/ai-brain.mjs";

test("村人は夜行動を持たない（null）", () => {
  assert.equal(decideNightAction(base), null);
});

test("人狼の襲撃先は仲間・自分を含まない生存者", () => {
  const out = decideNightAction({
    ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"],
  });
  assert.equal(out.kind, "attack");
  assert.ok(["p3", "p4"].includes(out.targetId));
});

test("占い師の占い先は自分・既占い者を除く生存者", () => {
  const out = decideNightAction({
    ...base, roleId: "prophet",
    divineResults: [{ targetId: "p2", result: "human" }],
  });
  assert.equal(out.kind, "divine");
  assert.ok(["p3", "p4"].includes(out.targetId)); // p2は既占いなので除外
});

test("夜行動は同seedで再現する", () => {
  const a = decideNightAction({ ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"], seed: 3 });
  const b = decideNightAction({ ...base, roleId: "werewolf", team: "werewolf", allyIds: ["p2"], seed: 3 });
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test game-engine/test/ai-brain.test.mjs`
Expected: FAIL（`decideNightAction` is not a function）

- [ ] **Step 3: 実装**（追記）

```js
export function decideNightAction(input) {
  const allySet = new Set(input.allyIds);
  if (input.roleId === "werewolf") {
    const targets = input.alivePlayerIds.filter(
      (id) => id !== input.selfId && !allySet.has(id),
    );
    if (targets.length === 0) return null;
    // 脅威度が高い順＝trustが低い（疑っている）順。同値はid昇順。ノイズはlogic連動。
    const trust = computeTrust(input);
    const sorted = [...targets].sort(
      (a, b) => (trust[a] ?? 0) - (trust[b] ?? 0) || a.localeCompare(b),
    );
    let choice = sorted[0];
    const noiseChance = (100 - input.personality.logic) / 200;
    if (seededUnit(input.seed + 11) < noiseChance) {
      const idx = Math.floor(seededUnit(input.seed + 12) * targets.length);
      choice = targets[Math.min(idx, targets.length - 1)];
    }
    return { kind: "attack", targetId: choice };
  }
  if (input.roleId === "prophet") {
    const divined = new Set(input.divineResults.map((r) => r.targetId));
    const targets = input.alivePlayerIds.filter(
      (id) => id !== input.selfId && !divined.has(id),
    );
    if (targets.length === 0) return null;
    // 最も不確実な相手（|trust|が小さい）を占う。同値はid昇順。
    const trust = computeTrust(input);
    const sorted = [...targets].sort(
      (a, b) => Math.abs(trust[a] ?? 0) - Math.abs(trust[b] ?? 0) || a.localeCompare(b),
    );
    let choice = sorted[0];
    const noiseChance = (100 - input.personality.logic) / 200;
    if (seededUnit(input.seed + 21) < noiseChance) {
      const idx = Math.floor(seededUnit(input.seed + 22) * targets.length);
      choice = targets[Math.min(idx, targets.length - 1)];
    }
    return { kind: "divine", targetId: choice };
  }
  return null;
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test game-engine/test/ai-brain.test.mjs`
Expected: PASS（13 tests）

- [ ] **Step 5: 既存エンジンテストが壊れていないことを確認してコミット**

Run: `node --test game-engine/test/*.test.mjs`
Expected: PASS（既存30 + 新規13 すべて緑）
```bash
git add game-engine/src/ai-brain.mjs game-engine/test/ai-brain.test.mjs
git commit -m "feat(ai-brain): add deterministic night-action decision (attack/divine)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Part B — 発話生成（`functions/ai/` の純ロジック＋LLM）

### Task B1: AIキャラ・ロスター `roster.mjs`

推奨モデル: **Luna**（データ定義）

**Files:**
- Create: `functions/ai/roster.mjs`
- Test: `functions/ai/roster.test.mjs`

**Interfaces:**
- Produces:
  - `AI_ROSTER: AiCharacter[]`（最低4体。MVP1のソロは最大11 AI必要になり得るが、名前は末尾に連番を付けて再利用可）
  - `AiCharacter = { key: string, name: string, pronoun: string, toneSamples: string[], verbalTic: string, personality: { logic: number, aggression: number } }`
  - `pickRoster(count: number) -> AiCharacter[]`（`count` 体を決定論的に返す。不足時は `name` に `②`等を付け複製）

- [ ] **Step 1: 失敗テストを書く**

`functions/ai/roster.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_ROSTER, pickRoster } from "./roster.mjs";

test("ロスターは最低4体、各キャラは必須フィールドを持つ", () => {
  assert.ok(AI_ROSTER.length >= 4);
  for (const c of AI_ROSTER) {
    assert.equal(typeof c.name, "string");
    assert.equal(typeof c.pronoun, "string");
    assert.ok(Array.isArray(c.toneSamples) && c.toneSamples.length >= 1);
    assert.ok(c.personality.logic >= 0 && c.personality.logic <= 100);
    assert.ok(c.personality.aggression >= 0 && c.personality.aggression <= 100);
  }
});

test("pickRosterは要求数ぴったり返す（超過要求は名前を変えて複製）", () => {
  assert.equal(pickRoster(3).length, 3);
  const many = pickRoster(AI_ROSTER.length + 2);
  assert.equal(many.length, AI_ROSTER.length + 2);
  const names = many.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, "名前は一意");
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test functions/ai/roster.test.mjs`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

`functions/ai/roster.mjs`:
```js
// AIキャラのロスター。人格値はブレイン(ai-brain)へ、口調はプロンプト(prompt)へ渡す。
// MVP1は人格2軸(logic/aggression)のみ使用。

export const AI_ROSTER = Object.freeze([
  {
    key: "kotetsu", name: "虎鉄", pronoun: "儂",
    toneSamples: ["ふむ、妙じゃな。", "儂はそうは思わんぞ。"],
    verbalTic: "…のう", personality: { logic: 80, aggression: 30 },
  },
  {
    key: "sana", name: "紗奈", pronoun: "あたし",
    toneSamples: ["ねえ、それ怪しくない？", "あたしは詰めたい派。"],
    verbalTic: "…だよね", personality: { logic: 55, aggression: 85 },
  },
  {
    key: "rin", name: "凛", pronoun: "私",
    toneSamples: ["落ち着いて考えましょう。", "根拠は？"],
    verbalTic: "", personality: { logic: 90, aggression: 40 },
  },
  {
    key: "gon", name: "ゴン", pronoun: "オレ",
    toneSamples: ["よくわからんが、いくぜ！", "とりあえず吊ろう！"],
    verbalTic: "！", personality: { logic: 25, aggression: 70 },
  },
  {
    key: "mai", name: "舞", pronoun: "わたし",
    toneSamples: ["みんなはどう思う？", "合わせるのが安全かな。"],
    verbalTic: "…かも", personality: { logic: 45, aggression: 20 },
  },
]);

export function pickRoster(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = AI_ROSTER[i % AI_ROSTER.length];
    const cycle = Math.floor(i / AI_ROSTER.length);
    const suffix = cycle === 0 ? "" : `${["", "②", "③", "④"][cycle] ?? `#${cycle + 1}`}`;
    out.push({ ...base, key: `${base.key}_${i}`, name: `${base.name}${suffix}` });
  }
  return out;
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test functions/ai/roster.test.mjs`
Expected: PASS（2 tests）

- [ ] **Step 5: コミット**

```bash
git add functions/ai/roster.mjs functions/ai/roster.test.mjs
git commit -m "feat(ai): add AI character roster with 2-axis personality

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: プロンプト生成 `prompt.mjs`

推奨モデル: **Terra**

**Files:**
- Create: `functions/ai/prompt.mjs`
- Test: `functions/ai/prompt.test.mjs`

**Interfaces:**
- Produces: `buildSpeechPrompt(ctx) -> { system: string, user: string }`（設計書 §4.2）。
  - `ctx = { name, pronoun, toneSamples: string[], verbalTic, maxChars: number, claimedRole: string, topSuspectNames: string[], reasonTags: string[], voteTargetName: string|null, composureText: string, structuredLog: string, recentUtterances: string[], validNames: string[] }`
  - **真の役職は system に書かない**（`claimedRole` は表向きの立場のみ）。禁止事項節を必ず含む。

- [ ] **Step 1: 失敗テストを書く**

`functions/ai/prompt.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSpeechPrompt } from "./prompt.mjs";

const ctx = {
  name: "虎鉄", pronoun: "儂", toneSamples: ["ふむ、妙じゃな。"], verbalTic: "…のう",
  maxChars: 100, claimedRole: "村人",
  topSuspectNames: ["紗奈"], reasonTags: ["自分に投票してきた"],
  voteTargetName: "紗奈", composureText: "落ち着いている",
  structuredLog: "CO: なし / 前日投票: なし / 死亡: なし",
  recentUtterances: ["紗奈: 虎鉄が怪しい"], validNames: ["紗奈", "凛", "ゴン"],
};

test("systemに名前・口調・禁止事項・文字数上限が含まれる", () => {
  const { system } = buildSpeechPrompt(ctx);
  assert.match(system, /虎鉄/);
  assert.match(system, /儂/);
  assert.match(system, /100文字/);
  assert.match(system, /禁止/);
  assert.match(system, /LLM|AI|プロンプト/); // システム用語への言及禁止が明記される
});

test("真の役職名（人狼/占い師の内部知識）はsystemにそのまま出さない", () => {
  const { system } = buildSpeechPrompt({ ...ctx, claimedRole: "村人" });
  // claimedRole=村人 のときは "人狼です" のような真role断定を含めない
  assert.doesNotMatch(system, /あなたの真の役職は人狼/);
});

test("投票予定と最重要容疑者がuserに反映される", () => {
  const { user } = buildSpeechPrompt(ctx);
  assert.match(user, /紗奈/);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test functions/ai/prompt.test.mjs`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

`functions/ai/prompt.mjs`:
```js
// 発話生成プロンプト（設計書 §4.2）。純関数。真の役職はsystemの「公開上の立場」欄に書かない。

export function buildSpeechPrompt(ctx) {
  const system = [
    `あなたは人狼ゲームのプレイヤー「${ctx.name}」です。以下に基づき「発言のみ」を日本語で出力してください。`,
    ``,
    `## 人格カード（不変）`,
    `- 一人称:${ctx.pronoun} / 口調サンプル:${ctx.toneSamples.join(" / ")} / 口癖:${ctx.verbalTic || "なし"}`,
    `- 発言は最大${ctx.maxChars}文字。会話として自然に。説明的な長文は禁止。`,
    ``,
    `## あなたの公開上の立場（この内容としてのみ振る舞う）`,
    `- 公言している役職:${ctx.claimedRole}   ※真の役職ではなく表向きの主張`,
    ``,
    `## 現在の脳内状態（結論は変えない）`,
    `- 最も疑っている:${ctx.topSuspectNames.join("、") || "特になし"}（理由:${ctx.reasonTags.join("、") || "なし"}）`,
    `- 今日の投票予定:${ctx.voteTargetName || "未定"}   ← 発言はこの結論へ誘導する`,
    `- 感情状態:${ctx.composureText}`,
    ``,
    `## 禁止事項`,
    `- 真の役職・狼仲間・システム用語（LLM/AI/プロンプト）への言及`,
    `- 投票予定と逆方向の主張`,
    `- 発言以外（思考・地の文）の出力`,
    `- 名簿にない人物への言及。言及してよい相手:${ctx.validNames.join("、")}`,
  ].join("\n");

  const user = [
    `## 今日の公式記録（帳面）`,
    ctx.structuredLog,
    ``,
    `## 直前の発言（これに応答する）`,
    ...(ctx.recentUtterances.length ? ctx.recentUtterances : ["（まだ発言なし）"]),
    ``,
    `あなた（${ctx.name}）の発言を1つだけ、${ctx.maxChars}文字以内で出力してください。`,
  ].join("\n");

  return { system, user };
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test functions/ai/prompt.test.mjs`
Expected: PASS（3 tests）

- [ ] **Step 5: コミット**

```bash
git add functions/ai/prompt.mjs functions/ai/prompt.test.mjs
git commit -m "feat(ai): add speech prompt builder (spec 4.2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B3: 発話検証 `validate.mjs`

推奨モデル: **Terra**

**Files:**
- Create: `functions/ai/validate.mjs`
- Test: `functions/ai/validate.test.mjs`

**Interfaces:**
- Produces: `validateUtterance(text, ctx) -> { ok: boolean, reason?: string, cleaned?: string }`（設計書 §4.3 の 1〜3。台帳整合(2)は MVP2）。
  - `ctx = { maxChars: number, validNames: string[] }`
  - 検証: (a) 禁止語（`LLM`/`AI`/`プロンプト`/`人狼です`のような真role断定→MVP1は禁止語リストのみ）、(b) 長さ ≤ `maxChars`（超過は末尾トリムして `cleaned`）、(c) `validNames` 以外の**人名らしき既知トークン**への言及は許容だが、`validNames` に無い**役職バラし的固有語**を弾く（MVP1は禁止語で担保）。

- [ ] **Step 1: 失敗テストを書く**

`functions/ai/validate.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUtterance } from "./validate.mjs";

const ctx = { maxChars: 100, validNames: ["紗奈", "凛", "ゴン"] };

test("システム用語を含む発話は不合格", () => {
  assert.equal(validateUtterance("これはAIだから信用できない", ctx).ok, false);
  assert.equal(validateUtterance("プロンプト的に怪しい", ctx).ok, false);
});

test("普通の発話は合格", () => {
  const r = validateUtterance("紗奈が怪しいと思うんだよね", ctx);
  assert.equal(r.ok, true);
});

test("文字数超過は末尾トリムしてcleanedを返す", () => {
  const long = "あ".repeat(150);
  const r = validateUtterance(long, ctx);
  assert.equal(r.ok, true);
  assert.ok(r.cleaned.length <= ctx.maxChars);
});

test("空文字・地の文だけは不合格", () => {
  assert.equal(validateUtterance("", ctx).ok, false);
  assert.equal(validateUtterance("（黙っている）", ctx).ok, false);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test functions/ai/validate.test.mjs`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

`functions/ai/validate.mjs`:
```js
// 発話検証（設計書 §4.3）。純関数。失格なら {ok:false}。長さ超過は cleaned で救済。

const BANNED = [
  /\bLLM\b/i, /\bAI\b/i, /人工知能/, /プロンプト/, /システムプロンプト/,
  /言語モデル/, /トークン/, /（[^）]*黙[^）]*）/, // 地の文っぽい括弧
];

export function validateUtterance(text, ctx) {
  const t = (text ?? "").trim();
  if (t.length === 0) return { ok: false, reason: "empty" };
  // 括弧だけ／地の文だけを弾く（会話でない）
  if (/^[（(].*[）)]$/.test(t) && !/[。！？]/.test(t.replace(/[（）()]/g, ""))) {
    return { ok: false, reason: "narration" };
  }
  for (const re of BANNED) {
    if (re.test(t)) return { ok: false, reason: `banned:${re}` };
  }
  if (t.length > ctx.maxChars) {
    return { ok: true, cleaned: t.slice(0, ctx.maxChars) };
  }
  return { ok: true, cleaned: t };
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test functions/ai/validate.test.mjs`
Expected: PASS（4 tests）

- [ ] **Step 5: コミット**

```bash
git add functions/ai/validate.mjs functions/ai/validate.test.mjs
git commit -m "feat(ai): add utterance validation (banned terms, length, narration)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task B4: LLMクライアント `llm.mjs`（Claude Haiku）

推奨モデル: **Terra**（`claude-api` スキルを必ず先に読むこと）

**Files:**
- Create: `functions/ai/llm.mjs`
- Test: `functions/ai/llm.test.mjs`

**Interfaces:**
- Produces: `generateSpeech({ system, user, apiKey, fetchImpl }) -> Promise<string>`。
  - Claude Messages API を叩く。モデルは `claude-haiku-4-5-20251001`（設計書§10「小型高速モデル」）。
  - `fetchImpl` は注入可能（テストでモック。既定は global `fetch`。Node22はネイティブ `fetch` あり）。
  - **実装前に必ず `claude-api` スキルを読み**、エンドポイント/ヘッダ/レスポンス形を最新版で確認する。

- [ ] **Step 1: 失敗テストを書く**（fetchをモックしネットワーク非依存に）

`functions/ai/llm.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSpeech } from "./llm.mjs";

test("Messages APIのレスポンスからテキストを取り出す", async () => {
  let captured = null;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return {
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "紗奈が怪しいのう" }] }),
    };
  };
  const out = await generateSpeech({
    system: "sys", user: "usr", apiKey: "sk-test", fetchImpl: fakeFetch,
  });
  assert.equal(out, "紗奈が怪しいのう");
  assert.match(captured.url, /api\.anthropic\.com\/v1\/messages/);
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.model, "claude-haiku-4-5-20251001");
  assert.equal(captured.opts.headers["x-api-key"], "sk-test");
  assert.equal(captured.opts.headers["anthropic-version"], "2023-06-01");
});

test("APIエラー時は例外を投げる", async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
  await assert.rejects(
    () => generateSpeech({ system: "s", user: "u", apiKey: "k", fetchImpl: fakeFetch }),
    /500/,
  );
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test functions/ai/llm.test.mjs`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**（`claude-api` スキルで確認後）

`functions/ai/llm.mjs`:
```js
// Claude Messages API 経由の発話生成。実装前に claude-api スキルで最新仕様を確認済み。
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001"; // 小型高速モデル（設計書§10）

export async function generateSpeech({ system, user, apiKey, fetchImpl }) {
  const doFetch = fetchImpl ?? fetch;
  const res = await doFetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const detail = typeof res.text === "function" ? await res.text() : "";
    throw new Error(`Anthropic API error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  const block = (data.content ?? []).find((b) => b.type === "text");
  return (block?.text ?? "").trim();
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test functions/ai/llm.test.mjs`
Expected: PASS（2 tests）

- [ ] **Step 5: コミット**

```bash
git add functions/ai/llm.mjs functions/ai/llm.test.mjs
git commit -m "feat(ai): add Claude Haiku speech generation client (injectable fetch)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Part C — サーバー・オーケストレーション（`functions/`）

### Task C1: AI用サーバー権威dispatch `applyServerCommand`

推奨モデル: **Sol**（既存トランザクション権威経路の複製・秘匿とデータ整合が要・慎重さ最優先）

**Files:**
- Modify: `functions/index.js`（既存 `dispatchWerewolfCommand` の直後にヘルパを追加。既存関数は変更しない）
- Test: `functions/ai/orchestrator.test.mjs`（このタスクでは `applyServerCommand` の構造検証は難しいため、C4のエミュレータ・スモークで確認。ここでは純粋な `deriveBrainInput` を切り出してテスト）

**Interfaces:**
- Consumes: 既存 `createCommandEnvelope`, `applyCommandOnce`, `buildPersistencePatch`, `dispatch`, `toPublicView`, `toPlayerView`（既に `functions/index.js` で import 済み）
- Produces: `async function applyServerCommand(roomId, actorId, type, payload) -> { revision, phase, finished } | null`。
  - **人間経路と違い `actorId` を引数で受ける**（AIのid）。`req.auth`/`roomMembers` ゲートは無い（Admin SDKのサーバー内部呼び出し専用。`onCall` として公開しない）。
  - `dispatchWerewolfCommand` と同じ RTDB transaction・冪等・patch書き戻しを行う。

**背景（なぜ新設か）**: 既存 `dispatchWerewolfCommand`（`functions/index.js:186`）は `actorId: uid`（`req.auth.uid`）に固定され `roomMembers/{roomId}/{uid}` を要求する。サーバーが AI の `actorId` で叩く経路が存在しないため、本ヘルパを追加する。

- [ ] **Step 1: 実装（既存 import を利用）**

`functions/index.js` の `dispatchWerewolfCommand` 定義（244行目付近の末尾 `});`）の直後に追加:
```js
/**
 * サーバー内部専用: AIプレイヤーの actorId でコマンドを1つ適用する。
 * dispatchWerewolfCommand と同じ権威トランザクションだが、actorId を引数で受け、
 * req.auth / roomMembers ゲートを持たない（Admin SDK からのみ呼ぶ・onCallにしない）。
 */
export async function applyServerCommand(roomId, actorId, type, payload = {}) {
  let outcome = null;
  let domainError = null;
  const commandId = `ai-${actorId}-${type}-${Date.now()}`;
  const gameRef = db().ref(`rooms/${roomId}/game`);
  const txn = await gameRef.transaction((game) => {
    if (!game || !game.authoritative) return game;
    try {
      const command = createCommandEnvelope({
        id: commandId,
        actorId, // ← AIのid。サーバーが信頼して指定する。
        type,
        payload,
        expectedRevision: game.authoritative.revision,
        now: Date.now(),
      });
      const processed = game.processedCommands || {};
      const result = applyCommandOnce({ state: game.authoritative, command, dispatch, processedCommands: processed });
      const patch = buildPersistencePatch({ state: result.state, events: result.events, toPublicView, toPlayerView });
      game.authoritative = patch.authoritative;
      game.public = patch.public;
      game.privateViews = patch.privateViews;
      game.processedCommands = processed;
      game.events = game.events || {};
      for (const ev of patch.events) game.events[ev.id] = ev;
      game.publicEvents = game.publicEvents || {};
      for (const ev of patch.publicEvents) game.publicEvents[ev.id] = ev;
      outcome = { revision: patch.authoritative.revision, phase: patch.public.phase, finished: !!patch.public.winner };
      return game;
    } catch (error) {
      domainError = error;
      return; // abort
    }
  });
  if (domainError) throw domainError;
  if (!txn.committed) return null;
  return outcome;
}
```

- [ ] **Step 2: 構文チェック（bundleが通ること）**

Run: `cd functions && npm run build`
Expected: esbuild 成功（`lib/index.mjs` 生成、エラーなし）

- [ ] **Step 3: コミット**

```bash
git add functions/index.js
git commit -m "feat(functions): add server-authoritative applyServerCommand for AI actors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C2: ブレイン入力抽出 `deriveBrainInput`（純関数）

推奨モデル: **Terra**

**Files:**
- Create: `functions/ai/context.mjs`
- Test: `functions/ai/context.test.mjs`

**Interfaces:**
- Produces: `deriveBrainInput(authoritative, aiId, seed) -> BrainInput`（`BrainInput` は Task A1 の `input` 形と**完全一致**させる）。
  - authoritative の形（Task 冒頭調査より）: `players[id] = {id, displayName, roleId, team, alive, ...}`、`pendingVotes: {voterId: targetId}`、`roleState.privateResults[id] = [{type:"divine", targetId, result}]`。
  - 狼の `allyIds` は authoritative から算出（team==="werewolf" の他プレイヤー）。

- [ ] **Step 1: 失敗テストを書く**

`functions/ai/context.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBrainInput } from "./context.mjs";

const authoritative = {
  players: {
    p1: { id: "p1", roleId: "prophet", team: "citizen", alive: true },
    ai1: { id: "ai1", roleId: "werewolf", team: "werewolf", alive: true },
    ai2: { id: "ai2", roleId: "werewolf", team: "werewolf", alive: true },
    ai3: { id: "ai3", roleId: "citizen", team: "citizen", alive: true },
    ai4: { id: "ai4", roleId: "citizen", team: "citizen", alive: false },
  },
  pendingVotes: { p1: "ai1" },
  roleState: { privateResults: { p1: [{ type: "divine", targetId: "ai1", result: "werewolf" }] } },
};

test("狼のallyIdsは他の狼だけ（自分・村人・死者を除く）", () => {
  const input = deriveBrainInput(authoritative, "ai1", 5);
  assert.deepEqual(input.allyIds.sort(), ["ai2"]);
  assert.equal(input.roleId, "werewolf");
  assert.equal(input.team, "werewolf");
});

test("alivePlayerIdsは生存者のみ（死者ai4を含まない）", () => {
  const input = deriveBrainInput(authoritative, "ai1", 5);
  assert.ok(!input.alivePlayerIds.includes("ai4"));
  assert.ok(input.alivePlayerIds.includes("ai1"));
});

test("占い師の privateResults が divineResults に変換される", () => {
  const input = deriveBrainInput(authoritative, "p1", 5);
  assert.deepEqual(input.divineResults, [{ targetId: "ai1", result: "werewolf" }]);
});

test("pendingVotes と seed をそのまま渡す", () => {
  const input = deriveBrainInput(authoritative, "ai1", 5);
  assert.deepEqual(input.pendingVotes, { p1: "ai1" });
  assert.equal(input.seed, 5);
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test functions/ai/context.test.mjs`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

`functions/ai/context.mjs`:
```js
// authoritative 状態から ai-brain の入力を組み立てる純関数。
// personality はここでは付けない（呼び出し側が roster から合成）。

export function deriveBrainInput(authoritative, aiId, seed, personality = { logic: 50, aggression: 50 }) {
  const players = authoritative.players ?? {};
  const self = players[aiId];
  const alivePlayerIds = Object.values(players).filter((p) => p.alive).map((p) => p.id).sort();
  const allyIds = Object.values(players)
    .filter((p) => p.alive && p.id !== aiId && p.team === "werewolf" && self.team === "werewolf")
    .map((p) => p.id).sort();
  const divineResults = (authoritative.roleState?.privateResults?.[aiId] ?? [])
    .filter((r) => r.type === "divine")
    .map((r) => ({ targetId: r.targetId, result: r.result }));
  return {
    selfId: aiId,
    roleId: self.roleId,
    team: self.team,
    allyIds,
    divineResults,
    alivePlayerIds,
    pendingVotes: authoritative.pendingVotes ?? {},
    personality,
    seed,
  };
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test functions/ai/context.test.mjs`
Expected: PASS（4 tests）

- [ ] **Step 5: コミット**

```bash
git add functions/ai/context.mjs functions/ai/context.test.mjs
git commit -m "feat(ai): add deriveBrainInput to map authoritative state to brain input

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C3: オーケストレータ `orchestrator.mjs`

推奨モデル: **Sol**（ステートフル・秘匿・LLM検証ループの統合。MVP1で最も難しい）

**Files:**
- Create: `functions/ai/orchestrator.mjs`
- Test: `functions/ai/orchestrator.test.mjs`（依存を注入して純粋にテスト）

**Interfaces:**
- Consumes: `deriveBrainInput`(C2), `decideVote`/`decideNightAction`(A2/A3), `buildSpeechPrompt`(B2), `validateUtterance`(B3), `generateSpeech`(B4), `pickRoster`(B1)。`applyServerCommand`(C1) と RTDB は**注入**（`deps`）でテスト可能に。
- Produces:
  - `async function runAiPhase(deps, { roomId, phase }) -> { actions: number, messages: number }`
  - `deps = { readAuthoritative(roomId), readAiPlayers(roomId), applyCommand(roomId, actorId, type, payload), pushChat(roomId, message), generate({system,user}), now }`
  - phase 別:
    - `"night"`: 生存AIごとに `decideNightAction`→ あれば `applyCommand(SUBMIT_NIGHT_ACTION, {kind,targetId})`
    - `"vote"`: 生存AIごとに `decideVote`→ `applyCommand(CAST_VOTE, {targetId})`
    - `"day"`: 生存AIごとに ブレインで投票先を内部決定→プロンプト→LLM→検証（失敗時1回だけ再生成、なお失敗ならスキップ）→ `pushChat`

- [ ] **Step 1: 失敗テストを書く**（全依存モック・ネットワーク非依存）

`functions/ai/orchestrator.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runAiPhase } from "./orchestrator.mjs";

function makeDeps(overrides = {}) {
  const applied = [];
  const chats = [];
  const authoritative = {
    round: 1, phase: "vote",
    players: {
      p1: { id: "p1", roleId: "citizen", team: "citizen", alive: true, displayName: "あなた" },
      ai1: { id: "ai1", roleId: "werewolf", team: "werewolf", alive: true, displayName: "虎鉄" },
      ai2: { id: "ai2", roleId: "prophet", team: "citizen", alive: true, displayName: "凛" },
    },
    pendingVotes: {},
    roleState: { privateResults: {} },
  };
  return {
    _applied: applied, _chats: chats,
    readAuthoritative: async () => overrides.authoritative ?? authoritative,
    readAiPlayers: async () => ({
      ai1: { name: "虎鉄", pronoun: "儂", toneSamples: ["ふむ"], verbalTic: "のう", personality: { logic: 80, aggression: 30 } },
      ai2: { name: "凛", pronoun: "私", toneSamples: ["根拠は？"], verbalTic: "", personality: { logic: 90, aggression: 40 } },
    }),
    applyCommand: async (roomId, actorId, type, payload) => { applied.push({ actorId, type, payload }); return { revision: 1 }; },
    pushChat: async (roomId, m) => { chats.push(m); },
    generate: async () => "なるほどのう、怪しいな",
    now: () => 1000,
    ...overrides,
  };
}

test("voteフェーズでは生存AI全員がCAST_VOTEを出す", async () => {
  const deps = makeDeps();
  const res = await runAiPhase(deps, { roomId: "r1", phase: "vote" });
  const votes = deps._applied.filter((a) => a.type === "CAST_VOTE");
  assert.equal(votes.length, 2); // ai1, ai2
  for (const v of votes) assert.ok(typeof v.payload.targetId === "string" || v.payload.targetId === null);
});

test("nightフェーズでは狼はattack・占い師はdivineを出す（村人は出さない）", async () => {
  const auth = {
    round: 1, phase: "night",
    players: {
      p1: { id: "p1", roleId: "citizen", team: "citizen", alive: true, displayName: "あなた" },
      ai1: { id: "ai1", roleId: "werewolf", team: "werewolf", alive: true, displayName: "虎鉄" },
      ai2: { id: "ai2", roleId: "prophet", team: "citizen", alive: true, displayName: "凛" },
    },
    pendingVotes: {}, roleState: { privateResults: {} },
  };
  const deps = makeDeps({ authoritative: auth });
  await runAiPhase(deps, { roomId: "r1", phase: "night" });
  const kinds = deps._applied.filter((a) => a.type === "SUBMIT_NIGHT_ACTION").map((a) => a.payload.kind);
  assert.ok(kinds.includes("attack"));
  assert.ok(kinds.includes("divine"));
  assert.equal(kinds.length, 2); // citizen p1 は人間・AIでもないので0、AI2体だけ
});

test("dayフェーズでは検証を通った発話だけがchatに入る", async () => {
  const deps = makeDeps({ generate: async () => "これはAIの陰謀だ" }); // 禁止語→不合格
  const res = await runAiPhase(deps, { roomId: "r1", phase: "day" });
  assert.equal(deps._chats.length, 0); // 全部弾かれる
  assert.equal(res.messages, 0);
});

test("dayフェーズの正常発話はchatに author 付きで入る", async () => {
  const deps = makeDeps({ generate: async () => "凛が怪しいと思うのう" });
  await runAiPhase(deps, { roomId: "r1", phase: "day" });
  assert.ok(deps._chats.length >= 1);
  assert.ok(deps._chats[0].authorId);
  assert.ok(deps._chats[0].text.length > 0);
  assert.equal(deps._chats[0].kind, "ai");
});
```

- [ ] **Step 2: 失敗を確認**

Run: `node --test functions/ai/orchestrator.test.mjs`
Expected: FAIL（module not found）

- [ ] **Step 3: 実装**

`functions/ai/orchestrator.mjs`:
```js
import { decideVote, decideNightAction } from "../../game-engine/src/ai-brain.mjs";
import { deriveBrainInput } from "./context.mjs";
import { buildSpeechPrompt } from "./prompt.mjs";
import { validateUtterance } from "./validate.mjs";

const MAX_CHARS = 100;
const ROLE_LABEL = { citizen: "村人", prophet: "村人", werewolf: "村人" }; // 表向きは全員「村人」を公言（MVP1: CO機構なし）

const aliveAiIds = (authoritative, aiPlayers) =>
  Object.values(authoritative.players)
    .filter((p) => p.alive && aiPlayers[p.id])
    .map((p) => p.id)
    .sort();

// 決定論seed: ゲーム内の round と actorId から。Date/Random不使用。
function seedFor(round, aiId) {
  let h = round * 2654435761;
  for (let i = 0; i < aiId.length; i++) h = (h ^ aiId.charCodeAt(i)) * 16777619;
  return h >>> 0;
}

export async function runAiPhase(deps, { roomId, phase }) {
  const authoritative = await deps.readAuthoritative(roomId);
  const aiPlayers = await deps.readAiPlayers(roomId);
  if (!authoritative || !aiPlayers) return { actions: 0, messages: 0 };
  const ids = aliveAiIds(authoritative, aiPlayers);
  const round = authoritative.round ?? 0;
  let actions = 0;
  let messages = 0;

  const nameOf = (id) => authoritative.players[id]?.displayName ?? id;
  const validNamesFor = (selfId) =>
    Object.values(authoritative.players).filter((p) => p.alive && p.id !== selfId).map((p) => nameOf(p.id));

  for (const aiId of ids) {
    const persona = aiPlayers[aiId];
    const seed = seedFor(round, aiId);
    const input = deriveBrainInput(authoritative, aiId, seed, persona.personality);

    if (phase === "night") {
      const act = decideNightAction(input);
      if (act) { await deps.applyCommand(roomId, aiId, "SUBMIT_NIGHT_ACTION", { kind: act.kind, targetId: act.targetId }); actions++; }
      continue;
    }
    if (phase === "vote") {
      const { targetId } = decideVote(input);
      await deps.applyCommand(roomId, aiId, "CAST_VOTE", { targetId });
      actions++;
      continue;
    }
    if (phase === "day") {
      const { targetId } = decideVote(input);
      const ctx = {
        name: persona.name, pronoun: persona.pronoun, toneSamples: persona.toneSamples,
        verbalTic: persona.verbalTic, maxChars: MAX_CHARS,
        claimedRole: ROLE_LABEL[input.roleId] ?? "村人",
        topSuspectNames: targetId ? [nameOf(targetId)] : [],
        reasonTags: input.divineResults.some((r) => r.result === "werewolf") ? ["占い結果が黒"] : ["言動が不自然"],
        voteTargetName: targetId ? nameOf(targetId) : null,
        composureText: persona.personality.aggression > 60 ? "苛立っている" : "落ち着いている",
        structuredLog: `生存: ${input.alivePlayerIds.map(nameOf).join("、")}`,
        recentUtterances: [],
        validNames: validNamesFor(aiId),
      };
      const { system, user } = buildSpeechPrompt(ctx);
      let text = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await deps.generate({ system, user });
        const v = validateUtterance(raw, { maxChars: MAX_CHARS, validNames: ctx.validNames });
        if (v.ok) { text = v.cleaned; break; }
      }
      if (text) {
        await deps.pushChat(roomId, {
          authorId: aiId, authorName: persona.name, text, round, kind: "ai", at: deps.now(),
        });
        messages++;
      }
    }
  }
  return { actions, messages };
}
```

- [ ] **Step 4: 通過を確認**

Run: `node --test functions/ai/orchestrator.test.mjs`
Expected: PASS（4 tests）

- [ ] **Step 5: コミット**

```bash
git add functions/ai/orchestrator.mjs functions/ai/orchestrator.test.mjs
git commit -m "feat(ai): add phase orchestrator (night actions, votes, validated speech)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task C4: Callable `seatAiPlayers` と `advanceAiTurn`＋シークレット

推奨モデル: **Sol**（本番シークレット・権威書込み・エミュレータ検証）

**Files:**
- Modify: `functions/index.js`（先頭 import 追加、末尾に2つの onCall とシークレット定義）
- Modify: `database.rules.json`（`chat`・`aiPlayers` ルール追加）
- Test: `tests/ai_functions_smoke.sh`（エミュレータ・スモーク。既存 `tests/*functions*smoke*` 相当のパターンに倣う）

**Interfaces:**
- Consumes: `pickRoster`(B1), `runAiPhase`(C3), `applyServerCommand`(C1), `generateSpeech`(B4)
- Produces:
  - `export const seatAiPlayers = onCall(...)` — data `{ roomId, count }`。host限定。`count` 体のAIを `rooms/{roomId}/players/{aiId}`・`roomMembers/{roomId}/{aiId}=true`・`rooms/{roomId}/aiPlayers/{aiId}=persona`・joinState更新に書く。返り `{ seated: string[] }`。
  - `export const advanceAiTurn = onCall({ secrets:[ANTHROPIC_API_KEY] }, ...)` — data `{ roomId, phase }`。member限定。`runAiPhase` を実 deps で駆動。返り `{ actions, messages }`。
  - `ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY")`。

- [ ] **Step 1: `functions/index.js` 先頭の import 群に追加**

既存の engine import ブロック（`functions/index.js:19-32`）の直後に:
```js
import { defineSecret } from "firebase-functions/params";
import { pickRoster } from "./ai/roster.mjs";
import { runAiPhase } from "./ai/orchestrator.mjs";
import { generateSpeech } from "./ai/llm.mjs";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
```

- [ ] **Step 2: `functions/index.js` 末尾に `seatAiPlayers` を追加**

```js
/** ホストがソロ卓に count 体のAIを着席させる。役職は startWerewolfGame が既存ロジックで配る。 */
export const seatAiPlayers = onCall(async (req) => {
  const uid = requireUid(req);
  const roomId = String(req.data?.roomId ?? "");
  const count = Math.max(0, Math.min(11, Number(req.data?.count ?? 0)));

  const metaSnap = await db().ref(`rooms/${roomId}/meta`).get();
  const meta = metaSnap.val();
  if (!meta) throw new HttpsError("not-found", "部屋が存在しません。");
  if (meta.hostId !== uid) throw new HttpsError("permission-denied", "ホストのみが実行できます。");
  if (meta.status !== "waiting") throw new HttpsError("failed-precondition", "開始前のみ着席できます。");

  const roster = pickRoster(count);
  const updates = {};
  const seated = [];
  const now = Date.now();
  roster.forEach((persona, i) => {
    const aiId = `ai_${i + 1}`;
    seated.push(aiId);
    updates[`roomMembers/${roomId}/${aiId}`] = true;
    updates[`rooms/${roomId}/players/${aiId}`] = { id: aiId, name: persona.name, role: "ai", connected: true, joinedAt: now, lastSeenAt: now };
    updates[`rooms/${roomId}/aiPlayers/${aiId}`] = {
      name: persona.name, pronoun: persona.pronoun, toneSamples: persona.toneSamples,
      verbalTic: persona.verbalTic, personality: persona.personality,
    };
  });
  await db().ref().update(updates);
  return { seated };
});
```

- [ ] **Step 3: `functions/index.js` 末尾に `advanceAiTurn` を追加**

```js
/** 指定フェーズのAI行動（夜行動 / 投票 / 発話）を一括実行する。member限定。 */
export const advanceAiTurn = onCall({ secrets: [ANTHROPIC_API_KEY] }, async (req) => {
  const uid = requireUid(req);
  const roomId = String(req.data?.roomId ?? "");
  const phase = String(req.data?.phase ?? "");
  const memberSnap = await db().ref(`roomMembers/${roomId}/${uid}`).get();
  if (memberSnap.val() !== true) throw new HttpsError("permission-denied", "この部屋のメンバーではありません。");

  const apiKey = ANTHROPIC_API_KEY.value();
  const deps = {
    readAuthoritative: async (rid) => (await db().ref(`rooms/${rid}/game/authoritative`).get()).val(),
    readAiPlayers: async (rid) => (await db().ref(`rooms/${rid}/aiPlayers`).get()).val() || {},
    applyCommand: (rid, actorId, type, payload) => applyServerCommand(rid, actorId, type, payload),
    pushChat: async (rid, m) => { await db().ref(`rooms/${rid}/game/chat`).push(m); },
    generate: ({ system, user }) => generateSpeech({ system, user, apiKey }),
    now: () => Date.now(),
  };
  return runAiPhase(deps, { roomId, phase });
});
```

- [ ] **Step 4: `database.rules.json` に chat/aiPlayers ルール追加**

`rooms/$roomId/game` ノード内（既存 `privateViews` ルールの兄弟）に追加:
```json
          "chat": {
            ".read": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).val() === true",
            "$msgId": {
              ".write": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).val() === true && (!data.exists() || data.child('authorId').val() === auth.uid) && newData.child('authorId').val() === auth.uid"
            }
          }
```
`rooms/$roomId` 直下に:
```json
        "aiPlayers": {
          ".read": "auth != null && root.child('roomMembers').child($roomId).child(auth.uid).val() === true"
        }
```
（`aiPlayers` は人格のみで秘匿情報を含まない。役職は書かない。）

- [ ] **Step 5: セキュリティルールの検証**

Run: `cd functions && npm run build && firebase deploy --only database --dry-run` もしくは `firebase database:rules:canary`（プロジェクト設定に応じて）。最低限:
Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('rules JSON valid')"`
Expected: `rules JSON valid`

- [ ] **Step 6: エミュレータ・スモーク**（`tests/ai_functions_smoke.sh`）

`tests/ai_functions_smoke.sh`（既存の functions スモークがあれば同じ起動手順を流用）:
```bash
#!/bin/bash
set -eu
cd "$(dirname "$0")/.."
cd functions && npm run build && cd ..
# エミュレータ起動 → createSnapRoom → seatAiPlayers(count=3) →
#   rooms/{roomId}/players 配下に ai_1..ai_3、aiPlayers 配下に3体、roomMembers に true が入ることを確認。
# startWerewolfGame → advanceAiTurn(phase="night") が {actions>=1} を返すことを確認。
echo "See docs: run with firebase emulators:exec — asserts seatAiPlayers writes 3 ai players."
```
実行手順を README コメントとして残し、`firebase emulators:exec "node tests/ai_smoke_assert.mjs"` で assert する（assert スクリプトは Admin SDK で上記ノードを read）。

Run: `bash tests/ai_functions_smoke.sh`
Expected: エミュレータ上で `seated:["ai_1","ai_2","ai_3"]`、`advanceAiTurn` が `actions>=1`。

- [ ] **Step 7: コミット**

```bash
git add functions/index.js database.rules.json tests/ai_functions_smoke.sh
git commit -m "feat(functions): add seatAiPlayers and advanceAiTurn callables + chat rules

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> **実装者への注記**: 本番デプロイ前に `firebase functions:secrets:set ANTHROPIC_API_KEY` で鍵を登録する（鍵はリポジトリ・`design/`・AI向け資料に**絶対に保存しない**）。エミュレータでは `.secret.local` かダミー鍵＋`generate` をスタブ化して検証する。

---

# Part D — クライアント配線（`game-client/firebase-game-client.mjs`）

### Task D1: クライアントに AI/チャット メソッドと購読を追加

推奨モデル: **Terra**

**Files:**
- Modify: `game-client/firebase-game-client.mjs`

**Interfaces:**
- Consumes: 既存 `httpsCallable`/`fns`、`subscribe`、`SUBSCRIPTION_KINDS`/`pathForKind`（`firebase-game-client.mjs:39-55`）
- Produces（返り値 `createGameClient(...)` オブジェクトに追加）:
  - `seatAiPlayers({ count }) -> Promise<{ seated: string[] }>`
  - `advanceAiTurn({ phase }) -> Promise<{ actions, messages }>`
  - `postChat(text) -> Promise<void>`（human発話。RTDB直push、rulesで `authorId===uid` 強制）
  - `onChat(cb) -> unsubscribe`（`rooms/{roomId}/game/chat` 購読）

- [ ] **Step 1: callable 参照を追加**

`firebase-game-client.mjs` の callable 定義群（`const dispatchWerewolfCommandFn = httpsCallable(fns, "dispatchWerewolfCommand");` 付近, line 87）の直後:
```js
const seatAiPlayersFn = httpsCallable(fns, "seatAiPlayers");
const advanceAiTurnFn = httpsCallable(fns, "advanceAiTurn");
```

- [ ] **Step 2: 購読種別に `chat` を追加**

`SUBSCRIPTION_KINDS`（line 39）に `"chat"` を追加し、`pathForKind`（lines 41-55）の switch に追加:
```js
    case "chat":
      return `rooms/${currentRoomId}/game/chat`;
```

- [ ] **Step 3: メソッド実装を追加**（`send` 関数の直後）

```js
async function seatAiPlayers({ count } = {}) {
  await ready;
  if (!currentRoomId) throw new Error("roomId is not set yet");
  const r = await seatAiPlayersFn({ roomId: currentRoomId, count });
  return r.data;
}
async function advanceAiTurn({ phase } = {}) {
  await ready;
  if (!currentRoomId) throw new Error("roomId is not set yet");
  const r = await advanceAiTurnFn({ roomId: currentRoomId, phase });
  return r.data;
}
async function postChat(text) {
  await ready;
  if (!currentRoomId) throw new Error("roomId is not set yet");
  const clean = String(text ?? "").trim().slice(0, 200);
  if (!clean) return;
  await push(ref(db, `rooms/${currentRoomId}/game/chat`), {
    authorId: currentUid, authorName: "あなた", text: clean, kind: "human", at: Date.now(),
  });
}
```
（`push`/`ref` が未 import なら、既存の firebase database import 行に追加。`renameSelf` が既に RTDB 直書きしているため `db`/`update` 等は import 済みのはず。`push` のみ追加が必要か確認する。）

- [ ] **Step 4: 返却オブジェクトに公開**

`return { ready, createRoom, joinRoom, startGame, send, renameSelf, ... }`（lines 195-212）に追記:
```js
    seatAiPlayers,
    advanceAiTurn,
    postChat,
    onChat: (cb) => subscribe("chat", cb),
```

- [ ] **Step 5: 構文チェック**

Run: `node --check game-client/firebase-game-client.mjs`
Expected: エラーなし（構文OK）

- [ ] **Step 6: コミット**

```bash
git add game-client/firebase-game-client.mjs
git commit -m "feat(client): add seatAiPlayers, advanceAiTurn, postChat, onChat

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Part E — フロントエンド（`mobile_app.html`）ソロ導線＋チャットUI

### Task E1: s02 にソロ入口＋新規 `s02b` ソロ設定画面

推奨モデル: **Sol**（新規画面の情報設計・マイクロインタラクション。設計書 §5.2 のUX）

**Files:**
- Modify: `mobile_app.html`（s02 セクション lines 1495-1511、`onScreenEnter` lines 3704-3732、`handleChooseHost` 付近 2582-2600、新規 render 関数）

**Interfaces:**
- Consumes: `showScreen`, `getLiveClient`, `appState`, 既存 `.opt-card`/`.btn` コンポーネント
- Produces:
  - s02 に3つ目の `.opt-card`「ひとりで遊ぶ（AI対戦）」＋ `onclick="handleChooseSolo()"`
  - `handleChooseSolo()`: `appState.view='host'`; `appState.solo=true`; `createRoom({displayName:'あなた', maxPlayers:12})`; `showScreen('s02b')`
  - 新規 `<section id="s02b">`: 「この卓は何人？ [− N +]（3〜12）」ステッパー＋「AIを着席させて始める」ボタン
  - `renderS02b()` / `adjustSoloCount(delta)` / `handleSoloStart()`: `handleSoloStart` は `seatAiPlayers({count: N-1})`（人間1を引く）→ `showScreen('s06')`

- [ ] **Step 1: s02 マークアップに3つ目のカードを追加**

`mobile_app.html` の s02 内 `.opt-cards`（line 1499 付近）の末尾、`</div>` の直前に:
```html
    <button type="button" class="opt-card" onclick="handleChooseSolo()">
      <span class="opt-card-tag"><i></i>ひとり用</span>
      <span class="opt-card-title">ひとりで遊ぶ（AI対戦）</span>
      <span class="opt-card-desc">AIのプレイヤーと今すぐ対戦。ルールの練習にも。</span>
    </button>
```

- [ ] **Step 2: 新規 `s02b` セクションを s02 の直後に追加**

```html
<!-- s02b: ソロ卓設定 -->
<section class="screen" id="s02b">
  <h2 class="screen-title">卓の設定</h2>
  <p class="screen-sub">あなたを含めた参加人数を選びます。残りはAIが着席します。</p>
  <div class="solo-stepper" role="group" aria-label="卓の人数">
    <button type="button" class="stepper-btn" aria-label="人数を減らす" onclick="adjustSoloCount(-1)">−</button>
    <span class="solo-count-num" id="soloCountNum" aria-live="polite">5</span>
    <button type="button" class="stepper-btn" aria-label="人数を増やす" onclick="adjustSoloCount(1)">＋</button>
  </div>
  <p class="center-note" id="soloBreakdown">あなた1人 ＋ AI4人</p>
  <button type="button" class="btn btn--primary" style="margin-top:auto;" onclick="handleSoloStart()">AIを着席させて始める</button>
</section>
```

- [ ] **Step 3: JS ハンドラを追加**（IIFE 内、`handleChooseHost` 付近）

```js
let soloCount = 5;
function handleChooseSolo() {
  appState.view = 'host';
  appState.solo = true;
  showScreen('s02b');
  getLiveClient().then((client) => client.createRoom({ displayName: 'あなた', maxPlayers: 12 }))
    .catch((e) => console.error('createRoom(solo) failed', e));
}
function adjustSoloCount(delta) {
  soloCount = Math.max(3, Math.min(12, soloCount + delta));
  renderS02b();
}
function renderS02b() {
  const num = document.getElementById('soloCountNum');
  const bd = document.getElementById('soloBreakdown');
  if (num) num.textContent = String(soloCount);
  if (bd) bd.textContent = `あなた1人 ＋ AI${soloCount - 1}人`;
}
async function handleSoloStart() {
  const client = await getLiveClient();
  await client.seatAiPlayers({ count: soloCount - 1 });
  showScreen('s06');
}
window.handleChooseSolo = handleChooseSolo;
window.adjustSoloCount = adjustSoloCount;
window.handleSoloStart = handleSoloStart;
```

- [ ] **Step 4: `onScreenEnter` に s02b を登録**

`onScreenEnter(id)`（lines 3704-3732）の if 連鎖に追加:
```js
    if (id === 's02b') renderS02b();
```

- [ ] **Step 5: 手動確認（ブラウザ）**

Run: `python3 -m http.server 8080`（リポジトリ直下）→ ブラウザで `http://localhost:8080/mobile_app.html` を開く。
Expected: s02 に「ひとりで遊ぶ（AI対戦）」カードが出る。押すと s02b が開き、ステッパーで 3〜12 に増減、内訳テキストが「あなた1人 ＋ AIn人」に追従。

- [ ] **Step 6: 既存モバイルUIテストを流し、コミット**

Run: `bash tests/*mobile*app*.sh 2>/dev/null || echo "no mobile test script"`
Expected: 既存があれば緑（無ければスキップ）
```bash
git add mobile_app.html
git commit -m "feat(ui): add solo AI entry (s02) and solo table setup screen (s02b)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task E2: s14 にチャットUI（AI発話表示＋人間入力）

推奨モデル: **Sol**（会話UI・マイクロアニメーション・可読性。プロダクトの核体験）

**Files:**
- Modify: `mobile_app.html`（s14 セクション lines 1667-1682、`renderS14`/`onScreenEnter`、購読配線）
- Modify: `design-system.css`（`.chat-*` コンポーネント。Task F 群と整合）

**Interfaces:**
- Consumes: `client.onChat`, `client.postChat`, 既存 `.council` レイアウト、`--sem-*` トークン
- Produces:
  - s14 内にチャットログ `#chatLog`（縦スクロール・吹き出し）＋入力バー `#chatInput`＋送信ボタン＋定型ボタン「怪しい」「賛成」
  - `renderS14Chat()`: `onChat` 購読を1回だけ張り、メッセージ配列を吹き出しに描画（AI=左・`--sem-accent`縁、human=右）。新着はフェードイン（`prefers-reduced-motion` 尊重）。
  - `handleChatSend()`: `client.postChat(text)`。定型ボタンは対象名を差し込んだ定型文を送る。

- [ ] **Step 1: s14 マークアップにチャット領域を追加**

s14 の `.council` ブロック（`#s14PrevRecord` の親 `.council-prev` の後）と「投票へ進む」ボタンの間に挿入:
```html
  <div class="chat" id="chatPanel">
    <div class="chat-log" id="chatLog" aria-live="polite" aria-label="議論ログ"></div>
    <div class="chat-quick">
      <button type="button" class="chat-chip" onclick="handleChatQuick('suspect')">怪しい</button>
      <button type="button" class="chat-chip" onclick="handleChatQuick('agree')">賛成</button>
    </div>
    <form class="chat-input-bar" id="chatForm" onsubmit="return handleChatSend(event)">
      <input type="text" class="chat-input" id="chatInput" maxlength="120"
             placeholder="発言を入力…" autocomplete="off" aria-label="発言を入力" />
      <button type="submit" class="btn btn--primary chat-send" aria-label="送信">送信</button>
    </form>
  </div>
```

- [ ] **Step 2: `design-system.css` にチャット・コンポーネントを追加**（Component層 末尾付近）

```css
/* チャット（AI議論） */
.chat { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-3); flex: 1; min-height: 0; }
.chat-log { flex: 1; min-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-2); }
.chat-bubble { max-width: 82%; padding: 10px 12px; border-radius: 14px; font-size: 15px; line-height: 1.55;
  background: var(--sem-bg-elevated, var(--p-surface)); color: var(--sem-text, var(--p-text));
  border: 1px solid var(--sem-line, var(--p-line)); animation: chatIn var(--t-micro, 160ms) var(--ease-standard, ease); }
.chat-bubble--ai { align-self: flex-start; border-color: var(--sem-accent, var(--p-moonlight)); }
.chat-bubble--human { align-self: flex-end; background: var(--sem-accent, var(--p-moonlight)); color: var(--p-soot); }
.chat-bubble .chat-author { display: block; font-size: 12px; font-weight: 700; margin-bottom: 2px; color: var(--sem-accent, var(--p-moonlight)); }
.chat-bubble--human .chat-author { color: var(--p-soot); }
.chat-quick { display: flex; gap: var(--sp-2); }
.chat-chip { min-height: var(--tap-min); padding: 8px 16px; border-radius: 20px; font-weight: 700;
  background: transparent; color: var(--sem-text, var(--p-text)); border: 1px solid var(--sem-accent, var(--p-moonlight)); cursor: pointer; }
.chat-input-bar { display: flex; gap: var(--sp-2); }
.chat-input { flex: 1; min-height: var(--tap-min); padding: var(--sp-3); border-radius: var(--r-control, 10px);
  background: var(--sem-bg, var(--p-charcoal)); color: var(--sem-text, var(--p-text)); border: 1px solid var(--sem-line, var(--p-line)); }
.chat-send { min-width: 72px; }
@keyframes chatIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .chat-bubble { animation: none; } }
```

- [ ] **Step 3: JS でチャット描画と送信を配線**（IIFE内）

```js
let chatMessages = [];
let chatUnsub = null;
function renderChatLog() {
  const log = document.getElementById('chatLog');
  if (!log) return;
  log.innerHTML = '';
  for (const m of chatMessages) {
    const b = document.createElement('div');
    b.className = 'chat-bubble ' + (m.kind === 'human' ? 'chat-bubble--human' : 'chat-bubble--ai');
    const who = document.createElement('span'); who.className = 'chat-author'; who.textContent = m.authorName || '';
    const body = document.createElement('span'); body.textContent = m.text || '';
    b.appendChild(who); b.appendChild(body); log.appendChild(b);
  }
  log.scrollTop = log.scrollHeight;
}
function renderS14Chat() {
  if (MODE !== 'live') return;
  getLiveClient().then((client) => {
    if (chatUnsub) return; // 二重購読防止
    chatUnsub = client.onChat((val) => {
      chatMessages = val ? Object.values(val).sort((a, b) => (a.at || 0) - (b.at || 0)) : [];
      renderChatLog();
    });
  });
}
function handleChatSend(ev) {
  ev.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input ? input.value : '';
  if (input) input.value = '';
  getLiveClient().then((client) => client.postChat(text)).catch((e) => console.error(e));
  return false;
}
function handleChatQuick(kind) {
  const suspectName = (latestPublic && latestPublic.players)
    ? (Object.values(latestPublic.players).find((p) => p.alive && p.id !== (window.liveClient && window.liveClient.uid)) || {}).displayName
    : null;
  const text = kind === 'suspect'
    ? `${suspectName || 'あの人'}が怪しいと思う`
    : 'それに賛成';
  getLiveClient().then((client) => client.postChat(text)).catch((e) => console.error(e));
}
window.handleChatSend = handleChatSend;
window.handleChatQuick = handleChatQuick;
```

- [ ] **Step 4: `onScreenEnter` の s14 分岐でチャットも初期化**

既存 `if (id === 's14') { setPhase('day'); renderS14(); }`（line 3720付近）を:
```js
    if (id === 's14') { setPhase('day'); renderS14(); renderS14Chat(); }
```

- [ ] **Step 5: 手動確認（エミュレータ＋ブラウザ）**

エミュレータ起動＋ソロ開始で s14 に到達し、入力→送信で自分の吹き出しが右に出る。`advanceAiTurn(phase="day")` 実行後にAI吹き出しが左にフェードインする（Task E3 で自動化前は devドロワー等から手動発火して確認）。
Expected: 吹き出しが左右に出て可読（コントラストOK）、`prefers-reduced-motion` でアニメ無効。

- [ ] **Step 6: コミット**

```bash
git add mobile_app.html design-system.css
git commit -m "feat(ui): add AI discussion chat UI to s14 (bubbles, quick actions, input)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task E3: `hostDriver` に AIターン自動駆動フックを追加

推奨モデル: **Sol**（進行タイミングと権威resolveの競合回避が肝）

**Files:**
- Modify: `mobile_app.html`（`hostDriver`/`hostDriverTick`/`computeNextHostCommand` lines 2404-2470 付近）

**Interfaces:**
- Consumes: `client.advanceAiTurn`, `latestPublic`（phase/round）, 既存 `hostDriver` オブジェクト
- Produces:
  - フェーズ遷移を検知したら1回だけ `advanceAiTurn({phase})` を呼ぶガード（`aiTurnKey = round + ':' + phase`）。
  - **競合回避**: `night`/`vote` では AIターン完了フラグが立つまで hostDriver の `RESOLVE_NIGHT`/`RESOLVE_VOTE` 送信を保留する。

- [ ] **Step 1: hostDriver にAIターン追跡状態を追加**

`const hostDriver = { lastSentType: null, roleRevealEnteredAt: null, inFlight: false, lastRevisionAtSend: -1 };`（line 2404）を:
```js
const hostDriver = { lastSentType: null, roleRevealEnteredAt: null, inFlight: false, lastRevisionAtSend: -1,
  aiTurnKey: null, aiTurnDone: {} };
```

- [ ] **Step 2: `hostDriverTick` にAI駆動を差し込む**

`hostDriverTick()`（`setInterval(() => hostDriverTick(), 1000)` line 2674 が呼ぶ）の先頭、`latestPublic` 取得後に:
```js
    // AIプレイヤーのフェーズ行動を1回だけ駆動する（solo/AI着席時）
    if (MODE === 'live' && appState.solo && latestPublic && latestPublic.players) {
      const phase = latestPublic.phase;
      const key = (latestPublic.round || 0) + ':' + phase;
      if (['night', 'vote', 'day'].includes(phase) && hostDriver.aiTurnKey !== key) {
        hostDriver.aiTurnKey = key;
        getLiveClient().then((client) => client.advanceAiTurn({ phase }))
          .then(() => { hostDriver.aiTurnDone[key] = true; })
          .catch((e) => { console.error('advanceAiTurn failed', e); hostDriver.aiTurnKey = null; /* 再試行許可 */ });
      }
    }
```

- [ ] **Step 3: night/vote の自動resolveをAIターン完了までガード**

`computeNextHostCommand(pub, opts)`（line 2406付近）内で `RESOLVE_NIGHT` / `RESOLVE_VOTE` を返す条件に、AIターン完了を AND する。該当分岐の直前に:
```js
    // AIの夜行動/投票が完了するまで resolve を保留（AIの行動を取りこぼさない）
    const aiKey = (pub.round || 0) + ':' + pub.phase;
    if (appState.solo && (pub.phase === 'night' || pub.phase === 'vote') && !hostDriver.aiTurnDone[aiKey]) {
      return null; // まだ resolve しない
    }
```
（`computeNextHostCommand` が `null` を返すと何も送らない既存挙動を利用。`return null` の位置は該当switch/if群の中で `RESOLVE_NIGHT`/`RESOLVE_VOTE` を決める直前に置く。）

- [ ] **Step 4: 手動E2E確認（エミュレータ）**

エミュレータでソロ開始→夜: AIの `SUBMIT_NIGHT_ACTION` が入ってから `RESOLVE_NIGHT` される（`rooms/{roomId}/game/authoritative.lastAttack` が設定される）。昼: s14 にAI発話が出る。投票: AI票が入ってから集計される。
Expected: 取りこぼしなく1ゲーム最後（`winner` 設定）まで進む。

- [ ] **Step 5: コミット**

```bash
git add mobile_app.html
git commit -m "feat(ui): drive AI phase turns from hostDriver, gate resolve until AI acts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Part F — アクセシビリティ第一弾（`design-system.css` ＋ CI）

### Task F1: コントラスト検査ツール `contrast_check.mjs`

推奨モデル: **Terra**

**Files:**
- Create: `tests/contrast_check.mjs`
- Modify: `tests/design_system_test.sh`（末尾で呼ぶ）

**Interfaces:**
- Produces: node スクリプト。`design-system.css` を読み、検査対象の (前景トークン, 背景) 対について WCAG コントラスト比を計算。基準未満があれば一覧を出力し `exit 1`。
  - 対象（現状の実測値・調査より）: `.brand-eyebrow`(0.45)=3.92:1 **AA不合格**、`.player-row .idx`(0.35)=2.81:1 **不合格**、`.btn.rules-link`(0.5)=4.59:1、`--sem-text-dim`(0.64)=6.89:1（AAA未達）等。
  - 背景は `--sem-bg`（最暗の `#0B0A10`＝night を代表に採用）。

- [ ] **Step 1: 失敗する検査を書く（現状CSSに対して落ちる）**

`tests/contrast_check.mjs`:
```js
// design-system.css の前景色トークンのコントラストを WCAG で検査する。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "design-system.css"), "utf8");

const BG = "#0B0A10"; // 最暗 phase(night) の --sem-bg を代表背景に
const PAPER = [237, 233, 220]; // EDE9DC

function lum([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function overBg(rgb, a) { const bg = hexRgb(BG); return rgb.map((c, i) => Math.round(c * a + bg[i] * (1 - a))); }
function ratio(fg) { const L1 = lum(fg), L2 = lum(hexRgb(BG)); const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]; return (hi + 0.05) / (lo + 0.05); }

// 検査対象: 「本文相当」は 4.5:1 必須。paper色を各不透明度で合成して判定。
const opacities = [
  { label: ".brand-eyebrow(0.45)", a: 0.45, min: 4.5 },
  { label: ".btn.rules-link(0.5)", a: 0.5, min: 4.5 },
  { label: ".player-row .idx(0.35) [UI 3:1]", a: 0.35, min: 3.0 },
  { label: "--sem-text-dim(0.64)", a: 0.64, min: 4.5 },
  { label: ".vote-num(0.55)", a: 0.55, min: 4.5 },
];
const fails = [];
for (const o of opacities) {
  const r = ratio(overBg(PAPER, o.a));
  if (r < o.min) fails.push(`${o.label}: ${r.toFixed(2)}:1 < ${o.min}:1`);
}
if (fails.length) {
  console.error("CONTRAST FAIL:\n" + fails.join("\n"));
  process.exit(1);
}
console.log("OK: contrast_check passed");
```

- [ ] **Step 2: 現状で落ちることを確認**

Run: `node tests/contrast_check.mjs`
Expected: FAIL（`.brand-eyebrow(0.45): 3.xx:1 < 4.5:1` と `.player-row .idx(0.35): 2.xx:1 < 3.0:1` が出て exit 1）

- [ ] **Step 3: `design-system.css` のコントラストを是正**

以下を引き上げる（値は AA/AAA を満たす最小限へ。「雰囲気の薄さ」は可読性を割らない範囲で維持）:
- `--p-line` / `--sem-line`（0.12）は非テキスト装飾のため据え置き可。ただし本文系は以下を変更:
- `.brand-eyebrow`（`design-system.css:271`）: `rgba(237, 233, 220, 0.45)` → `rgba(237, 233, 220, 0.72)`（≈7.4:1、AAA）
- `.btn.rules-link`（`:278`）: `0.5` → `0.72`
- `.player-row .idx`（`:1022`）: `0.35` → `0.6`（UI 3:1 を超え、本文相当でもAA近傍）
- `.target-option .vote-num`（`:616`）: `0.55` → `0.7`
- `.target-option .vote-mark`（`:632` 境界0.35）: `0.35` → `0.5`（UI境界3:1目標）
- `--sem-text-dim`（`:104,115,126,137,148`）: `0.64` → `0.75`（本文AAA 7:1超え、補助テキスト全般が一括改善）

`contrast_check.mjs` の閾値は既に AA/AAA を表現しているので、CSS 変更後に再実行して緑を確認。

- [ ] **Step 4: 緑を確認**

Run: `node tests/contrast_check.mjs`
Expected: `OK: contrast_check passed`

- [ ] **Step 5: `tests/design_system_test.sh` から呼ぶ**

`tests/design_system_test.sh` の最終行 `exit $FAIL` の直前に追加:
```bash
node tests/contrast_check.mjs || FAIL=1
```

Run: `bash tests/design_system_test.sh`
Expected: `OK: design_system_test passed` かつ contrast も緑

- [ ] **Step 6: コミット**

```bash
git add tests/contrast_check.mjs tests/design_system_test.sh design-system.css
git commit -m "feat(a11y): add WCAG contrast check + raise low-opacity text tokens to AA/AAA

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task F2: フォーカスリング＋タップ領域の是正

推奨モデル: **Terra**

**Files:**
- Modify: `design-system.css`

**Interfaces:**
- Produces: 全キーボード可視要素に `:focus-visible` の可視リング（3:1以上）。`--tap-min`(44px) 未満の `.role-chip`(40px) を是正。

**背景**: 調査で `:focus-visible` リングが**皆無**（`.text-field input:focus` 等で `outline:none` のみ、代替リング無し）。`.role-chip` は 40px でタップ最小44pxを下回る。

- [ ] **Step 1: 共通フォーカスリングを追加**（Component層の適所）

```css
/* フォーカス可視化（WCAG 2.2 SC 2.4.11/2.4.13） */
.btn:focus-visible,
.opt-card:focus-visible,
.gm-row:focus-visible,
.rules-tab-btn:focus-visible,
.role-chip:focus-visible,
.target-option:focus-visible,
.stepper-btn:focus-visible,
.chat-chip:focus-visible,
.chat-input:focus-visible,
.seg-control > button:focus-visible {
  outline: 3px solid var(--sem-accent, var(--p-moonlight));
  outline-offset: 2px;
}
```

- [ ] **Step 2: `.role-chip` のタップ領域を是正**

`.role-chip`（`design-system.css:1363`）の `min-height: 40px;` を `min-height: var(--tap-min);`（44px）に変更。

- [ ] **Step 3: 手動確認（キーボード）**

ブラウザで Tab キー移動時に各ボタン・カード・タブ・チップ・入力にリングが見えること、`.role-chip` の高さが44px以上であることを確認。

- [ ] **Step 4: design_system_test を流してコミット**

Run: `bash tests/design_system_test.sh`
Expected: 緑
```bash
git add design-system.css
git commit -m "feat(a11y): add visible focus rings and fix sub-44px tap target (role-chip)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 統合スモーク（全タスク後の受け入れ確認）

推奨モデル: **Terra**（最終確認）

- [ ] 全ユニットテスト: `node --test game-engine/test/*.test.mjs functions/ai/*.test.mjs` → 全緑
- [ ] `cd functions && npm run build` → esbuild 成功
- [ ] `bash tests/design_system_test.sh` → 緑（contrast含む）
- [ ] エミュレータE2E（`firebase emulators:start`）: s02→ソロ→s02b(5人)→着席→s06→s07(村人3/人狼1/占い師1相当の配役)→開始→夜(AI行動)→昼(s14でAI発話)→投票(AI票)→決着まで到達。役職秘匿が保たれ、AI発話に禁止語・死者言及が無いこと。
- [ ] 本番デプロイ前チェックリスト: `ANTHROPIC_API_KEY` を `firebase functions:secrets:set` で登録済み・リポジトリに鍵が無いこと（`git grep -i "sk-ant"` が空）。

---

## Self-Review（spec 突き合わせ）

- **§3 Step1 ブレイン（logic/aggression・3役職）** → Task A1-A3。✅（二重マトリクス・6軸は MVP2 と明記しスコープ外）
- **§3.6 ハルシネーション物理防御（選択可能リスト＋対象強制）** → ブレインが `alivePlayerIds` からのみ対象選択（A2/A3）＋ `validateUtterance` の `validNames`（B3）。✅（JSON Schema厳格強制は MVP2 で強化余地——MVP1はコード側の対象限定で担保、と明記）
- **§4.2 プロンプト（真role非記載・禁止事項・100字）** → B2。✅
- **§4.3 検証パス（禁止語・長さ・対象）** → B3＋orchestratorの再生成ループ（C3）。台帳整合(2)と秘匿漏洩自動回帰(4)は MVP2。
- **§5.1 席モデル（人間＋AI）／§5.2 ソロ経路／§5.3 開始前自由編集** → seatAiPlayers は status="waiting" 限定で開始前のみ（C4）、solo導線 E1。✅
- **§5.5 テンポ（ラウンド制・定型ボタン）** → 定型ボタン E2。先読み生成は MVP1では未実装（`advanceAiTurn` は同期）と明記。
- **§7 アクセシビリティ第一弾（コントラスト＋CI回帰）** → F1（contrast_check＋CSS是正）＋F2（focus/タップ）。✅
- **§11 既存資産対応（dispatchWerewolfCommand を AI actorId で叩く）** → 調査で uid固定を発見 → `applyServerCommand` 新設（C1）で実現。✅
- **判断A（LLMに意思決定させない）** → 意思決定は全て ai-brain、LLMは言語化のみ（C3の構造）。✅
- **スコープ外の非目標（亡霊・パターンB・音声・自由文ディクテーション）** → 本計画に含めず。✅

**型整合チェック**: `input`（A1）＝`deriveBrainInput` 返り（C2）＝orchestrator 生成（C3）で `selfId/roleId/team/allyIds/divineResults/alivePlayerIds/pendingVotes/personality/seed` が一致。`buildSpeechPrompt` の `ctx` フィールド（B2）と orchestrator の生成（C3）が一致。`generateSpeech({system,user,apiKey,fetchImpl})`（B4）と orchestrator の `generate({system,user})` は deps 層で apiKey を閉じ込め整合。✅

**プレースホルダ走査**: TBD/TODO/「適切に」等なし。既存ファイルの変更は行番号＋挿入位置を明示。✅
