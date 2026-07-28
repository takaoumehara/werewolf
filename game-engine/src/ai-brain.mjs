// AI決定論ブレイン（全役職対応・人格2軸 logic/aggression）。
// Firebase非依存の純関数。意思決定はすべてここ。LLMは言語化のみ（判断A）。
//
// ここに夜行動が無い役職は「AIに配れない役職」になり、ソロ卓から締め出される。
// 役職を足したら NIGHT_ACTION_BY_ROLE と TARGETING に必ず対を追加すること
// （game-engine/test/ai-brain-all-roles.test.mjs が取りこぼしを検出する）。

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 決定論の一様乱数[0,1)。Math.random は使わない（テスト再現性のため）。
function seededUnit(seed) {
  let s = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  s ^= s << 13; s >>>= 0;
  s ^= s >>> 17;
  s ^= s << 5; s >>>= 0;
  return s / 0xffffffff;
}

export function computeTrust(input) {
  const { selfId, team, allyIds, divineResults, alivePlayerIds, pendingVotes, personality } = input;
  const allySet = new Set(allyIds);
  const trust = {};
  for (const id of alivePlayerIds) {
    if (id === selfId) continue;
    trust[id] = 0;
  }
  // 占い結果（占い師の確定情報）
  for (const r of divineResults) {
    if (!(r.targetId in trust)) continue;
    if (r.result === "werewolf") trust[r.targetId] = -100;
    else trust[r.targetId] = clamp(trust[r.targetId] + 40, -100, 100);
  }
  // 狼は仲間を守る（表マトリクスは MVP2。MVP1は単純化して常に守る）
  if (team === "werewolf") {
    for (const id of allyIds) if (id in trust) trust[id] = 100;
  }
  // 疑い返し：自分に投票してきた相手を疑う（aggressionで増幅）
  for (const [voter, target] of Object.entries(pendingVotes)) {
    if (target === selfId && voter in trust && !allySet.has(voter)) {
      trust[voter] = clamp(trust[voter] - (10 + personality.aggression * 0.3), -100, 100);
    }
  }
  return trust;
}

// 投票可能な候補（自分と狼仲間を除く生存者）
function voteCandidates(input) {
  const allySet = new Set(input.allyIds);
  return input.alivePlayerIds.filter((id) => id !== input.selfId && !allySet.has(id));
}

export function decideVote(input) {
  const candidates = voteCandidates(input);
  if (candidates.length === 0) return { targetId: null };
  const trust = computeTrust(input);
  // 最も疑う相手（trust最小）。同値は id 昇順で決定論的に。
  const sorted = [...candidates].sort(
    (a, b) => (trust[a] ?? 0) - (trust[b] ?? 0) || a.localeCompare(b),
  );
  let choice = sorted[0];
  // logicが低いほどノイズで最適から外す（難易度スライダー）
  const noiseChance = (100 - input.personality.logic) / 200; // logic=0→0.5, 100→0
  if (seededUnit(input.seed) < noiseChance) {
    const idx = Math.floor(seededUnit(input.seed + 1) * candidates.length);
    choice = candidates[Math.min(idx, candidates.length - 1)];
  }
  return { targetId: choice };
}

/** 役職 → その役職が夜に出すコマンド種別。エンジンの ROLE_DEFINITIONS.actions と一致させる。 */
export const NIGHT_ACTION_BY_ROLE = Object.freeze({
  werewolf: "attack",
  werewolf_child: "attack",
  lone_wolf: "attack",
  prophet: "divine",
  knights: "protect",
  bodyguard: "protect",
  necromancer: "medium",
  trapper: "trap",
  magician: "swap",
  magician_c: "swap",
  counselor: "calm",
  god: "oracle",
  double: "choose_copy",
  spy: "relay",
  hunter: "death_shot",
});

/**
 * 行動種別ごとの狙いどころ。score が小さいほど優先。
 *
 * - `suspect`  最も疑っている相手（trust 昇順）
 * - `trustful` 最も信頼している相手（trust 降順）
 * - `unknown`  最も情報が無い相手（|trust| 昇順）
 * - `any`      対象がエンジン上で結果に影響しない行動。id 昇順で安定させる
 */
const TARGETING = Object.freeze({
  attack: "suspect",      // 脅威になりそうな相手から消す
  divine: "unknown",      // 白黒がついていない相手を確かめる
  protect: "trustful",    // 人間と確定した相手を守る
  trap: "trustful",       // 人狼が狙いに来そうな相手に罠を張る
  calm: "suspect",        // 動揺していそうな相手を鎮める
  choose_copy: "trustful",// 信頼できる相手の役職を写す
  relay: "suspect",       // 最も怪しい相手を人狼チームへ流す
  death_shot: "suspect",  // 道連れにするなら最も疑っている相手
  swap: "suspect",        // 疑わしい2人を入れ替えて場を攪拌する
  medium: "any",          // 対象は霊media の結果に影響しない（前日の処刑者を見る）
  oracle: "any",          // 対象は神託の結果に影響しない（襲撃先を見る）
});

/** 夜に狙える相手。自分と、相互に正体を知っている仲間は除く。 */
function nightCandidates(input) {
  const allySet = new Set(input.allyIds);
  return input.alivePlayerIds.filter((id) => id !== input.selfId && !allySet.has(id));
}

function scorerFor(strategy, trust) {
  if (strategy === "trustful") return (id) => -(trust[id] ?? 0);
  if (strategy === "unknown") return (id) => Math.abs(trust[id] ?? 0);
  if (strategy === "any") return () => 0;
  return (id) => trust[id] ?? 0; // suspect
}

/**
 * 決定論的に1人選ぶ。logic が低いほどノイズで最適から外す（難易度スライダー）。
 * salt は行動種別ごとに変えて、同じ夜の別判断が同じ乱数を引かないようにする。
 */
function pickTarget(candidates, scorer, input, salt) {
  const sorted = [...candidates].sort((a, b) => scorer(a) - scorer(b) || a.localeCompare(b));
  const noiseChance = (100 - input.personality.logic) / 200;
  if (seededUnit(input.seed + salt) < noiseChance) {
    const idx = Math.floor(seededUnit(input.seed + salt + 1) * candidates.length);
    return candidates[Math.min(idx, candidates.length - 1)];
  }
  return sorted[0];
}

// 行動種別ごとの seed ずらし幅。値そのものに意味は無く、重複しないことだけが要件。
const SALT = { attack: 11, divine: 21, protect: 31, trap: 41, calm: 51, choose_copy: 61, relay: 71, death_shot: 81, swap: 91, medium: 101, oracle: 111 };

export function decideNightAction(input) {
  const kind = NIGHT_ACTION_BY_ROLE[input.roleId];
  if (!kind) return null;

  let candidates = nightCandidates(input);
  // 予言者は一度占った相手を占い直さない。
  if (kind === "divine") {
    const divined = new Set(input.divineResults.map((r) => r.targetId));
    candidates = candidates.filter((id) => !divined.has(id));
  }
  if (candidates.length === 0) return null;

  const trust = computeTrust(input);
  const scorer = scorerFor(TARGETING[kind], trust);
  const salt = SALT[kind] ?? 0;
  const targetId = pickTarget(candidates, scorer, input, salt);

  if (kind !== "swap") return { kind, targetId };

  // 入れ替えは相手が2人要る。1人しか居ない夜は手を出さない。
  const rest = candidates.filter((id) => id !== targetId);
  if (rest.length === 0) return null;
  const secondTargetId = pickTarget(rest, scorer, input, salt + 2);
  return { kind, targetId, secondTargetId };
}
