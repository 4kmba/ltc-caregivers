// 화면 흐름: 처음 화면 → 고정 질문 8개 → 보충 질문 → 돌봄 수첩.
// 수첩이 저장돼 있으면 처음 화면 대신 수첩을 바로 연다.
// AI가 쓴 글은 innerHTML로 넣지 않고 textContent로만 넣는다.
const app = document.getElementById("app");
const STORE_KEY = "care-todo:v1";
const PREFS_KEY = "care-todo:prefs";
const SECTIONS = [
  { bucket: "this_week", label: "이번 주", hint: "늦추면 손해가 생기거나 다음 일을 못 하는 일" },
  { bucket: "this_month", label: "이번 달", hint: "이번 주 일이 끝나면 이어서 할 일" },
  { bucket: "know_ahead", label: "미리 알아둘 것", hint: "상태가 바뀌면 바로 필요한 일" }
];
const RELATION = { parent: "부모님", spouse: "배우자", grandparent: "조부모님", other: "가족" };
const PHONE = /(1\d{3}-\d{4}|\b(?:119|112|129|109|182|1350)\b)/g;
const ADVANCE_MS = 350;

const state = {
  questions: [],
  answers: {},
  followups: [],
  plan: null,
  checks: {},
  newIds: [],
  receivedAt: null,
  refreshing: false,
  refreshNote: null,
  open: new Set()
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
  const { answers, plan, checks, newIds, receivedAt } = state;
  write(STORE_KEY, { answers, plan, checks, newIds, receivedAt });
}
function clearSaved() {
  try {
    localStorage.removeItem(STORE_KEY);
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

async function post(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
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

function loading(message) {
  render(topbar(), el("div", { class: "loading", role: "status" }, el("div", { class: "spinner", "aria-hidden": "true" }), el("p", {}, message)));
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

// ---- 처음 화면 ----
function showIntro() {
  render(
    topbar(),
    el("h1", {}, "지금 무엇부터 해야 할지 정리해 드려요"),
    el("p", {}, "몇 가지만 답하시면 지금 할 일을 수첩처럼 정리해 드려요. 3분쯤 걸려요."),
    el("p", { class: "meta" }, "이름, 연락처, 주소는 묻지 않아요. 답과 체크한 내용은 이 휴대폰에만 남고 서버에는 저장하지 않아요."),
    el("button", { class: "primary", type: "button", onclick: () => showQuestion(0) }, "시작하기")
  );
}

function startOver() {
  if (!window.confirm("체크한 기록과 답을 모두 지우고 처음부터 할까요?")) return;
  clearSaved();
  Object.assign(state, { answers: {}, followups: [], plan: null, checks: {}, newIds: [], receivedAt: null, refreshing: false, refreshNote: null });
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

  const fields = q.fields.map((field) => {
    // 하나만 고르는 보기는 화면 낭독기에 라디오 버튼으로, 여러 개 고르는 보기는 누름 버튼으로 읽힌다.
    const single = field.type === "one";
    const stateAttr = single ? "aria-checked" : "aria-pressed";
    const buttons = field.options.map((opt) =>
      el("button", {
        class: `choice${single ? "" : " many"}`,
        type: "button",
        role: single ? "radio" : null,
        [stateAttr]: String(isChosen(field, opt.value))
      }, opt.label)
    );
    buttons.forEach((b, k) =>
      b.addEventListener("click", () => {
        if (advancing) return;
        choose(field, field.options[k].value);
        buttons.forEach((x, j) => x.setAttribute(stateAttr, String(isChosen(field, field.options[j].value))));
        refresh();
        if (autoAdvance) {
          advancing = true;
          setTimeout(goNext, ADVANCE_MS);
        }
      })
    );
    return el(
      "fieldset",
      { class: "field" },
      field.label ? el("legend", {}, field.label) : el("legend", { class: "visually-hidden" }, q.title),
      field.type === "many" ? el("p", { class: "meta" }, q.hint ?? "여러 개 고를 수 있어요.") : null,
      el("div", { class: "choices", role: single ? "radiogroup" : null, "aria-label": field.label ?? q.title }, buttons)
    );
  });
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
async function showFollowups() {
  loading("답을 보고 몇 가지만 더 여쭤볼게요");
  let list = [];
  try {
    list = (await post("/api/followups", { answers: state.answers })).questions;
  } catch {}
  // 보충 질문을 만들지 못하면 건너뛰고 목록으로 간다.
  if (!list.length) return makePlan([]);
  state.followups = list.map((q) => ({ ...q, answer: "" }));

  const blocks = state.followups.map((f, n) => {
    const box = el("textarea", { "aria-label": `${f.text} 직접 적기`, placeholder: "직접 적어도 돼요" });
    const chips = f.options.map((o) => el("button", { class: "choice", type: "button", "aria-pressed": "false" }, o));
    box.addEventListener("input", () => {
      f.answer = box.value;
      chips.forEach((c) => c.setAttribute("aria-pressed", "false"));
    });
    chips.forEach((c, k) =>
      c.addEventListener("click", () => {
        const on = c.getAttribute("aria-pressed") !== "true";
        f.answer = on ? f.options[k] : "";
        box.value = "";
        chips.forEach((x) => x.setAttribute("aria-pressed", String(on && x === c)));
      })
    );
    return el("fieldset", { class: "field" }, el("legend", {}, `${n + 1}. ${f.text}`), el("div", { class: "choices" }, chips), box);
  });

  render(
    topbar(el("button", { class: "text-button", type: "button", onclick: () => showQuestion(state.questions.length - 1) }, "이전 질문"), el("span", { class: "step" }, "보충 질문")),
    el("h1", {}, "조금만 더 알려 주세요"),
    el("p", { class: "meta" }, "모르면 비워 두고 넘어가도 돼요."),
    blocks,
    el("button", { class: "primary", type: "button", onclick: () => makePlan(state.followups) }, "할 일 정리하기"),
    el("button", { class: "secondary", type: "button", onclick: () => makePlan([]) }, "건너뛰고 정리하기")
  );
}

// ---- 목록 받기 ----
async function makePlan(followups) {
  state.answers.followups = followups.filter((f) => f.answer.trim()).map((f) => ({ question: f.text, answer: f.answer.trim() }));
  const previous = state.plan;
  state.plan = null;
  loading("지금 할 일을 정리하고 있어요");
  const planRequest = post("/api/plan", { answers: state.answers });
  planRequest.catch(() => {});
  let failed = false;
  const showFailed = () =>
    render(
      topbar(),
      el("h1", {}, "목록을 받지 못했어요"),
      el("p", {}, "인터넷 연결을 확인하고 다시 시도해 주세요."),
      el("button", { class: "primary", type: "button", onclick: () => makePlan(followups) }, "다시 시도하기"),
      helpBlock()
    );

  // 응급 신호가 있으면 목록을 기다리지 않고 안내부터 띄운다.
  let emergency = [];
  try {
    emergency = (await post("/api/emergency", { answers: state.answers })).emergency;
  } catch {}
  let bannerOpen = emergency.length > 0;
  if (bannerOpen) {
    showEmergency(emergency, () => {
      bannerOpen = false;
      if (state.plan) showPlan(true);
      else if (failed) showFailed();
      else loading("지금 할 일을 정리하고 있어요");
    });
  }

  try {
    state.plan = await planRequest;
  } catch {
    failed = true;
    state.plan = previous;
    if (!bannerOpen) showFailed();
    return;
  }

  // 다시 받은 목록이면 같은 카드의 체크를 그대로 두고, 처음 나온 카드를 표시한다.
  const ids = state.plan.items.map((it) => it.card.id);
  if (state.refreshing && previous) {
    const before = previous.items.map((it) => it.card.id);
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
  save();
  if (!bannerOpen) showPlan(emergency.length > 0);
}

function showEmergency(kinds, onClose) {
  render(
    el(
      "section",
      { class: "emergency", role: "alert" },
      el("h1", {}, "즉시 도움이 필요할 때"),
      el("p", {}, "적어 주신 내용에 위급할 수 있는 상황이 있어요. 할 일 목록보다 먼저 전화해 주세요."),
      el("a", { class: "call-urgent", href: "tel:119" }, "119에 전화하기", el("small", {}, "의식이 없거나 다칠 위험이 있을 때")),
      kinds.includes("suicide") ? el("a", { class: "call-urgent", href: "tel:109" }, "109 자살예방상담전화", el("small", {}, "24시간 받아요")) : null,
      el("a", { class: "call-urgent soft", href: "tel:15770199" }, "1577-0199 정신건강위기상담전화", el("small", {}, "24시간 받아요")),
      el("button", { class: "secondary", type: "button", onclick: onClose }, "안내를 닫고 할 일 보기")
    )
  );
}

// ---- 돌봄 수첩 ----
function itemsOf(bucket) {
  return state.plan.items.filter((it) => it.bucket === bucket);
}

function phonesIn(text) {
  return [...new Set([...text.matchAll(PHONE)].map((m) => m[0]))];
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

function askButton(card, q, qi) {
  const slot = el("div", { "aria-live": "polite" });
  const btn = el("button", { class: "ask", type: "button", "aria-expanded": "false" }, q);
  btn.addEventListener("click", async () => {
    if (btn.getAttribute("aria-expanded") === "true") {
      btn.setAttribute("aria-expanded", "false");
      slot.replaceChildren();
      return;
    }
    btn.setAttribute("aria-expanded", "true");
    slot.replaceChildren(el("p", { class: "meta" }, "답을 정리하고 있어요."));
    try {
      const res = await post("/api/answer", { answers: state.answers, card_id: card.id, q_index: qi });
      slot.replaceChildren(
        el(
          "div",
          { class: "answer" },
          res.urgent ? el("p", { class: "urgent" }, "위급할 수 있는 상황이면 먼저 119에 전화하세요.") : null,
          el("p", {}, res.text),
          res.medical ? el("p", { class: "medical" }, "일반적인 정보예요. 진단과 치료는 주치의와 상의하세요.") : null
        )
      );
    } catch {
      slot.replaceChildren(el("p", { class: "meta" }, "답을 불러오지 못했어요. 다시 눌러 주세요."));
      btn.setAttribute("aria-expanded", "false");
    }
  });
  return [btn, slot];
}

// 펼친 내용은 연락하기 → 물어볼 질문 → 출처 순서로 고정한다.
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
    el("section", {}, el("h3", {}, "물어볼 질문"), card.questions.map((q, qi) => askButton(card, q, qi))),
    el("section", {}, el("h3", {}, "출처"), sourceList(card.sources))
  );
}

function todoItem(item) {
  const { card } = item;
  const boxId = `check-${card.id}`;
  const panelId = `detail-${card.id}`;
  const done = Boolean(state.checks[card.id]);
  const li = el("li", { class: `todo${done ? " done" : ""}`, id: `todo-${card.id}` });

  const box = el("input", { type: "checkbox", id: boxId });
  box.checked = done;
  box.addEventListener("change", () => setDone(card.id, box.checked));

  const more = el("button", { class: "more", type: "button", "aria-expanded": String(state.open.has(card.id)), "aria-controls": panelId }, "연락처와 물어볼 질문");
  const body = el("div", { class: "todo-body" }, el("p", { class: "why" }, item.why), more);
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

// 체크하면 그 줄과 완료 개수, 맨 위 안내만 바꾼다. 화면 전체를 다시 그리면 초점을 잃는다.
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
}

function countText(section) {
  const items = itemsOf(section.bucket);
  const doneCount = items.filter((it) => state.checks[it.card.id]).length;
  return `${items.length}개 중 ${doneCount}개 완료`;
}

function openItem(id) {
  const li = document.getElementById(`todo-${id}`);
  const more = li?.querySelector(".more");
  if (more && more.getAttribute("aria-expanded") !== "true") more.click();
  li?.scrollIntoView({ block: "start" });
  li?.querySelector("input")?.focus({ preventScroll: true });
}

// 맨 위: 아직 하지 않은 첫 번째 할 일. 이번 주를 다 끝냈으면 그 사실과 다음 구간을 알려 준다.
function firstBlock() {
  const pending = SECTIONS.flatMap((s) => itemsOf(s.bucket)).find((it) => !state.checks[it.card.id]);
  const weekItems = itemsOf("this_week");
  const weekDone = weekItems.length > 0 && weekItems.every((it) => state.checks[it.card.id]);

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
      ? [el("p", { class: "label" }, "이번 주에 필요한 일을 확인했어요."), el("p", { class: "meta" }, `다음은 ${section.label} 할 일이에요.`)]
      : el("p", { class: "label" }, "지금은 이 일부터 해 보세요"),
    el("p", { class: "title" }, pending.card.title),
    el(
      "div",
      { class: "actions" },
      el("button", { class: "open-button", type: "button", onclick: () => openItem(pending.card.id) }, "연락처 보기"),
      el("button", { class: "done-button", type: "button", onclick: () => setDone(pending.card.id, true) }, "했어요")
    )
  );
}

function startRefresh() {
  state.refreshing = true;
  showQuestion(0);
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

  const sections = SECTIONS.filter((s) => itemsOf(s.bucket).length).map((s) =>
    el(
      "li",
      { class: "section" },
      el("div", { class: "section-head" }, el("h2", {}, s.label), el("span", { class: "count", id: `count-${s.bucket}` }, countText(s))),
      el("p", { class: "section-hint" }, s.hint),
      el("ul", { class: "todo-ul" }, itemsOf(s.bucket).map(todoItem))
    )
  );

  render(
    topbar(),
    el("h1", {}, `${who} 돌봄 수첩`),
    date ? el("p", { class: "meta" }, `${date}에 받은 목록이에요.`) : null,
    note
      ? el(
          "p",
          { class: "note", role: "status" },
          note.kept ? `완료한 일 ${note.kept}개는 그대로 두었어요. ` : "",
          note.allNew ? "바뀐 상황에 맞춰 목록이 모두 새로 바뀌었어요." : note.added ? `새로 추가된 일 ${note.added}개에 표시해 두었어요.` : "새로 추가된 일은 없어요."
        )
      : null,
    urgent
      ? el(
          "p",
          { class: "urgent-line" },
          el("strong", {}, "즉시 도움이 필요할 때 "),
          el("a", { href: "tel:119" }, "119"),
          plan.emergency.includes("suicide") ? [", ", el("a", { href: "tel:109" }, "109")] : null,
          ", ",
          el("a", { href: "tel:15770199" }, "1577-0199")
        )
      : null,
    plan.notice ? el("p", { class: "note" }, plan.notice) : null,
    firstBlock(),
    el("ol", { class: "notebook" }, sections),
    el(
      "div",
      { class: "after" },
      el("button", { class: "secondary", type: "button", onclick: startRefresh }, "상황이 바뀌었어요"),
      el("p", { class: "meta" }, "입원, 퇴원, 등급 변경처럼 상황이 달라졌다면 바뀐 답만 고쳐 새 목록을 받으세요. 끝낸 일의 체크는 그대로 남아요."),
      helpBlock(),
      el("p", { class: "meta" }, "할 일 카드는 공개 자료를 바탕으로 김영균이 만든 초안이에요. 정확한 기준은 각 기관에 확인해 주세요."),
      el("button", { class: "text-button", type: "button", onclick: startOver }, "기록 지우고 처음부터 하기")
    )
  );
  if (note) {
    state.refreshNote = null;
  }
}

async function init() {
  try {
    const res = await fetch("/api/questions");
    state.questions = (await res.json()).questions;
  } catch {
    render(topbar(), el("h1", {}, "화면을 불러오지 못했어요"), el("p", {}, "인터넷 연결을 확인하고 다시 열어 주세요."), helpBlock());
    return;
  }
  const saved = read(STORE_KEY);
  if (saved?.plan) {
    Object.assign(state, {
      answers: saved.answers ?? {},
      plan: saved.plan,
      checks: saved.checks ?? {},
      newIds: saved.newIds ?? [],
      receivedAt: saved.receivedAt ?? null
    });
    showPlan();
    return;
  }
  showIntro();
}

init();
