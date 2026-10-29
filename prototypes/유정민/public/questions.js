// 질문 1～6 (스펙 4절 표). 화면과 서버가 같은 목록을 쓴다.
// 서버는 이 목록에 있는 값만 받아서 AI에게 넘긴다.

export const NOTE_MAX = 500;

export const QUESTIONS = [
  {
    title: "어떤 상황인가요?",
    parts: [
      {
        key: "situation",
        label: "상황",
        choices: ["돌봄을 처음 시작함", "입원·퇴원", "낙상", "증상 악화", "보호자 사정이 바뀜", "이용하던 기관 문제"],
      },
    ],
  },
  {
    title: "어르신 거동은 어떤가요? 치매 진단을 받았나요?",
    parts: [
      { key: "mobility", label: "거동", choices: ["혼자 걸음", "부축 필요", "주로 누워 지냄"] },
      { key: "dementia", label: "치매 진단", choices: ["진단 받음", "의심됨", "아님"] },
    ],
  },
  {
    title: "장기요양등급이 있나요?",
    parts: [
      {
        key: "grade",
        label: "장기요양등급",
        choices: ["없음", "신청 중", "1등급", "2등급", "3등급", "4등급", "5등급", "인지지원등급", "모름"],
      },
    ],
  },
  {
    title: "지금은 어떻게 돌보고 있나요?",
    hint: "여러 개 고를 수 있어요.",
    parts: [
      {
        key: "care",
        label: "지금 돌봄 방식",
        multiple: true,
        choices: ["가족이 직접", "방문요양", "주간보호", "요양원", "요양병원·입원 중"],
      },
    ],
  },
  {
    title: "가족이 돌봄에 낼 수 있는 시간과 비용 부담은?",
    parts: [
      { key: "time", label: "가족이 낼 수 있는 시간", choices: ["거의 없음", "일부", "대부분"] },
      { key: "cost", label: "비용 부담", choices: ["큼", "보통", "크지 않음"] },
    ],
  },
  {
    title: "더 알려 주고 싶은 것 (선택)",
    hint: "비워 둬도 돼요. 이름, 주소, 연락처는 적지 마세요.",
    note: true,
  },
];
