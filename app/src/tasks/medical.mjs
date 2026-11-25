// 담당 자리: B4 의료 질문 돌려 주기.
// evals/medical.jsonl과 prompts/medical.md를 만들면 AI가 켜짐. 순서는 app/README.md.
// 입력: { worry }
// 값: string[] 2개까지(다음 진료 때 의료진에게 물어볼 질문). 꺼져 있거나 실패하면 [].
// 안전장치: 전화번호, 복용량, 약 이름이 든 문장은 버린다(스펙 7절).

// 약 이름 목록은 B4·C4 담당이 더함. 여기 든 이름이 문장에 있으면 그 문장을 버린다.
export const DRUG_NAMES = [];

// 전화번호: 구분 기호(-, ., ), 공백)로 나뉜 꼴, 붙여 쓴 대표번호(15xx/16xx/18xx 8자리 이상), 0으로 시작하는 9～11자리
const PHONE = /\d{2,4}[-.)\s]{1,2}\d{3,4}[-.\s]\d{4}|\d{4}-\d{4}|(?<!\d)(?:1[568]\d{6,}|0\d{8,10})(?!\d)/;
// 복용량: 숫자 뒤 단위(대소문자 무시), 한글 수 뒤 알·정·포·캡슐
const DOSE = /\d\s*(?:mcg|mg|ml|g|㎎|㎖|㎍|µg|μg|iu|cc|정|알|포|캡슐|방울)|(?:한|두|세|네|반)\s*(?:알|정|포|캡슐)/i;

export function dropUnsafeSentences(sentences) {
  return sentences.filter(
    (s) => !PHONE.test(s) && !DOSE.test(s) && !DRUG_NAMES.some((name) => s.includes(name))
  );
}

export function makeMedical(content) {
  return {
    name: "medical",
    schema: {
      type: "object",
      properties: { questions: { type: "array", items: { type: "string" } } },
      required: ["questions"],
      additionalProperties: false,
    },
    // 스펙 7절: 걱정 칸의 글만 보낸다. 답은 쓰지 않고 물어볼 질문만 만들게 한다.
    buildUser: ({ worry }) =>
      `걱정: ${typeof worry === "string" ? worry : ""}\n\n다음 진료 때 의료진에게 물어볼 질문을 한두 개 만들어 주세요. 답은 쓰지 마세요.`,
    validate(data) {
      const list = Array.isArray(data?.questions) ? data.questions : [];
      const texts = list.filter((x) => typeof x === "string" && x.trim() !== "").map((x) => x.trim());
      const safe = dropUnsafeSentences(texts).slice(0, 2);
      return safe.length ? safe : null;
    },
    fallback: () => [],
  };
}
