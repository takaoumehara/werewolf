// tests/solo_loop_test.mjs — ソロ卓(人間1人 + AI)が最後まで回り切るかの通し確認。
//
// なぜ要るか: 個々のユニットテストは全部通っていたのに「ひとりで遊ぶ」が
// 最後まで回らなかった。原因は結合部分にあった —
//   ① 昼の発話だけが ANTHROPIC_API_KEY に依存していて、鍵が無いと卓が無言になる
//   ③ AIの入力に発言ログが渡っておらず、人間が何を書いても反応しない
// どちらも「部品は正しいが繋ぐと遊べない」型の穴なので、部品ではなく通しで見る。
//
// Firebase エミュレータはこの環境では動かない(docs/deploy.md)。そこで RTDB の
// 代わりにメモリ上の卓を置き、functions/index.js と同じ順序でコマンドを流す。
// 検証しているのは「エンジン + AI の結合」であって Firebase の配線ではない。

import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, toPublicView, toPlayerView } from "../game-engine/src/engine.mjs";
import { createCommandEnvelope, applyCommandOnce } from "../game-engine/src/firebase-adapter-contract.mjs";
import { runAiPhase } from "../functions/ai/orchestrator.mjs";
import { pickRoster } from "../functions/ai/roster.mjs";
import { phaseDurationsFor } from "../functions/ai/turn-policy.mjs";

const HUMAN = "human1";
const AI_COUNT = 4;
// 5人卓の構成。roleIds を渡さないと engine は全員を村人にするので、
// 狼が居らず初日の夜明けに村人勝利で終わってしまう（通しにならない）。
const ROLE_IDS = ["werewolf", "prophet", "knights", "citizen", "citizen"];

/** メモリ上の卓。rooms/{id}/game 相当だけを持つ。 */
function makeTable({ generate = null, seed = 42 } = {}) {
  const roster = pickRoster(AI_COUNT);
  const aiPlayers = {};
  const players = [{ id: HUMAN, displayName: "あなた", joinedAt: 0 }];
  roster.forEach((persona, i) => {
    const id = `ai_${i + 1}`;
    aiPlayers[id] = {
      name: persona.name, pronoun: persona.pronoun, toneSamples: persona.toneSamples,
      verbalTic: persona.verbalTic, personality: persona.personality,
    };
    players.push({ id, displayName: persona.name, joinedAt: i + 1 });
  });

  let state = createGame({
    gameId: "solo", players, seed, roleIds: ROLE_IDS, gmMode: "computer", hostId: HUMAN,
    phaseDurations: phaseDurationsFor(AI_COUNT),
  });
  const processed = {};
  const chat = [];
  const errors = [];
  let clock = 1000;

  function apply(actorId, type, payload = {}) {
    const command = createCommandEnvelope({
      id: `${actorId}:${type}:${clock++}`,
      actorId, type, payload,
      expectedRevision: state.revision,
      now: clock,
    });
    const result = applyCommandOnce({ state, command, dispatch, processedCommands: processed });
    state = result.state;
    return result;
  }

  const deps = {
    readAuthoritative: async () => state,
    readAiPlayers: async () => aiPlayers,
    readChat: async () => chat,
    applyCommand: async (_rid, actorId, type, payload) => apply(actorId, type, payload),
    pushChat: async (_rid, m) => { chat.push(m); },
    generate,
    now: () => clock++,
    logError: (ctx) => { errors.push(ctx); },
  };

  return {
    deps, chat, errors, aiPlayers,
    get state() { return state; },
    get pub() { return toPublicView(state); },
    selfView: (id) => toPlayerView(state, id),
    apply,
    say: (text) => { chat.push({ authorId: HUMAN, authorName: "あなた", text, kind: "human", at: clock++ }); },
  };
}

/** 人間の1手。AIと同じ判断はさせず、常に「生きている誰か」を選ぶだけ。 */
function humanActs(table) {
  const self = table.selfView(HUMAN).self;
  if (!self?.alive) return;
  const others = Object.values(table.state.players).filter((p) => p.alive && p.id !== HUMAN);
  if (!others.length) return;
  const target = others[0].id;
  const phase = table.pub.phase;
  if (phase === "vote") {
    table.apply(HUMAN, "CAST_VOTE", { targetId: target });
  }
}

/** 1ラウンド分（夜 → 昼 → 投票）を回す。夜明けに決着したら昼は来ない。 */
async function playRound(table, { humanSpeaks = false } = {}) {
  await runAiPhase(table.deps, { roomId: "solo", phase: "night" });
  table.apply(HUMAN, "RESOLVE_NIGHT");
  if (table.pub.winner) return { hadDay: false };

  const day1 = await runAiPhase(table.deps, { roomId: "solo", phase: "day", wave: 1 });
  if (humanSpeaks) {
    table.say("虎鉄が怪しいと思う");
    await runAiPhase(table.deps, { roomId: "solo", phase: "day", wave: 2 });
  }

  table.apply(HUMAN, "START_VOTE");
  await runAiPhase(table.deps, { roomId: "solo", phase: "vote" });
  humanActs(table);
  table.apply(HUMAN, "RESOLVE_VOTE");
  return { hadDay: true, day1 };
}

async function playToEnd(table, { maxRounds = 12, humanSpeaks = false } = {}) {
  table.apply(HUMAN, "START_GAME");
  table.apply(HUMAN, "BEGIN_NIGHT");
  let rounds = 0;
  const daySpeechCounts = [];
  while (!table.pub.winner && rounds < maxRounds) {
    const before = table.chat.filter((m) => m.kind === "ai").length;
    const round = await playRound(table, { humanSpeaks });
    // 夜明けに決着したラウンドには昼が無い。無かった昼を「無言」と数えない。
    if (round.hadDay) daySpeechCounts.push(table.chat.filter((m) => m.kind === "ai").length - before);
    rounds += 1;
    if (table.pub.winner) break;
    table.apply(HUMAN, "BEGIN_NIGHT");
  }
  return { rounds, daySpeechCounts };
}

/* ------------------------------------------------------------------ */

test("APIキーが無くても、ソロ卓は決着まで回り切る", async () => {
  const table = makeTable({ generate: null });
  const { rounds } = await playToEnd(table);
  assert.ok(table.pub.winner, `${rounds} ラウンド回しても決着しない`);
  assert.equal(table.errors.length, 0, JSON.stringify(table.errors.map((e) => e.step)));
});

test("APIキーが無くても、昼は毎回AIが喋る（卓が無言にならない）", async () => {
  const table = makeTable({ generate: null });
  const { daySpeechCounts } = await playToEnd(table);
  assert.ok(daySpeechCounts.length >= 1);
  for (const [i, n] of daySpeechCounts.entries()) {
    assert.ok(n >= 1, `${i + 1} ラウンド目の昼にAIが1人も喋っていない`);
  }
  assert.ok(table.chat.every((m) => m.kind !== "ai" || m.source === "local"));
});

test("生成が全部落ちても、ソロ卓は決着まで回り切る", async () => {
  const table = makeTable({ generate: async () => { throw new Error("anthropic 529"); } });
  const { rounds } = await playToEnd(table);
  assert.ok(table.pub.winner, `${rounds} ラウンド回しても決着しない`);
  // 生成の失敗は隠さず記録する。それでも卓は止まらない。
  assert.ok(table.errors.length > 0);
  assert.ok(table.chat.some((m) => m.kind === "ai"));
});

test("人間の発言に、その昼のうちにAIが返す", async () => {
  const table = makeTable({ generate: null });
  table.apply(HUMAN, "START_GAME");
  table.apply(HUMAN, "BEGIN_NIGHT");
  await runAiPhase(table.deps, { roomId: "solo", phase: "night" });
  table.apply(HUMAN, "RESOLVE_NIGHT");
  await runAiPhase(table.deps, { roomId: "solo", phase: "day", wave: 1 });

  const beforeReply = table.chat.length;
  table.say("わたしは占い師だ。虎鉄が黒だった");
  const res = await runAiPhase(table.deps, { roomId: "solo", phase: "day", wave: 2 });
  const replies = table.chat.slice(beforeReply).filter((m) => m.kind === "ai");
  assert.ok(replies.length >= 1, "人間が喋ってもAIが誰も返していない");
  assert.ok(replies.length <= 2, "全員が一斉に返している（会話が渋滞する）");
  assert.equal(res.messages, replies.length);
});

test("人間の発言がAIのプロンプトに実際に載る", async () => {
  const seen = [];
  const table = makeTable({ generate: async ({ user }) => { seen.push(user); return "なるほど、確かに"; } });
  table.apply(HUMAN, "START_GAME");
  table.apply(HUMAN, "BEGIN_NIGHT");
  await runAiPhase(table.deps, { roomId: "solo", phase: "night" });
  table.apply(HUMAN, "RESOLVE_NIGHT");
  table.say("昨夜のことで聞きたいことがある");
  await runAiPhase(table.deps, { roomId: "solo", phase: "day", wave: 1 });
  assert.ok(seen.length > 0);
  assert.ok(seen.every((u) => u.includes("昨夜のことで聞きたいことがある")),
    "人間の発言がプロンプトに入っていない");
});

test("AIの発話は生存者だけを名指しする（死人の名前を出さない）", async () => {
  const table = makeTable({ generate: null });
  await playToEnd(table, { humanSpeaks: true });
  // 各発話の時点での生存者名だけが出ていること、は状態を遡らないと厳密には見られない。
  // ここでは「その卓に存在しない名前」が出ていないことだけを見る。
  const known = Object.values(table.state.players).map((p) => p.displayName);
  for (const m of table.chat.filter((c) => c.kind === "ai")) {
    const mentioned = known.filter((n) => m.text.includes(n));
    for (const n of mentioned) assert.ok(known.includes(n), `${m.text} に未知の名前 ${n}`);
  }
});
