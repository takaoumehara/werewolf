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
