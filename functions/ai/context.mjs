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

/**
 * 卓の発言ログから「直前の発言」を組み立てる。純関数。
 *
 * AIの入力に発言ログが渡っていなかったため、人間が何を書いてもAIは反応せず、
 * 毎ラウンド同じ独り言を並べるだけだった（監査の積み残し3件目）。
 *
 * chat は RTDB の push オブジェクト（キー順 = 時系列）か配列。
 * 直近 limit 件だけを渡す — 全部渡すとプロンプトが膨らみ、古い話に引きずられる。
 */
export function deriveChatDigest(chat, { limit = 6, aliveNames = null } = {}) {
  const rows = (Array.isArray(chat) ? chat : Object.values(chat ?? {}))
    .filter((m) => m && typeof m.text === "string" && m.text.trim())
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  // 死亡者・退室者の発言はプロンプトに載せない。名前を出すと「名簿にない人物への
  // 言及」を誘発し、validateUtterance に落ちる発話が増える。
  const visible = aliveNames
    ? rows.filter((m) => aliveNames.includes(m.authorName))
    : rows;
  const recent = visible.slice(-limit);
  const lastHuman = [...visible].reverse().find((m) => m.kind === "human") ?? null;
  return {
    recentUtterances: recent.map((m) => `${m.authorName}: ${m.text}`),
    lastHuman: lastHuman ? { name: lastHuman.authorName, text: lastHuman.text } : null,
    lastHumanAt: lastHuman?.at ?? 0,
  };
}

/**
 * 全員が見ている公式記録（帳面）。誰が死んだかは公開情報なので、
 * AIにだけ隠す理由がない。逆にこれが無いと「昨夜の犠牲者」に触れられない。
 */
export function deriveTableLog(authoritative, nameOf) {
  const players = authoritative.players ?? {};
  const alive = Object.values(players).filter((p) => p.alive).map((p) => nameOf(p.id));
  const lines = [`生存: ${alive.join("、")}`];
  const attack = authoritative.lastAttack;
  if (attack?.targetId) {
    lines.push(attack.protected
      ? `昨夜は誰も欠けなかった`
      : `昨夜の犠牲: ${nameOf(attack.targetId)}`);
  }
  const vote = authoritative.lastVote;
  if (vote?.executedPlayerId) lines.push(`前回の処刑: ${nameOf(vote.executedPlayerId)}`);
  else if (vote?.tied) lines.push(`前回の投票は同数で処刑なし`);
  return lines.join(" / ");
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
