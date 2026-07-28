// AIキャラのロスター。人格値はブレイン(ai-brain)へ、口調はプロンプト(prompt)へ渡す。
// MVP1は人格2軸(logic/aggression)のみ使用。

export const AI_ROSTER = Object.freeze([
  {
    key: "kotetsu", name: "虎鉄", pronoun: "儂",
    toneSamples: ["ふむ、妙じゃな。", "儂はそうは思わんぞ。"],
    verbalTic: "…のう", personality: { logic: 80, aggression: 30 },
  },
  {
    key: "sana", name: "紗奈", pronoun: "あたし",
    toneSamples: ["ねえ、それ怪しくない？", "あたしは詰めたい派。"],
    verbalTic: "…だよね", personality: { logic: 55, aggression: 85 },
  },
  {
    key: "rin", name: "凛", pronoun: "私",
    toneSamples: ["落ち着いて考えましょう。", "根拠は？"],
    verbalTic: "", personality: { logic: 90, aggression: 40 },
  },
  {
    key: "gon", name: "ゴン", pronoun: "オレ",
    toneSamples: ["よくわからんが、いくぜ！", "とりあえず吊ろう！"],
    verbalTic: "！", personality: { logic: 25, aggression: 70 },
  },
  {
    key: "mai", name: "舞", pronoun: "わたし",
    toneSamples: ["みんなはどう思う？", "合わせるのが安全かな。"],
    verbalTic: "…かも", personality: { logic: 45, aggression: 20 },
  },
]);

export function pickRoster(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = AI_ROSTER[i % AI_ROSTER.length];
    const cycle = Math.floor(i / AI_ROSTER.length);
    const suffix = cycle === 0 ? "" : `${["", "②", "③", "④"][cycle] ?? `#${cycle + 1}`}`;
    out.push({ ...base, key: `${base.key}_${i}`, name: `${base.name}${suffix}` });
  }
  return out;
}
