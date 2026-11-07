// 손 점검 1: 인터뷰 요약 5건과 일부러 까다롭게 만든 상황 10건을 규칙 엔진에 넣어 본다.
// 실행: npm run check:cases
// 인터뷰 사례(C2～H1)의 답은 인터뷰에서 막혔다고 말한 시점을 기준으로 골랐다. 실명과 기관명은 없다.
// expect는 목록에 들어가야 할 카드, forbid는 들어가면 안 되는 카드다.
import { fileURLToPath } from "node:url";
import { engine, deck } from "./engine.mjs";

const title = (id) => engine.cardById.get(id).title;

export const CASES = [
  {
    id: "C2",
    situation: "어머니, 파킨슨 증후군으로 와상. 패혈증 입원 뒤 1등급, 등급 시간 밖은 가족 돈으로 24시간 간병",
    expect: ["S3-07", "S3-09"],
    forbid: ["S2-02"],
    answers: {
      stage: "change", relation: "parent", age: "unknown", diagnoses: ["parkinson"], mobility: "bed", talk: "normal",
      grade: "g1", care: ["home_visit", "private_caregiver"], lives_together: "no", works: "yes", hours: "le2",
      budget: "gt150", split: "discussing", sudden_change: "no", service_fit: "change", worry: "형제끼리 간병비 나누는 게 어려워요"
    }
  },
  {
    id: "C3",
    situation: "어머니, 80대 후반, 혼자 사심. 치매 진단을 믿지 못해 약을 끊음. 등급은 아직 없음",
    expect: ["S1-04", "S1-10"],
    forbid: ["S1-01"],
    answers: {
      stage: "suspect", relation: "parent", age: "85plus", diagnoses: ["dementia"], mobility: "walk", talk: "sometimes",
      grade: "none", care: ["family"], lives_together: "no", works: "no", hours: "half", budget: "unknown", split: "decided",
      worry: "부작용이 걱정돼서 약을 끊었어요"
    }
  },
  {
    id: "C5",
    situation: "어머니, 70대, 편마비. 넘어져 수술한 뒤 퇴원을 앞둠. 4등급. 보호자는 회사에 다님",
    expect: ["S3-01", "S3-03"],
    forbid: [],
    answers: {
      stage: "change", relation: "parent", age: "65_74", diagnoses: ["fracture", "other"], mobility: "assist", talk: "normal",
      grade: "g4", care: ["hospital"], lives_together: "yes", works: "yes", hours: "none", budget: "lt30", split: "alone",
      hospital_stay: "soon", sudden_change: "no"
    }
  },
  {
    id: "C6",
    situation: "할아버지, 80대, 치매 5등급으로 주야간보호. 혈압약을 바꾼 뒤 증상이 갑자기 나빠짐. 함께 살며 출근",
    expect: ["S3-10", "S3-11"],
    forbid: ["S2-02"],
    emergency: ["violence"],
    answers: {
      stage: "change", relation: "grandparent", age: "85plus", diagnoses: ["dementia"], mobility: "walk", talk: "hard",
      grade: "g5", care: ["daycare"], lives_together: "yes", works: "yes", hours: "le2", budget: "unknown", split: "decided",
      sudden_change: "yes", service_fit: "unknown", worry: "할아버지가 할머니를 때리려고 하세요"
    }
  },
  {
    id: "H1",
    situation: "어머니, 두 번 넘어져 입원. 5남매가 돌아가며 간병",
    expect: ["S3-07", "S3-05"],
    forbid: [],
    answers: {
      stage: "change", relation: "parent", age: "85plus", diagnoses: ["fracture"], mobility: "assist", talk: "normal",
      grade: "unknown", care: ["hospital"], lives_together: "no", works: "yes", hours: "le2", budget: "30_70", split: "discussing",
      hospital_stay: "unknown", sudden_change: "no"
    }
  },
  {
    id: "E1",
    situation: "배우자 85세 이상, 1등급 와상, 이미 요양원에 계심, 최근 상태 악화",
    expect: ["S4-10", "S3-10"],
    forbid: ["S2-02", "S2-03", "S2-05", "S4-01", "S4-09"],
    answers: {
      stage: "change", relation: "spouse", age: "85plus", diagnoses: ["dementia"], mobility: "bed", talk: "hard", grade: "g1",
      care: ["nursing_home"], lives_together: "no", works: "no", hours: "le2", budget: "70_150", split: "na", sudden_change: "yes"
    }
  },
  {
    id: "E2",
    situation: "1번을 '잘 모르겠어요', 뇌졸중 뒤 부축 필요, 등급 없음, 가족만 돌봄",
    expect: ["S1-06"],
    forbid: ["S1-01", "S1-03"],
    answers: {
      stage: "unknown", relation: "parent", age: "75_84", diagnoses: ["stroke"], mobility: "assist", talk: "normal", grade: "none",
      care: ["family"], lives_together: "yes", works: "yes", hours: "le2", budget: "30_70", split: "decided"
    }
  },
  {
    id: "E3",
    situation: "60세 배우자가 뇌졸중으로 입원, 등급 없음, 곧 퇴원",
    expect: ["S1-06", "S3-01"],
    forbid: [],
    answers: {
      stage: "change", relation: "spouse", age: "lt65", diagnoses: ["stroke"], mobility: "bed", talk: "hard", grade: "none",
      care: ["hospital"], lives_together: "yes", works: "yes", hours: "none", budget: "30_70", split: "alone", hospital_stay: "soon"
    }
  },
  {
    id: "E4",
    situation: "인지지원등급을 받은 지 얼마 안 됨, 치매 초기, 혼자 걸으심",
    expect: ["S1-09"],
    forbid: ["S2-02", "S2-05"],
    answers: {
      stage: "new_grade", relation: "parent", age: "75_84", diagnoses: ["dementia"], mobility: "walk", talk: "sometimes",
      grade: "cognitive", care: ["family"], lives_together: "no", works: "yes", hours: "le2", budget: "lt30", split: "decided"
    }
  },
  {
    id: "E5",
    situation: "시설 고민 단계인데 이미 요양원 입소 중(요양병원으로 옮길지 고민)",
    expect: ["S4-02", "S4-10"],
    forbid: ["S4-01", "S4-05", "S4-07", "S4-09"],
    answers: {
      stage: "facility", relation: "parent", age: "85plus", diagnoses: ["dementia", "other"], mobility: "bed", talk: "hard",
      grade: "g2", care: ["nursing_home"], lives_together: "no", works: "yes", hours: "none", budget: "70_150", split: "decided",
      sudden_change: "no", worry: "요양병원으로 옮겨야 할지 모르겠어요"
    }
  },
  {
    id: "E6",
    situation: "5등급 치매, 은퇴한 자녀가 하루 종일 집에서 돌봄",
    expect: ["S2-06", "S2-02"],
    forbid: [],
    answers: {
      stage: "new_grade", relation: "parent", age: "85plus", diagnoses: ["dementia"], mobility: "walk", talk: "sometimes",
      grade: "g5", care: ["family"], lives_together: "yes", works: "no", hours: "full", budget: "lt30", split: "alone",
      worry: "하루 종일 돌보느라 너무 지쳐요"
    }
  },
  {
    id: "E7",
    situation: "2등급, 와상으로 요양병원에 계속 계실 예정",
    expect: ["S3-02"],
    forbid: ["S3-01", "S3-03", "S2-02", "S2-05"],
    answers: {
      stage: "change", relation: "parent", age: "85plus", diagnoses: ["other"], mobility: "bed", talk: "normal", grade: "g2",
      care: ["hospital"], lives_together: "no", works: "no", hours: "half", budget: "gt150", split: "decided",
      hospital_stay: "long", sudden_change: "no"
    }
  },
  {
    id: "E8",
    situation: "거의 다 '잘 모르겠어요'",
    expect: ["S1-06"],
    forbid: [],
    answers: {
      stage: "unknown", relation: "other", age: "unknown", diagnoses: ["unknown"], mobility: "unknown", talk: "unknown",
      grade: "unknown", care: [], lives_together: "no", works: "no", hours: "none", budget: "unknown", split: "na"
    }
  },
  {
    id: "E9",
    situation: "등급 신청 중, 시설을 생각 중, 혼자 부담",
    expect: ["S1-07", "S4-04"],
    forbid: [],
    answers: {
      stage: "facility", relation: "parent", age: "75_84", diagnoses: ["dementia"], mobility: "assist", talk: "hard",
      grade: "applying", care: ["family"], lives_together: "yes", works: "yes", hours: "le2", budget: "lt30", split: "alone",
      sudden_change: "no"
    }
  },
  {
    id: "E10",
    situation: "방문요양을 이미 쓰는 3등급, 등급 받은 직후, 출근함",
    expect: ["S3-11"],
    forbid: ["S2-02"],
    answers: {
      stage: "new_grade", relation: "parent", age: "75_84", diagnoses: ["parkinson"], mobility: "assist", talk: "normal",
      grade: "g3", care: ["home_visit"], lives_together: "yes", works: "yes", hours: "le2", budget: "30_70", split: "decided",
      service_fit: "ok"
    }
  }
];

export function checkCase(c) {
  const plan = engine.buildPlan(c.answers);
  const ids = plan.items.map((it) => it.card_id);
  const missing = c.expect.filter((id) => !ids.includes(id));
  const forbidden = c.forbid.filter((id) => ids.includes(id));
  const emergencyOk = JSON.stringify(plan.emergency) === JSON.stringify(c.emergency ?? []);
  return { plan, ids, missing, forbidden, emergencyOk, ok: !missing.length && !forbidden.length && emergencyOk };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let allOk = true;
  for (const c of CASES) {
    const r = checkCase(c);
    allOk &&= r.ok;
    console.log(`■ ${c.id} ${r.ok ? "통과" : "확인 필요"}  ${c.situation}`);
    console.log(`  단계: ${r.plan.stage} · 응급: ${r.plan.emergency.join(", ") || "없음"}`);
    for (const it of r.plan.items) console.log(`  - [${it.bucket}] ${it.card_id} ${title(it.card_id)}\n      ${it.reasons.join(" ")}`);
    if (r.missing.length) console.log(`  빠진 카드: ${r.missing.map((id) => `${id} ${title(id)}`).join(" / ")}`);
    if (r.forbidden.length) console.log(`  나오면 안 되는 카드: ${r.forbidden.map((id) => `${id} ${title(id)}`).join(" / ")}`);
    console.log("");
  }
  console.log(`카드 ${deck.cards.length}장, 사례 ${CASES.length}건: ${allOk ? "모두 통과" : "확인이 필요한 사례가 있습니다"}`);
  process.exitCode = allOk ? 0 : 1;
}
