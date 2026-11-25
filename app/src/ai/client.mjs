// AI 호출 통로. 응답과 오류를 { ok, data } 또는 { ok: false, reason }으로 바꾼다. call은 예외를 던지지 않는다.
// reason: no_key | timeout | refusal | error | bad_output
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-5-5";
const MAX_TOKENS = 4000;
const TIMEOUT_MS = 15000;

// 요청 객체를 만드는 순수 함수. try-call 스크립트도 같은 설정을 쓴다.
export function buildRequest({ system, user, schema }) {
  const output_config = { effort: "low" };
  if (schema) output_config.format = { type: "json_schema", schema };
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config,
    system,
    messages: [{ role: "user", content: user }],
  };
}

// 마지막 fallback 블록 뒤의 글만 이어 붙인다. 그 앞의 글은 거절된 모델이 쓰다 만 것이다.
export function collectText(content) {
  const blocks = Array.isArray(content) ? content : [];
  const lastFallback = blocks.map((b) => b?.type).lastIndexOf("fallback");
  return blocks
    .slice(lastFallback + 1)
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
}

function isTimeout(err) {
  return err instanceof Anthropic.APIConnectionTimeoutError || err?.name === "APIConnectionTimeoutError";
}

export function createCall({ apiKey = process.env.ANTHROPIC_API_KEY, create } = {}) {
  let send = create;
  return async function call({ system, user, schema }) {
    if (!apiKey) return { ok: false, reason: "no_key" };
    try {
      if (!send) {
        const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
        send = (req) => client.beta.messages.create(req);
      }
      const response = await send(buildRequest({ system, user, schema }));
      if (response?.stop_reason === "refusal") return { ok: false, reason: "refusal" };
      if (response?.stop_reason === "max_tokens") return { ok: false, reason: "bad_output" };
      const text = collectText(response?.content);
      if (!text) return { ok: false, reason: "bad_output" };
      if (!schema) return { ok: true, data: text };
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch {
        return { ok: false, reason: "bad_output" };
      }
    } catch (err) {
      return { ok: false, reason: isTimeout(err) ? "timeout" : "error" };
    }
  };
}
