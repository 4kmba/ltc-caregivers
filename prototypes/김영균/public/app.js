// 화면 흐름: 시작 → 고정 질문 8개 → 보충 질문 → 할 일 목록.
// AI가 쓴 글은 innerHTML로 넣지 않고 textContent로만 넣는다.
const app = document.getElementById("app");
const STORE_KEY = "care-todo:v1";
const BUCKET_LABELS = { this_week: "이번 주", this_month: "이번 달", know_ahead: "미리 알아둘 것" };
const PHONE = /(1\d{3}-\d{4}|\b(?:119|112|129|109|182|1350)\b)/g;

const state = { questions: [], step: 0, answers: {}, followups: [], plan: null, checks: {} };

// 브라우저 저장소는 막혀 있을 수 있어 실패해도 화면은 그대로 동작하게 한다.
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) ?? null;
  } catch {
    return null;
  }
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ answers: state.answers, plan: state.plan, checks: state.checks }));
  } catch {}
}
function clearSaved() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// 연락처 글 속 전화번호를 눌러서 걸 수 있게 만든다.
function withPhoneLinks(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(PHONE)) {
    parts.push(text.slice(last, m.index));
    parts.push(el("a", { href: `tel:${m[0].replace(/-/g, "")}` }, m[0]));
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

function render(...nodes) {
  app.replaceChildren(...nodes.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false));
  window.scrollTo(0, 0);
}

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

function loading(message) {
  render(el("div", { class: "loading" }, el("div", { class: "spinner" }), el("p", {}, message)));
}

// ---- 시작 화면 ----
function showIntro() {
  const saved = load();
  render(
    el("h1", {}, "지금 무엇부터 해야 할지 정리해 드려요"),
    el("p", {}, "몇 가지만 답하시면 지금 할 일을 정리해 드려요. 3분쯤 걸려요."),
    el("p", { class: "muted" }, "이름, 연락처, 주소는 묻지 않아요. 답은 이 휴대폰에만 남고 서버에는 저장하지 않아요."),
    saved?.plan
      ? [
          el("button", { class: "primary", onclick: () => restore(saved) }, "지난번 목록 이어 보기"),
          el("button", { class: "secondary", onclick: startOver }, "처음부터 다시 하기")
        ]
      : el("button", { class: "primary", onclick: () => showQuestion(0) }, "시작")
  );
}

function restore(saved) {
  state.answers = saved.answers ?? {};
  state.plan = saved.plan;
  state.checks = saved.checks ?? {};
  showPlan();
}

function startOver() {
  clearSaved();
  Object.assign(state, { step: 0, answers: {}, followups: [], plan: null, checks: {} });
  showQuestion(0);
}

// ---- 고정 질문 ----
function fieldDone(field) {
  const v = state.answers[field.key];
  return field.type === "many" ? Array.isArray(v) && v.length > 0 : Boolean(v);
}

function choose(field, value) {
  if (field.type === "one") {
    state.answers[field.key] = value;
    return;
  }
  const current = new Set(state.answers[field.key] ?? []);
  const exclusive = field.exclusive ?? [];
  if (current.has(value)) current.delete(value);
  else if (exclusive.includes(value)) current.clear(), current.add(value);
  else {
    exclusive.forEach((x) => current.delete(x));
    current.add(value);
  }
  state.answers[field.key] = [...current];
}

function isChosen(field, value) {
  const v = state.answers[field.key];
  return field.type === "many" ? (v ?? []).includes(value) : v === value;
}

function showQuestion(i) {
  state.step = i;
  const q = state.questions[i];
  const total = state.questions.length;
  const next = el("button", { class: "primary", onclick: () => (i + 1 < total ? showQuestion(i + 1) : showFollowups()) }, i + 1 < total ? "다음" : "다 답했어요");
  const refresh = () => (next.disabled = !q.fields.every(fieldDone));

  const fields = q.fields.map((field) => {
    const buttons = field.options.map((opt) => {
      const b = el("button", { class: "chip", "aria-pressed": String(isChosen(field, opt.value)) }, opt.label);
      b.addEventListener("click", () => {
        choose(field, opt.value);
        for (const [btn, o] of buttons.map((x, k) => [x, field.options[k]])) btn.setAttribute("aria-pressed", String(isChosen(field, o.value)));
        refresh();
      });
      return b;
    });
    return el("div", { class: "field" }, field.label ? el("div", { class: "field-label" }, field.label) : null, el("div", { class: "chips" }, buttons));
  });
  refresh();

  render(
    el("div", { class: "progress" }, el("span", {}, q.group), el("span", {}, `${i + 1} / ${total}`)),
    el("div", { class: "bar" }, el("span", { style: `width:${((i + 1) / total) * 100}%` })),
    el("h2", {}, q.title),
    q.hint ? el("p", { class: "muted" }, q.hint) : null,
    fields,
    el("div", { class: "nav" }, i > 0 ? el("button", { class: "secondary", onclick: () => showQuestion(i - 1) }, "이전") : null, next)
  );
}

// ---- 보충 질문 ----
async function showFollowups() {
  loading("답을 보고 몇 가지만 더 여쭤볼게요");
  let list = [];
  try {
    list = (await post("/api/followups", { answers: state.answers })).questions;
  } catch {}
  // 보충 질문을 만들지 못하면 건너뛰고 목록으로 간다.
  if (!list.length) return makePlan([]);
  state.followups = list.map((q) => ({ ...q, answer: "" }));

  const blocks = state.followups.map((f) => {
    const box = el("textarea", { placeholder: "직접 적어도 돼요", "aria-label": f.text });
    box.addEventListener("input", () => {
      f.answer = box.value;
      chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
    });
    const chips = f.options.map((o) =>
      el("button", {
        class: "chip",
        "aria-pressed": "false",
        onclick: (e) => {
          f.answer = o;
          box.value = "";
          chips.forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget)));
        }
      }, o)
    );
    return el("div", { class: "field" }, el("div", { class: "field-label" }, f.text), el("div", { class: "chips" }, chips), box);
  });

  render(
    el("div", { class: "progress" }, el("span", {}, "보충 질문"), el("span", {}, "건너뛰어도 돼요")),
    el("h2", {}, "조금만 더 알려 주세요"),
    blocks,
    el("button", { class: "primary", onclick: () => makePlan(state.followups) }, "할 일 목록 받기"),
    el("button", { class: "link", onclick: () => makePlan([]) }, "건너뛰기")
  );
}

// ---- 할 일 목록 ----
async function makePlan(followups) {
  state.answers.followups = followups.filter((f) => f.answer.trim()).map((f) => ({ question: f.text, answer: f.answer.trim() }));
  state.plan = null;
  loading("지금 할 일을 정리하고 있어요");
  const planRequest = post("/api/plan", { answers: state.answers });
  planRequest.catch(() => {});
  let failed = false;
  const showFailed = () =>
    render(el("h2", {}, "목록을 받지 못했어요"), el("p", {}, "인터넷 연결을 확인하고 다시 시도해 주세요."), el("button", { class: "primary", onclick: () => makePlan(followups) }, "다시 시도"), helpFooter());

  // 응급 신호가 있으면 목록을 기다리지 않고 안내부터 띄운다.
  let emergency = [];
  try {
    emergency = (await post("/api/emergency", { answers: state.answers })).emergency;
  } catch {}
  let bannerOpen = emergency.length > 0;
  if (bannerOpen) {
    render(emergencyBanner(emergency, () => {
      bannerOpen = false;
      if (state.plan) showPlan(true);
      else if (failed) showFailed();
      else loading("지금 할 일을 정리하고 있어요");
    }));
  }

  try {
    state.plan = await planRequest;
  } catch {
    failed = true;
    if (!bannerOpen) showFailed();
    return;
  }
  state.checks = {};
  save();
  if (!bannerOpen) showPlan(emergency.length > 0);
}

function emergencyBanner(kinds, onClose) {
  return el(
    "section",
    { class: "emergency", role: "alert" },
    el("h2", {}, "지금 바로 도움을 받으세요"),
    el("p", {}, "적어 주신 내용에 위급할 수 있는 상황이 있어요. 할 일 목록보다 먼저 전화해 주세요."),
    el("a", { class: "call", href: "tel:119" }, "119 응급 신고 (의식이 없거나 다칠 위험이 있을 때)"),
    kinds.includes("suicide") ? el("a", { class: "call", href: "tel:109" }, "109 자살예방상담전화 (24시간)") : null,
    el("a", { class: "call soft", href: "tel:15770199" }, "1577-0199 정신건강위기상담전화 (24시간)"),
    el("button", { class: "secondary", onclick: onClose }, "안내를 닫고 목록 보기")
  );
}

function helpFooter() {
  return el(
    "div",
    { class: "footer-help" },
    el("strong", {}, "더 궁금하면 "),
    el("a", { href: "tel:15771000" }, "국민건강보험공단 장기요양 상담 1577-1000"),
    el("p", { class: "muted" }, "평일 업무 시간에 등급, 서비스, 비용을 상담할 수 있어요.")
  );
}

function sourceList(sources) {
  return el(
    "div",
    { class: "sources" },
    "출처: ",
    sources.map((s, i) => [i ? " · " : "", el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.title), s.checked ? ` (${s.checked} 확인)` : " (출처 확인 전)"])
  );
}

function todoCard(item) {
  const { card } = item;
  const box = el("input", { type: "checkbox", "aria-label": `${card.title} 끝냄` });
  box.checked = Boolean(state.checks[card.id]);
  const wrap = el("article", { class: `todo${box.checked ? " done" : ""}` });
  box.addEventListener("change", () => {
    state.checks[card.id] = box.checked;
    wrap.classList.toggle("done", box.checked);
    save();
  });

  const asks = card.questions.map((q, qi) => {
    const slot = el("div");
    const btn = el("button", { class: "ask", "aria-expanded": "false" }, `Q. ${q}`);
    btn.addEventListener("click", async () => {
      if (btn.getAttribute("aria-expanded") === "true") {
        btn.setAttribute("aria-expanded", "false");
        slot.replaceChildren();
        return;
      }
      btn.setAttribute("aria-expanded", "true");
      slot.replaceChildren(el("p", { class: "muted" }, "답을 정리하고 있어요..."));
      try {
        const res = await post("/api/answer", { answers: state.answers, card_id: card.id, q_index: qi });
        slot.replaceChildren(
          el("div", { class: "answer" },
            res.urgent ? el("p", { class: "urgent" }, "위급할 수 있는 상황이면 먼저 119에 전화하세요.") : null,
            el("p", {}, res.text),
            res.medical ? el("p", { class: "medical" }, "일반적인 정보예요. 진단과 치료는 주치의와 상의하세요.") : null,
            sourceList(res.sources))
        );
      } catch {
        slot.replaceChildren(el("p", { class: "muted" }, "답을 불러오지 못했어요. 다시 눌러 주세요."));
        btn.setAttribute("aria-expanded", "false");
      }
    });
    return [btn, slot];
  });

  wrap.append(
    el("div", { class: "todo-head" }, box, el("div", { class: "todo-title" }, card.title)),
    el("p", { class: "why" }, item.why),
    el("p", { class: "meta" }, el("strong", {}, "연락처 "), withPhoneLinks(card.contact)),
    ...asks.flat(),
    sourceList(card.sources)
  );
  return wrap;
}

function showPlan(skipEmergency = false) {
  const plan = state.plan;
  if (!skipEmergency && plan.emergency?.length) {
    render(emergencyBanner(plan.emergency, () => showPlan(true)));
    return;
  }
  const sections = Object.entries(BUCKET_LABELS).map(([bucket, label]) => {
    const items = plan.items.filter((it) => it.bucket === bucket);
    return items.length ? el("section", {}, el("h3", {}, `${label} (${items.length})`), items.map(todoCard)) : null;
  });
  render(
    el("h2", {}, "지금 할 일"),
    plan.notice ? el("p", { class: "notice" }, plan.notice) : null,
    sections,
    helpFooter(),
    el("p", { class: "muted" }, "할 일 카드는 공개 자료를 바탕으로 김영균이 만든 초안이에요. 정확한 기준은 각 기관에 확인해 주세요."),
    el("button", { class: "secondary", onclick: startOver }, "처음부터 다시 하기")
  );
}

async function init() {
  try {
    const res = await fetch("/api/questions");
    state.questions = (await res.json()).questions;
  } catch {
    render(el("h2", {}, "화면을 불러오지 못했어요"), el("p", {}, "잠시 뒤 다시 열어 주세요."), helpFooter());
    return;
  }
  showIntro();
}

init();
