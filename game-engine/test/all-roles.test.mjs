// カードに書かれた能力どおりに全役職が機能することを確認する。
// カード文言は mobile_app.html の rolesData（= card_viewer.html の正本）が出典。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, dispatch, ROLE_IDS } from "../src/engine.mjs";
import { ROLE_DEFINITIONS } from "../src/roles.mjs";

const NOW = 1_000_000;

function makePlayers(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, displayName: `P${i + 1}`, joinedAt: i }));
}

/** 役職を席順どおりに配りたいので、シャッフルを打ち消す seed を総当たりで探す。 */
function gameWithExactRoles(roleIds) {
  const players = makePlayers(roleIds.length);
  for (let seed = 1; seed < 4000; seed += 1) {
    const state = createGame({ gameId: "g", players, seed, roleIds, hostId: "p1" });
    if (players.every((p, i) => state.players[p.id].roleId === roleIds[i])) return state;
  }
  throw new Error(`no seed reproduces the exact seating for ${roleIds.join(",")}`);
}

function send(state, actorId, type, payload = {}, now = NOW) {
  const result = dispatch(state, { id: `c${state.revision}`, actorId, type, payload, expectedRevision: state.revision, now });
  return result.state;
}

/** 対象以外の全員が対象へ投票し、対象自身は別の誰かへ投票する（自分には投票できない）。 */
function voteOut(state, targetId) {
  const alive = Object.values(state.players).filter((p) => p.alive);
  const other = alive.find((p) => p.id !== targetId).id;
  let next = state;
  for (const voter of alive) {
    next = send(next, voter.id, "CAST_VOTE", { targetId: voter.id === targetId ? other : targetId });
  }
  return next;
}

/** lobby から最初の夜まで進める。 */
function toNight(state) {
  return send(send(state, "p1", "START_GAME"), "p1", "BEGIN_NIGHT");
}

test("全ROLE_IDSに定義がある(カタログとエンジンの取りこぼしが無い)", () => {
  for (const id of ROLE_IDS) assert.ok(ROLE_DEFINITIONS[id], `${id} の定義が無い`);
  assert.equal(Object.keys(ROLE_DEFINITIONS).length, ROLE_IDS.length);
});

/* ---- ハンター: 道連れ ------------------------------------------------- */

test("ハンター: 処刑されると、夜に定めた相手を道連れにする", () => {
  let state = toNight(gameWithExactRoles(["hunter", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "death_shot", targetId: "p2" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  state = send(state, "p1", "START_VOTE");
  state = voteOut(state, "p1");
  state = send(state, "p1", "RESOLVE_VOTE");
  assert.equal(state.players.p1.alive, false);
  assert.equal(state.players.p2.alive, false, "道連れの相手が死んでいない");
  assert.equal(state.players.p2.death.cause, "hunter_death_shot");
});

test("ハンター: 襲撃で死んだ場合も、同じ夜に定めた相手を道連れにする", () => {
  let state = toNight(gameWithExactRoles(["hunter", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "death_shot", targetId: "p4" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.alive, false);
  assert.equal(state.players.p4.alive, false, "襲撃死では道連れが発動していない");
});

test("ハンター: 道連れの相手を定めていなければ、自分だけが死ぬ", () => {
  let state = toNight(gameWithExactRoles(["hunter", "citizen", "werewolf", "citizen"]));
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.alive, false);
  assert.equal(state.players.p2.alive, true);
  assert.equal(state.players.p4.alive, true);
});

test("ハンター: 道連れの相手は夜ごとに上書きできる", () => {
  let state = toNight(gameWithExactRoles(["hunter", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "death_shot", targetId: "p2" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  state = send(state, "p1", "BEGIN_NIGHT");
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "death_shot", targetId: "p4" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p2.alive, true, "古い指定が残っている");
  assert.equal(state.players.p4.alive, false);
});

/* ---- 妖狐: 襲撃耐性 --------------------------------------------------- */

test("妖狐: 人狼の襲撃では死なない", () => {
  let state = toNight(gameWithExactRoles(["mysterious_fox", "citizen", "werewolf", "citizen"]));
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.alive, true, "妖狐が襲撃で死んでいる");
});

test("妖狐: 襲撃が通らなかったことは、守られた場合と公開上は区別できない", () => {
  let state = toNight(gameWithExactRoles(["mysterious_fox", "citizen", "werewolf", "citizen"]));
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.deepEqual(state.lastAttack, { targetId: "p1", protected: true });
});

test("妖狐: 予言者に占われると呪殺される(既存仕様の確認)", () => {
  let state = toNight(gameWithExactRoles(["mysterious_fox", "prophet", "werewolf", "citizen"]));
  state = send(state, "p2", "SUBMIT_NIGHT_ACTION", { kind: "divine", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.alive, false);
  assert.equal(state.players.p1.death.cause, "prophet_curse");
});

/* ---- 人狼の子ども: 死後の怒り ----------------------------------------- */

test("人狼の子ども: 死んだ次の夜だけ、人狼の襲撃が2件通る", () => {
  // p1 人狼の子ども / p2,p3 人狼 / p4..p7 市民
  let state = toNight(gameWithExactRoles(["werewolf_child", "werewolf", "werewolf", "citizen", "citizen", "citizen", "citizen"]));
  state = send(state, "p1", "RESOLVE_NIGHT");
  state = send(state, "p1", "START_VOTE");
  state = voteOut(state, "p1");
  state = send(state, "p1", "RESOLVE_VOTE");
  assert.equal(state.players.p1.alive, false, "人狼の子どもが処刑されていない");

  state = send(state, "p1", "BEGIN_NIGHT");
  state = send(state, "p2", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p4" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p5" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p4.alive, false);
  assert.equal(state.players.p5.alive, false, "怒りの夜に2件目の襲撃が通っていない");
});

test("人狼の子ども: 怒りは次の夜かぎりで、その先の夜は襲撃1件に戻る", () => {
  let state = toNight(gameWithExactRoles(["werewolf_child", "werewolf", "werewolf", "citizen", "citizen", "citizen", "citizen", "citizen", "citizen"]));
  state = send(state, "p1", "RESOLVE_NIGHT");
  state = send(state, "p1", "START_VOTE");
  state = voteOut(state, "p1");
  state = send(state, "p1", "RESOLVE_VOTE");
  // 怒りの夜
  state = send(state, "p1", "BEGIN_NIGHT");
  state = send(state, "p2", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p4" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p5" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  // その次の夜
  state = send(state, "p1", "BEGIN_NIGHT");
  state = send(state, "p2", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p6" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p7" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  const deadCount = [state.players.p6, state.players.p7].filter((p) => !p.alive).length;
  assert.equal(deadCount, 1, "怒りが翌夜以降も続いている");
});

/* ---- 既に実装済みの役職が壊れていないことの通し確認 -------------------- */

test("騎士団の守護は襲撃を止める", () => {
  let state = toNight(gameWithExactRoles(["knights", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "protect", targetId: "p2" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p2" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p2.alive, true);
});

test("罠師の罠は襲撃してきた人狼と相打ちになる", () => {
  let state = toNight(gameWithExactRoles(["trapper", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "trap", targetId: "p2" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p2" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p2.alive, false);
  assert.equal(state.players.p3.alive, false, "襲撃した人狼が相打ちになっていない");
});

test("奇術師は2人の役職を入れ替える", () => {
  let state = toNight(gameWithExactRoles(["magician", "citizen", "werewolf", "prophet"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "swap", targetId: "p3", secondTargetId: "p4" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p3.roleId, "prophet");
  assert.equal(state.players.p4.roleId, "werewolf");
});

test("影武者は指定した相手の役職になる", () => {
  let state = toNight(gameWithExactRoles(["double", "prophet", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "choose_copy", targetId: "p2" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.roleId, "prophet");
});

test("タフガイは襲撃された夜は死なず、次の夜の解決で死ぬ", () => {
  let state = toNight(gameWithExactRoles(["tough_guy", "citizen", "werewolf", "citizen"]));
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.alive, true);
  state = send(state, "p1", "BEGIN_NIGHT");
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.alive, false);
  assert.equal(state.players.p1.death.cause, "tough_guy_wounds");
});

test("恋人は片方が死ぬともう片方も死ぬ", () => {
  let state = toNight(gameWithExactRoles(["lovers", "lovers", "werewolf", "citizen"]));
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p1" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p1.alive, false);
  assert.equal(state.players.p2.alive, false);
  assert.equal(state.players.p2.death.cause, "lover_grief");
});

test("スパイの relay は受理されるが盤面を変えない(演出専用)", () => {
  let state = toNight(gameWithExactRoles(["spy", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "relay", targetId: "p2" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  assert.equal(state.players.p2.alive, true);
  assert.equal(state.players.p1.alive, true);
});

test("独裁者は昼に正体を明かして1人を処刑できる(1回だけ)", () => {
  let state = toNight(gameWithExactRoles(["dictator", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "RESOLVE_NIGHT");
  state = send(state, "p1", "REVEAL_DICTATOR", { targetId: "p3" });
  assert.equal(state.players.p3.alive, false);
  assert.throws(() => send(state, "p1", "REVEAL_DICTATOR", { targetId: "p2" }));
});

test("神様は毎夜、襲撃された相手を神託として受け取る", () => {
  let state = toNight(gameWithExactRoles(["god", "citizen", "werewolf", "citizen"]));
  state = send(state, "p1", "SUBMIT_NIGHT_ACTION", { kind: "oracle", targetId: "p2" });
  state = send(state, "p3", "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: "p4" });
  state = send(state, "p1", "RESOLVE_NIGHT");
  const results = state.roleState.privateResults.p1;
  assert.equal(results.at(-1).type, "oracle");
  assert.equal(results.at(-1).targetId, "p4");
});
