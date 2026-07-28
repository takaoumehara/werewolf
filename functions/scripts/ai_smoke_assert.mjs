// functions/scripts/ai_smoke_assert.mjs
//
// Emulator smoke assertions for Task C4 (seatAiPlayers / advanceAiTurn).
// Invoked via `firebase emulators:exec "node functions/scripts/ai_smoke_assert.mjs"`
// from tests/ai_functions_smoke.sh so it always runs against a fresh emulator instance
// (auth + functions + database). Follows the same signUp/callFn pattern as
// tests/functions_smoke_test.mjs, plus a firebase-admin connection (bypasses security
// rules, per the brief: "assert スクリプトは Admin SDK で上記ノードを read") to read
// roomMembers/aiPlayers/players. Lives under functions/ (not tests/) purely so plain
// `node` can resolve the `firebase-admin` import from functions/node_modules without a
// separate root-level npm install.
//
// Flow:
//   1. sign up a host user
//   2. createSnapRoom -> roomId
//   3. seatAiPlayers({ roomId, count: 3 }) -> expect seated === [ai_1, ai_2, ai_3]
//   4. Admin-SDK read: rooms/{roomId}/players has ai_1..ai_3 (role "ai"),
//      rooms/{roomId}/aiPlayers has 3 personas, roomMembers/{roomId} has ai_1..ai_3 = true
//   5. startWerewolfGame with 4 roleIds (host + 3 AI), 2 werewolves + 1 prophet + 1 citizen
//      so that at least 2 of the 3 AI are guaranteed a mandatory night action regardless
//      of how role assignment shuffles seats
//   6. advanceAiTurn({ roomId, phase: "night" }) -> expect actions >= 1
//
// Exits 0 on success, 1 with a message on any assertion failure.

import { initializeApp as initAdminApp } from "firebase-admin/app";
import { getDatabaseWithUrl } from "firebase-admin/database";

const PROJECT_ID = process.env.SMOKE_PROJECT_ID || "jinro-bb5a5";
const AUTH_SIGNUP_URL =
  process.env.SMOKE_AUTH_URL || "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo";
const FN_BASE = process.env.SMOKE_FN_BASE || `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
const DB_EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
const DB_NS = `${PROJECT_ID}-default-rtdb`;

function log(...args) {
  console.log("[ai-smoke]", ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(fn, attempts = 25, delayMs = 500) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

async function signUp() {
  const res = await fetch(AUTH_SIGNUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { token: data.idToken, uid: data.localId };
}

async function callFn(name, token, data) {
  const res = await fetch(`${FN_BASE}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    throw new Error(`${name} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.result;
}

let commandCounter = 0;
function nextCommandId(uid, type) {
  commandCounter += 1;
  return `${uid}:${type}:${Date.now()}:${commandCounter}`;
}

// Drives the phase machine like the mobile_app.html host driver /
// tests/functions_smoke_test.mjs does: startWerewolfGame only persists phase "lobby";
// an explicit START_GAME then BEGIN_NIGHT is required to reach "night" before
// advanceAiTurn's SUBMIT_NIGHT_ACTION calls are valid.
async function dispatch(roomId, host, type) {
  return retry(() =>
    callFn("dispatchWerewolfCommand", host.token, {
      roomId,
      commandId: nextCommandId(host.uid, type),
      type,
      payload: {},
    }),
  );
}

function assert(cond, message) {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
}

async function main() {
  // Admin SDK connects directly to the RTDB emulator and bypasses database.rules.json,
  // so it can read roomMembers (which has no client-readable rule at all) as well as
  // players/aiPlayers, to independently verify what seatAiPlayers wrote.
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = DB_EMULATOR_HOST;
  const adminApp = initAdminApp({ projectId: PROJECT_ID });
  const adminDb = getDatabaseWithUrl(`http://${DB_EMULATOR_HOST}/?ns=${DB_NS}`, adminApp);

  log("signing up host via auth emulator...");
  const host = await retry(signUp);

  const created = await retry(() => callFn("createSnapRoom", host.token, { displayName: "ホスト" }));
  const roomId = created.roomId;
  log("room created:", roomId, "code:", created.code);

  log("seatAiPlayers(count=3)...");
  const seatResult = await retry(() => callFn("seatAiPlayers", host.token, { roomId, count: 3 }));
  assert(Array.isArray(seatResult.seated), "seatAiPlayers did not return seated[]");
  assert(
    JSON.stringify(seatResult.seated) === JSON.stringify(["ai_1", "ai_2", "ai_3"]),
    `expected seated=[ai_1,ai_2,ai_3], got ${JSON.stringify(seatResult.seated)}`,
  );
  log("seatAiPlayers ok, seated:", seatResult.seated);

  const playersSnap = await adminDb.ref(`rooms/${roomId}/players`).get();
  const players = playersSnap.val() || {};
  for (const aiId of ["ai_1", "ai_2", "ai_3"]) {
    assert(players[aiId], `players/${aiId} missing`);
    assert(players[aiId].role === "ai", `players/${aiId}.role expected "ai", got ${players[aiId].role}`);
  }
  log("admin read: players has ai_1..ai_3");

  const aiPlayersSnap = await adminDb.ref(`rooms/${roomId}/aiPlayers`).get();
  const aiPlayers = aiPlayersSnap.val() || {};
  assert(Object.keys(aiPlayers).length === 3, `expected 3 aiPlayers, got ${Object.keys(aiPlayers).length}`);
  log("admin read: aiPlayers has 3 personas");

  const membersSnap = await adminDb.ref(`roomMembers/${roomId}`).get();
  const members = membersSnap.val() || {};
  for (const aiId of ["ai_1", "ai_2", "ai_3"]) {
    assert(members[aiId] === true, `roomMembers/${roomId}/${aiId} expected true`);
  }
  log("admin read: roomMembers has ai_1..ai_3 = true");

  // 4 players total (host + 3 AI). 2 werewolves + 1 prophet + 1 citizen means only one
  // seat lacks a mandatory night action, so >= 2 of the 3 AI are guaranteed one no
  // matter how role assignment shuffles seats.
  log("startWerewolfGame (4 players: 2 werewolf / 1 prophet / 1 citizen)...");
  const startResult = await retry(() =>
    callFn("startWerewolfGame", host.token, {
      roomId,
      roleIds: ["werewolf", "werewolf", "prophet", "citizen"],
      seed: 42,
    }),
  );
  log("startWerewolfGame ok, revision:", startResult.revision);

  log("driving phase machine: START_GAME -> BEGIN_NIGHT...");
  await dispatch(roomId, host, "START_GAME");
  await dispatch(roomId, host, "BEGIN_NIGHT");

  // advanceAiTurn is claimed per (round, phase), so a retried call would legitimately
  // come back as skipped. Call it exactly once and assert on that single result.
  log("advanceAiTurn(phase=night)...");
  const advanceResult = await callFn("advanceAiTurn", host.token, { roomId, phase: "night" });
  log("advanceAiTurn result:", JSON.stringify(advanceResult));
  assert(typeof advanceResult.actions === "number", "advanceAiTurn did not return actions:number");
  assert(advanceResult.actions >= 1, `expected actions >= 1, got ${advanceResult.actions}`);
  assert(typeof advanceResult.errors === "number", "advanceAiTurn did not return errors:number");
  assert(advanceResult.errors === 0, `expected errors === 0, got ${advanceResult.errors}`);

  // Same (round, phase) must not run twice: that is what stops a shared table's members
  // from re-triggering LLM calls, and what stops the post-vote `day` from speaking twice.
  log("advanceAiTurn(phase=night) again — expecting it to be skipped...");
  const repeatResult = await callFn("advanceAiTurn", host.token, { roomId, phase: "night" });
  log("advanceAiTurn repeat result:", JSON.stringify(repeatResult));
  assert(repeatResult.skipped === "already-done", `expected skipped === "already-done", got ${JSON.stringify(repeatResult)}`);
  assert(repeatResult.actions === 0, `expected no further actions, got ${repeatResult.actions}`);

  // Only the host may drive the AI turn (a non-host member must be rejected).
  log("advanceAiTurn as a non-host member — expecting permission-denied...");
  const intruder = await signUp();
  await adminDb.ref(`roomMembers/${roomId}/${intruder.uid}`).set(true);
  let denied = false;
  try {
    await callFn("advanceAiTurn", intruder.token, { roomId, phase: "night" });
  } catch (err) {
    denied = /permission-denied/.test(String(err.message));
    if (!denied) throw err;
  }
  assert(denied, "a non-host room member was allowed to call advanceAiTurn");

  console.log("OK: ai_smoke_assert — seatAiPlayers + advanceAiTurn(night) verified");
}

main().catch((err) => {
  console.error("FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
