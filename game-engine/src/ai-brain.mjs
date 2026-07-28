// AI決定論ブレイン（MVP1: 役職 citizen/prophet/werewolf・人格2軸 logic/aggression）。
// Firebase非依存の純関数。意思決定はすべてここ。LLMは言語化のみ（判断A）。

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

export function decideNightAction(input) {
  const allySet = new Set(input.allyIds);
  if (input.roleId === "werewolf") {
    const targets = input.alivePlayerIds.filter(
      (id) => id !== input.selfId && !allySet.has(id),
    );
    if (targets.length === 0) return null;
    // 脅威度が高い順＝trustが低い（疑っている）順。同値はid昇順。ノイズはlogic連動。
    const trust = computeTrust(input);
    const sorted = [...targets].sort(
      (a, b) => (trust[a] ?? 0) - (trust[b] ?? 0) || a.localeCompare(b),
    );
    let choice = sorted[0];
    const noiseChance = (100 - input.personality.logic) / 200;
    if (seededUnit(input.seed + 11) < noiseChance) {
      const idx = Math.floor(seededUnit(input.seed + 12) * targets.length);
      choice = targets[Math.min(idx, targets.length - 1)];
    }
    return { kind: "attack", targetId: choice };
  }
  if (input.roleId === "prophet") {
    const divined = new Set(input.divineResults.map((r) => r.targetId));
    const targets = input.alivePlayerIds.filter(
      (id) => id !== input.selfId && !divined.has(id),
    );
    if (targets.length === 0) return null;
    // 最も不確実な相手（|trust|が小さい）を占う。同値はid昇順。
    const trust = computeTrust(input);
    const sorted = [...targets].sort(
      (a, b) => Math.abs(trust[a] ?? 0) - Math.abs(trust[b] ?? 0) || a.localeCompare(b),
    );
    let choice = sorted[0];
    const noiseChance = (100 - input.personality.logic) / 200;
    if (seededUnit(input.seed + 21) < noiseChance) {
      const idx = Math.floor(seededUnit(input.seed + 22) * targets.length);
      choice = targets[Math.min(idx, targets.length - 1)];
    }
    return { kind: "divine", targetId: choice };
  }
  return null;
}
