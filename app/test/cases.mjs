// 인터뷰 요약 5건으로 만든 점검용 사례. prototypes/김영균/scripts/run-cases.mjs의 C2, C3, C5, C6, H1을 옮겼다.
// 주의: 답은 인터뷰 요약을 보고 고른 것이라 실제 보호자가 직접 답한 결과가 아니다.
// 답의 키와 값은 content/situations.json의 것이고, 실명과 기관명은 넣지 않았다.
// expect는 인터뷰에서 막혔다고 말한 일에 해당하는 카드 번호다. 규칙 기본 목록에 들어 있어야 한다.
// 사례의 입력은 { situation, answers, worry } 모양이고, 나머지 입력(methodId, followups)은 테스트가 채운다.
export const CASES = [
  {
    id: "C2",
    summary: "어머니, 파킨슨 증후군으로 와상. 패혈증 입원 뒤 1등급, 등급 시간 밖은 가족 돈으로 24시간 간병",
    situation: "hospital",
    worry: "형제끼리 간병비 나누는 게 어려워요",
    expect: ["S3-07", "S3-09"],
    answers: {
      grade: "g1", care: ["home_visit", "private_caregiver"], diagnoses: ["parkinson"], mobility: "bed", talk: "normal",
      lives_together: "no", works: "yes", daytime_family: "no", cost_burden: "high", hospital_stay: "unknown"
    }
  },
  {
    id: "C3",
    summary: "어머니, 80대 후반, 혼자 사심. 치매 진단을 믿지 못해 약을 끊음. 등급은 아직 없음",
    situation: "suspect",
    worry: "부작용이 걱정돼서 약을 끊었어요",
    expect: ["S1-04", "S1-10"],
    answers: {
      grade: "none", care: ["family"], diagnoses: ["dementia"], mobility: "walk", talk: "sometimes",
      lives_together: "no", works: "no", daytime_family: "no", cost_burden: "unknown"
    }
  },
  {
    id: "C5",
    summary: "어머니, 70대, 편마비. 넘어져 수술한 뒤 퇴원을 앞둠. 4등급. 보호자는 회사에 다님",
    situation: "hospital",
    worry: "퇴원하시면 누가 돌볼지 정해지지 않았어요",
    expect: ["S3-01", "S3-03"],
    answers: {
      grade: "g4", care: ["hospital"], diagnoses: ["fracture", "other"], mobility: "assist", talk: "normal",
      lives_together: "yes", works: "yes", daytime_family: "no", cost_burden: "low", hospital_stay: "soon"
    }
  },
  {
    id: "C6",
    summary: "할아버지, 80대, 치매 5등급으로 주야간보호. 혈압약을 바꾼 뒤 증상이 갑자기 나빠짐. 함께 살며 출근",
    situation: "symptom",
    worry: "혈압약을 바꾼 뒤부터 갑자기 달라지셨어요",
    expect: ["S3-10", "S3-11"],
    answers: {
      grade: "g5", care: ["daycare"], diagnoses: ["dementia"], mobility: "walk", talk: "hard",
      lives_together: "yes", works: "yes", daytime_family: "no", cost_burden: "unknown",
      change: "behavior", risk: "yes", sudden_change: "yes", service_fit: "unknown"
    }
  },
  {
    id: "H1",
    summary: "어머니, 두 번 넘어져 입원. 5남매가 돌아가며 간병",
    situation: "fall",
    worry: "다섯 남매가 돌아가며 간병하는데 순번이 자꾸 어긋나요",
    expect: ["S3-07", "S3-05"],
    answers: {
      grade: "unknown", care: ["hospital"], diagnoses: ["fracture"], mobility: "assist", talk: "normal",
      lives_together: "no", works: "yes", daytime_family: "no", cost_burden: "medium", treated: "admitted"
    }
  }
];
