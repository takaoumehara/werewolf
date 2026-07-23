import { decideVote, decideNightAction } from "../../game-engine/src/ai-brain.mjs";
import { deriveBrainInput } from "./context.mjs";
import { buildSpeechPrompt } from "./prompt.mjs";
import { validateUtterance } from "./validate.mjs";

const MAX_CHARS = 100;
const ROLE_LABEL = { citizen: "村人", prophet: "村人", werewolf: "村人" }; // 表向きは全員「村人」を公言（MVP1: CO機構なし）

const aliveAiIds = (authoritative, aiPlayers) =>
  Object.values(authoritative.players)
    .filter((p) => p.alive && aiPlayers[p.id])
    .map((p) => p.id)
    .sort();

// 決定論seed: ゲーム内の round と actorId から。Date/Random不使用。
function seedFor(round, aiId) {
  let h = round * 2654435761;
  for (let i = 0; i < aiId.length; i++) h = (h ^ aiId.charCodeAt(i)) * 16777619;
  return h >>> 0;
}

export async function runAiPhase(deps, { roomId, phase }) {
  const authoritative = await deps.readAuthoritative(roomId);
  const aiPlayers = await deps.readAiPlayers(roomId);
  if (!authoritative || !aiPlayers) return { actions: 0, messages: 0 };
  const ids = aliveAiIds(authoritative, aiPlayers);
  const round = authoritative.round ?? 0;
  let actions = 0;
  let messages = 0;

  const nameOf = (id) => authoritative.players[id]?.displayName ?? id;
  const validNamesFor = (selfId) =>
    Object.values(authoritative.players).filter((p) => p.alive && p.id !== selfId).map((p) => nameOf(p.id));

  for (const aiId of ids) {
    const persona = aiPlayers[aiId];
    const seed = seedFor(round, aiId);
    const input = deriveBrainInput(authoritative, aiId, seed, persona.personality);

    if (phase === "night") {
      const act = decideNightAction(input);
      if (act) { await deps.applyCommand(roomId, aiId, "SUBMIT_NIGHT_ACTION", { kind: act.kind, targetId: act.targetId }); actions++; }
      continue;
    }
    if (phase === "vote") {
      const { targetId } = decideVote(input);
      await deps.applyCommand(roomId, aiId, "CAST_VOTE", { targetId });
      actions++;
      continue;
    }
    if (phase === "day") {
      const { targetId } = decideVote(input);
      const ctx = {
        name: persona.name, pronoun: persona.pronoun, toneSamples: persona.toneSamples,
        verbalTic: persona.verbalTic, maxChars: MAX_CHARS,
        claimedRole: ROLE_LABEL[input.roleId] ?? "村人",
        topSuspectNames: targetId ? [nameOf(targetId)] : [],
        reasonTags: input.divineResults.some((r) => r.result === "werewolf") ? ["占い結果が黒"] : ["言動が不自然"],
        voteTargetName: targetId ? nameOf(targetId) : null,
        composureText: persona.personality.aggression > 60 ? "苛立っている" : "落ち着いている",
        structuredLog: `生存: ${input.alivePlayerIds.map(nameOf).join("、")}`,
        recentUtterances: [],
        validNames: validNamesFor(aiId),
      };
      const { system, user } = buildSpeechPrompt(ctx);
      let text = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        const raw = await deps.generate({ system, user });
        const v = validateUtterance(raw, { maxChars: MAX_CHARS, validNames: ctx.validNames });
        if (v.ok) { text = v.cleaned; break; }
      }
      if (text) {
        await deps.pushChat(roomId, {
          authorId: aiId, authorName: persona.name, text, round, kind: "ai", at: deps.now(),
        });
        messages++;
      }
    }
  }
  return { actions, messages };
}
