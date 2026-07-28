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
import { defineSecret } from "firebase-functions/params";
import { pickRoster } from "./ai/roster.mjs";
import { runAiPhase } from "./ai/orchestrator.mjs";
import { generateSpeech } from "./ai/llm.mjs";
import { AI_TURN_CLAIM_TTL_MS, claimDecision, phaseDurationsFor } from "./ai/turn-policy.mjs";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

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

  // AIが同席する卓は、締切到達だけが解決条件でも待ち時間が支配的にならないよう
  // 短いフェーズ長で開始する(既定は夜90秒/昼180秒/投票60秒)。
  const aiSnap = await db().ref(`rooms/${roomId}/aiPlayers`).get();
  const aiCount = Object.keys(aiSnap.val() || {}).length;

  let state;
  try {
    state = createGame({
      gameId: roomId, players, seed, roleIds, gmMode: "computer", hostId: uid,
      phaseDurations: phaseDurationsFor(aiCount),
    });
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

/**
 * サーバー内部専用: AIプレイヤーの actorId でコマンドを1つ適用する。
 * dispatchWerewolfCommand と同じ権威トランザクションだが、actorId を引数で受け、
 * req.auth / roomMembers ゲートを持たない(Admin SDK からのみ呼ぶ・onCallにしない)。
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

/**
 * ホストが卓に count 体のAIを着席させる。ソロ卓でも人間の混じった卓でも同じ。
 * 呼ぶたびに「AIはちょうど count 体」の状態にする(減らす方向も反映される)。
 * 役職は startWerewolfGame が既存ロジックで配る。
 */
export const seatAiPlayers = onCall(async (req) => {
  const uid = requireUid(req);
  const roomId = String(req.data?.roomId ?? "");
  const requested = Math.max(0, Math.min(MAX_PLAYERS_CAP - 1, Number(req.data?.count ?? 0)));

  const metaSnap = await db().ref(`rooms/${roomId}/meta`).get();
  const meta = metaSnap.val();
  if (!meta) throw new HttpsError("not-found", "部屋が存在しません。");
  if (meta.hostId !== uid) throw new HttpsError("permission-denied", "ホストのみが実行できます。");
  if (meta.status !== "waiting") throw new HttpsError("failed-precondition", "開始前のみ着席できます。");

  const playersSnap = await db().ref(`rooms/${roomId}/players`).get();
  const existing = playersSnap.val() || {};
  const humanIds = Object.values(existing).filter((p) => p.role !== "ai").map((p) => p.id);
  const capacity = Math.max(0, Math.min(meta.maxPlayers ?? MAX_PLAYERS_CAP, MAX_PLAYERS_CAP) - humanIds.length);
  const count = Math.min(requested, capacity);

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
  // 前回より減らした場合に余分なAIが席に残らないよう、範囲外のAIを消す。
  for (const player of Object.values(existing)) {
    if (player.role !== "ai" || seated.includes(player.id)) continue;
    updates[`roomMembers/${roomId}/${player.id}`] = null;
    updates[`rooms/${roomId}/players/${player.id}`] = null;
    updates[`rooms/${roomId}/aiPlayers/${player.id}`] = null;
  }
  await db().ref().update(updates);
  return { seated };
});

/**
 * 指定フェーズのAI行動(夜行動 / 投票 / 発話)を一括実行する。
 *
 * ホスト限定かつ (round, phase) ごとに1回だけ。member 全員に開けておくと
 * 同卓の誰でも何回でも LLM 呼び出しを発生させられる(課金誘発)。
 * timeoutSeconds は明示する — 既定の60秒だと発話生成でタイムアウトしうる。
 */
export const advanceAiTurn = onCall({ secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 180 }, async (req) => {
  const uid = requireUid(req);
  const roomId = String(req.data?.roomId ?? "");
  const phase = String(req.data?.phase ?? "");

  const metaSnap = await db().ref(`rooms/${roomId}/meta`).get();
  const meta = metaSnap.val();
  if (!meta) throw new HttpsError("not-found", "部屋が存在しません。");
  if (meta.hostId !== uid) throw new HttpsError("permission-denied", "進行役のみがAIの行動を進められます。");

  const publicSnap = await db().ref(`rooms/${roomId}/game/public`).get();
  const pub = publicSnap.val();
  if (!pub) throw new HttpsError("failed-precondition", "ゲームが開始されていません。");
  if (pub.phase !== phase) throw new HttpsError("failed-precondition", "フェーズが一致しません。");

  // 同じフェーズの二重実行を止める。クライアントの再試行や、投票解決後に
  // day へ戻る遷移で発話が二度走るのをサーバー側で確実に防ぐ。
  const claimRef = db().ref(`rooms/${roomId}/game/aiTurns/${pub.round ?? 0}_${phase}`);
  let decision = { grant: false, reason: "claimed" };
  const claimTxn = await claimRef.transaction((current) => {
    decision = claimDecision(current, Date.now(), AI_TURN_CLAIM_TTL_MS);
    if (!decision.grant) return; // abort
    return { startedAt: Date.now(), done: false };
  });
  if (!claimTxn.committed) return { actions: 0, messages: 0, errors: 0, skipped: decision.reason };

  const apiKey = ANTHROPIC_API_KEY.value();
  const deps = {
    readAuthoritative: async (rid) => (await db().ref(`rooms/${rid}/game/authoritative`).get()).val(),
    readAiPlayers: async (rid) => (await db().ref(`rooms/${rid}/aiPlayers`).get()).val() || {},
    applyCommand: (rid, actorId, type, payload) => applyServerCommand(rid, actorId, type, payload),
    pushChat: async (rid, m) => { await db().ref(`rooms/${rid}/game/chat`).push(m); },
    generate: ({ system, user }) => generateSpeech({ system, user, apiKey }),
    now: () => Date.now(),
    logError: ({ phase: p, aiId, step, error }) =>
      console.error(`advanceAiTurn: ${aiId} の ${p}/${step} に失敗`, error),
  };
  try {
    const result = await runAiPhase(deps, { roomId, phase });
    await claimRef.update({ done: true, doneAt: Date.now(), ...result });
    return result;
  } catch (error) {
    // フェーズ全体が落ちた場合は claim を解放し、次の呼び出しで再試行できるようにする。
    await claimRef.remove();
    throw error;
  }
});
