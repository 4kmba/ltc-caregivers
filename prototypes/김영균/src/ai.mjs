// Claude를 부르는 세 가지 일: 보충 질문 만들기, 카드 고르고 설명 붙이기, 질문에 답하기.
// 어느 함수든 실패하면 null을 돌려주고, 대신할 동작은 server.mjs가 정한다.
import Anthropic from "@anthropic-ai/sdk";
import { BUCKETS } from "./rules.mjs";

export const MODEL = "claude-sonnet-5-5";
const TIMEOUT_MS = 15_000;

let client = null;
export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
function getClient() {
  if (!client) client = new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 0 });
  return client;
}

const COMMON_RULES = `당신은 장기요양 가족 보호자를 돕는 서비스의 일부입니다.
- 한국어 존댓말로, 짧고 쉬운 문장으로 씁니다.
- 진단, 처방, 특정 기관 추천은 하지 않습니다.
- 이름, 연락처, 주소, 주민번호는 묻지 않습니다.`;

async function call({ system, user, schema, maxTokens = 1500 }) {
  if (!aiEnabled()) return null;
  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // 15초 안에 답해야 해서 생각 단계를 끄고 노력 수준을 낮춘다.
      thinking: { type: "between_tools" },
      output_config: schema
        ? { effort: "low", format: { type: "json_schema", schema } }
        : { effort: "low" },
      // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도한다.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: user }]
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      console.warn(`[ai] 응답을 쓰지 않음: stop_reason=${response.stop_reason}`);
      return null;
    }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!schema) return text || null;
    return JSON.parse(text);
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      console.warn("[ai] 15초 안에 응답이 없음");
    } else if (err instanceof Anthropic.APIError) {
      console.warn(`[ai] API 오류 ${err.status ?? ""}: ${err.message}`);
    } else if (err instanceof SyntaxError) {
      console.warn("[ai] JSON 형식이 깨진 응답");
    } else {
      console.warn(`[ai] 알 수 없는 오류: ${err.message}`);
    }
    return null;
  }
}

// 고정 질문의 답을 사람이 읽을 문장으로 바꾼다. AI에게도 이 문장을 보낸다.
export function describeAnswers(answers, questions) {
  const lines = [];
  for (const q of questions) {
    for (const field of q.fields) {
      const value = answers[field.key];
      if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
      const values = Array.isArray(value) ? value : [value];
      const labels = values.map((v) => field.options.find((o) => o.value === v)?.label ?? v);
      lines.push(`- ${field.label ?? q.title}: ${labels.join(", ")}`);
    }
  }
  for (const f of answers.followups ?? []) {
    if (f.answer) lines.push(`- (보충) ${f.question}: ${f.answer}`);
  }
  return lines.join("\n");
}

const FOLLOWUP_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          options: { type: "array", items: { type: "string" } }
        },
        required: ["text", "options"],
        additionalProperties: false
      }
    }
  },
  required: ["questions"],
  additionalProperties: false
};

export async function makeFollowups(summary) {
  const result = await call({
    system: `${COMMON_RULES}
보호자가 고정 질문 8개에 답했습니다. 지금 할 일을 고르는 데 꼭 필요한데 비어 있는 정보를 묻는 보충 질문을 1개에서 3개 만드세요.
- 예: 최근 입원을 골랐으면 "퇴원 날짜가 정해졌나요?"
- 질문마다 고를 수 있는 짧은 답 2～4개를 options에 넣습니다. 보호자는 직접 입력할 수도 있습니다.
- 이미 답한 내용을 다시 묻지 않습니다.`,
    user: `보호자의 답:\n${summary}`,
    schema: FOLLOWUP_SCHEMA,
    maxTokens: 800
  });
  const list = Array.isArray(result?.questions) ? result.questions : [];
  const cleaned = list
    .filter((q) => typeof q?.text === "string" && q.text.trim())
    .slice(0, 3)
    .map((q, i) => ({
      id: `f${i + 1}`,
      text: q.text.trim(),
      options: (Array.isArray(q.options) ? q.options : []).filter((o) => typeof o === "string" && o.trim()).slice(0, 4)
    }));
  return cleaned.length ? cleaned : null;
}

function planSchema(candidateIds) {
  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            card_id: { type: "string", enum: candidateIds },
            bucket: { type: "string", enum: BUCKETS },
            why: { type: "string" }
          },
          required: ["card_id", "bucket", "why"],
          additionalProperties: false
        }
      }
    },
    required: ["items"],
    additionalProperties: false
  };
}

// AI가 고른 항목 가운데 후보에 있고 형식이 맞는 것만 남긴다.
export function validatePlan(result, candidateIds) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const seen = new Set();
  const valid = [];
  for (const item of items) {
    if (!item || !candidateIds.includes(item.card_id) || seen.has(item.card_id)) continue;
    if (!BUCKETS.includes(item.bucket)) continue;
    if (typeof item.why !== "string" || !item.why.trim()) continue;
    seen.add(item.card_id);
    valid.push({ card_id: item.card_id, bucket: item.bucket, why: item.why.trim() });
  }
  return valid.slice(0, 7);
}

export async function makePlan(summary, candidates) {
  const ids = candidates.map((c) => c.id);
  const cardText = candidates
    .map((c) => `[${c.id}] ${c.title}\n  기본 시점: ${c.bucket}\n  왜 필요한가: ${c.why}`)
    .join("\n");
  const result = await call({
    system: `${COMMON_RULES}
아래 후보 카드 가운데 이 보호자에게 지금 가장 필요한 카드 5～7장을 고르세요.
- bucket: this_week(늦추면 손해가 생기거나 다음 일을 못 하는 것), this_month(이번 주 일이 끝나면 이어서 할 것), know_ahead(지금 할 일은 아니지만 상태가 바뀌면 바로 필요한 것). 기본 시점을 따르되, 보호자의 답을 보고 바꿀 수 있습니다.
- why: 왜 지금 해야 하는지를 보호자의 답과 연결해 한두 문장으로 씁니다. 카드에 없는 제도, 금액, 기간을 지어내지 않습니다.
- 후보에 없는 카드 ID는 쓰지 않습니다.`,
    user: `보호자의 답:\n${summary}\n\n후보 카드:\n${cardText}`,
    schema: planSchema(ids),
    maxTokens: 2000
  });
  if (!result) return null;
  return validatePlan(result, ids);
}

// 지시해도 5문장을 넘길 때가 있어서 앞의 5문장만 남긴다.
export function limitSentences(text, max = 5) {
  if (!text) return text;
  const sentences = text.match(/[^.?!]+[.?!]+["')\]]*|[^.?!]+$/g) ?? [text];
  return sentences.slice(0, max).join("").trim();
}

export async function makeAnswer(summary, card, qaIndex) {
  const qa = card.qa[qaIndex];
  const text = await call({
    system: `${COMMON_RULES}
보호자가 할 일 카드에 붙은 질문을 눌렀습니다. 카드에 적힌 답을 이 보호자의 상황에 맞게 풀어 쓰세요.
- 3문장에서 5문장 사이로 씁니다. 5문장을 넘기지 않습니다.
- 카드에 적힌 답에 없는 사실, 제도, 금액, 기간, 의학 정보를 덧붙이지 않습니다.
- 보호자가 적은 증상을 보고 얼마나 위급한지, 언제 병원에 가야 하는지 판단하지 않습니다. 위급한 상황 안내는 화면이 따로 합니다.
- 보호자의 답과 관련 없는 부분은 줄여도 됩니다.
- 출처 표시와 머리말 없이 답만 씁니다.`,
    user: `보호자의 답:\n${summary}\n\n할 일: ${card.title}\n질문: ${qa.q}\n카드에 적힌 답: ${qa.a}`,
    maxTokens: 600
  });
  return limitSentences(text);
}
