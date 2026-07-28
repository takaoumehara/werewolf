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

test("奇術師のAIは入れ替える2人目まで含めてコマンドを出す", async () => {
  const auth = {
    round: 1, phase: "night",
    players: {
      p1: { id: "p1", roleId: "citizen", team: "citizen", alive: true, displayName: "あなた" },
      ai1: { id: "ai1", roleId: "magician", team: "citizen", alive: true, displayName: "虎鉄" },
      ai2: { id: "ai2", roleId: "citizen", team: "citizen", alive: true, displayName: "凛" },
    },
    pendingVotes: {}, roleState: { privateResults: {} },
  };
  const deps = makeDeps({ authoritative: auth });
  await runAiPhase(deps, { roomId: "r1", phase: "night" });
  const swap = deps._applied.find((a) => a.payload?.kind === "swap");
  assert.ok(swap, "swap コマンドが出ていない");
  assert.equal(typeof swap.payload.secondTargetId, "string");
  assert.notEqual(swap.payload.secondTargetId, swap.payload.targetId);
});

test("swap 以外の夜行動に secondTargetId は付かない", async () => {
  const auth = {
    round: 1, phase: "night",
    players: {
      p1: { id: "p1", roleId: "citizen", team: "citizen", alive: true, displayName: "あなた" },
      ai1: { id: "ai1", roleId: "knights", team: "citizen", alive: true, displayName: "虎鉄" },
      ai2: { id: "ai2", roleId: "hunter", team: "citizen", alive: true, displayName: "凛" },
    },
    pendingVotes: {}, roleState: { privateResults: {} },
  };
  const deps = makeDeps({ authoritative: auth });
  await runAiPhase(deps, { roomId: "r1", phase: "night" });
  const kinds = deps._applied.map((a) => a.payload.kind).sort();
  assert.deepEqual(kinds, ["death_shot", "protect"]);
  for (const applied of deps._applied) {
    assert.ok(!("secondTargetId" in applied.payload), `${applied.payload.kind} に secondTargetId が付いている`);
  }
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

/* --------------------------------------------------------------------------
   E-1: 1体の失敗が全体を巻き込まないこと。
   ここが reject するとクライアントの aiTurnDone が永久に立たず、
   RESOLVE_NIGHT / RESOLVE_VOTE が二度と送られずゲームが恒久停止する。
   -------------------------------------------------------------------------- */

test("投票: 1体のAIが失敗しても残りは投票でき、全体は reject しない", async () => {
  const applied = [];
  const deps = makeDeps({
    applyCommand: async (_roomId, actorId, type, payload) => {
      if (actorId === "ai1") throw new Error("revision mismatch: expected 7");
      applied.push({ actorId, type, payload });
      return { revision: 1 };
    },
  });
  const res = await runAiPhase(deps, { roomId: "r1", phase: "vote" });
  assert.equal(applied.length, 1);
  assert.equal(applied[0].actorId, "ai2");
  assert.equal(res.actions, 1);
  assert.equal(res.errors, 1);
});

test("夜: 1体のAIが失敗しても残りは行動でき、全体は reject しない", async () => {
  const auth = {
    round: 1, phase: "night",
    players: {
      p1: { id: "p1", roleId: "citizen", team: "citizen", alive: true, displayName: "あなた" },
      ai1: { id: "ai1", roleId: "werewolf", team: "werewolf", alive: true, displayName: "虎鉄" },
      ai2: { id: "ai2", roleId: "prophet", team: "citizen", alive: true, displayName: "凛" },
    },
    pendingVotes: {}, roleState: { privateResults: {} },
  };
  const applied = [];
  const deps = makeDeps({
    authoritative: auth,
    applyCommand: async (_roomId, actorId, type, payload) => {
      if (actorId === "ai1") throw new Error("firebase unavailable");
      applied.push({ actorId, type, payload });
      return { revision: 1 };
    },
  });
  const res = await runAiPhase(deps, { roomId: "r1", phase: "night" });
  assert.deepEqual(applied.map((a) => a.actorId), ["ai2"]);
  assert.equal(res.actions, 1);
  assert.equal(res.errors, 1);
});

test("発話: 1体の生成が失敗しても他のAIの発話は投稿される", async () => {
  const deps = makeDeps({
    generate: async ({ system, user }) => {
      // 虎鉄(ai1)の生成だけ常に失敗させる。一人称「儂」は虎鉄のプロンプトにしか出ない
      // (名前で判定すると、他のAIのプロンプトにも生存者として名前が入るため)。
      if (`${system}${user}`.includes("儂")) throw new Error("anthropic 529 overloaded");
      return "虎鉄が怪しいと思う";
    },
  });
  const res = await runAiPhase(deps, { roomId: "r1", phase: "day" });
  assert.equal(deps._chats.length, 1);
  assert.equal(deps._chats[0].authorId, "ai2");
  assert.equal(res.messages, 1);
  assert.equal(res.errors, 1);
});

test("発話: 1回目の生成が失敗しても2回目で成功すればエラーにはならない", async () => {
  let calls = 0;
  const deps = makeDeps({
    generate: async () => {
      calls++;
      if (calls === 1) throw new Error("anthropic 500");
      return "凛が怪しいと思うのう";
    },
  });
  const res = await runAiPhase(deps, { roomId: "r1", phase: "day" });
  assert.equal(res.errors, 0);
  assert.equal(res.messages, 2);
});

/* --------------------------------------------------------------------------
   E-2: 60秒のタイムアウトに対し、発話生成が直列だとAI11体で確実に溢れる。
   -------------------------------------------------------------------------- */

test("発話生成はAIごとに並列で走る(直列だとタイムアウトする)", async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const deps = makeDeps({
    generate: async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
      return "凛が怪しいと思うのう";
    },
  });
  await runAiPhase(deps, { roomId: "r1", phase: "day" });
  assert.ok(maxInFlight >= 2, `発話生成が直列になっている (最大同時実行数=${maxInFlight})`);
});

test("発話は生成順ではなくAIのid順で安定してchatに入る", async () => {
  const deps = makeDeps({
    generate: async ({ system, user }) => {
      // ai1(虎鉄)の生成を遅らせても、投稿順は ai1 → ai2 のままであること
      if (`${system}${user}`.includes("虎鉄")) await new Promise((r) => setTimeout(r, 30));
      return "誰かが怪しいと思う";
    },
  });
  await runAiPhase(deps, { roomId: "r1", phase: "day" });
  assert.deepEqual(deps._chats.map((c) => c.authorId), ["ai1", "ai2"]);
});
