// 돌봄수첩 화면의 시작점. 주소의 # 뒤를 읽어 화면 모듈 하나를 그린다.
//   #/            표지 (screens/cover.mjs)
//   #/new         상황 고르기 (screens/questions.mjs)
//   #/q/<단계>    기본 정보, 상황별 질문, 걱정 한 줄, 보충 질문 (screens/questions.mjs)
//   #/compare     돌봄 방식 비교 (screens/compare.mjs)
//   #/page/<id>   수첩 페이지. new는 만들기, unsaved는 저장하지 못한 페이지 (screens/page.mjs)
//   #/emergency   응급 안내 (screens/emergency.mjs)
// 판단은 서버가 내보내는 모듈(rules, notebook, emergency)에 맡긴다. 이 파일은 화면을 잇고 서버와 저장소에 연결만 한다.
// 온디바이스 원칙(스펙 7절, 8절): 서버로 보내는 것은 api() 한 곳에서만, 허용한 칸만 담는다.
import { rankMethods, cardMatches } from "/src/rules.mjs";
import { createNotebook, carryChecks, changedAnswers } from "/src/notebook.mjs";
import { detectEmergency, emergencyContacts } from "/src/emergency.mjs";
import * as cover from "/screens/cover.mjs";
import * as questions from "/screens/questions.mjs";
import * as compare from "/screens/compare.mjs";
import * as page from "/screens/page.mjs";
import * as emergency from "/screens/emergency.mjs";

const root = document.getElementById("app");
const PREFS_KEY = "dolbom.prefs.v1";
const REQUEST_MS = 25000;

// ---- 화면 도구 ----
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  return put(node, ...children);
}

// 자식 넣기. DOM의 기본 append는 null을 "null"로, 배열을 문자열로 바꾸므로 화면 코드는 이 함수만 쓴다.
// 배열은 펼치고, null·undefined·false는 건너뛰고, Node가 아니면 글자로 넣는다.
function put(parent, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

// 비우고 새로 넣기(replaceChildren 대신).
function fill(parent, ...children) {
  parent.replaceChildren();
  return put(parent, ...children);
}

// 심청이 그림 자리(B5). 파일이 없으면 숨긴다. 오류 처리를 src보다 먼저 붙여야 놓치지 않는다.
function simcheong(name = "default") {
  const img = document.createElement("img");
  img.dataset.slot = "simcheong";
  img.alt = "";
  img.className = "simcheong";
  img.addEventListener("error", () => (img.hidden = true));
  img.src = `/img/simcheong/${name}.png`;
  return img;
}

// ---- 저장소 ----
// 사생활 모드에서는 localStorage에 손대기만 해도 던질 수 있어, 그때는 이 화면 동안만 쓰는 메모리 저장소로 대신한다.
function safeStorage() {
  try {
    const s = window.localStorage;
    const probe = "dolbom.probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: () => {
        throw new Error("no_storage");
      },
      removeItem: (k) => mem.delete(k),
    };
  }
}
const storage = safeStorage();
const notebook = createNotebook(storage);

function readPrefs() {
  try {
    const v = JSON.parse(storage.getItem(PREFS_KEY));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
const prefs = { large: false, ...readPrefs() };
function applyPrefs() {
  document.documentElement.classList.toggle("large", prefs.large === true);
}
function toggleLarge() {
  prefs.large = !prefs.large;
  try {
    storage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // 저장하지 못해도 지금 화면에서는 바뀐다.
  }
  applyPrefs();
  return prefs.large;
}
applyPrefs();

// ---- 서버 ----
// 기능마다 서버로 보내도 되는 칸. 지난 페이지, 체크, 돌보는 대상 칸은 여기에 없으므로 섞여 와도 버린다.
const SEND = {
  "pick-cards": ["situation", "answers", "methodId", "worry", "followups"],
  followups: ["situation", "answers"],
  summary: ["answered", "followups", "worry"],
  answer: ["qaId", "answers"],
  medical: ["worry"],
};

// 성공하면 { ok: true, value, usedAi, reason }, 500·네트워크 오류·시간 초과면 { ok: false, reason }.
async function api(name, input) {
  const fields = SEND[name];
  if (!fields) return { ok: false, reason: "unknown_task" };
  const body = {};
  for (const f of fields) if (input?.[f] !== undefined && input[f] !== null) body[f] = input[f];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const res = await fetch(`/api/task/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const data = await res.json();
    return { ok: true, value: data.value, usedAi: data.usedAi === true, reason: data.reason ?? null };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}

// ---- 내용 ----
let content = null;
// 키마다 질문 문구와 보기 문구. 보낼 답을 거르고, 화면에 "질문: 답"으로 적을 때 쓴다.
const questionMap = new Map();

function indexQuestions() {
  const add = (key, text, options) => questionMap.set(key, { text, labels: new Map(options.map((o) => [o.value, o.label])) });
  for (const screen of content.basic) for (const f of screen.fields) add(f.key, f.label ?? screen.title, f.options);
  for (const s of content.situations) for (const q of s.questions) add(q.key, q.text, q.options);
  for (const q of content.conditional) add(q.key, q.text, q.options);
}

const basicKeys = () => content.basic.flatMap((b) => b.fields.map((f) => f.key));
const situationOf = (id) => content.situations.find((s) => s.id === id) ?? null;
const cardOf = (id) => content.cards.find((c) => c.id === id) ?? null;
const qaOf = (id) => content.qa.find((q) => q.id === id) ?? null;
const sourceOf = (id) => content.sources.find((s) => s.id === id) ?? null;
const methodOf = (id) => content.methods.find((m) => m.id === id) ?? null;

function labelOf(key, value) {
  const known = questionMap.get(key);
  const values = Array.isArray(value) ? value : [value];
  return values.map((v) => known?.labels.get(v) ?? String(v)).join(", ");
}
const questionText = (key) => questionMap.get(key)?.text ?? key;

// 아는 질문의 값만 남긴다. 고르기 답은 문자열이나 문자열 배열이다.
function cleanAnswers(answers) {
  const out = {};
  for (const [key, value] of Object.entries(answers ?? {})) {
    const known = questionMap.get(key);
    if (!known) continue;
    if (typeof value === "string" && known.labels.has(value)) out[key] = value;
    else if (Array.isArray(value)) {
      const ok = value.filter((v) => typeof v === "string" && known.labels.has(v));
      if (ok.length) out[key] = ok;
    }
  }
  return out;
}

// ---- 이번에 정리하는 중인 답 (메모리에만) ----
let session = null;

function newSession(situationId) {
  // 기본 정보는 지난 페이지의 답을 채워 두고 "달라진 곳만 고쳐 주세요"로 묻는다(스펙 3절 3단계).
  const last = cleanAnswers(notebook.lastAnswers() ?? {});
  const basic = {};
  for (const key of basicKeys()) if (key in last) basic[key] = last[key];
  session = {
    situation: situationId,
    answers: basic,
    basicPrefilled: Object.keys(basic).length === basicKeys().length,
    worry: "",
    followupQs: null,
    followupAnswers: [],
    methodId: null,
    emergencyKinds: [],
    builtPageId: null,
  };
  return session;
}

// 조건부 질문(지금 받는 서비스는 어떠세요?)이 지금 답에 붙는지. 판단은 rules.mjs의 cardMatches에 맡긴다.
function conditionalApplies(q, answers) {
  return cardMatches({ situations: [session.situation], when: q.when, when_not: q.when_not }, { ...answers, situation: session.situation });
}

// 질문 단계 목록. 답에 따라 조건부 질문이 붙었다 빠지므로 매번 새로 만든다.
function steps() {
  const s = situationOf(session.situation);
  const list = [];
  if (session.basicPrefilled) list.push({ id: "basic", kind: "basic-all" });
  else for (const screen of content.basic) list.push({ id: `basic-${screen.no}`, kind: "basic", screen });
  for (const q of s?.questions ?? []) list.push({ id: `sq-${q.key}`, kind: "pick", q });
  for (const q of content.conditional) if (conditionalApplies(q, session.answers)) list.push({ id: `cq-${q.key}`, kind: "pick", q });
  list.push({ id: "worry", kind: "worry" });
  list.push({ id: "more", kind: "followups" });
  return list;
}

// 이번에 보낼 답: 아는 질문의 값만, 지금 붙지 않는 조건부 질문의 답은 뺀다.
function currentAnswers() {
  const answers = cleanAnswers(session.answers);
  for (const q of content.conditional) if (!conditionalApplies(q, answers)) delete answers[q.key];
  return answers;
}

function describeAnswers(answers) {
  return Object.entries(answers).map(([key, value]) => ({ q: questionText(key), a: labelOf(key, value) }));
}

// 직접 적은 글에서 응급 신호를 찾는다. 처음 보는 신호가 있으면 응급 안내를 먼저 띄우고, 닫으면 next로 간다.
function checkEmergency(texts, next) {
  const kinds = detectEmergency(texts.filter((t) => typeof t === "string"));
  const fresh = kinds.filter((k) => !session.emergencyKinds.includes(k));
  if (fresh.length === 0) return nav(next);
  session.emergencyKinds = [...session.emergencyKinds, ...fresh];
  pendingEmergency = { kinds: session.emergencyKinds, next };
  nav("#/emergency");
}
let pendingEmergency = null;

function contactsFor(kinds) {
  return emergencyContacts(kinds, content.sources).filter(Boolean);
}

// 보충 질문 다음: 선택지가 갈리는 상황이고 방식이 있으면 비교, 아니면 수첩 페이지.
function afterQuestions() {
  const s = situationOf(session.situation);
  if (s?.compare && rankMethods(content.methods, { ...currentAnswers(), situation: session.situation }).length) return "#/compare";
  return "#/page/new";
}

// 수첩 페이지 만들기. 카드 고르기, 오늘 정리, 의료 질문을 함께 부른다.
// 카드 고르기가 서버 오류로 실패하면 { error: true }. 나머지는 실패해도 대체 값으로 채운다.
async function buildPage() {
  const s = situationOf(session.situation);
  const answers = currentAnswers();
  const followups = session.followupAnswers;
  const worry = session.worry.trim();
  const answered = describeAnswers(answers);
  const [pick, summary, medical] = await Promise.all([
    api("pick-cards", { situation: session.situation, answers, methodId: session.methodId ?? undefined, worry, followups }),
    api("summary", { answered, followups, worry }),
    worry ? api("medical", { worry }) : Promise.resolve({ ok: true, value: [] }),
  ]);
  if (!pick.ok || !Array.isArray(pick.value?.items)) return { error: true };

  const items = pick.value.items.filter((it) => cardOf(it?.card_id));
  const prev = notebook.listPages()[0] ?? null;
  const carried = carryChecks(prev, items);
  const summaryText =
    summary.ok && typeof summary.value === "string" && summary.value.trim()
      ? summary.value
      : [...answered, ...followups].map(({ q, a }) => `${q}: ${a}`).concat(worry ? [`걱정: ${worry}`] : []).join("\n");
  const method = methodOf(session.methodId);
  const pageData = {
    situation: session.situation,
    situationTitle: s?.title ?? session.situation,
    compare: Boolean(s?.compare),
    methodId: method?.id ?? null,
    methodTitle: method?.title ?? null,
    answers,
    worry,
    followups,
    summary: summaryText,
    medical: medical.ok && Array.isArray(medical.value) ? medical.value.filter((x) => typeof x === "string") : [],
    usedAi: pick.usedAi,
    items: carried.map(({ done, ...rest }) => rest),
    checks: carried.filter((it) => it.done).map((it) => it.card_id),
    opened: [],
    changes: prev ? changedAnswers(prev.answers, answers) : [],
    emergencyKinds: session.emergencyKinds,
    watch: method?.watch?.length ? method.watch : s?.watch ?? [],
  };
  const id = notebook.savePage(pageData);
  session.builtPageId = id ?? "unsaved";
  if (!id) unsavedPage = { ...pageData, id: null, createdAt: Date.now() };
  return { id };
}
let unsavedPage = null;

function getPage(id) {
  if (id === "unsaved") return unsavedPage;
  return notebook.getPage(id);
}

// 저장한 페이지의 일부를 고친다. 저장하지 못한 페이지는 메모리에서만 고친다.
function updatePage(id, patch) {
  if (id === "unsaved" || !id) {
    if (unsavedPage) Object.assign(unsavedPage, patch);
    return unsavedPage;
  }
  return notebook.updatePage(id, patch);
}

// ---- 주소와 화면 ----
function nav(hash, { replace = false } = {}) {
  if (location.hash === hash) return route();
  if (replace) location.replace(hash);
  else location.hash = hash;
}

// 모든 화면 아래: "즉시 도움이 필요할 때"와 글자 크기.
function footer() {
  const size = el("button", { class: "text-button size-toggle", type: "button", "aria-pressed": String(prefs.large) }, prefs.large ? "글자 보통" : "글자 크게");
  size.addEventListener("click", () => {
    const on = toggleLarge();
    size.setAttribute("aria-pressed", String(on));
    size.textContent = on ? "글자 보통" : "글자 크게";
  });
  return el("footer", { class: "site-footer" }, el("a", { class: "help-link", href: "#/emergency" }, "즉시 도움이 필요할 때"), size);
}

// 새 화면을 그린 뒤 화면 낭독기가 새 제목부터 읽도록 제목에 초점을 옮긴다.
function settle() {
  put(root, footer());
  window.scrollTo(0, 0);
  const heading = root.querySelector("h1");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

const ctx = {
  el,
  put,
  fill,
  simcheong,
  get content() {
    return content;
  },
  get session() {
    return session;
  },
  get pendingEmergency() {
    return pendingEmergency;
  },
  notebook,
  nav,
  api,
  rankMethods,
  newSession,
  steps,
  currentAnswers,
  labelOf,
  questionText,
  situationOf,
  cardOf,
  qaOf,
  sourceOf,
  methodOf,
  checkEmergency,
  contactsFor,
  afterQuestions,
  buildPage,
  getPage,
  updatePage,
  settle,
  clearPendingEmergency() {
    pendingEmergency = null;
  },
};

function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  const [head, arg] = parts;
  const screen =
    head === undefined ? cover :
    head === "new" || head === "q" ? questions :
    head === "compare" ? compare :
    head === "page" ? page :
    head === "emergency" ? emergency :
    cover;
  // 응급 안내를 닫지 않고 다른 화면으로 갔으면 이어서 할 단계는 잊는다.
  if (screen !== emergency) pendingEmergency = null;
  root.replaceChildren();
  screen.render(root, { ...ctx, params: { head: head ?? "", arg: arg ? decodeURIComponent(arg) : null } });
}

async function init() {
  try {
    const res = await fetch("/api/content", { cache: "no-store" });
    if (!res.ok) throw new Error(`content_${res.status}`);
    content = await res.json();
    indexQuestions();
  } catch {
    fill(
      root,
      el("section", { class: "sheet" }, el("h1", {}, "화면을 불러오지 못했어요"), el("p", {}, "인터넷 연결을 확인하고 다시 열어 주세요."), el("button", { class: "primary", type: "button", onclick: () => location.reload() }, "다시 열기"))
    );
    settle();
    return;
  }
  window.addEventListener("hashchange", route);
  route();
}

init();
