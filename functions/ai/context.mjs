// authoritative 状態から ai-brain の入力を組み立てる純関数。
// personality はここでは付けない（呼び出し側が roster から合成）。

export function deriveBrainInput(authoritative, aiId, seed, personality = { logic: 50, aggression: 50 }) {
  const players = authoritative.players ?? {};
  const self = players[aiId];
  const alivePlayerIds = Object.values(players).filter((p) => p.alive).map((p) => p.id).sort();
  const allyIds = Object.values(players)
    .filter((p) => p.alive && p.id !== aiId && p.team === "werewolf" && self.team === "werewolf")
    .map((p) => p.id).sort();
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
