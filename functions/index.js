/**
 * 人狼ゲーム — サーバー権威 Cloud Functions(第一版 / エミュレータ確認用)
 *
 * 設計: docs/superpowers/specs/2026-07-19-firebase-game-session-design.md
 * ドメインエンジンはサーバーだけで動かし、クライアントには
 *  - public / publicEvents(全員向け・役職なし)
 *  - privateViews/{uid}(本人だけ)
 * だけを書き出す。authoritative(完全状態)はサーバー専用。
 *
 * NOTE: これは最初の実装。冪等性・満室・不正コマンドの境界は
 * docs/superpowers/plans/2026-07-19-firebase-game-session.md の TDD で固める。
 */
import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";

// エンジンは相対パスで参照する。esbuild が deploy 用 bundle へ inline し、
// エミュレータ(node直読み)でも相対解決で動く。cloud の npm install に
// file: 依存を残さないための構成。
import {
  createGame,
  dispatch,
  toPublicView,
  toPlayerView,
} from "../game-engine/src/engine.mjs";
import {
  createCommandEnvelope,
  applyCommandOnce,
  buildPersistencePatch,
} from "../game-engine/src/firebase-adapter-contract.mjs";

initializeApp();

// Blaze のコスト暴走を防ぐ保険。同時インスタンス数と地域を固定する。
// (対面5〜10人・数部屋の規模では 10 で十分。無料枠内に収まる想定)
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

// DB は遅延取得する。モジュール読み込み時に getDatabase() を呼ぶと、DB URL が
// まだ決まらない文脈(functions 単体解析・RTDB未有効化)で読み込み自体が失敗するため。
let _db;
function db() {
  return (_db ??= getDatabase());
}

// 紛らわしい文字(0/O/1/I 等)を除いた合言葉用アルファベット
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const CODE_TTL_MS = 5 * 60 * 1000;
const MAX_PLAYERS_CAP = 12;
const MIN_PLAYERS = 3;

function makeCode(length = CODE_LENGTH) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function requireUid(req) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "サインインが必要です。");
  return uid;
}

/** 疎通確認用。エミュレータ/デプロイの生存確認に使う。 */
export const ping = onCall((req) => ({ ok: true, uid: req.auth?.uid ?? null }));

/** 部屋を作り、合言葉(pairingCode)を発行する。呼び出し元がホストになる。 */
export const createSnapRoom = onCall(async (req) => {
  const uid = requireUid(req);
  const displayName = String(req.data?.displayName ?? "ホスト").slice(0, 24);
  const maxPlayers = Math.min(Math.max(Number(req.data?.maxPlayers ?? 10) || 10, MIN_PLAYERS), MAX_PLAYERS_CAP);
  const roomId = randomUUID();
  const now = Date.now();

  let code = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = makeCode();
    const snap = await db().ref(`pairingCodes/${candidate}`).get();
    if (!snap.exists()) { code = candidate; break; }
  }
  if (!code) throw new HttpsError("resource-exhausted", "合言葉の生成に失敗しました。もう一度お試しください。");

  const updates = {};
  updates[`pairingCodes/${code}`] = { roomId, hostId: uid, createdAt: now, expiresAt: now + CODE_TTL_MS, maxPlayers };
  updates[`roomMembers/${roomId}/${uid}`] = true;
  updates[`rooms/${roomId}/meta`] = {
    hostId: uid, status: "waiting", createdAt: now, updatedAt: now, participantCount: 1, maxPlayers,
  };
  updates[`rooms/${roomId}/players/${uid}`] = {
    id: uid, name: displayName, role: "host", connected: true, joinedAt: now, lastSeenAt: now,
  };
  updates[`rooms/${roomId}/joinState/count`] = 1;
  updates[`rooms/${roomId}/joinState/members/${uid}`] = true;
  await db().ref().update(updates);

  return { roomId, code, expiresAt: now + CODE_TTL_MS };
});

/** 合言葉で部屋に参加する。満室は transaction で原子的に弾く。再参加は冪等。 */
export const joinSnapRoom = onCall(async (req) => {
  const uid = requireUid(req);
  const code = String(req.data?.code ?? "").toUpperCase().trim();
  const displayName = String(req.data?.displayName ?? "プレイヤー").slice(0, 24);

  const codeSnap = await db().ref(`pairingCodes/${code}`).get();
  if (!codeSnap.exists()) throw new HttpsError("not-found", "合言葉が見つかりません。");
  const { roomId, maxPlayers, expiresAt } = codeSnap.val();
  if (Date.now() > expiresAt) throw new HttpsError("deadline-exceeded", "合言葉の有効期限が切れています。");

  const txn = await db().ref(`rooms/${roomId}/joinState`).transaction((current) => {
    const state = current || { count: 0, members: {} };
    if (state.members && state.members[uid]) return state; // 再参加は冪等
    if ((state.count || 0) >= maxPlayers) return; // 満室 → abort
    state.count = (state.count || 0) + 1;
    state.members = state.members || {};
    state.members[uid] = true;
    return state;
  });
  if (!txn.committed) throw new HttpsError("resource-exhausted", "この部屋は満員です。");

  const now = Date.now();
  const existing = await db().ref(`rooms/${roomId}/players/${uid}`).get();
  const updates = {};
  updates[`roomMembers/${roomId}/${uid}`] = true;
  if (!existing.exists()) {
    updates[`rooms/${roomId}/players/${uid}`] = {
      id: uid, name: displayName, role: "participant", connected: true, joinedAt: now, lastSeenAt: now,
    };
    updates[`rooms/${roomId}/meta/participantCount`] = txn.snapshot.child("count").val();
    updates[`rooms/${roomId}/meta/updatedAt`] = now;
  }
  await db().ref().update(updates);

  return { roomId };
});

/** ホストだけがゲームを開始できる。役職を割り当て、公開/秘密ビューを分けて書き出す。 */
export const startWerewolfGame = onCall(async (req) => {
  const uid = requireUid(req);
  const roomId = String(req.data?.roomId ?? "");
  const roleIds = Array.isArray(req.data?.roleIds) ? req.data.roleIds : [];
  const seed = Number.isSafeInteger(req.data?.seed) ? req.data.seed : (Date.now() % 2147483647);

  const metaSnap = await db().ref(`rooms/${roomId}/meta`).get();
  if (!metaSnap.exists()) throw new HttpsError("not-found", "部屋が見つかりません。");
  const meta = metaSnap.val();
  if (meta.hostId !== uid) throw new HttpsError("permission-denied", "ホストのみ開始できます。");
  // waiting(初回)と finished(再戦)は開始可。playing 中の二重開始だけ弾く。
  if (meta.status === "playing") throw new HttpsError("failed-precondition", "すでに進行中です。");

  const playersSnap = await db().ref(`rooms/${roomId}/players`).get();
  const players = Object.values(playersSnap.val() || {})
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    .map((p) => ({ id: p.id, displayName: p.name, joinedAt: p.joinedAt }));
  if (players.length < MIN_PLAYERS) throw new HttpsError("failed-precondition", `${MIN_PLAYERS}人以上必要です。`);

  let state;
  try {
    state = createGame({ gameId: roomId, players, seed, roleIds, gmMode: "computer", hostId: uid });
  } catch (error) {
    throw new HttpsError("invalid-argument", `構成が不正です: ${error.message}`);
  }
  const patch = buildPersistencePatch({ state, events: [], toPublicView, toPlayerView });

  // game ノードを丸ごと set し直す(再戦時に前回の events / 旧 privateViews を残さない)。
  await db().ref(`rooms/${roomId}/game`).set({
    public: patch.public,
    authoritative: patch.authoritative,
    processedCommands: {},
    privateViews: patch.privateViews,
  });
  await db().ref(`rooms/${roomId}/meta`).update({ status: "playing", updatedAt: Date.now() });

  return { ok: true, revision: state.revision };
});

/**
 * プレイヤーのコマンド(投票・夜行動・進行)を1つ適用する。
 * actorId は必ず auth.uid を使い、リクエスト本文からは取らない(なりすまし防止)。
 * transaction 内で冪等適用し、公開/秘密/完全状態を分けて書き戻す。
 */
export const dispatchWerewolfCommand = onCall(async (req) => {
  const uid = requireUid(req);
  const roomId = String(req.data?.roomId ?? "");
  const commandId = String(req.data?.commandId ?? "");
  const type = String(req.data?.type ?? "");
  const payload = (req.data?.payload && typeof req.data.payload === "object") ? req.data.payload : {};

  const memberSnap = await db().ref(`roomMembers/${roomId}/${uid}`).get();
  if (memberSnap.val() !== true) throw new HttpsError("permission-denied", "この部屋のメンバーではありません。");

  let outcome = null;
  let domainError = null;
  const gameRef = db().ref(`rooms/${roomId}/game`);
  const txn = await gameRef.transaction((game) => {
    if (!game || !game.authoritative) return game; // まだゲーム未開始
    try {
      const command = createCommandEnvelope({
        id: commandId,
        actorId: uid, // ← サーバー信頼。クライアント本文の actorId は使わない
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

      outcome = {
        revision: patch.authoritative.revision,
        phase: patch.public.phase,
        finished: !!patch.public.winner,
      };
      return game;
    } catch (error) {
      domainError = error; // 不正コマンド等 → abort して下で 400 に変換
      return; // abort transaction
    }
  });

  if (domainError) throw new HttpsError("failed-precondition", domainError.message);
  if (!txn.committed) throw new HttpsError("aborted", "コマンドを適用できませんでした。");

  // 終局したら meta.status を finished にする(再戦=startWerewolfGame の再実行を許可するため)。
  if (outcome?.finished) {
    await db().ref(`rooms/${roomId}/meta`).update({ status: "finished", updatedAt: Date.now() });
  }
  return outcome ?? { ok: true };
});
