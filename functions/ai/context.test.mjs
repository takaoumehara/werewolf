import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveBrainInput, deriveChatDigest, deriveTableLog } from "./context.mjs";

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

/* --------------------------------------------------------------------------
   AIが知ってよい情報は、同じ役職の人間プレイヤーが toPlayerView で受け取る
   範囲と一致していなければならない。広いとAIだけが有利になる。
   -------------------------------------------------------------------------- */

const mixedTable = {
  players: {
    p1: { id: "p1", roleId: "twins", team: "citizen", alive: true },
    p2: { id: "p2", roleId: "twins", team: "citizen", alive: true },
    w1: { id: "w1", roleId: "werewolf", team: "werewolf", alive: true },
    w2: { id: "w2", roleId: "werewolf_child", team: "werewolf", alive: true },
    t1: { id: "t1", roleId: "traitor", team: "werewolf", alive: true },
    s1: { id: "s1", roleId: "spy", team: "werewolf", alive: true },
    l1: { id: "l1", roleId: "lone_wolf", team: "werewolf", alive: true },
    b1: { id: "b1", roleId: "betrayal_twin", team: "werewolf", alive: true },
    b2: { id: "b2", roleId: "betrayal_twin", team: "werewolf", alive: true },
  },
  pendingVotes: {},
  roleState: { privateResults: {}, twins: { p1: "p2", p2: "p1" }, betrayalTwins: { b1: "b2", b2: "b1" } },
};

test("人狼と人狼の子どもは互いを仲間として認識する", () => {
  assert.deepEqual(deriveBrainInput(mixedTable, "w1", 1).allyIds, ["w2"]);
  assert.deepEqual(deriveBrainInput(mixedTable, "w2", 1).allyIds, ["w1"]);
});

test("内通者・スパイ・一匹狼は人狼陣営でも仲間を知らない", () => {
  for (const id of ["t1", "s1", "l1"]) {
    assert.deepEqual(deriveBrainInput(mixedTable, id, 1).allyIds, [], `${id} が仲間を知っている`);
  }
});

test("共有者と裏切りの共有者は相方だけを知る", () => {
  assert.deepEqual(deriveBrainInput(mixedTable, "p1", 1).allyIds, ["p2"]);
  assert.deepEqual(deriveBrainInput(mixedTable, "b1", 1).allyIds, ["b2"]);
});

test("死んだ仲間は allyIds に残らない", () => {
  const withDeadWolf = {
    ...mixedTable,
    players: { ...mixedTable.players, w2: { ...mixedTable.players.w2, alive: false } },
  };
  assert.deepEqual(deriveBrainInput(withDeadWolf, "w1", 1).allyIds, []);
});

/* --------------------------------------------------------------------------
   発言ログ（ブロッカー③）。AIの入力に渡っていなかった部分。
   -------------------------------------------------------------------------- */

test("deriveChatDigest は時系列に並べ、直近だけを返す", () => {
  const chat = {
    b: { authorName: "凛", text: "二番目", kind: "ai", at: 20 },
    a: { authorName: "あなた", text: "最初", kind: "human", at: 10 },
    c: { authorName: "虎鉄", text: "三番目", kind: "ai", at: 30 },
  };
  const d = deriveChatDigest(chat, { limit: 2 });
  assert.deepEqual(d.recentUtterances, ["凛: 二番目", "虎鉄: 三番目"]);
});

test("deriveChatDigest は最後の人間の発言を取り出す", () => {
  const chat = {
    a: { authorName: "あなた", text: "古い方", kind: "human", at: 10 },
    b: { authorName: "あなた", text: "新しい方", kind: "human", at: 30 },
    c: { authorName: "凛", text: "AIの発言", kind: "ai", at: 40 },
  };
  assert.deepEqual(deriveChatDigest(chat).lastHuman, { name: "あなた", text: "新しい方" });
});

test("deriveChatDigest は空・未定義でも落ちない", () => {
  for (const input of [null, undefined, {}, []]) {
    const d = deriveChatDigest(input);
    assert.deepEqual(d.recentUtterances, []);
    assert.equal(d.lastHuman, null);
  }
});

test("deriveChatDigest は生存者以外の発言を落とす", () => {
  const chat = {
    a: { authorName: "凛", text: "死人の言葉", kind: "ai", at: 10 },
    b: { authorName: "あなた", text: "生者の言葉", kind: "human", at: 20 },
  };
  const d = deriveChatDigest(chat, { aliveNames: ["あなた", "虎鉄"] });
  assert.deepEqual(d.recentUtterances, ["あなた: 生者の言葉"]);
});

test("deriveTableLog は生存者・昨夜の犠牲・前回の処刑を1行にする", () => {
  const auth = {
    players: {
      p1: { id: "p1", alive: true }, ai1: { id: "ai1", alive: true }, ai2: { id: "ai2", alive: false },
    },
    lastAttack: { targetId: "ai2", protected: false },
    lastVote: { executedPlayerId: "ai3" },
  };
  const line = deriveTableLog(auth, (id) => ({ p1: "あなた", ai1: "虎鉄", ai2: "凛", ai3: "舞" }[id] ?? id));
  assert.ok(line.includes("生存: あなた、虎鉄"));
  assert.ok(line.includes("昨夜の犠牲: 凛"));
  assert.ok(line.includes("前回の処刑: 舞"));
});

test("守られた夜は犠牲者の名前を出さない", () => {
  const auth = {
    players: { p1: { id: "p1", alive: true } },
    lastAttack: { targetId: "p1", protected: true },
  };
  const line = deriveTableLog(auth, (id) => "あなた");
  assert.ok(line.includes("誰も欠けなかった"));
  assert.ok(!line.includes("犠牲:"));
});
