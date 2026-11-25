// 담당 자리: A1 보충 질문 만들기.
// evals/followups.jsonl과 prompts/followups.md를 만들면 AI가 켜짐. 순서는 app/README.md.
// 입력: { situation, answers }
// 값: [{ q, options: string[] }] 2개까지. AI가 꺼져 있거나 실패하면 [] (보충 질문을 건너뜀).

function show(v) {
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function makeFollowups(content) {
  return {
    name: "followups",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: { q: { type: "string" }, options: { type: "array", items: { type: "string" } } },
            required: ["q", "options"],
          },
        },
      },
      required: ["questions"],
    },
    // 스펙 7절에 허용된 것만 넣는다: 고른 상황과 답. 팀원이 고칠 출발점이다.
    buildUser: ({ situation, answers }) =>
      `상황: ${show(situation)}\n고른 답: ${show(answers)}\n\n답에서 비어 있는 정보를 묻는 질문을 최대 2개, 보기와 함께 만들어 주세요.`,
    validate(data) {
      const list = Array.isArray(data?.questions) ? data.questions : [];
      const ok = list.filter(
        (x) =>
          typeof x?.q === "string" &&
          x.q.trim() !== "" &&
          Array.isArray(x.options) &&
          x.options.length >= 2 &&
          x.options.every((o) => typeof o === "string" && o.trim() !== "")
      );
      return ok.length ? ok.slice(0, 2).map((x) => ({ q: x.q.trim(), options: x.options })) : null;
    },
    fallback: () => [],
  };
}
