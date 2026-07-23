// Claude Messages API 経由の発話生成。実装前に claude-api スキルで最新仕様を確認済み。
const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001"; // 小型高速モデル（設計書§10）

export async function generateSpeech({ system, user, apiKey, fetchImpl }) {
  const doFetch = fetchImpl ?? fetch;
  const res = await doFetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const detail = typeof res.text === "function" ? await res.text() : "";
    throw new Error(`Anthropic API error ${res.status}: ${detail}`);
  }
  const data = await res.json();
  const block = (data.content ?? []).find((b) => b.type === "text");
  return (block?.text ?? "").trim();
}
