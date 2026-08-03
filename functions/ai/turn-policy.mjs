// AI卓(ソロ含む)の進行ポリシー。純関数のみ。DB/Firebase には触れない。

/**
 * AIが同席する卓のフェーズ長。
 *
 * 既定値(夜90秒/昼180秒/投票60秒)は対面プレイ向け。AI卓ではAIが即座に行動を
 * 終えるのに解決条件が「締切到達」しかないため、1ラウンドあたり最短5分半の
 * 空白が生まれる(監査 E-3)。人間が読む時間だけを残して短くする。
 */
export const AI_TABLE_PHASE_DURATIONS = { night: 30_000, day: 90_000, vote: 30_000 };

/** AIが1体でも居れば短いフェーズ長を、居なければエンジンの既定値を使う。 */
export function phaseDurationsFor(aiCount) {
  return aiCount > 0 ? { ...AI_TABLE_PHASE_DURATIONS } : {};
}

/** 走り出したAIターンが完了しないまま放置されたとみなすまでの時間。 */
export const AI_TURN_CLAIM_TTL_MS = 120_000;

/**
 * 昼に流せる発話の波の数。1波目は全員の第一声、2波目以降は人間の発言への返し。
 *
 * 1波だけだと、AIは昼の開始と同時に喋り切って終わる — 人間がそのあとに何を書いても
 * 誰も反応しない（監査の積み残し3件目の正体はこれ）。上限を設けるのは、
 * 人間が書くたびに LLM 呼び出しが無制限に増えないようにするため。
 */
export const MAX_DAY_WAVES = 3;

/** 発話の波は昼だけに存在する。夜と投票は常に1回。 */
export function normalizeWave(phase, wave) {
  if (phase !== "day") return 1;
  const n = Number(wave);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_DAY_WAVES);
}

/**
 * 二重実行を止めるための claim のキー。
 * 1波目は従来と同じ `{round}_{phase}` のまま（既存の卓の状態と互換）。
 */
export function claimKey(round, phase, wave = 1) {
  return wave > 1 ? `${round}_${phase}_w${wave}` : `${round}_${phase}`;
}

/**
 * 同じ (round, phase) に対する advanceAiTurn を1回だけ通すための判定。
 *
 * claim は rooms/{roomId}/game/aiTurns/{round}_{phase} の現在値
 * (未実行なら null / undefined)。これが無いと、同卓の誰でも何回でも
 * LLM 呼び出しを発生させられる(監査 E-5)し、投票解決後の day で
 * 二度目の発話が走る(監査 E-4)。
 */
export function claimDecision(claim, now, ttlMs = AI_TURN_CLAIM_TTL_MS) {
  if (!claim) return { grant: true, reason: "first" };
  if (claim.done) return { grant: false, reason: "already-done" };
  if (now - (claim.startedAt ?? 0) < ttlMs) return { grant: false, reason: "in-flight" };
  // 前回が途中で落ちたまま TTL を過ぎている。再試行を許す。
  return { grant: true, reason: "stale" };
}
