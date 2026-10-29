// 위기 시나리오별 액션 플랜 P0의 내용 데이터.
// 스펙: docs/specs/백민경-actionplan.md
// 화면에 나오는 질문, 시나리오, 액션 플랜, 연락처는 모두 여기서만 고친다.
// 연락처와 제도는 정부기관 자료로만 쓰고, verifiedAt에 공식 사이트에서 확인한 날짜를 적는다.
// verifiedAt이 null이면 화면에 "확인 전"으로 표시된다.

const SOURCES = {
  ltc: {
    name: "노인장기요양보험 (국민건강보험공단)",
    type: "정부기관",
    url: "https://www.longtermcare.or.kr",
    verifiedAt: null,
  },
  nid: {
    name: "중앙치매센터",
    type: "정부기관",
    url: "https://www.nid.or.kr",
    verifiedAt: null,
  },
  interviews: {
    name: "Team 10 보호자 인터뷰 (C2, C5, C6, H1)",
    type: "보호자 인터뷰",
    url: null,
    verifiedAt: "2026-10-28",
  },
};

const CONTACTS = {
  nhis: {
    name: "국민건강보험공단 장기요양 상담",
    phone: "1577-1000",
    what: "등급 변경 신청, 이용할 수 있는 장기요양 서비스와 본인부담 문의",
    source: "ltc",
  },
  dementiaCall: {
    name: "치매상담콜센터",
    phone: "1899-9988",
    what: "치매 증상 대처, 가까운 치매안심센터 안내",
    source: "nid",
  },
  dementiaCenter: {
    name: "치매안심센터 (주소지 보건소)",
    phone: null,
    what: "치매 검진과 상담, 가족 지원 프로그램. 치매상담콜센터에서 가까운 곳을 안내받을 수 있다",
    source: "nid",
  },
  communityCenter: {
    name: "주민센터 (행정복지센터)",
    phone: null,
    what: "장기요양 외 지자체 돌봄 지원과 긴급 지원 문의",
    source: null,
  },
  hospitalSW: {
    name: "병원 사회복지팀 (의료사회복지사)",
    phone: null,
    what: "입원 중이라면 퇴원 뒤 돌봄 계획, 간병, 이용할 수 있는 제도 상담",
    source: null,
  },
};

// 가족 정보 항목. 꼬리 질문의 profileKey와 같으면 그 질문은 다시 묻지 않는다.
const PROFILE_FIELDS = [
  { key: "age", label: "어르신 나이대", options: ["60대", "70대", "80대 이상"] },
  { key: "grade", label: "장기요양등급", options: ["1~2등급", "3~5등급", "인지지원등급", "등급 없음", "모름"] },
  { key: "livesWith", label: "주 보호자와 함께 사나요?", options: ["함께 산다", "따로 산다"] },
  { key: "services", label: "지금 받는 서비스", options: ["없음", "방문요양", "주야간보호", "요양시설"] },
  { key: "caregiverWork", label: "주 보호자의 일", options: ["전일 근무", "시간제·유연 근무", "일하지 않음"] },
];

const UNKNOWN = "잘 모르겠어요";

const SITUATIONS = [
  {
    id: "dementia",
    title: "치매 증상 악화",
    hint: "가족을 못 알아보거나, 성격·행동이 달라졌어요",
    questions: [
      { key: "change", text: "어떤 변화가 가장 큰가요?", options: ["기억 (가족을 못 알아봄 등)", "성격·행동 (화, 의심, 배회)", "일상생활 (식사, 대소변)"] },
      { key: "risk", text: "혼자 있을 때 위험했던 일이 있었나요? (배회, 가스불, 낙상 등)", options: ["있었다", "없었다"] },
      { key: "daytime", text: "평일 낮에 곁에 있을 수 있는 가족이 있나요?", options: ["있다", "없다"] },
      { key: "livesWith", profileKey: "livesWith", text: "주 보호자와 함께 사나요?", options: ["함께 산다", "따로 산다"] },
      { key: "diagnosis", text: "치매 진단을 받았나요?", options: ["받았다", "아직 받지 않았다"] },
    ],
    scenarios: [
      {
        id: "home-more",
        title: "집에서 돌보며 방문요양 시간 늘리기",
        pros: ["어르신이 익숙한 집에 머문다", "지금 생활을 크게 바꾸지 않아도 된다"],
        cons: ["보호자가 비는 시간이 여전히 남는다", "행동 변화가 심하면 집에서 감당하기 어렵다"],
        cost: { level: "낮음", items: "장기요양 방문요양 본인부담금, 늘린 시간만큼" },
        burden: "가족이 저녁과 주말을 맡는다",
        startNow: "등급이 있으면 지금 이용하는 기관에 시간 조정을 요청할 수 있다",
        rules: [
          { key: "daytime", is: ["있다"], score: 2, reason: "평일 낮에 곁에 있을 가족이 있다고 답하셨어요" },
          { key: "risk", is: ["없었다"], score: 1, reason: "혼자 있을 때 위험했던 일은 없었다고 답하셨어요" },
        ],
        plan: {
          today: ["어떤 변화가 언제부터 있었는지 날짜와 함께 적어 둔다", "지금 이용하는 방문요양 기관에 연락해 변화를 알린다"],
          week: ["방문요양 시간을 늘릴 수 있는지 기관과 공단에 묻는다", "진단을 받지 않았다면 치매안심센터 검진을 예약한다"],
          contacts: ["nhis", "dementiaCall", "dementiaCenter"],
          support: [
            { text: "상태가 바뀌었다면 장기요양 등급 변경 신청이 가능한지 공단에 문의", source: "ltc" },
            { text: "치매안심센터의 검진·상담과 가족 지원 프로그램", source: "nid" },
          ],
          watch: ["혼자 있을 때 위험한 일이 처음 생긴다", "밤에 잠을 거의 자지 않거나 집을 나가려 한다", "보호자가 지쳐 하루를 버티기 어렵다"],
        },
      },
      {
        id: "daycare",
        title: "주야간보호센터 다니기",
        pros: ["평일 낮 돌봄 공백을 메운다", "어르신이 사람들과 어울리고 프로그램에 참여한다"],
        cons: ["센터에 적응하는 시간이 필요하다", "등하원 시간에 맞춰 누군가 준비를 도와야 한다"],
        cost: { level: "중간", items: "장기요양 주야간보호 본인부담금, 식비 등 비급여" },
        burden: "아침 등원 준비와 저녁 돌봄을 가족이 맡는다",
        startNow: "가까운 센터에 자리가 있는지 확인해야 한다. 등급이 필요하다",
        rules: [
          { key: "daytime", is: ["없다"], score: 2, reason: "평일 낮에 곁에 있을 가족이 없다고 답하셨어요" },
          { key: "caregiverWork", is: ["전일 근무"], score: 1, reason: "주 보호자가 전일 근무를 한다고 적으셨어요" },
          { key: "risk", is: ["있었다"], score: 1, reason: "혼자 있을 때 위험했던 일이 있었다고 답하셨어요" },
        ],
        plan: {
          today: ["집에서 다닐 수 있는 거리의 주야간보호센터를 2~3곳 찾는다", "변화를 날짜와 함께 적어 둔다"],
          week: ["센터를 직접 방문해 프로그램과 차량 운행을 확인한다", "공단에 주야간보호 이용 가능 여부와 본인부담을 묻는다"],
          contacts: ["nhis", "dementiaCall"],
          support: [
            { text: "장기요양 재가급여 중 주야간보호 이용", source: "ltc" },
            { text: "등급이 없거나 낮다면 등급 신청·변경 상담", source: "ltc" },
          ],
          watch: ["센터에서 적응하지 못하고 계속 집에 가겠다고 한다", "밤 시간 돌봄이 점점 어려워진다"],
        },
      },
      {
        id: "facility",
        title: "요양원(노인요양시설) 입소 알아보기",
        pros: ["하루 종일 돌봄 인력이 있다", "위험한 상황을 가족 혼자 감당하지 않아도 된다"],
        cons: ["어르신과 가족 모두 마음의 부담이 크다", "좋은 시설은 대기가 길 수 있다"],
        cost: { level: "높음", items: "시설급여 본인부담금, 식비·간식비 등 비급여" },
        burden: "자주 면회하고, 시설과 소통하는 일을 가족이 맡는다",
        startNow: "시설급여를 받을 수 있는 등급인지 먼저 확인해야 한다",
        rules: [
          { key: "risk", is: ["있었다"], score: 2, reason: "혼자 있을 때 위험했던 일이 있었다고 답하셨어요" },
          { key: "daytime", is: ["없다"], score: 1, reason: "평일 낮에 곁에 있을 가족이 없다고 답하셨어요" },
          { key: "change", is: ["성격·행동 (화, 의심, 배회)"], score: 1, reason: "성격·행동 변화가 가장 크다고 답하셨어요" },
        ],
        plan: {
          today: ["가족끼리 입소를 알아보는 것 자체에 동의하는지 이야기한다", "위험했던 일을 날짜와 함께 적어 둔다"],
          week: ["공단에 지금 등급으로 시설급여를 받을 수 있는지 묻는다", "시설 2~3곳을 직접 방문해 비교한다"],
          contacts: ["nhis", "dementiaCall", "communityCenter"],
          support: [
            { text: "장기요양 시설급여 이용 조건과 본인부담 문의", source: "ltc" },
            { text: "시설급여가 어려운 등급이면 등급 변경 신청 상담", source: "ltc" },
          ],
          watch: ["가족이 다치거나 위협을 느끼는 일이 생긴다", "주 보호자의 건강이 나빠진다"],
        },
      },
    ],
  },
  {
    id: "fall",
    title: "갑작스러운 낙상",
    hint: "넘어져서 다쳤거나 걷기 어려워졌어요",
    questions: [
      { key: "treated", text: "병원 진료를 받았나요?", options: ["입원했다", "진료 후 집으로 왔다", "아직 진료를 받지 않았다"] },
      { key: "mobility", text: "지금 걷는 상태는 어떤가요?", options: ["혼자 걸을 수 있다", "부축이 필요하다", "거의 움직이지 못한다"] },
      { key: "daytime", text: "평일 낮에 곁에 있을 수 있는 가족이 있나요?", options: ["있다", "없다"] },
      { key: "livesWith", profileKey: "livesWith", text: "주 보호자와 함께 사나요?", options: ["함께 산다", "따로 산다"] },
      { key: "grade", profileKey: "grade", text: "장기요양등급이 있나요?", options: ["1~2등급", "3~5등급", "인지지원등급", "등급 없음"] },
    ],
    scenarios: [
      {
        id: "home-recover",
        title: "집에서 회복하며 방문요양·복지용구 쓰기",
        pros: ["익숙한 집에서 회복한다", "안전손잡이 같은 복지용구로 다시 넘어질 위험을 줄인다"],
        cons: ["움직이기 어려우면 가족의 손이 많이 간다", "집 안 환경을 바꾸는 데 시간이 든다"],
        cost: { level: "낮음", items: "방문요양 본인부담금, 복지용구 본인부담금" },
        burden: "회복 기간 동안 가족이 자주 들여다봐야 한다",
        startNow: "등급이 있으면 바로 기관과 상의할 수 있다",
        rules: [
          { key: "mobility", is: ["혼자 걸을 수 있다", "부축이 필요하다"], score: 2, reason: "혼자 걷거나 부축하면 걸을 수 있다고 답하셨어요" },
          { key: "daytime", is: ["있다"], score: 1, reason: "평일 낮에 곁에 있을 가족이 있다고 답하셨어요" },
        ],
        plan: {
          today: ["넘어진 곳과 상황을 적어 둔다", "진료를 받지 않았다면 오늘 안에 진료를 받는다"],
          week: ["집 안에서 넘어지기 쉬운 곳(욕실, 문턱, 침대)을 살핀다", "공단에 복지용구와 방문요양 이용을 묻는다"],
          contacts: ["nhis", "communityCenter"],
          support: [
            { text: "장기요양 복지용구(안전손잡이, 미끄럼 방지용품 등) 구입·대여", source: "ltc" },
            { text: "방문요양 시간 조정과 등급 변경 신청 상담", source: "ltc" },
          ],
          watch: ["한 달 안에 또 넘어진다", "통증 때문에 거의 눕기만 한다", "식사량이 눈에 띄게 줄어든다"],
        },
      },
      {
        id: "rehab",
        title: "병원에서 재활하며 회복하기",
        pros: ["전문 인력이 재활을 돕는다", "집에서 돌보기 어려운 시기를 넘길 수 있다"],
        cons: ["입원이 길어지면 근력과 인지가 떨어질 수 있다", "간병을 누가 할지 정해야 한다"],
        cost: { level: "높음", items: "입원비, 간병비(간병인을 쓰는 경우)" },
        burden: "병원 방문과 간병 일정을 가족이 나눠야 한다",
        startNow: "입원 중이라면 병원 사회복지팀과 상의할 수 있다",
        rules: [
          { key: "treated", is: ["입원했다"], score: 2, reason: "지금 입원했다고 답하셨어요" },
          { key: "mobility", is: ["거의 움직이지 못한다"], score: 2, reason: "거의 움직이지 못한다고 답하셨어요" },
        ],
        plan: {
          today: ["담당 의료진에게 예상 입원 기간과 재활 계획을 묻는다", "간병을 누가 맡을지 가족과 정한다"],
          week: ["병원 사회복지팀에 퇴원 뒤 돌봄 계획을 상의한다", "퇴원 후 필요한 서비스를 공단에 미리 묻는다"],
          contacts: ["hospitalSW", "nhis"],
          support: [
            { text: "퇴원 뒤 장기요양 서비스 조정과 등급 변경 신청 상담", source: "ltc" },
          ],
          watch: ["입원이 길어지며 정신이 흐려지거나 기운이 크게 떨어진다", "간병하는 가족이 지친다"],
        },
      },
      {
        id: "short-stay",
        title: "단기보호나 가족 교대로 회복 기간 넘기기",
        pros: ["회복하는 몇 주 동안만 돌봄을 늘린다", "가족 한 사람에게 부담이 몰리지 않는다"],
        cons: ["일정을 짜고 지키는 데 품이 든다", "단기보호는 자리가 없을 수 있다"],
        cost: { level: "중간", items: "단기보호 본인부담금, 식비 등 비급여" },
        burden: "가족이 교대 일정을 나눠 맡는다",
        startNow: "등급이 있어야 단기보호를 쓸 수 있다",
        rules: [
          { key: "daytime", is: ["없다"], score: 2, reason: "평일 낮에 곁에 있을 가족이 없다고 답하셨어요" },
          { key: "livesWith", is: ["따로 산다"], score: 1, reason: "주 보호자와 따로 산다고 답하셨어요" },
        ],
        plan: {
          today: ["회복에 몇 주가 걸릴지 의료진에게 묻는다", "가족 단체방에 교대 일정을 올린다"],
          week: ["가까운 단기보호 기관에 자리가 있는지 확인한다", "공단에 단기보호 이용 가능 여부를 묻는다"],
          contacts: ["nhis", "communityCenter"],
          support: [
            { text: "장기요양 재가급여 중 단기보호 이용", source: "ltc" },
          ],
          watch: ["교대 일정이 자주 비어 어르신이 혼자 있게 된다", "회복이 예상보다 늦어진다"],
        },
      },
    ],
  },
  {
    id: "caregiver",
    title: "주 보호자가 돌볼 수 없게 됨",
    hint: "아프거나, 출장·출근 때문에 돌볼 수 없어요",
    questions: [
      { key: "reason", text: "왜 돌볼 수 없게 됐나요?", options: ["질병·입원", "출장·출근 공백", "지쳐서 쉬어야 한다"] },
      { key: "duration", text: "얼마 동안인가요?", options: ["며칠", "몇 주", "기한이 없다"] },
      { key: "otherFamily", text: "대신 돌볼 수 있는 다른 가족이 있나요?", options: ["있다", "없다"] },
      { key: "livesWith", profileKey: "livesWith", text: "주 보호자와 함께 사나요?", options: ["함께 산다", "따로 산다"] },
      { key: "services", profileKey: "services", text: "지금 받는 서비스가 있나요?", options: ["없음", "방문요양", "주야간보호", "요양시설"] },
    ],
    scenarios: [
      {
        id: "family-rotation",
        title: "다른 가족과 교대 일정 짜기",
        pros: ["비용이 거의 들지 않는다", "어르신이 아는 사람에게 돌봄을 받는다"],
        cons: ["가족 사이에 부담이 고르지 않으면 갈등이 생긴다", "기간이 길어지면 버티기 어렵다"],
        cost: { level: "낮음", items: "교통비 등 가족이 쓰는 비용" },
        burden: "다른 가족이 시간을 내야 한다",
        startNow: "오늘 가족에게 연락해 바로 시작할 수 있다",
        rules: [
          { key: "otherFamily", is: ["있다"], score: 2, reason: "대신 돌볼 수 있는 다른 가족이 있다고 답하셨어요" },
          { key: "duration", is: ["며칠"], score: 1, reason: "며칠 동안이라고 답하셨어요" },
        ],
        plan: {
          today: ["돌봐야 하는 시간표(식사, 약, 병원)를 한 장으로 적는다", "가족에게 맡을 수 있는 날을 묻는다"],
          week: ["교대 일정을 가족 모두가 보는 곳에 올린다", "비는 시간이 있으면 서비스 추가를 함께 알아본다"],
          contacts: ["nhis"],
          support: [
            { text: "비는 시간을 메울 방문요양 시간 조정 상담", source: "ltc" },
          ],
          watch: ["교대 일정이 자주 바뀌거나 비는 날이 생긴다", "다른 가족이 지쳤다고 말한다"],
        },
      },
      {
        id: "more-service",
        title: "그 기간만 서비스 늘리기",
        pros: ["가족 부담 없이 돌봄 공백을 메운다", "지금 다니는 기관과 바로 상의할 수 있다"],
        cons: ["늘린 만큼 본인부담이 늘어난다", "원하는 시간대에 인력이 없을 수 있다"],
        cost: { level: "중간", items: "방문요양·주야간보호 본인부담금, 늘린 시간만큼" },
        burden: "기관과 일정 조율을 누군가 맡는다",
        startNow: "지금 받는 서비스가 있으면 바로 상의할 수 있다",
        rules: [
          { key: "services", is: ["방문요양", "주야간보호"], score: 2, reason: "지금 방문요양이나 주야간보호를 받고 있다고 적으셨어요" },
          { key: "reason", is: ["출장·출근 공백"], score: 1, reason: "출장·출근 공백 때문이라고 답하셨어요" },
        ],
        plan: {
          today: ["지금 이용하는 기관에 연락해 늘릴 수 있는 시간을 묻는다", "비는 시간대를 적어 둔다"],
          week: ["공단에 늘린 시간의 본인부담을 확인한다", "서비스가 없다면 주야간보호센터를 알아본다"],
          contacts: ["nhis", "communityCenter"],
          support: [
            { text: "장기요양 재가급여(방문요양, 주야간보호) 이용 조정", source: "ltc" },
          ],
          watch: ["기관에서 시간을 늘리기 어렵다고 한다", "기간이 처음 예상보다 길어진다"],
        },
      },
      {
        id: "respite",
        title: "단기보호로 잠시 맡기기",
        pros: ["며칠에서 몇 주 동안 하루 종일 돌봄을 받는다", "주 보호자가 치료나 휴식에 집중할 수 있다"],
        cons: ["어르신이 낯선 곳에서 불안해할 수 있다", "자리가 없을 수 있다"],
        cost: { level: "중간", items: "단기보호 본인부담금, 식비 등 비급여" },
        burden: "입소 준비와 면회를 가족이 맡는다",
        startNow: "등급이 있어야 하고, 기관에 자리가 있는지 확인해야 한다",
        rules: [
          { key: "otherFamily", is: ["없다"], score: 2, reason: "대신 돌볼 다른 가족이 없다고 답하셨어요" },
          { key: "reason", is: ["질병·입원", "지쳐서 쉬어야 한다"], score: 1, reason: "주 보호자가 아프거나 쉬어야 한다고 답하셨어요" },
        ],
        plan: {
          today: ["가까운 단기보호 기관에 자리가 있는지 묻는다", "어르신이 드시는 약과 생활 습관을 한 장에 적는다"],
          week: ["공단에 단기보호 이용 가능 일수와 본인부담을 묻는다", "치매가 있다면 가족휴가제를 쓸 수 있는지 함께 묻는다"],
          contacts: ["nhis", "dementiaCall"],
          support: [
            { text: "장기요양 재가급여 중 단기보호 이용", source: "ltc" },
            { text: "치매 어르신 가족을 위한 가족휴가제 이용 가능 여부 문의", source: "ltc" },
          ],
          watch: ["주 보호자의 회복이 길어진다", "어르신이 단기보호 뒤 상태가 나빠진다"],
        },
      },
    ],
  },
];

// "기타 / 잘 모르겠어요"를 고르거나 상황에 맞는 시나리오가 없을 때 보여 주는 공통 기본 플랜
const DEFAULT_PLAN = {
  title: "공통 기본 플랜",
  plan: {
    today: ["무엇이 언제부터 달라졌는지 날짜와 함께 적어 둔다", "다니는 병원이 있다면 달라진 점을 담당 의료진에게 알린다"],
    week: ["공단에 지금 상태로 바꿀 수 있는 서비스가 있는지 묻는다", "가족과 누가 무엇을 맡을지 이야기한다"],
    contacts: ["nhis", "dementiaCall", "communityCenter"],
    support: [
      { text: "장기요양 서비스 조정과 등급 변경 신청 상담", source: "ltc" },
    ],
    watch: ["식사·잠·대소변 습관이 갑자기 달라진다", "혼자 있을 때 위험한 일이 생긴다", "주 보호자가 더는 버티기 어렵다"],
  },
};
