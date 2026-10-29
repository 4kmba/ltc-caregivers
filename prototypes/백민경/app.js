// 위기 시나리오별 액션 플랜 P0. 내용은 data.js, 화면 흐름은 이 파일이 맡는다.
// 흐름: 처음 화면 → 꼬리 질문 → 시나리오 카드 → 액션 플랜
// 응급 대응은 다루지 않는다. 심한 사고라면 119 신고가 끝난 뒤 돌봄 차원에서 할 일을 찾는 용도다.

const PROFILE_KEY = "ltc-actionplan-profile";

const state = {
  view: "home",
  situationId: null,
  answers: {},
  scenarioId: null,
};

// 브라우저 저장소는 사생활 보호 모드 등에서 막힐 수 있어 실패해도 화면은 그대로 동작하게 한다
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    alert("이 브라우저에서는 가족 정보를 저장할 수 없어요. 이번 사용 중에만 반영됩니다.");
  }
}

function clearAll() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (e) {
    // 저장된 것이 없으면 지울 것도 없다
  }
}

let profile = loadProfile();

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "onclick") node.addEventListener("click", v);
    else if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function go(view, patch) {
  Object.assign(state, patch || {}, { view });
  render();
  window.scrollTo(0, 0);
}

function currentSituation() {
  return SITUATIONS.find((s) => s.id === state.situationId) || null;
}

// 가족 정보에 이미 답이 있는 질문은 다시 묻지 않는다
function visibleQuestions(situation) {
  return situation.questions.filter((q) => !(q.profileKey && profile[q.profileKey]));
}

function mergedAnswers() {
  return { ...profile, ...state.answers };
}

function rankScenarios(situation) {
  const answers = mergedAnswers();
  const scored = situation.scenarios.map((sc, index) => {
    const matched = sc.rules.filter((r) => r.is.includes(answers[r.key]));
    const score = matched.reduce((sum, r) => sum + r.score, 0);
    const top = matched.slice().sort((a, b) => b.score - a.score)[0];
    return { sc, index, score, reason: top ? top.reason : null };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  // 점수가 같은 카드가 둘 이상이면 어느 하나를 골라 표시하지 않는다
  const best = scored[0];
  const tied = scored.length > 1 && scored[1].score === best.score;
  return scored.map((item, i) => ({ ...item, fits: i === 0 && best.score > 0 && !tied }));
}

function sourceLine(sourceId) {
  const src = SOURCES[sourceId];
  if (!src) return null;
  const when = src.verifiedAt ? `확인 ${src.verifiedAt}` : "확인 전";
  return el("p", { class: "source" },
    "출처: ",
    src.url ? el("a", { href: src.url, target: "_blank", rel: "noopener" }, src.name) : src.name,
    ` · ${src.type} · ${when}`);
}

function header(title, backTo) {
  return el("header", { class: "top" },
    backTo ? el("button", { class: "back", onclick: () => go(backTo) }, "← 뒤로") : null,
    el("h1", {}, title));
}

function footer() {
  return el("footer", {},
    el("p", {}, "참고용 정보이며 의료·법률 판단을 대신하지 않습니다."));
}

function viewHome() {
  const filled = PROFILE_FIELDS.filter((f) => profile[f.key]).length;
  return [
    header("상황이 바뀌었나요?"),
    el("p", { class: "lead" }, "지금 상황을 고르면, 할 일과 선택지를 한 장으로 정리해 드려요."),
    el("div", { class: "cards" },
      SITUATIONS.map((s) =>
        el("button", { class: "card situation", onclick: () => go("questions", { situationId: s.id, answers: {}, scenarioId: null }) },
          el("strong", {}, s.title), el("span", {}, s.hint))),
      el("button", { class: "card situation other", onclick: () => go("plan", { situationId: "other", answers: {}, scenarioId: null }) },
        el("strong", {}, "기타 / 잘 모르겠어요"), el("span", {}, "공통으로 먼저 할 일을 보여 드려요"))),
    el("section", { class: "profile-box" },
      el("p", {}, filled ? `가족 정보 ${filled}/${PROFILE_FIELDS.length}개를 적어 두셨어요. 이미 적은 내용은 다시 묻지 않아요.` : "가족 정보를 미리 적어 두면 질문이 줄어요."),
      el("button", { class: "secondary", onclick: () => go("profile") }, filled ? "가족 정보 고치기" : "가족 정보 적기"),
      el("button", {
        class: "link danger",
        onclick: () => {
          if (confirm("이 휴대폰에 저장된 가족 정보를 모두 지울까요?")) {
            clearAll();
            profile = {};
            render();
          }
        },
      }, "모든 기록 지우기")),
    footer(),
  ];
}

function chips(options, selected, onPick) {
  return el("div", { class: "chips" },
    options.map((opt) =>
      el("button", { class: opt === selected ? "chip on" : "chip", "aria-pressed": String(opt === selected), onclick: () => onPick(opt) }, opt)));
}

function viewProfile() {
  const draft = { ...profile };
  const body = el("div", { class: "questions" });
  const draw = () => {
    body.replaceChildren(...PROFILE_FIELDS.map((f) =>
      el("div", { class: "question" },
        el("p", {}, f.label),
        chips(f.options, draft[f.key], (opt) => {
          if (draft[f.key] === opt) delete draft[f.key];
          else draft[f.key] = opt;
          draw();
        }))));
  };
  draw();
  return [
    header("가족 정보", "home"),
    el("p", { class: "lead" }, "이 정보는 이 휴대폰의 브라우저에만 저장돼요. 모르는 항목은 비워 두세요."),
    body,
    el("button", { class: "primary", onclick: () => { profile = draft; saveProfile(profile); go("home"); } }, "저장하기"),
    footer(),
  ];
}

function viewQuestions() {
  const situation = currentSituation();
  const qs = visibleQuestions(situation);
  const body = el("div", { class: "questions" });
  const draw = () => {
    body.replaceChildren(...qs.map((q) =>
      el("div", { class: "question" },
        el("p", {}, q.text),
        chips([...q.options, UNKNOWN], state.answers[q.key], (opt) => {
          if (state.answers[q.key] === opt) delete state.answers[q.key];
          else state.answers[q.key] = opt;
          draw();
        }))));
  };
  draw();
  return [
    header(situation.title, "home"),
    el("p", { class: "lead" }, "아는 것만 눌러 주세요. 다 답하지 않아도 괜찮아요."),
    body,
    el("button", { class: "primary", onclick: () => go("scenarios") }, "시나리오 보기"),
    footer(),
  ];
}

function viewScenarios() {
  const situation = currentSituation();
  const ranked = rankScenarios(situation);
  return [
    header("선택지를 비교해 보세요", "questions"),
    el("p", { class: "lead" }, "어느 쪽이 맞는지는 가족이 정해요. 카드를 누르면 할 일이 나와요."),
    el("div", { class: "cards" },
      ranked.map(({ sc, fits, reason }) =>
        el("button", { class: fits ? "card scenario fits" : "card scenario", onclick: () => go("plan", { scenarioId: sc.id }) },
          fits ? el("span", { class: "badge" }, "우리 상황과 잘 맞을 수 있음") : null,
          fits ? el("span", { class: "why" }, reason) : null,
          el("strong", {}, sc.title),
          el("dl", {},
            el("dt", {}, "장점"), el("dd", {}, sc.pros.join(" · ")),
            el("dt", {}, "단점"), el("dd", {}, sc.cons.join(" · ")),
            el("dt", {}, "비용"), el("dd", {}, `${sc.cost.level} — ${sc.cost.items}`),
            el("dt", {}, "가족 부담"), el("dd", {}, sc.burden),
            el("dt", {}, "바로 시작"), el("dd", {}, sc.startNow)),
          el("span", { class: "more" }, "할 일 보기 →")))),
    footer(),
  ];
}

function listSection(title, items) {
  return el("section", { class: "plan-sec" }, el("h2", {}, title), el("ul", {}, items.map((t) => el("li", {}, t))));
}

function viewPlan() {
  const situation = currentSituation();
  const scenario = situation ? situation.scenarios.find((s) => s.id === state.scenarioId) : null;
  const title = scenario ? scenario.title : DEFAULT_PLAN.title;
  const plan = scenario ? scenario.plan : DEFAULT_PLAN.plan;

  // 답하지 않았거나 "잘 모르겠어요"라고 답한 질문은 "확인할 것"으로 남긴다
  const unknowns = situation
    ? visibleQuestions(situation).filter((q) => !state.answers[q.key] || state.answers[q.key] === UNKNOWN).map((q) => q.text)
    : [];

  return [
    header(title, situation ? "scenarios" : "home"),
    listSection("오늘 할 일", plan.today),
    listSection("이번 주 할 일", plan.week),
    el("section", { class: "plan-sec" },
      el("h2", {}, "연락할 곳"),
      plan.contacts.map((id) => {
        const c = CONTACTS[id];
        return el("div", { class: "contact" },
          el("strong", {}, c.name),
          c.phone ? el("a", { class: "tel", href: `tel:${c.phone}` }, c.phone) : null,
          el("p", {}, c.what),
          c.source ? sourceLine(c.source) : null);
      })),
    el("section", { class: "plan-sec" },
      el("h2", {}, "신청할 수 있는 제도·지원"),
      el("ul", {}, plan.support.map((s) => el("li", {}, s.text, sourceLine(s.source))))),
    listSection("앞으로 지켜볼 신호", plan.watch.map((w) => `${w} → 이런 일이 생기면 다시 열어 보세요`)),
    unknowns.length
      ? listSection("확인할 것", unknowns)
      : null,
    el("button", { class: "secondary", onclick: () => go("home") }, "처음으로"),
    footer(),
  ];
}

const VIEWS = {
  home: viewHome,
  profile: viewProfile,
  questions: viewQuestions,
  scenarios: viewScenarios,
  plan: viewPlan,
};

function render() {
  document.getElementById("app").replaceChildren(...VIEWS[state.view]().filter(Boolean));
}

render();
