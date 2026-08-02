import { decideVote, decideNightAction } from "../../game-engine/src/ai-brain.mjs";
import { deriveBrainInput, deriveChatDigest, deriveTableLog } from "./context.mjs";
import { buildSpeechPrompt } from "./prompt.mjs";
import { validateUtterance } from "./validate.mjs";
import { localUtterance } from "./fallback.mjs";

const MAX_CHARS = 100;
const ROLE_LABEL = { citizen: "村人", prophet: "村人", werewolf: "村人" }; // 表向きは全員「村人」を公言（MVP1: CO機構なし）

// 第二波（人間の発言への返し）で口を開くAIの上限。全員に返させると
// 会話が渋滞し、LLM 呼び出しも人数分増える。
const REPLY_WAVE_MAX_SPEAKERS = 2;

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

/**
 * 第二波で返事をするAIを選ぶ。純関数。
 * 名指しされたAIを最優先する — 呼ばれたのに黙っているのが一番不自然なため。
 */
export function pickRepliers(ids, nameOf, humanText, limit = REPLY_WAVE_MAX_SPEAKERS) {
  const text = humanText ?? "";
  const named = ids.filter((id) => text.includes(nameOf(id)));
  const rest = ids.filter((id) => !named.includes(id));
  return [...named, ...rest].slice(0, limit).sort();
}

export async function runAiPhase(deps, { roomId, phase, wave = 1 }) {
  const authoritative = await deps.readAuthoritative(roomId);
  const aiPlayers = await deps.readAiPlayers(roomId);
  if (!authoritative || !aiPlayers) return { actions: 0, messages: 0, errors: 0, fallbacks: 0, speechMode: "none" };
  const ids = aliveAiIds(authoritative, aiPlayers);
  const round = authoritative.round ?? 0;
  let actions = 0;
  let messages = 0;
  let errors = 0;
  let fallbacks = 0;

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
    return { actions, messages, errors, fallbacks, speechMode: "none" };
  }

  if (phase !== "day") return { actions, messages, errors, fallbacks, speechMode: "none" };

  // 卓の発言ログ。これを渡していなかったので、AIは人間が何を書いても反応せず、
  // 毎ラウンド同じ独り言を並べていた。
  const aliveNames = Object.values(authoritative.players).filter((p) => p.alive).map((p) => nameOf(p.id));
  const chat = typeof deps.readChat === "function" ? await deps.readChat(roomId) : null;
  const digest = deriveChatDigest(chat, { limit: 6, aliveNames });
  const tableLog = deriveTableLog(authoritative, nameOf);

  // 第一波は全員の第一声。第二波は人間の発言への返しなので、返す相手が居なければ
  // 何もしない（空振りで LLM を焼かない）。
  const isReplyWave = wave >= 2;
  if (isReplyWave && !digest.lastHuman) {
    return { actions, messages, errors, fallbacks, speechMode: "none", skipped: "no-human-utterance" };
  }
  const speakers = isReplyWave ? pickRepliers(ids, nameOf, digest.lastHuman?.text) : ids;

  const canGenerate = typeof deps.generate === "function";

  // 発話は LLM 呼び出しが所要時間の大半を占める。直列だと AI 11体 × 最大2回で
  // 関数のタイムアウトを確実に超えるため、生成だけ並列にする。
  const drafts = await Promise.all(speakers.map(async (aiId) => {
    const persona = aiPlayers[aiId];
    try {
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
        structuredLog: tableLog,
        recentUtterances: digest.recentUtterances,
        validNames: validNamesFor(aiId),
        personality: persona.personality,
        replyTo: isReplyWave ? digest.lastHuman : null,
      };

      // 鍵が無い（generate 未提供）ときは最初からローカル生成に落とす。
      // 「鍵が無い」は失敗ではなく設定状態なので、errors には数えない。
      if (!canGenerate) {
        return { aiId, persona, text: localUtterance(ctx, seedFor(round, aiId) + wave), source: "local" };
      }

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
      if (text) return { aiId, persona, text, source: "llm" };
      // 生成が落ちた場合も、検証を2回とも通らなかった場合も、卓を無言にはしない。
      // ローカル発話へ落として必ず一言残す（source が local なので後から追える）。
      return {
        aiId, persona, source: "local", error: lastError,
        text: localUtterance(ctx, seedFor(round, aiId) + wave),
      };
    } catch (error) {
      return { aiId, persona, error, fatal: true };
    }
  }));

  // 投稿は id 順に直列で行い、チャットの並びを生成完了順に左右されないようにする。
  for (const draft of drafts) {
    if (draft.error) {
      errors++;
      reportError(deps, { phase, aiId: draft.aiId, step: "generate" }, draft.error);
    }
    if (!draft.text) continue;
    if (draft.source === "local") fallbacks++;
    try {
      await deps.pushChat(roomId, {
        authorId: draft.aiId, authorName: draft.persona.name, text: draft.text,
        round, kind: "ai", source: draft.source, at: deps.now(),
      });
      messages++;
    } catch (error) {
      errors++;
      reportError(deps, { phase, aiId: draft.aiId, step: "pushChat" }, error);
    }
  }

  // 画面に「いま何で喋っているか」を出すための一語。
  //   llm      = APIキーがあり、実際に生成できた
  //   degraded = キーはあるが全部落ちてローカルへ退避した
  //   local    = キーが未設定（設定すれば直る）
  let speechMode = "none";
  if (messages > 0) {
    if (!canGenerate) speechMode = "local";
    else speechMode = fallbacks >= messages ? "degraded" : "llm";
  }
  return { actions, messages, errors, fallbacks, speechMode };
}
