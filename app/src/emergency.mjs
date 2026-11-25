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

// 응급 신호가 하나라도 있으면 띄우는 연락처. 값은 sources.json의 자료 번호다.
const ALWAYS = ["emergency119", "mental_crisis"];
// 신호의 종류에 따라 더 띄우는 연락처: 폭력은 경찰 112, 죽음이나 자살은 자살예방상담전화 109.
const BY_KIND = { violence: "police112", suicide: "hs_line109" };

// 찾은 신호의 종류를 받아 화면에 띄울 자료를 순서대로 돌려준다. 번호와 이름은 자료 목록에서 꺼낸다.
export function emergencyContacts(kinds, sources) {
  if (kinds.length === 0) return [];
  const extra = Object.entries(BY_KIND).filter(([kind]) => kinds.includes(kind)).map(([, id]) => id);
  return [...ALWAYS, ...extra].map((id) => sources.find((s) => s.id === id));
}
