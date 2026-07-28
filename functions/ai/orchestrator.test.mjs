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
