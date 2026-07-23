// 発話検証（設計書 §4.3）。純関数。失格なら {ok:false}。長さ超過は cleaned で救済。

const BANNED = [
  /\bLLM\b/i, /\bAI\b/i, /人工知能/, /プロンプト/, /システムプロンプト/,
  /言語モデル/, /トークン/, /（[^）]*黙[^）]*）/, // 地の文っぽい括弧
];

export function validateUtterance(text, ctx) {
  const t = (text ?? "").trim();
  if (t.length === 0) return { ok: false, reason: "empty" };
  // 括弧だけ／地の文だけを弾く（会話でない）
  if (/^[（(].*[）)]$/.test(t) && !/[。！？]/.test(t.replace(/[（）()]/g, ""))) {
    return { ok: false, reason: "narration" };
  }
  for (const re of BANNED) {
    if (re.test(t)) return { ok: false, reason: `banned:${re}` };
  }
  if (t.length > ctx.maxChars) {
    return { ok: true, cleaned: t.slice(0, ctx.maxChars) };
  }
  return { ok: true, cleaned: t };
}
