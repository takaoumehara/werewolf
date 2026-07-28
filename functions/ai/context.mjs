// authoritative 状態から ai-brain の入力を組み立てる純関数。
// personality はここでは付けない（呼び出し側が roster から合成）。

// 互いに正体を知り合う役職。engine.mjs の toPlayerView と同じ範囲でなければ、
// AIだけが人間より広い情報を持つことになり、卓が不公平になる。
const PACK_ROLES = new Set(["werewolf", "werewolf_child"]);

/** 自分が「仲間だと知っている」相手。内通者・スパイ・一匹狼は誰も知らない。 */
function knownAllyIds(players, roleState, self) {
  const isAlive = (id) => !!players[id]?.alive;
  if (PACK_ROLES.has(self.roleId)) {
    return Object.values(players)
      .filter((p) => p.alive && p.id !== self.id && PACK_ROLES.has(p.roleId))
      .map((p) => p.id).sort();
  }
  if (self.roleId === "twins") {
    const partner = roleState?.twins?.[self.id];
    return partner && isAlive(partner) ? [partner] : [];
  }
  if (self.roleId === "betrayal_twin") {
    const partner = roleState?.betrayalTwins?.[self.id];
    return partner && isAlive(partner) ? [partner] : [];
  }
  return [];
}

export function deriveBrainInput(authoritative, aiId, seed, personality = { logic: 50, aggression: 50 }) {
  const players = authoritative.players ?? {};
  const self = players[aiId];
  const alivePlayerIds = Object.values(players).filter((p) => p.alive).map((p) => p.id).sort();
  const allyIds = knownAllyIds(players, authoritative.roleState, self);
  const divineResults = (authoritative.roleState?.privateResults?.[aiId] ?? [])
    .filter((r) => r.type === "divine")
    .map((r) => ({ targetId: r.targetId, result: r.result }));
  return {
    selfId: aiId,
    roleId: self.roleId,
    team: self.team,
    allyIds,
    divineResults,
    alivePlayerIds,
    pendingVotes: authoritative.pendingVotes ?? {},
    personality,
    seed,
  };
}
