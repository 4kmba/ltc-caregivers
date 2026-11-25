// 응급 신호 낱말 찾기(스펙 8절). 보호자가 직접 적은 글에 응급 신호가 있으면 목록보다 먼저 안내를 띄운다.
// AI를 부르기 전에 하고, AI가 실패해도 동작해야 하므로 낱말로만 찾는다.
// 낱말 목록은 김영균 HW6 프로토타입(prototypes/김영균/src/rules.mjs)에서 가져왔다.

const RULES = [
  {
    kind: "medical",
    words: ["대답이 없", "대답을 안", "반응이 없", "의식이 없", "의식을 잃", "깨워도", "숨을 안", "숨을 못", "숨쉬기", "숨이 차", "쓰러", "경련", "발작", "피를 토", "피를 많이", "말이 어눌", "한쪽이 마비", "마비가 왔"]
  },
  {
    kind: "violence",
    words: ["때리", "때려", "폭력", "주먹", "흉기", "칼을", "목을 조", "위협"]
  },
  {
    kind: "suicide",
    words: ["죽고 싶", "죽어버리", "죽어 버리", "죽겠다고", "자살", "목숨을", "살기 싫", "그만 살"]
  }
];

// 급하게 적으면 띄어쓰기가 틀리기 쉬우므로, 글과 낱말 모두 띄어쓰기를 지우고 비교한다.
const compact = (text) => text.replace(/\s+/g, "");

// 글 여러 개(걱정 칸, 보충 질문의 답)를 받아 찾은 응급 신호의 종류를 돌려준다.
export function detectEmergency(texts) {
  const joined = compact(texts.filter(Boolean).join(""));
  return RULES.filter((rule) => rule.words.some((w) => joined.includes(compact(w)))).map((rule) => rule.kind);
}
