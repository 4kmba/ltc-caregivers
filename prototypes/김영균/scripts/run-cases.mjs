// 손 점검 1: 인터뷰 요약 5건의 상황을 비식별한 채로 고정 질문에 넣어 본다.
// 실행: npm run check:cases   (.env에 키가 있으면 AI로, 없으면 규칙 기본 목록으로 돈다)
// 각 사례의 답은 인터뷰에서 막혔다고 말한 시점을 기준으로 골랐다. 실명과 기관명은 없다.
import { buildPlan, cleanAnswers } from "../server.mjs";
import { aiEnabled } from "../src/ai.mjs";
import { cardById } from "../src/rules.mjs";

const CASES = [
  {
    id: "C2",
    situation: "어머니, 파킨슨 증후군으로 와상. 패혈증 입원 뒤 1등급, 등급 시간 밖은 가족 돈으로 24시간 간병",
    blocked: "형제 간 간병비 분담, 새 증상이 생길 때 의료 정보의 진위",
    expect: ["S3-07", "S3-09"],
    answers: {
      stage: "change", relation: "parent", age: "unknown", diagnoses: ["parkinson"], mobility: "bed", talk: "normal",
      grade: "g1", care: ["home_visit", "private_caregiver"], lives_together: "no", works: "yes", hours: "le2",
      budget: "gt150", split: "discussing"
    }
  },
  {
    id: "C3",
    situation: "어머니, 80대 후반, 혼자 사심. 신경과에서 치매 진단을 받았지만 믿지 못해 약을 끊음. 등급은 아직 없음",
    blocked: "치매가 맞는지와 약을 먹일지, 알츠하이머 말고 다른 치매의 초기 증상을 몰랐음",
    expect: ["S1-04", "S1-10"],
    answers: {
      stage: "suspect", relation: "parent", age: "85plus", diagnoses: ["dementia"], mobility: "walk", talk: "sometimes",
      grade: "none", care: ["family"], lives_together: "no", works: "no", hours: "half", budget: "unknown", split: "decided"
    },
    followups: [{ question: "지금 약은 드시고 계신가요?", answer: "부작용이 걱정돼서 끊었어요" }]
  },
  {
    id: "C5",
    situation: "어머니, 70대, 편마비. 넘어져 수술한 뒤 퇴원을 앞둠. 4등급. 보호자는 회사에 다님",
    blocked: "퇴원 뒤 어디서 돌볼지, 기관마다 설명이 다름, 요양보호사 구하기",
    expect: ["S3-01", "S3-03"],
    answers: {
      stage: "change", relation: "parent", age: "65_74", diagnoses: ["fracture", "other"], mobility: "assist", talk: "normal",
      grade: "g4", care: ["hospital"], lives_together: "yes", works: "yes", hours: "none", budget: "lt30", split: "alone"
    },
    followups: [{ question: "퇴원 날짜가 정해졌나요?", answer: "다음 주에 퇴원하라고 했어요" }]
  },
  {
    id: "C6",
    situation: "할아버지, 80대, 치매 5등급으로 주야간보호. 혈압약을 바꾼 뒤 증상이 갑자기 나빠짐. 보호자는 함께 살며 출근",
    blocked: "혼자 결정하고 책임지는 부담, 퇴근 전 한 시간 돌봄 공백",
    expect: ["S3-10", "S3-11"],
    answers: {
      stage: "change", relation: "grandparent", age: "85plus", diagnoses: ["dementia"], mobility: "walk", talk: "hard",
      grade: "g5", care: ["daycare"], lives_together: "yes", works: "yes", hours: "le2", budget: "unknown", split: "decided"
    },
    followups: [{ question: "요즘 가장 걱정되는 일은 무엇인가요?", answer: "할아버지가 할머니를 때리려고 하세요" }]
  },
  {
    id: "H1",
    situation: "어머니, 두 번 넘어져 입원. 5남매가 돌아가며 간병",
    blocked: "간병을 누가 할지와 비용 나누기, 의료 결정은 병원에 맡김",
    expect: ["S3-07", "S3-05"],
    answers: {
      stage: "change", relation: "parent", age: "85plus", diagnoses: ["fracture"], mobility: "assist", talk: "normal",
      grade: "unknown", care: ["hospital"], lives_together: "no", works: "yes", hours: "le2", budget: "30_70", split: "discussing"
    }
  }
];

console.log(`AI: ${aiEnabled() ? "켜짐" : "꺼짐 (규칙 기본 목록)"}\n`);
let allOk = true;
for (const c of CASES) {
  const started = Date.now();
  const plan = await buildPlan(cleanAnswers({ ...c.answers, followups: c.followups }));
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const ids = plan.items.map((it) => it.card.id);
  const missingSource = plan.items.filter((it) => !it.card.sources.length).map((it) => it.card.id);
  const hits = c.expect.filter((id) => ids.includes(id));
  const stageOk = plan.stage === c.answers.stage;
  allOk &&= stageOk && !missingSource.length && hits.length > 0;

  console.log(`■ ${c.id}  ${c.situation}`);
  console.log(`  막힌 일: ${c.blocked}`);
  console.log(`  단계: ${plan.stage} ${stageOk ? "(맞음)" : "(틀림)"} · 방식: ${plan.mode} · ${seconds}초 · 응급: ${plan.emergency.join(", ") || "없음"}`);
  for (const it of plan.items) console.log(`  - [${it.bucket}] ${it.card.id} ${it.card.title}\n      왜: ${it.why}`);
  console.log(`  출처 없는 항목: ${missingSource.length ? missingSource.join(", ") : "없음"}`);
  console.log(`  막힌 일과 맞는 카드: ${hits.length}/${c.expect.length} (${c.expect.map((id) => `${id}${ids.includes(id) ? "✓" : "✗"} ${cardById.get(id).title}`).join(" / ")})\n`);
}
console.log(allOk ? "모든 사례: 단계 맞음, 출처 있음, 막힌 일 카드가 하나 이상 들어감" : "확인이 필요한 사례가 있습니다");
