// AI 없이도 동작해야 하는 규칙: 단계 정하기, 후보 카드 거르기, 규칙 기본 목록, 응급 신호 확인.
import { readFileSync } from "node:fs";

const dataDir = new URL("../data/", import.meta.url);
export const deck = JSON.parse(readFileSync(new URL("cards.json", dataDir), "utf-8"));
export const questions = JSON.parse(readFileSync(new URL("questions.json", dataDir), "utf-8"));
export const cardById = new Map(deck.cards.map((c) => [c.id, c]));

export const BUCKETS = ["this_week", "this_month", "know_ahead"];
const HAS_GRADE = ["g1", "g2", "g3", "g4", "g5", "cognitive"];

// 1번 답이 "잘 모르겠어요"이면 등급과 지금 받는 돌봄으로 단계를 짐작한다.
export function resolveStage(answers) {
  const stage = answers.stage;
  if (stage && stage !== "unknown") return stage;
  const care = answers.care ?? [];
  if (care.includes("hospital")) return "change";
  if (care.includes("nursing_home")) return "facility";
  if (HAS_GRADE.includes(answers.grade)) return "new_grade";
  return "suspect";
}

function overlaps(answer, allowed) {
  if (answer === undefined || answer === null) return false;
  const values = Array.isArray(answer) ? answer : [answer];
  return values.some((v) => allowed.includes(v));
}

// when의 조건은 모두 맞아야 하고, when_not의 조건은 하나도 맞으면 안 된다.
export function matches(card, answers, { onlyKeys } = {}) {
  for (const [key, allowed] of Object.entries(card.when ?? {})) {
    if (onlyKeys && !onlyKeys.includes(key)) continue;
    if (!overlaps(answers[key], allowed)) return false;
  }
  for (const [key, blocked] of Object.entries(card.when_not ?? {})) {
    if (onlyKeys && !onlyKeys.includes(key)) continue;
    if (overlaps(answers[key], blocked)) return false;
  }
  return true;
}

function byPriority(a, b) {
  return a.priority - b.priority;
}

// 맞는 조건이 많은 카드일수록 이 사람의 상황에 가깝다고 보고 먼저 고른다.
function bySpecificity(a, b) {
  const n = (c) => Object.keys(c.when ?? {}).length;
  return n(b) - n(a) || byPriority(a, b);
}

// AI에게 넘길 후보: 단계와 조건이 모두 맞는 카드.
export function candidateCards(answers) {
  const stage = resolveStage(answers);
  return deck.cards.filter((c) => c.stages.includes(stage) && matches(c, answers)).sort(byPriority);
}

// 규칙 기본 목록: 후보 카드와 같은 조건으로 고르고, 3장이 안 되면
// 단계와 등급 말고는 조건이 없는 카드로 채운다.
export function ruleList(answers, size = 6) {
  const stage = resolveStage(answers);
  const pool = candidateCards(answers).sort(bySpecificity);
  if (pool.length < 3) {
    const plain = deck.cards
      .filter((c) => c.stages.includes(stage) && !pool.includes(c))
      .filter((c) => Object.keys(c.when ?? {}).every((k) => k === "grade") && !c.when_not)
      .filter((c) => matches(c, answers))
      .sort(byPriority);
    pool.push(...plain);
  }
  const picked = [];
  // 구간마다 하나씩 먼저 넣어 세 구간이 비지 않게 한다.
  for (const bucket of BUCKETS) {
    const first = pool.find((c) => c.bucket === bucket && !picked.includes(c));
    if (first) picked.push(first);
  }
  for (const c of pool) {
    if (picked.length >= size) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked
    .sort(byPriority)
    .map((c) => ({ card_id: c.id, bucket: c.bucket, why: c.why }));
}

// 응급 신호는 AI가 아니라 키워드로 확인한다. AI가 실패해도 동작해야 하기 때문이다.
const EMERGENCY_RULES = [
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

export function detectEmergency(texts) {
  const joined = texts.filter(Boolean).join(" ").replace(/\s+/g, " ");
  const compact = joined.replace(/\s/g, "");
  const kinds = [];
  for (const rule of EMERGENCY_RULES) {
    const hit = rule.words.some((w) => joined.includes(w) || compact.includes(w.replace(/\s/g, "")));
    if (hit) kinds.push(rule.kind);
  }
  return kinds;
}

export function sourcesOf(card) {
  return card.source_keys.map((key) => ({ ...deck.sources[key], checked: deck.sources[key].checked ?? null }));
}

// 화면에 보낼 카드 한 장. 질문의 답 원문은 눌렀을 때만 보낸다.
export function publicCard(card) {
  return {
    id: card.id,
    title: card.title,
    contact: card.contact,
    questions: card.qa.map((x) => x.q),
    sources: sourcesOf(card)
  };
}
