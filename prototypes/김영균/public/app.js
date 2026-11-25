// 화면 흐름: 처음 화면 → 고정 질문 8개 → 보충 질문 → 돌봄 수첩.
// 서버도 AI도 쓰지 않는다. 카드와 질문은 data/의 JSON에서 읽고, 목록은 logic.js의 규칙으로 고른다.
// 보호자의 답은 이 휴대폰의 브라우저에만 저장하고 어디로도 보내지 않는다.
import { createEngine } from "./logic.js";

const app = document.getElementById("app");
const STORE_KEY = "care-todo:v2";
const PREFS_KEY = "care-todo:prefs";
const CHECKED_ON = "2026년 11월";
const SECTIONS = [
  { bucket: "this_week", label: "이번 주", hint: "늦추면 손해가 생기거나 다음 일을 못 하는 일" },
  { bucket: "this_month", label: "이번 달", hint: "이번 주 일이 끝나면 이어서 할 일" },
  { bucket: "know_ahead", label: "알아두기", hint: "지금 할 일은 아니지만 상태가 바뀌면 바로 필요한 일" }
];
const RELATION = { parent: "부모님", spouse: "배우자", grandparent: "조부모님", other: "가족" };
const PHONE = /(1\d{3}-\d{4}|\b(?:119|112|129|109|182|1350)\b)/g;
const ADVANCE_MS = 350;

let engine = null;
let deck = null;
let followupBank = null;

const state = {
  questions: [],
  answers: {},
  plan: null,
  checks: {},
  hidden: [],
  added: [],
  newIds: [],
  receivedAt: null,
  refreshing: false,
  refreshNote: null,
  open: new Set(),
  tab: null,
  showExtras: false
};

// ---- 저장 ----
// 브라우저 저장소는 막혀 있을 수 있어 실패해도 화면은 그대로 동작하게 한다.
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? null;
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function save() {
  const { answers, plan, checks, hidden, added, newIds, receivedAt } = state;
  write(STORE_KEY, { answers, plan, checks, hidden, added, newIds, receivedAt });
}
function clearSaved() {
  try {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem("care-todo:v1");
  } catch {}
}

const prefs = read(PREFS_KEY) ?? { large: false };
function applyPrefs() {
  document.documentElement.classList.toggle("large", Boolean(prefs.large));
}
applyPrefs();

// ---- 화면 도구 ----
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

// 새 화면을 그리고, 화면 낭독기가 새 제목부터 읽도록 제목에 초점을 옮긴다.
function render(...nodes) {
  app.replaceChildren(...nodes.flat(Infinity).filter((n) => n !== null && n !== undefined && n !== false));
  window.scrollTo(0, 0);
  const heading = app.querySelector("h1");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

function sizeToggle() {
  const btn = el("button", { class: "size-toggle", type: "button", "aria-pressed": String(Boolean(prefs.large)) }, prefs.large ? "글자 보통" : "글자 크게");
  btn.setAttribute("aria-label", "글자 크기");
  btn.addEventListener("click", () => {
    prefs.large = !prefs.large;
    write(PREFS_KEY, prefs);
    applyPrefs();
    btn.setAttribute("aria-pressed", String(prefs.large));
    btn.textContent = prefs.large ? "글자 보통" : "글자 크게";
  });
  return btn;
}

function topbar(left = null, middle = null) {
  return el("div", { class: "topbar" }, left ?? el("span"), middle, sizeToggle());
}

function helpBlock() {
  return el(
    "p",
    { class: "help" },
    "더 궁금하면 ",
    el("a", { href: "tel:15771000" }, "국민건강보험공단 장기요양 상담 1577-1000"),
    "에 전화해 보세요. 평일 오전 9시부터 오후 6시까지 받아요."
  );
}

function checkedNotice() {
  return el(
    "p",
    { class: "note" },
    `할 일과 답은 ${CHECKED_ON}에 공식 자료로 확인한 내용이에요. 제도는 해마다 바뀔 수 있으니, 신청하기 전에 공단(1577-1000)이나 안내된 기관에 꼭 확인해 주세요.`
  );
}

// ---- 처음 화면 ----
function showIntro() {
  render(
    topbar(),
    el("h1", {}, "지금 무엇부터 해야 할지 정리해 드려요"),
    el("p", {}, "몇 가지만 답하시면 지금 할 일을 수첩처럼 정리해 드려요. 3분쯤 걸려요."),
    el("p", { class: "meta" }, "이름, 연락처, 주소는 묻지 않아요. 답과 체크한 내용은 이 휴대폰에만 남고 어디로도 보내지 않아요."),
    el("p", { class: "meta" }, `${CHECKED_ON} 기준으로 확인한 정보예요. 의료 판단은 하지 않고, 무엇을 어디에 물어보면 되는지 안내해 드려요.`),
    el("button", { class: "primary", type: "button", onclick: () => showQuestion(0) }, "시작하기")
  );
}

function startOver() {
  if (!window.confirm("체크한 기록과 답을 모두 지우고 처음부터 할까요?")) return;
  clearSaved();
  Object.assign(state, { answers: {}, plan: null, checks: {}, hidden: [], added: [], newIds: [], receivedAt: null, refreshing: false, refreshNote: null, showExtras: false });
  state.open.clear();
  showIntro();
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
  else if (exclusive.includes(value)) {
    current.clear();
    current.add(value);
  } else {
    exclusive.forEach((x) => current.delete(x));
    current.add(value);
  }
  state.answers[field.key] = [...current];
}

function isChosen(field, value) {
  const v = state.answers[field.key];
  return field.type === "many" ? (v ?? []).includes(value) : v === value;
}

// 보기 버튼 묶음. 하나만 고르는 보기는 라디오 버튼으로, 여러 개 고르는 보기는 누름 버튼으로 읽힌다.
function choiceGroup(field, legend, { onPick, toggleOff = false } = {}) {
  const single = field.type === "one";
  const stateAttr = single ? "aria-checked" : "aria-pressed";
  const buttons = field.options.map((opt) =>
    el("button", { class: `choice${single ? "" : " many"}`, type: "button", role: single ? "radio" : null, [stateAttr]: String(isChosen(field, opt.value)) }, opt.label)
  );
  buttons.forEach((b, k) =>
    b.addEventListener("click", () => {
      const value = field.options[k].value;
      // 보충 질문은 고른 답을 다시 누르면 지울 수 있다(모르면 비워 둬도 되므로).
      if (toggleOff && single && state.answers[field.key] === value) delete state.answers[field.key];
      else choose(field, value);
      buttons.forEach((x, j) => x.setAttribute(stateAttr, String(isChosen(field, field.options[j].value))));
      onPick?.();
    })
  );
  return el(
    "fieldset",
    { class: "field" },
    legend,
    field.type === "many" ? el("p", { class: "meta" }, field.hint ?? "여러 개 고를 수 있어요.") : null,
    el("div", { class: "choices", role: single ? "radiogroup" : null, "aria-label": field.label ?? field.text ?? "" }, buttons)
  );
}

function showQuestion(i) {
  const q = state.questions[i];
  const total = state.questions.length;
  const isLast = i + 1 === total;
  const goNext = () => (isLast ? showFollowups() : showQuestion(i + 1));
  // 보기 하나만 고르는 칸 하나짜리 질문은 고르면 바로 넘어간다.
  const autoAdvance = q.fields.length === 1 && q.fields[0].type === "one";
  let advancing = false;

  const next = el("button", { class: "primary", type: "button", onclick: goNext }, isLast ? "다 답했어요" : "다음");
  const refresh = () => (next.disabled = !q.fields.every(fieldDone));

  const fields = q.fields.map((field) =>
    choiceGroup(
      { ...field, hint: q.hint },
      field.label ? el("legend", {}, field.label) : el("legend", { class: "visually-hidden" }, q.title),
      {
        onPick: () => {
          refresh();
          if (autoAdvance && !advancing) {
            advancing = true;
            setTimeout(goNext, ADVANCE_MS);
          }
        }
      }
    )
  );
  refresh();

  const back = i === 0
    ? el("button", { class: "text-button", type: "button", onclick: () => {
        if (!state.refreshing) return showIntro();
        state.refreshing = false;
        showPlan(true);
      } }, state.refreshing ? "수첩으로" : "처음 화면")
    : el("button", { class: "text-button", type: "button", onclick: () => showQuestion(i - 1) }, "이전 질문");

  render(
    topbar(back, el("span", { class: "step" }, `${i + 1} / ${total}`)),
    el("p", { class: "question-group" }, q.group),
    el("h1", {}, q.title),
    state.refreshing ? el("p", { class: "meta" }, "지난번 답이 골라져 있어요. 바뀐 것만 고치고 넘어가세요.") : null,
    fields,
    next
  );
}

// ---- 보충 질문 ----
// 앞의 답에 따라 미리 정해 둔 질문 0～3개와, 걱정을 적는 칸 하나를 보여 준다.
function showFollowups() {
  const list = engine.pickFollowups(state.answers);
  // 이번 답에서 더는 묻지 않는 보충 질문의 예전 답은 지운다.
  for (const q of followupBank.questions) if (!list.includes(q)) delete state.answers[q.key];

  const blocks = list.map((q, n) =>
    choiceGroup({ key: q.key, type: "one", options: q.options, text: q.text }, el("legend", {}, `${n + 1}. ${q.text}`), { toggleOff: true })
  );
  const worry = followupBank.worry;
  const box = el("textarea", { id: "worry", maxlength: "300", placeholder: worry.placeholder });
  box.value = state.answers.worry ?? "";
  box.addEventListener("input", () => (state.answers.worry = box.value));

  render(
    topbar(el("button", { class: "text-button", type: "button", onclick: () => showQuestion(state.questions.length - 1) }, "이전 질문"), el("span", { class: "step" }, "보충 질문")),
    el("h1", {}, "조금만 더 알려 주세요"),
    el("p", { class: "meta" }, "모르면 비워 두고 넘어가도 돼요."),
    blocks,
    el(
      "div",
      { class: "field" },
      el("label", { for: "worry", class: "legend-like" }, `${list.length + 1}. ${worry.text}`),
      el("p", { class: "meta" }, worry.note),
      box
    ),
    el("button", { class: "primary", type: "button", onclick: makePlan }, "할 일 정리하기")
  );
}

// ---- 목록 만들기 ----
function computePlan() {
  return engine.buildPlan(state.answers, { hidden: state.hidden, added: state.added });
}

function makePlan() {
  const previous = state.plan;
  state.plan = computePlan();

  // 다시 받은 목록이면 같은 카드의 체크를 그대로 두고, 처음 나온 카드를 표시한다.
  const ids = state.plan.items.map((it) => it.card_id);
  if (state.refreshing && previous) {
    const before = previous.items.map((it) => it.card_id);
    state.newIds = ids.filter((id) => !before.includes(id));
    const kept = ids.filter((id) => state.checks[id]).length;
    // 모두 새 카드면 줄마다 표시해도 정보가 없어서 한 줄 안내로만 알린다.
    const allNew = state.newIds.length === ids.length;
    state.refreshNote = { kept, added: state.newIds.length, allNew };
    if (allNew) state.newIds = [];
  } else {
    state.checks = {};
    state.newIds = [];
    state.refreshNote = null;
  }
  state.refreshing = false;
  state.receivedAt = new Date().toISOString();
  state.open.clear();
  state.tab = null;
  state.showExtras = false;
  save();
  showPlan();
}

// 숨기거나 더한 뒤에는 같은 답으로 목록을 다시 고르고, 체크는 그대로 둔다.
function replan(note) {
  const before = state.plan.items.map((it) => it.card_id);
  state.plan = { ...computePlan(), emergencyShown: state.plan.emergencyShown };
  const now = state.plan.items.map((it) => it.card_id);
  state.newIds = [...new Set([...state.newIds.filter((id) => now.includes(id)), ...now.filter((id) => !before.includes(id))])];
  state.refreshNote = note ? { text: note } : null;
  save();
  const scroll = window.scrollY;
  showPlan(true);
  window.scrollTo(0, scroll);
}

function hideCard(id) {
  if (!state.hidden.includes(id)) state.hidden.push(id);
  state.added = state.added.filter((x) => x !== id);
  state.open.delete(id);
  replan("그 할 일은 숨기고, 맞는 다른 할 일이 있으면 채워 넣었어요.");
}

function addCard(id) {
  if (!state.added.includes(id)) state.added.push(id);
  state.hidden = state.hidden.filter((x) => x !== id);
  replan("수첩에 넣었어요. 새로 추가됨 표시를 확인해 보세요.");
}

function restoreHidden() {
  state.hidden = [];
  replan("숨긴 할 일을 다시 보이게 했어요.");
}

function showEmergency(kinds, onClose) {
  render(
    el(
      "section",
      { class: "emergency", role: "alert" },
      el("h1", {}, "즉시 도움이 필요할 때"),
      el("p", {}, "적어 주신 내용에 위급할 수 있는 상황이 있어요. 할 일 목록보다 먼저 전화해 주세요."),
      el("a", { class: "call-urgent", href: "tel:119" }, "119에 전화하기", el("small", {}, "의식이 없거나 다칠 위험이 있을 때")),
      kinds.includes("violence") ? el("a", { class: "call-urgent", href: "tel:112" }, "112에 신고하기", el("small", {}, "누군가 맞거나 다칠 위험이 있을 때")) : null,
      kinds.includes("suicide") ? el("a", { class: "call-urgent", href: "tel:109" }, "109 자살예방상담전화", el("small", {}, "24시간 받아요")) : null,
      el("a", { class: "call-urgent soft", href: "tel:15770199" }, "1577-0199 정신건강위기상담전화", el("small", {}, "24시간 받아요")),
      el("button", { class: "secondary", type: "button", onclick: onClose }, "안내를 닫고 할 일 보기")
    )
  );
}

// ---- 돌봄 수첩 ----
function cardOf(item) {
  return engine.cardById.get(item.card_id);
}

function itemsOf(bucket) {
  return state.plan.items.filter((it) => it.bucket === bucket && engine.cardById.has(it.card_id));
}

function phonesIn(text) {
  return [...new Set([...text.matchAll(PHONE)].map((m) => m[0]))];
}

function sourcesOf(keys) {
  return [...new Set(keys)].map((k) => deck.sources[k]).filter(Boolean);
}

function sourceList(sources) {
  return el(
    "ul",
    { class: "sources" },
    sources.map((s) =>
      el("li", {}, el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.title), s.checked ? ` (${s.checked} 확인)` : " (출처 확인 전)")
    )
  );
}

// 질문을 누르면 카드에 적어 둔 답을 펼친다. 인터넷이 없어도 열린다.
function askButton(qa) {
  const slot = el("div", { "aria-live": "polite" });
  const btn = el("button", { class: "ask", type: "button", "aria-expanded": "false" }, qa.q);
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(open));
    if (!open) return slot.replaceChildren();
    const extra = sourcesOf(qa.source_keys ?? []);
    slot.replaceChildren(
      el(
        "div",
        { class: "answer" },
        state.plan.emergency?.length ? el("p", { class: "urgent" }, "위급할 수 있는 상황이면 먼저 119에 전화하세요.") : null,
        el("p", {}, qa.a),
        qa.medical ? el("p", { class: "medical" }, "일반적인 정보예요. 진단과 치료는 주치의와 상의하세요.") : null,
        extra.length ? [el("p", { class: "meta" }, "이 답의 근거"), sourceList(extra)] : null
      )
    );
  });
  return [btn, slot];
}

// 펼친 내용은 연락하기 → 물어볼 질문 → 출처 → 숨기기 순서로 고정한다.
function detailPanel(card, id) {
  const phones = phonesIn(card.contact);
  return el(
    "div",
    { class: "detail", id },
    el(
      "section",
      {},
      el("h3", {}, "연락하기"),
      el("p", {}, card.contact),
      phones.length ? el("div", { class: "calls" }, phones.map((p) => el("a", { class: "call", href: `tel:${p.replace(/-/g, "")}` }, `${p} 전화하기`))) : null
    ),
    el("section", {}, el("h3", {}, `물어볼 질문 ${card.qa.length}개`), card.qa.map(askButton)),
    el("section", {}, el("h3", {}, "출처"), sourceList(sourcesOf(card.source_keys))),
    el(
      "section",
      { class: "hide-row" },
      el("button", { class: "text-button", type: "button", onclick: () => hideCard(card.id) }, "우리 상황과 안 맞아요 (숨기기)")
    )
  );
}

function todoItem(item) {
  const card = cardOf(item);
  const boxId = `check-${card.id}`;
  const panelId = `detail-${card.id}`;
  const done = Boolean(state.checks[card.id]);
  const li = el("li", { class: `todo${done ? " done" : ""}`, id: `todo-${card.id}` });

  const box = el("input", { type: "checkbox", id: boxId });
  box.checked = done;
  box.addEventListener("change", () => setDone(card.id, box.checked));

  const more = el("button", { class: "more", type: "button", "aria-expanded": String(state.open.has(card.id)), "aria-controls": panelId }, "연락처와 물어볼 질문");
  const body = el(
    "div",
    { class: "todo-body" },
    el("p", { class: "why" }, card.why),
    el("p", { class: "reason" }, item.reasons.join(" ")),
    more
  );
  if (state.open.has(card.id)) body.append(detailPanel(card, panelId));
  more.addEventListener("click", () => {
    const open = !state.open.has(card.id);
    if (open) state.open.add(card.id);
    else state.open.delete(card.id);
    more.setAttribute("aria-expanded", String(open));
    body.querySelector(".detail")?.remove();
    if (open) body.append(detailPanel(card, panelId));
  });

  li.append(
    el(
      "div",
      { class: "todo-row" },
      box,
      el("label", { class: "todo-title", for: boxId }, card.title, state.newIds.includes(card.id) ? el("span", { class: "new-tag" }, "새로 추가됨") : null)
    ),
    body
  );
  return li;
}

// 체크하면 그 줄과 탭의 완료 개수, 맨 위 안내만 바꾼다. 화면 전체를 다시 그리면 초점을 잃는다.
function setDone(id, done) {
  state.checks[id] = done;
  save();
  document.getElementById(`todo-${id}`)?.classList.toggle("done", done);
  const box = document.getElementById(`check-${id}`);
  if (box) box.checked = done;
  for (const s of SECTIONS) {
    const count = document.getElementById(`count-${s.bucket}`);
    if (count) count.textContent = countText(s);
  }
  document.getElementById("first")?.replaceWith(firstBlock());
  // 열린 장의 일을 모두 끝내면 남은 일이 있는 다음 장을 연다.
  const current = itemsOf(state.tab);
  if (done && current.length && current.every((it) => state.checks[it.card_id])) {
    const next = SECTIONS.find((s) => itemsOf(s.bucket).some((it) => !state.checks[it.card_id]));
    if (next) selectTab(next.bucket, true);
  }
}

function countText(section) {
  const items = itemsOf(section.bucket);
  const doneCount = items.filter((it) => state.checks[it.card_id]).length;
  return `${doneCount}/${items.length} 완료`;
}

function visibleSections() {
  return SECTIONS.filter((s) => itemsOf(s.bucket).length);
}

// 처음에는 남은 일이 있는 가장 이른 장을 연다.
function defaultTab() {
  const sections = visibleSections();
  return (sections.find((s) => itemsOf(s.bucket).some((it) => !state.checks[it.card_id])) ?? sections[0])?.bucket;
}

function sheet() {
  const section = SECTIONS.find((s) => s.bucket === state.tab);
  return el(
    "div",
    { class: "sheet", id: "sheet", role: "tabpanel", "aria-labelledby": `tab-${section.bucket}` },
    el("p", { class: "sheet-hint" }, section.hint),
    el("ul", { class: "todo-ul" }, itemsOf(section.bucket).map(todoItem))
  );
}

// 탭을 바꾸면 탭 표시와 종이만 바꾼다. focusTab이면 새 탭에 초점을 옮겨 낭독기가 바뀐 장을 읽게 한다.
function selectTab(bucket, focusTab = false) {
  state.tab = bucket;
  for (const s of visibleSections()) {
    const tab = document.getElementById(`tab-${s.bucket}`);
    if (!tab) continue;
    const on = s.bucket === bucket;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
  }
  document.getElementById("sheet")?.replaceWith(sheet());
  if (focusTab) document.getElementById(`tab-${bucket}`)?.focus();
}

function tabs() {
  const sections = visibleSections();
  const list = el("div", { class: "tabs", role: "tablist", "aria-label": "할 일 시기" });
  sections.forEach((s, i) => {
    const on = s.bucket === state.tab;
    const tab = el(
      "button",
      { class: "tab", type: "button", role: "tab", id: `tab-${s.bucket}`, "aria-selected": String(on), "aria-controls": "sheet", tabindex: on ? "0" : "-1" },
      el("span", { class: "tab-label" }, s.label),
      el("span", { class: "tab-count", id: `count-${s.bucket}` }, countText(s))
    );
    tab.addEventListener("click", () => selectTab(s.bucket));
    // 탭 목록의 표준 키보드 동작: 화살표, Home, End로 옮긴다.
    tab.addEventListener("keydown", (e) => {
      const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: sections.length - 1 };
      if (!(e.key in moves)) return;
      e.preventDefault();
      const target = sections[(moves[e.key] + sections.length) % sections.length];
      selectTab(target.bucket, true);
    });
    list.append(tab);
  });
  return list;
}

function openItem(id) {
  const item = state.plan.items.find((it) => it.card_id === id);
  if (item && item.bucket !== state.tab) selectTab(item.bucket);
  const li = document.getElementById(`todo-${id}`);
  const more = li?.querySelector(".more");
  if (more && more.getAttribute("aria-expanded") !== "true") more.click();
  li?.scrollIntoView({ block: "start" });
  li?.querySelector("input")?.focus({ preventScroll: true });
}

// 맨 위: 아직 하지 않은 첫 번째 할 일. 이번 주를 다 끝냈으면 그 사실과 다음 구간을 알려 준다.
function firstBlock() {
  const pending = SECTIONS.flatMap((s) => itemsOf(s.bucket)).find((it) => !state.checks[it.card_id]);
  const weekItems = itemsOf("this_week");
  const weekDone = weekItems.length > 0 && weekItems.every((it) => state.checks[it.card_id]);

  if (!pending) {
    return el(
      "section",
      { class: "first", id: "first", "aria-live": "polite" },
      el("p", { class: "label" }, "목록의 일을 모두 확인했어요."),
      el("p", {}, "상황이 바뀌면 아래 \"상황이 바뀌었어요\"를 눌러 새 목록을 받아 보세요.")
    );
  }
  const section = SECTIONS.find((s) => s.bucket === pending.bucket);
  return el(
    "section",
    { class: "first", id: "first", "aria-live": "polite" },
    weekDone
      ? [el("p", { class: "label" }, "이번 주에 필요한 일을 확인했어요."), el("p", { class: "meta" }, section.bucket === "know_ahead" ? "다음은 알아둘 것이에요." : `다음은 ${section.label} 할 일이에요.`)]
      : el("p", { class: "label" }, "지금은 이 일부터 해 보세요"),
    el("p", { class: "title" }, cardOf(pending).title),
    el(
      "div",
      { class: "actions" },
      el("button", { class: "open-button", type: "button", onclick: () => openItem(pending.card_id) }, "연락처 보기"),
      el("button", { class: "done-button", type: "button", onclick: () => setDone(pending.card_id, true) }, "했어요")
    )
  );
}

// 목록에 들지 못했지만 조건이 맞는 할 일. 보호자가 직접 골라 수첩에 넣을 수 있다.
function extrasBlock() {
  const extras = (state.plan.extras ?? []).filter((id) => engine.cardById.has(id));
  const hiddenCount = state.hidden.length;
  if (!extras.length && !hiddenCount) return null;
  const toggle = el(
    "button",
    { class: "secondary", type: "button", "aria-expanded": String(state.showExtras), "aria-controls": "extras" },
    state.showExtras ? "다른 할 일 접기" : `다른 할 일 더 보기 (${extras.length}개)`
  );
  toggle.addEventListener("click", () => {
    state.showExtras = !state.showExtras;
    document.getElementById("extras-block")?.replaceWith(extrasBlock());
    document.querySelector("#extras-block button")?.focus();
  });
  return el(
    "section",
    { class: "extras", id: "extras-block" },
    extras.length ? toggle : null,
    state.showExtras && extras.length
      ? el(
          "ul",
          { class: "extras-list", id: "extras" },
          extras.map((id) => {
            const card = engine.cardById.get(id);
            return el(
              "li",
              {},
              el("p", { class: "extra-title" }, card.title),
              el("p", { class: "meta" }, card.why),
              el("button", { class: "text-button add", type: "button", onclick: () => addCard(id) }, "수첩에 넣기")
            );
          })
        )
      : null,
    hiddenCount
      ? el("p", { class: "meta" }, `숨긴 할 일 ${hiddenCount}개 `, el("button", { class: "text-button inline", type: "button", onclick: restoreHidden }, "다시 보기"))
      : null
  );
}

function startRefresh() {
  state.refreshing = true;
  showQuestion(0);
}

function refreshNoteText(note) {
  if (note.text) return note.text;
  return [
    note.kept ? `완료한 일 ${note.kept}개는 그대로 두었어요. ` : "",
    note.allNew ? "바뀐 상황에 맞춰 목록이 모두 새로 바뀌었어요." : note.added ? `새로 추가된 일 ${note.added}개에 표시해 두었어요.` : "새로 추가된 일은 없어요."
  ].join("");
}

// 응급 안내는 목록을 받은 뒤 한 번만 전체 화면으로 띄우고, 그다음부터는 수첩 맨 위에 둔다.
function showPlan(skipEmergency = false) {
  const plan = state.plan;
  const urgent = plan.emergency?.length > 0;
  if (urgent && !skipEmergency && !plan.emergencyShown) {
    showEmergency(plan.emergency, () => showPlan(true));
    return;
  }
  if (urgent && !plan.emergencyShown) {
    plan.emergencyShown = true;
    save();
  }
  const who = RELATION[state.answers.relation] ?? "가족";
  const date = state.receivedAt ? new Date(state.receivedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) : null;
  const note = state.refreshNote;

  if (!state.tab || !itemsOf(state.tab).length) state.tab = defaultTab();

  render(
    topbar(),
    el("h1", {}, `${who} 돌봄 수첩`),
    date ? el("p", { class: "meta" }, `${date}에 만든 목록이에요.`) : null,
    note ? el("p", { class: "note", role: "status" }, refreshNoteText(note)) : null,
    urgent
      ? el(
          "p",
          { class: "urgent-line" },
          el("strong", {}, "즉시 도움이 필요할 때 "),
          el("a", { href: "tel:119" }, "119"),
          plan.emergency.includes("violence") ? [", ", el("a", { href: "tel:112" }, "112")] : null,
          plan.emergency.includes("suicide") ? [", ", el("a", { href: "tel:109" }, "109")] : null,
          ", ",
          el("a", { href: "tel:15770199" }, "1577-0199")
        )
      : null,
    firstBlock(),
    state.tab ? el("section", { class: "notebook", "aria-label": "할 일" }, tabs(), sheet()) : el("p", {}, "지금 답으로는 보여 드릴 할 일이 없어요. 숨긴 할 일을 다시 보거나 답을 바꿔 보세요."),
    extrasBlock(),
    el(
      "div",
      { class: "after" },
      checkedNotice(),
      el("button", { class: "secondary", type: "button", onclick: startRefresh }, "상황이 바뀌었어요"),
      el("p", { class: "meta" }, "입원, 퇴원, 등급 변경처럼 상황이 달라졌다면 바뀐 답만 고쳐 새 목록을 받으세요. 끝낸 일의 체크는 그대로 남아요."),
      helpBlock(),
      el("p", { class: "meta" }, "할 일 카드는 KAIST 수업 프로젝트에서 김영균이 공개 자료를 바탕으로 만들었어요. 정확한 기준은 각 기관에 확인해 주세요."),
      el("button", { class: "text-button", type: "button", onclick: startOver }, "기록 지우고 처음부터 하기")
    )
  );
  if (note) state.refreshNote = null;
}

async function loadJson(name) {
  const res = await fetch(`data/${name}`);
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return res.json();
}

async function init() {
  try {
    const [cards, questions, followups] = await Promise.all([loadJson("cards.json"), loadJson("questions.json"), loadJson("followups.json")]);
    deck = cards;
    followupBank = followups;
    state.questions = questions;
    engine = createEngine({ deck, questions, followups });
  } catch {
    render(topbar(), el("h1", {}, "화면을 불러오지 못했어요"), el("p", {}, "인터넷 연결을 확인하고 다시 열어 주세요."), helpBlock());
    return;
  }
  const saved = read(STORE_KEY);
  if (saved?.plan) {
    Object.assign(state, {
      answers: saved.answers ?? {},
      checks: saved.checks ?? {},
      hidden: saved.hidden ?? [],
      added: saved.added ?? [],
      newIds: saved.newIds ?? [],
      receivedAt: saved.receivedAt ?? null
    });
    // 카드가 고쳐졌을 수 있으니 저장한 답으로 목록을 다시 고른다. 체크와 응급 안내 표시는 그대로 둔다.
    state.plan = { ...computePlan(), emergencyShown: saved.plan.emergencyShown };
    showPlan();
    return;
  }
  showIntro();
}

init();
