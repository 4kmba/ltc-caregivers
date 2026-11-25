// 본보기 AI 자리: 후보 카드 가운데 5～7장을 고르고 구간과 "왜 지금"을 쓴다(스펙 6절, 7절).
// 다른 자리를 만드는 팀원은 이 파일을 보고 따라 한다. 순서는 app/README.md의 "AI 자리"에 있다.
// 입력 { situation, answers, methodId, worry, followups: [{ q, a }] }에서 꺼내 쓰는 것은 이 다섯 개뿐이다.
// 지난 페이지, 체크, 돌보는 대상 칸이 입력에 섞여 와도 AI에게 보내지 않는다(스펙 7절).
import { candidateCards, cardMatches, ruleList, BUCKETS } from "../rules.mjs";
import { validatePlan } from "../ai-check.mjs";

const MIN_ITEMS = 3;

// 후보가 3장보다 적으면 상황과 등급 말고는 조건이 없는 카드로 채운다(스펙 6절).
// 조건이 등급 하나뿐이고 when_not과 when_any가 없는 카드 가운데, 이 사람의 답에도 맞는 카드(cardMatches)만 우선순위 순서로 넣는다.
// 등급이 맞지 않는 카드(예: 1등급인 사람에게 등급 신청)는 넣지 않는다.
function fillCandidates(cards, answers, method, candidates) {
  if (candidates.length >= MIN_ITEMS) return candidates;
  const excluded = method?.exclude_cards ?? [];
  const firsts = method?.first_cards ?? [];
  const plain = cards
    .filter((c) => cardMatches(c, answers) && !excluded.includes(c.id))
    .filter((c) => !candidates.some((x) => x.id === c.id))
    .filter((c) => Object.keys(c.when ?? {}).every((key) => key === "grade"))
    .filter((c) => Object.keys(c.when_not ?? {}).length === 0 && (c.when_any ?? []).length === 0)
    .sort((a, b) => a.priority - b.priority)
    .map((c) => ({ ...c, first: firsts.includes(c.id) }));
  return [...candidates, ...plain.slice(0, MIN_ITEMS - candidates.length)];
}

export function makePickCards(content) {
  // buildUser, validate, fallback이 모두 이 함수로 같은 후보를 얻는다.
  function prepare(input) {
    const answers = { ...input.answers, situation: input.situation };
    const method = content.methods.find((m) => m.id === input.methodId) ?? null;
    const candidates = fillCandidates(content.cards, answers, method, candidateCards(content.cards, answers, method));
    return { answers, candidates };
  }

  // 질문 번호가 아닌 보호자가 본 문구로 답을 적어 주려고, 키마다 질문 문구와 보기 문구를 모아 둔다.
  const questions = new Map();
  const addQuestion = (key, text, options) => questions.set(key, { text, labels: new Map(options.map((o) => [o.value, o.label])) });
  for (const screen of content.basic) for (const f of screen.fields) addQuestion(f.key, f.label ?? screen.title, f.options);
  for (const s of content.situations) for (const q of s.questions) addQuestion(q.key, q.text, q.options);
  for (const q of content.conditional) addQuestion(q.key, q.text, q.options);

  function describeAnswer(key, value) {
    const known = questions.get(key);
    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0) return null;
    if (!known) return `${key}: ${values.join(", ")}`;
    return `${known.text} → ${values.map((v) => known.labels.get(v) ?? v).join(", ")}`;
  }

  function describeCard(card) {
    const bucket = content.buckets[card.bucket] ?? card.bucket;
    return `- ${card.id} | ${card.title} | 구간: ${bucket} | 왜 필요한가: ${card.why}${card.first ? " | 먼저" : ""}`;
  }

  return {
    name: "pick-cards",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              card_id: { type: "string" },
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
    },

    buildUser(input) {
      const { answers, candidates } = prepare(input);
      const situation = content.situations.find((s) => s.id === input.situation);
      const answerLines = Object.entries(input.answers ?? {})
        .filter(([key]) => key !== "situation")
        .map(([key, value]) => describeAnswer(key, value))
        .filter(Boolean);
      const followupLines = (input.followups ?? []).map((f) => `- ${f.q} → ${f.a}`);
      return [
        `지금 상황: ${situation?.title ?? answers.situation}`,
        `보호자의 답:\n${answerLines.map((l) => `- ${l}`).join("\n") || "- 없음"}`,
        `걱정 한 줄: ${input.worry?.trim() || "없음"}`,
        `보충 질문의 답:\n${followupLines.join("\n") || "- 없음"}`,
        `후보 카드 (이 안에서만 고르세요. "먼저"는 보호자가 고른 돌봄 방식이 가리키는 카드입니다):\n${candidates.map(describeCard).join("\n")}`,
        "후보 가운데 5～7장을 골라 구간을 정하고, 카드마다 '왜 지금'을 보호자의 답과 이어서 한두 문장으로 쓰세요."
      ].join("\n\n");
    },

    // 후보에 없는 번호, 없는 구간, 빈 이유는 validatePlan이 버린다. 남은 항목이 3개보다 적으면 쓰지 않는다.
    validate(data, input) {
      const { candidates } = prepare(input);
      const items = validatePlan(data, candidates.map((c) => c.id));
      return items.length < MIN_ITEMS ? null : { items };
    },

    // AI 없이 보여 줄 규칙 기본 목록. "왜 지금"에는 카드에 적힌 "왜 필요한가"를 그대로 쓴다.
    fallback(input) {
      const { answers, candidates } = prepare(input);
      return { items: ruleList(candidates, answers).map((c) => ({ card_id: c.id, bucket: c.bucket, why: c.why })) };
    }
  };
}
