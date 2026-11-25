// 담당 자리: B2 오늘 정리한 내용 쓰기.
// evals/summary.jsonl과 prompts/summary.md를 만들면 AI가 켜짐. 순서는 app/README.md.
// 입력: { answered: [{ q, a }], followups: [{ q, a }], worry }
// 값: 글 한 덩이. 꺼져 있거나 실패하면 답을 "질문: 답" 줄로 나열하고, 걱정이 있으면 "걱정: ..." 줄을 덧붙인다.

function lines(list) {
  return (list ?? []).map(({ q, a }) => `${q}: ${a}`);
}

export function makeSummary(content) {
  return {
    name: "summary",
    schema: null,
    // 스펙 7절: 고른 답, 보충 질문의 답, 걱정 한 줄만 보낸다. 판단이나 권유는 넣지 않게 시킨다.
    buildUser: ({ answered, followups, worry }) =>
      [
        "고른 답:",
        ...lines(answered),
        "보충 질문의 답:",
        ...lines(followups),
        `걱정: ${worry ?? ""}`,
        "",
        "위 내용을 두세 문장으로 돌려 적어 주세요. 판단이나 권유는 넣지 마세요.",
      ].join("\n"),
    validate: (data) => (typeof data === "string" && data.trim() !== "" ? data.trim() : null),
    fallback({ answered, followups, worry }) {
      const out = [...lines(answered), ...lines(followups)];
      if (worry && String(worry).trim() !== "") out.push(`걱정: ${String(worry).trim()}`);
      return out.join("\n");
    },
  };
}
