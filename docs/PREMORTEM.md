**PREMORTEM.md**

Team: Team10 4K  
Members: 김영균, 백민경, 유정민, 한수연  
Merged on: 2026-10-07  
Last updated: 2026-10-08

**1\. Individual lists**

| Member | File | Written on | Causes listed |
| :---- | :---- | :---- | :---- |
| 김영균 | docs/premortem/김영균.md | \[2026-10-07\] | \[9\] |
| 백민경 | docs/premortem/백민경.md | \[2026-10-07\] | \[7\] |
| 유정민 | docs/premortem/유정민.md | \[2026-10-07\] | \[5\] |
| 한수연 | docs/premortem/한수연.md | \[2026-10-07\] | \[5\] |

**2\. Read-out**

Done.

**3\. The merged list**

| \# | Failure cause (past tense, specific) | Problem cluster | Raised by | How many |
| :---- | :---- | :---- | :---- | :---- |
| 1 | 실제 현장 workflow와 확보 가능한 데이터를 충분히 확인하기 전에 제품을 설계해 필요한 입력정보·서류·기능 일부가 실제로는 없거나 접근하기 어려웠고 결국 Demo에서 핵심 기능이 빠지거나 신뢰도 낮은 결과가 나왔다. | 실사용 가능성 | 김영균, 백민경, 유정민, 한수연 | 4 |
| 2 | (us) 핵심 구현과 디버깅 역량이 일부 팀원에게 집중되거나 충분하지 않아 예외처리와 오류를 제때 해결하지 못했고, 충분한 QA 없이 Demo Day를 맞거나 화면이 멈추는 문제가 발생했다.  | 데모 안정성 | 김영균, 백민경, 유정민, 한수연 | 4 |
| 3 | (us) 팀원마다 기대하는 완성도·개발 속도·업무량에 대한 그림이 달랐지만 서로 배려하며 명확히 조율하지 않아 실제 진척이 멈추거나 역할 불균형과 갈등이 생겼고, 기능 통합·검증·발표 준비가 늦어졌다.  | 팀 Alignment | 김영균, 백민경, 유정민, 한수연 | 4 |
| 4 | 한 가족의 강한 사례와 AI·desk research에 과도하게 의존해 실제 타깃 보호자를 충분히 만나지 않았고, 과잉·부적합 구매가 반복되는 실제 pain인지 증명하지 못한 채 제품 스펙을 확정했다. | 문제 검증 | 김영균, 백민경, 한수연 | 3 |
| 5 | 기존 장기요양 플랫폼과 일반 ChatGPT 대비 차이를 검증하지 않아, Demo Day에서 “이미 있는 서비스와 무엇이 다른가”, “왜 별도 AI 서비스가 필요한가”라는 질문에 답하지 못했고 AI-native라기보다 rule-based 제품이라는 평가를 받았다. | 제품 차별성 | 김영균, 백민경, 한수연 | 3 |
| 6 | 복지용구 필요 조건을 recommendation rule로 충분히 구조화하지 못해 AI가 불필요한 품목을 권하거나 필요한 품목을 보류했고, 추천의 정확성과 신뢰성을 증명하지 못했다. | 추천 신뢰성 | 김영균, 백민경 | 2 |
| 7 | 판매수수료를 배제한 뒤 실제 payer와 willingness-to-pay를 검증하지 않아 누가 왜 돈을 내는지 답하지 못했고, 일회성 서비스의 시장성과 확장성을 설명하지 못했다. | 사업 지속가능성 | 김영균, 백민경 | 2 |
| 8 | 등급 직후 보호자는 정신이 없는 상황에서 외부 세컨드 오피니언을 따로 찾지 않았고, 결국 팀 밖 실제 사용자를 확보하지 못해 서비스가 필요한 순간에 고객에게 도달하지 못했다. | 고객 도달 | 김영균 | 1 |
| 9 | (us) 발표 전날 AI 코드리뷰 에이전트에 과도한 권한을 주고 백업 없이 실행해 GitHub 프로젝트를 손상시켰다.  | 변경 안전성 | 김영균 | 1 |
| 10 | 제품 개발과 반복적인 방향 변경에 집중한 나머지 발표자료와 스토리라인 준비를 마감 직전까지 미뤘고, Demo Day에 문제–해결–검증 논리를 일관되게 설명하지 못했다. | 발표 준비 | 유정민 | 1 |

**4\. What only one person saw**

| Cause | Raised by | What we decided to do about it |
| :---- | :---- | :---- |
| 서비스가 필요한 순간 보호자가 별도의 세컨드 오피니언을 찾지 않아 실제 사용자를 확보하지 못했다. | 김영균 | 사용자 인터뷰에서 이 서비스가 있었다면 썼을지뿐 아니라 언제, 어디서 이런 서비스를 발견할 수 있었을지도 함께 묻고 초기 유입 경로를 검증한다. |
| AI agent에 과도한 권한을 주고 백업 없이 실행해 프로젝트를 손상시켰다. | 김영균 | main branch 보호, 자동 백업, AI agent의 write 권한 제한을 개발 규칙에 넣는다. |
| 제품 개발에 집중하느라 발표자료와 스토리라인을 늦게 준비했다. | 유정민 | Demo Day 1주 전 feature freeze를 두고, 발표 3일 전까지 발표자료 완성 후 발표 전 전체 리허설을 진행한다. |

**5\. The three we act on**

| \# | Failure cause | Early warning signal — what we would actually observe, and when | Countermeasure — the action | Owner | By when |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 1 | 팀원마다 기대하는 완성도·개발 속도·업무량에 대한 그림이 달랐지만 이를 명확히 조율하지 않아 실제 진척이 멈추거나 역할 불균형과 갈등이 생겼고, 기능 통합·검증·발표 준비가 늦어졌다.  | 담당 task의 deadline 또는 정기회의 시간을 기준으로 24시간 이상 응답이 없거나 연락이 두절되는 경우. 정기회의 중 논의가 중단될 정도의 감정적 충돌이 발생하는 경우. | 주 1회 정기회의 를 통해 진행 상황을 투명하게 공유하고, 일정을 차질없이 관리한다. 각 task마다 Lead 1명과 Supporter 1명을 지정하고, 업무 진행뿐 아니라 일정상·심리적으로 어려운 점도 서로 챙긴다. | 백민경 \*Supporter: 김영균 | 2026-10-10  이후 매주  |
| 2 | 실제 타깃 보호자를 충분히 만나지 않아 과잉·부적합 구매가 반복되는 실제 pain인지 검증하지 못한 채 제품 스펙을 확정했다. | 10월 25일까지 등급 직후 복지용구 구매 경험이 있는 보호자 인터뷰 대상 5명을 확보하지 못하는 경우  | 타깃 보호자 5명 인터뷰  결과, 우리 제품에 대한 니즈가 충분히 확인되지 않으면 현재 solution을 고집하지 않고 문제 정의 또는 solution을 pivot한다. | 한수연 \*Supporter: 유정민 | 2026-10-31  |
| 3 | 복지용구 필요 조건을 recommendation rule로 충분히 구조화하지 못해 Demo에서 핵심 기능이 빠지거나 신뢰도가 낮은 추천 결과가 나왔다.  | 11월 13일까지 인터뷰이에게 보여줄 수준의 end-to-end demo를 완성하지 못하는 경우 | 타깃 보호자 인터뷰이 5명에게 중간 demo를 테스트하고, 틀린 추천·판단 보류·이해하기 어려운 결과를 기록해 recommendation rule을 수정한다.  | 김영균 \*Supporter: 유정민 | 2026-11-15 |

**Revision log**

Any change of direction needs a new row here within one week.  
A premortem that analyzes a product you no longer build is worse than none, because it reads as covered.

| Date | What changed and why |
| :---- | :---- |
| \[2026-10-08\] | Draft for consultation |
| \[YYYY-MM-DD\] | Revised after consultation on \[date\]: \[what changed\] |

Method note: Gary Klein, "Performing a Project Premortem", Harvard Business Review, September 2007\.