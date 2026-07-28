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

function reportError(deps, context, error) {
  if (typeof deps.logError === "function") deps.logError({ ...context, error });
  else console.error("[runAiPhase]", context, error);
}

export async function runAiPhase(deps, { roomId, phase }) {
  const authoritative = await deps.readAuthoritative(roomId);
  const aiPlayers = await deps.readAiPlayers(roomId);
  if (!authoritative || !aiPlayers) return { actions: 0, messages: 0, errors: 0 };
  const ids = aliveAiIds(authoritative, aiPlayers);
  const round = authoritative.round ?? 0;
  let actions = 0;
  let messages = 0;
  let errors = 0;

  const nameOf = (id) => authoritative.players[id]?.displayName ?? id;
  const validNamesFor = (selfId) =>
    Object.values(authoritative.players).filter((p) => p.alive && p.id !== selfId).map((p) => nameOf(p.id));
  const inputFor = (aiId) =>
    deriveBrainInput(authoritative, aiId, seedFor(round, aiId), aiPlayers[aiId].personality);

  // 夜行動と投票。applyCommand は rooms/{id}/game 全体の transaction なので、
  // 並列化しても衝突して再試行が増えるだけ。直列のまま1体ずつ隔離する。
  // ここで例外を外へ投げると、クライアントの aiTurnDone が永久に立たず
  // RESOLVE_NIGHT / RESOLVE_VOTE が二度と送られなくなる（ゲームの恒久停止）。
  if (phase === "night" || phase === "vote") {
    for (const aiId of ids) {
      try {
        const input = inputFor(aiId);
        if (phase === "night") {
          const act = decideNightAction(input);
          if (!act) continue;
          // secondTargetId は swap（奇術師）だけが使う。エンジンは undefined を
          // 受け付けないので、無い場合は payload に載せない。
          const payload = { kind: act.kind, targetId: act.targetId };
          if (act.secondTargetId) payload.secondTargetId = act.secondTargetId;
          await deps.applyCommand(roomId, aiId, "SUBMIT_NIGHT_ACTION", payload);
        } else {
          const { targetId } = decideVote(input);
          await deps.applyCommand(roomId, aiId, "CAST_VOTE", { targetId });
        }
        actions++;
      } catch (error) {
        errors++;
        reportError(deps, { phase, aiId, step: "applyCommand" }, error);
      }
    }
    return { actions, messages, errors };
  }

  if (phase !== "day") return { actions, messages, errors };

  // 発話は LLM 呼び出しが所要時間の大半を占める。直列だと AI 11体 × 最大2回で
  // 関数のタイムアウトを確実に超えるため、生成だけ並列にする。
  const drafts = await Promise.all(ids.map(async (aiId) => {
    try {
      const persona = aiPlayers[aiId];
      const input = inputFor(aiId);
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
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = await deps.generate({ system, user });
          lastError = null;
          const v = validateUtterance(raw, { maxChars: MAX_CHARS, validNames: ctx.validNames });
          if (v.ok) { text = v.cleaned; break; }
        } catch (error) {
          lastError = error; // 生成そのものの失敗だけ再試行する
        }
      }
      // 検証に落ちただけ（text === ""）は正常系。生成が最後まで失敗した場合だけ error。
      if (lastError) return { aiId, error: lastError };
      return { aiId, persona, text };
    } catch (error) {
      return { aiId, error };
    }
  }));

  // 投稿は id 順に直列で行い、チャットの並びを生成完了順に左右されないようにする。
  for (const draft of drafts) {
    if (draft.error) {
      errors++;
      reportError(deps, { phase, aiId: draft.aiId, step: "generate" }, draft.error);
      continue;
    }
    if (!draft.text) continue;
    try {
      await deps.pushChat(roomId, {
        authorId: draft.aiId, authorName: draft.persona.name, text: draft.text, round, kind: "ai", at: deps.now(),
      });
      messages++;
    } catch (error) {
      errors++;
      reportError(deps, { phase, aiId: draft.aiId, step: "pushChat" }, error);
    }
  }
  return { actions, messages, errors };
}
