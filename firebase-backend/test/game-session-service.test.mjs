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
