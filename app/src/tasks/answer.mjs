// 담당 자리: B3 질문에 답하기.
// evals/answer.jsonl과 prompts/answer.md를 만들면 AI가 켜짐. 순서는 app/README.md.
// 입력: { qaId, answers }
// 값: 글 한 덩이. 꺼져 있거나 실패하면 qa.json에 적힌 답 원문(없는 qaId면 빈 글).
import { stripUnsafe } from "../ai/sanitize.mjs";

export function makeAnswer(content) {
  // 서버로 들어온 qaId가 글이 아니면 없는 질문으로 본다.
  const find = (id) => (typeof id === "string" ? content.qa.find((x) => x.id === id) : undefined);
  return {
    name: "answer",
    schema: null,
    // 카드에 적힌 질문과 답 원문을 넣고, 그 사람의 답을 함께 보낸다.
    buildUser({ qaId, answers }) {
      const item = find(qaId);
      return [
        `질문: ${item?.q ?? ""}`,
        `카드에 적힌 답: ${item?.a ?? ""}`,
        `이 사람이 고른 답: ${typeof answers === "string" ? answers : JSON.stringify(answers)}`,
        "",
        "카드에 적힌 내용만으로 이 사람의 상황에 맞춰 3～5문장으로 풀어 써 주세요.",
      ].join("\n");
    },
    // 전화번호와 링크가 든 문장은 지우고, 남는 글이 없으면 대체 값으로 간다.
    validate: (data) => stripUnsafe(data) || null,
    fallback: ({ qaId }) => find(qaId)?.a ?? "",
  };
}
