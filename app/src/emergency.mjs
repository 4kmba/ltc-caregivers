// 응급 신호 찾기(스펙 8절). 보호자가 직접 적은 글에 응급 신호가 있으면 목록보다 먼저 안내를 띄운다.
// AI를 부르기 전에 하고, AI가 실패해도 동작해야 하므로 정해 둔 낱말로만 찾는다.
//
// 찾는 방법은 두 가지다.
// - 낱말: 그 자체로 이상을 뜻하는 말("쓰러", "경련", "죽고 싶")은 혼자 있어도 잡는다.
// - 짝: 무엇이(대답, 숨, 눈…) 어떻게 됐는지(없, 안, 못…)가 한 문장 안에서 여섯 글자 안에 이어지면 잡는다.
//   "대답을 잘 안 하세요"처럼 사이에 말이 끼어도 찾고, "숨쉬기 운동"처럼 상태가 없으면 넘긴다.
// 의료와 폭력은 찾은 말 바로 뒤에 부정("지는 않", "은 없었"), 과거 이력("적 있"), 걱정("까 봐")이 오면 내린다.
// 자살은 놓치면 되돌릴 수 없으므로 어떤 맥락에서도 내리지 않는다.
// 판별 기준은 test/emergency.test.mjs의 예문이다. 낱말을 고칠 때는 예문을 먼저 더한다.

const RULES = [
  {
    kind: "medical",
    words: ["쓰러", "경련", "발작", "피를토", "피를많이", "마비가왔", "의식불명"],
    pairs: [
      [["대답", "반응"], ["없", "안", "못"]],
      [["의식"], ["없", "잃", "흐려", "희미"]],
      [["눈을", "눈이", "눈도"], ["안떠", "못떠", "안뜨", "못뜨", "뜨지않", "뜨지못", "뒤집"]],
      [["깨워도", "흔들어도"], ["안일어", "못일어", "안깨", "못깨"]],
      [["숨이", "숨을", "숨도", "숨쉬"], ["안쉬", "못쉬", "힘들", "어려", "차", "가빠", "가쁘", "막", "멎"]],
      [["숨소리"], ["이상", "거칠", "그르렁", "가르랑"]],
      [["입술", "얼굴"], ["파래", "퍼래", "파랗", "새파"]],
      [["말이", "말을", "발음"], ["어눌", "안나", "꼬여"]],
      [["한쪽"], ["마비", "힘이없", "힘이안", "안움직", "못움직"]]
    ],
    suppress: true
  },
  {
    kind: "violence",
    words: ["때리", "때려", "때렸", "주먹", "목을조", "흉기", "위협"],
    pairs: [[["칼", "가위", "망치"], ["들고", "휘두", "찌르", "찔러"]]],
    suppress: true
  },
  {
    kind: "suicide",
    words: ["죽고싶", "죽어버리", "죽겠다고", "자살", "목숨을", "살기싫", "그만살"],
    pairs: [],
    suppress: false
  }
];

// 찾은 말 바로 뒤(두 글자 안)에 이 표현이 오면 지금 벌어진 일이 아니라고 본다.
// 범위를 넓히면 "경련이 멈추지 않아요"처럼 뒤에 온 다른 말의 부정까지 읽어 응급을 놓친다.
const NOT_NOW = /^.{0,2}?(지는않|진않|지도않|지않|[은는이가]없|안했|적이?있|까봐)/;

// 급하게 적으면 띄어쓰기가 틀리기 쉬우므로, 띄어쓰기를 지우고 비교한다.
const compact = (text) => text.replace(/\s+/g, "");

const matchers = RULES.map((rule) => ({
  ...rule,
  patterns: [
    ...(rule.words.length ? [new RegExp(`(${rule.words.join("|")})`, "g")] : []),
    ...rule.pairs.map(([what, how]) => new RegExp(`(${what.join("|")}).{0,6}?(${how.join("|")})`, "g"))
  ]
}));

// 문장 하나에 이 규칙의 신호가 있는지 본다. 같은 말이 여러 번 나오면 하나라도 내리지 않은 것이 있으면 잡는다.
function hits(rule, sentence) {
  return rule.patterns.some((pattern) =>
    [...sentence.matchAll(pattern)].some((m) => !rule.suppress || !NOT_NOW.test(sentence.slice(m.index + m[0].length)))
  );
}

// 글 여러 개(상황별 질문·보충 질문의 직접 적은 답, 걱정 한 줄)를 받아 찾은 응급 신호의 종류를 돌려준다.
// 칸끼리, 문장끼리 이어 붙이지 않는다. 다른 칸의 말이 짝으로 묶이지 않게 하려는 것이다.
export function detectEmergency(texts) {
  const sentences = texts
    .filter(Boolean)
    .flatMap((text) => text.split(/[.?!,\n。]+/))
    .map(compact)
    .filter(Boolean);
  return matchers.filter((rule) => sentences.some((s) => hits(rule, s))).map((rule) => rule.kind);
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
