// tests/functions_smoke_test.mjs
//
// Full round simulation against the Firebase emulator suite (auth + functions + database).
// Signs up a host + 5 guests, creates/joins a room, starts a 6-player game
// (2 werewolf / 1 prophet / 1 knights / 2 citizen), then drives the game loop the same way
// the mobile_app.html host driver does:
//
//   (lobby) START_GAME
//   (role_reveal) BEGIN_NIGHT
//   (night) alive actors with a night action SUBMIT_NIGHT_ACTION, then host RESOLVE_NIGHT
//   (day) host START_VOTE
//   (vote) alive players CAST_VOTE, then host RESOLVE_VOTE
//   (day, no winner) BEGIN_NIGHT again ... repeat
//
// until pub.winner is set (capped at 8 rounds). Exits 0 and prints the winning team(s) on
// success; exits 1 with a message otherwise. Invoked via `firebase emulators:exec` from
// tests/functions_smoke_test.sh so it always runs against a fresh emulator instance.

// 既定はエミュレータ。env で本番など別ターゲットへ切替可能。
const PROJECT_ID = process.env.SMOKE_PROJECT_ID || "jinro-bb5a5";
const AUTH_SIGNUP_URL = process.env.SMOKE_AUTH_URL || "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo";
const FN_BASE = process.env.SMOKE_FN_BASE || `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
const DB_BASE = process.env.SMOKE_DB_BASE || "http://127.0.0.1:9000";
// エミュレータは ns クエリが要る。本番の default インスタンスは SMOKE_DB_NS="" で無効化。
const DB_NS = process.env.SMOKE_DB_NS !== undefined ? process.env.SMOKE_DB_NS : `ns=${PROJECT_ID}-default-rtdb`;

const NAMES = ["ホスト", "唯", "健太", "沙耶", "アキラ", "美月"];
const ROLE_IDS = ["werewolf", "werewolf", "prophet", "knights", "citizen", "citizen"];
const KILLING_WEREWOLF_ROLES = new Set(["werewolf", "werewolf_child", "lone_wolf"]);
const MAX_ROUNDS = 8;

function log(...args) {
  console.log("[smoke]", ...args);
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

async function dbGet(path, token) {
  const query = DB_NS ? `${DB_NS}&auth=${token}` : `auth=${token}`;
  const res = await fetch(`${DB_BASE}/${path}.json?${query}`);
  if (!res.ok) throw new Error(`dbGet ${path} failed: ${res.status}`);
  return res.json();
}

let commandCounter = 0;
function nextCommandId(uid, type) {
  commandCounter += 1;
  return `${uid}:${type}:${Date.now()}:${commandCounter}`;
}

async function dispatch(roomId, actor, type, payload) {
  return retry(
    () =>
      callFn("dispatchWerewolfCommand", actor.token, {
        roomId,
        commandId: nextCommandId(actor.uid, type),
        type,
        payload: payload || {},
      }),
    10,
    300,
  );
}

function aliveCount(pub) {
  return Object.values(pub.players).filter((p) => p.alive).length;
}

async function main() {
  log("signing up host + 5 guests via auth emulator...");
  const users = [];
  for (let i = 0; i < NAMES.length; i += 1) {
    users.push(await retry(signUp));
  }
  const host = users[0];
  const guests = users.slice(1);
  log(
    "uids:",
    users.map((u, i) => `${NAMES[i]}=${u.uid}`).join(" "),
  );

  const created = await retry(() => callFn("createSnapRoom", host.token, { displayName: NAMES[0] }));
  const roomId = created.roomId;
  log("room created:", roomId, "code:", created.code);

  for (let i = 0; i < guests.length; i += 1) {
    await retry(() => callFn("joinSnapRoom", guests[i].token, { code: created.code, displayName: NAMES[i + 1] }));
  }
  log("all 5 guests joined");

  const startResult = await retry(() =>
    callFn("startWerewolfGame", host.token, { roomId, roleIds: ROLE_IDS, seed: 42 }),
  );
  log("startWerewolfGame ok, revision:", startResult.revision);

  // 各プレイヤーの役職を本人のトークンで privateViews から読む(サーバー権威 —
  // クライアントは自分の役職しか読めないことも同時に確認できる)。
  const roleByUid = {};
  for (const u of users) {
    const self = await retry(() => dbGet(`rooms/${roomId}/game/privateViews/${u.uid}/self`, u.token));
    roleByUid[u.uid] = self.roleId;
  }
  log(
    "roles:",
    users.map((u, i) => `${NAMES[i]}=${roleByUid[u.uid]}`).join(" "),
  );

  async function getPublic() {
    return dbGet(`rooms/${roomId}/game/public`, host.token);
  }

  let pub = await getPublic();
  log("initial phase:", pub.phase, "round:", pub.round);

  // lobby -> role_reveal (startWerewolfGame persists phase "lobby"; roles are already
  // assigned but the phase machine still needs an explicit START_GAME, exactly like the
  // mobile_app.html host driver's first step).
  if (pub.phase === "lobby") {
    await dispatch(roomId, host, "START_GAME", {});
    pub = await getPublic();
    log("after START_GAME, phase:", pub.phase);
  }

  for (let round = 1; round <= MAX_ROUNDS && !pub.winner; round += 1) {
    // role_reveal (round 1) or day (round > 1) -> night
    await dispatch(roomId, host, "BEGIN_NIGHT", {});
    pub = await getPublic();
    log(`round ${round}: phase=${pub.phase} round#=${pub.round} alive=${aliveCount(pub)}`);

    const alivePlayers = users.filter((u) => pub.players[u.uid] && pub.players[u.uid].alive);
    const werewolves = alivePlayers.filter((u) => KILLING_WEREWOLF_ROLES.has(roleByUid[u.uid]));
    const nonWerewolves = alivePlayers.filter((u) => !KILLING_WEREWOLF_ROLES.has(roleByUid[u.uid]));
    const attackTargetUid = nonWerewolves.length > 0 ? [...nonWerewolves].map((u) => u.uid).sort()[0] : null;

    for (const actor of alivePlayers) {
      const roleId = roleByUid[actor.uid];
      if (KILLING_WEREWOLF_ROLES.has(roleId) && attackTargetUid) {
        await dispatch(roomId, actor, "SUBMIT_NIGHT_ACTION", { kind: "attack", targetId: attackTargetUid });
      } else if (roleId === "prophet") {
        const divineTarget = alivePlayers.find((u) => u.uid !== actor.uid);
        if (divineTarget) {
          await dispatch(roomId, actor, "SUBMIT_NIGHT_ACTION", { kind: "divine", targetId: divineTarget.uid });
        }
      }
      // knights/citizen have no mandatory night action for this simulation.
    }

    await dispatch(roomId, host, "RESOLVE_NIGHT", {});
    pub = await getPublic();
    log(`round ${round}: after RESOLVE_NIGHT phase=${pub.phase} alive=${aliveCount(pub)}`);
    if (pub.winner) break;

    await dispatch(roomId, host, "START_VOTE", {});
    pub = await getPublic();

    const votingAlive = users.filter((u) => pub.players[u.uid] && pub.players[u.uid].alive);
    const sortedAliveUids = votingAlive.map((u) => u.uid).sort();
    const primaryTarget = sortedAliveUids[0];
    const fallbackTarget = sortedAliveUids[1] || null;
    for (const voter of votingAlive) {
      const targetId = voter.uid === primaryTarget ? fallbackTarget : primaryTarget;
      if (targetId) {
        await dispatch(roomId, voter, "CAST_VOTE", { targetId });
      }
    }

    await dispatch(roomId, host, "RESOLVE_VOTE", {});
    pub = await getPublic();
    log(`round ${round}: after RESOLVE_VOTE phase=${pub.phase} alive=${aliveCount(pub)}`);
  }

  if (!pub.winner) {
    console.error(`FAIL: no winner reached within ${MAX_ROUNDS} rounds (final phase=${pub.phase})`);
    process.exit(1);
  }

  log("WINNER:", JSON.stringify(pub.winner));
  console.log(`SMOKE_TEST_WINNER=${pub.winner.teams.join(",")}`);

  // 再戦: 終局した部屋で startWerewolfGame を再実行でき、状態がリセットされること。
  log("rematch: startWerewolfGame again on the finished room...");
  const rematch = await retry(() =>
    callFn("startWerewolfGame", host.token, { roomId, roleIds: ROLE_IDS, seed: 7 }),
  );
  const pub2 = await getPublic();
  if (pub2.winner) throw new Error("rematch did not reset winner");
  if (aliveCount(pub2) !== NAMES.length) throw new Error(`rematch did not revive all players (alive=${aliveCount(pub2)})`);
  log("rematch ok, revision:", rematch.revision, "alive:", aliveCount(pub2));

  console.log("OK: functions_smoke_test reached a winner and rematch works");
}

main().catch((err) => {
  console.error("FAIL:", err && err.stack ? err.stack : err);
  process.exit(1);
});
