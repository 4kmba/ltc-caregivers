// 돌봄수첩 검수 페이지.
// app/content/의 내용 파일 다섯 개와 review/assignments.json을 읽어, 검수 담당자가 맡은 카드, 돌봄 방식,
// FAQ, 자료를 읽기 쉬운 모양으로 보여 준다. 판정과 메모는 이 브라우저의 localStorage에만 저장하고,
// "결과 복사"로 GitHub 이슈에 붙일 댓글을 만든다. 내용 파일은 읽기만 하고 고치지 않는다.

const CONTENT = "../app/content/";
const STORE_KEY = "dolbom-review-v1";
const ISSUES_URL = "https://github.com/4kmba/ltc-caregivers/issues";

const TABS = [
  { id: "cards", label: "할 일 카드" },
  { id: "methods", label: "돌봄 방식" },
  { id: "faq", label: "FAQ" },
  { id: "sources", label: "자료 확인" },
];
const TOPIC_LABEL = {};

let C; // 내용
let A; // 담당
let label; // 조건을 사람이 읽는 말로 바꾸는 표
let store = loadStore();

// ---------- 저장 ----------
function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") return { reviewer: null, items: {}, ...parsed };
  } catch {}
  return { reviewer: null, items: {} };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
}
function rec(key) {
  const who = store.reviewer;
  store.items[who] ??= {};
  store.items[who][key] ??= {};
  return store.items[who][key];
}
function peek(key) {
  return store.items[store.reviewer]?.[key] ?? {};
}
const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ---------- DOM 도우미 ----------
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return node;
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}
function link(url, text) {
  return url ? el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, text ?? url) : text;
}

// ---------- 불러오기 ----------
async function boot() {
  try {
    const names = ["situations", "methods", "cards", "qa", "sources"];
    const [s, m, c, q, src, asg] = await Promise.all([
      ...names.map((n) => fetch(`${CONTENT}${n}.json`, { cache: "no-store" }).then(ok)),
      fetch("assignments.json", { cache: "no-store" }).then(ok),
    ]);
    C = {
      basic: s.basic, situations: s.situations, conditional: s.conditional, topics: s.topics,
      methods: m.methods, cards: c.cards, buckets: c.buckets, qa: q.qa, sources: src.sources,
    };
    C.card = new Map(C.cards.map((x) => [x.id, x]));
    C.qaById = new Map(C.qa.map((x) => [x.id, x]));
    C.method = new Map(C.methods.map((x) => [x.id, x]));
    C.source = new Map(C.sources.map((x) => [x.id, x]));
    C.sit = new Map(C.situations.map((x) => [x.id, x]));
    for (const t of C.topics) TOPIC_LABEL[t.id] = t.title;
    A = asg;
    label = buildLabels();
    C.usedBy = buildUsage();
  } catch (e) {
    document.getElementById("main").replaceChildren(
      el("div", { class: "error" },
        el("p", {}, el("b", {}, "내용 파일을 불러오지 못했어요.")),
        el("p", {}, `이 페이지는 저장소의 app/content/ 파일을 읽어요. 파일을 직접 열었다면(file://) 브라우저가 막으니, 저장소 맨 위 폴더에서 정적 서버를 띄워 /review/로 들어가 주세요. (${e.message})`)));
    return;
  }
  window.addEventListener("hashchange", render);
  render();
}
function ok(r) {
  if (!r.ok) throw new Error(`${r.url} ${r.status}`);
  return r.json();
}

// 답의 키와 값을 화면 문구로 바꾼다.
function buildLabels() {
  const key = { situation: "고른 상황" };
  const val = { situation: {} };
  for (const s of C.situations) val.situation[s.id] = s.title;
  const add = (k, name, options) => {
    key[k] ??= name;
    val[k] ??= {};
    for (const o of options ?? []) val[k][o.value] = o.label;
  };
  for (const screen of C.basic) for (const f of screen.fields) add(f.key, f.label ?? screen.title.replace(/\?$/, ""), f.options);
  for (const s of C.situations) for (const q of s.questions ?? []) add(q.key, `${s.title} › ${q.text}`, q.options);
  for (const q of C.conditional) add(q.key, q.text, q.options);
  return { key, val };
}
function condLine(group) {
  return Object.entries(group).map(([k, vs]) => {
    const names = vs.map((v) => label.val[k]?.[v] ?? v).join(", ");
    return `${label.key[k] ?? k}: ${names}`;
  }).join(" 그리고 ");
}

// 자료마다 어느 카드, 답, 방식이 가리키는지.
function buildUsage() {
  const used = new Map();
  const push = (id, item) => {
    if (!used.has(id)) used.set(id, []);
    used.get(id).push(item);
  };
  for (const c of C.cards) for (const id of new Set([...(c.source_ids ?? []), ...(c.contact_ids ?? [])])) push(id, { kind: "card", id: c.id });
  for (const q of C.qa) for (const id of new Set([...(q.source_ids ?? []), ...(q.contact_ids ?? [])])) push(id, { kind: "qa", id: q.id });
  for (const m of C.methods) for (const id of m.source_ids ?? []) push(id, { kind: "method", id: m.id });
  return used;
}

// ---------- 담당과 진행 ----------
function me() {
  return A.reviewers.find((r) => r.id === store.reviewer);
}
function itemsOf(tab, r = me()) {
  return { cards: r.cards, methods: r.methods, faq: r.faq, sources: r.sources }[tab] ?? [];
}
const KIND = { cards: "card", methods: "method", faq: "faq", sources: "src" };
function stateOf(tab, id) {
  const r = peek(`${KIND[tab]}:${id}`);
  if (r.status === "ok") return { cls: "ok", text: tab === "sources" ? "확인했어요" : "괜찮아요" };
  if (r.status === "fix") return { cls: "fix", text: tab === "sources" ? "문제 있어요" : "고칠 곳 있어요" };
  const started = r.note || (r.checks && Object.values(r.checks).some(Boolean)) || (r.qa && Object.keys(r.qa).length) || r.sits;
  return started ? { cls: "part", text: "보는 중" } : { cls: "", text: "아직" };
}
function doneCount(tab) {
  return itemsOf(tab).filter((id) => ["ok", "fix"].includes(peek(`${KIND[tab]}:${id}`).status)).length;
}

// ---------- 화면 ----------
function parseHash() {
  const [who, tab, id] = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/");
  return { who, tab, id };
}
function go(tab, id) {
  location.hash = `#${store.reviewer}/${tab}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

function render() {
  const { who, tab, id } = parseHash();
  if (who && A.reviewers.some((r) => r.id === who) && who !== store.reviewer) {
    store.reviewer = who;
    save();
  }
  renderWho();
  const main = document.getElementById("main");
  if (!me()) {
    main.replaceChildren(pickPerson());
    return;
  }
  const t = TABS.some((x) => x.id === tab) || tab === "result" ? tab : "cards";
  if (t === "result") main.replaceChildren(resultView());
  else if (id) main.replaceChildren(detailView(t, id));
  else main.replaceChildren(listView(t));
  if (!id) window.scrollTo(0, 0);
}

function renderWho() {
  const box = document.getElementById("who");
  box.replaceChildren(...A.reviewers.map((r) =>
    el("button", {
      type: "button", "aria-pressed": String(r.id === store.reviewer),
      onclick: () => { store.reviewer = r.id; save(); location.hash = `#${r.id}/cards`; },
    }, r.name)));
}

function pickPerson() {
  return el("div", {},
    el("p", {}, "검수하실 분의 이름을 위에서 골라 주세요. 그 사람이 맡은 카드, 돌봄 방식, FAQ, 자료만 나와요."),
    el("p", { class: "intro" }, "담당은 review/assignments.json에 적혀 있어요."));
}

function header(active) {
  const r = me();
  const total = TABS.reduce((n, t) => n + itemsOf(t.id).length, 0);
  const done = TABS.reduce((n, t) => n + doneCount(t.id), 0);
  return [
    el("p", { class: "intro" },
      el("b", {}, `${r.name}`), ` 님이 맡은 것 ${total}개 가운데 ${done}개를 봤어요. `,
      "다 보지 않았어도 언제든 ", el("a", { href: `#${r.id}/result` }, "결과 복사"), "로 중간 결과를 이슈에 남길 수 있어요."),
    el("div", { class: "bar", "aria-hidden": "true" }, el("i", { style: `width:${total ? (done / total) * 100 : 0}%` })),
    el("div", { class: "progress", role: "tablist" },
      TABS.map((t) => el("button", {
        type: "button", class: "tab", role: "tab", "aria-selected": String(t.id === active),
        onclick: () => go(t.id),
      }, el("span", { class: "n" }, `${doneCount(t.id)}/${itemsOf(t.id).length}`), el("span", { class: "l" }, t.label)))),
  ];
}

const HIDE_KEY = "dolbom-review-hide-done";
function hideDone() {
  try { return localStorage.getItem(HIDE_KEY) === "1"; } catch { return false; }
}

function listView(tab) {
  const ids = itemsOf(tab);
  const hide = hideDone();
  const shown = ids.filter((id) => !hide || !["ok", "fix"].includes(peek(`${KIND[tab]}:${id}`).status));
  const intro = {
    cards: "카드마다 할 일, 왜 필요한가, 연락할 곳, 붙은 질문과 답을 출처와 맞춰 봐 주세요.",
    methods: "돌봄 방식 비교 카드예요. 장단점, 비용 기준, 점수 규칙과 이유 문장이 맞는지 봐 주세요.",
    faq: "카드에 붙지 않은 주제별 질문과 답이에요.",
    sources: "자료 링크를 직접 열어 이름, 기관, 전화번호, 요약이 원문과 맞는지 봐 주세요. 확인하면 두 번째 확인 기록이 남아요.",
  }[tab];
  return el("div", {},
    header(tab),
    el("p", { class: "intro" }, intro),
    el("div", { class: "tools" },
      el("label", {}, el("input", {
        type: "checkbox", checked: hide,
        onchange: (e) => { try { localStorage.setItem(HIDE_KEY, e.target.checked ? "1" : "0"); } catch {} render(); },
      }), "다 본 것 숨기기"),
      el("span", { class: "spacer" }),
      el("button", { type: "button", class: "btn small primary", onclick: () => go("result") }, "결과 복사")),
    shown.length
      ? el("ul", { class: "list" }, shown.map((id) => el("li", {}, rowFor(tab, id))))
      : el("p", { class: "empty" }, ids.length ? "모두 봤어요. 결과를 복사해 이슈에 붙여 주세요." : "이 칸에 맡은 것이 없어요."));
}

function rowFor(tab, id) {
  const st = stateOf(tab, id);
  let title = id, sub = "";
  if (tab === "cards") {
    const c = C.card.get(id);
    title = c?.title ?? "(카드 없음)";
    sub = `${C.buckets[c?.bucket] ?? ""} · 질문 ${c?.qa_ids?.length ?? 0}개`;
  } else if (tab === "methods") {
    const m = C.method.get(id);
    title = m?.title ?? "(방식 없음)";
    sub = C.sit.get(m?.situation)?.title ?? "";
  } else if (tab === "faq") {
    const q = C.qaById.get(id);
    title = q?.q ?? "(질문 없음)";
    sub = TOPIC_LABEL[q?.topic] ?? "";
  } else {
    const s = C.source.get(id);
    title = s?.name ?? "(자료 없음)";
    const who = (s?.checks ?? []).map((x) => x.by).join(", ");
    sub = `${s?.org || kindLabel(s)} · 지금 확인: ${who || "없음"}`;
  }
  return el("button", { type: "button", class: "row", onclick: () => go(tab, id) },
    el("span", { class: "id" }, tab === "sources" ? "" : id.replace(/^faq-/, "")),
    el("span", { class: "t" }, title, el("span", { class: "sub" }, sub)),
    el("span", { class: `state ${st.cls}` }, st.text));
}
function kindLabel(s) {
  return { page: "자료 페이지", place: "연락할 곳 (링크 없음)", contact: "연락처" }[s?.kind] ?? "";
}

function detailView(tab, id) {
  const ids = itemsOf(tab);
  const i = ids.indexOf(id);
  const prev = i > 0 ? ids[i - 1] : null;
  const next = i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
  const body = { cards: cardSheet, methods: methodSheet, faq: faqSheet, sources: sourceSheet }[tab](id);
  return el("div", {},
    el("nav", { class: "detail-nav" },
      el("button", { type: "button", class: "btn small", onclick: () => go(tab) }, "← 목록"),
      el("span", { class: "pos" }, i >= 0 ? `${i + 1} / ${ids.length}` : "맡지 않은 항목"),
      el("button", { type: "button", class: "btn small", disabled: !prev, onclick: () => go(tab, prev) }, "이전"),
      el("button", { type: "button", class: "btn small primary", disabled: !next, onclick: () => go(tab, next) }, "다음")),
    body);
}

function sec(title, ...kids) {
  return el("div", { class: "sec" }, el("h3", {}, title), ...kids);
}
function sourceList(ids, emptyText = "없음") {
  if (!ids?.length) return el("p", { class: "empty" }, emptyText);
  return el("ul", { class: "srcs" }, ids.map((sid) => {
    const s = C.source.get(sid);
    if (!s) return el("li", {}, `${sid} (자료 목록에 없음)`);
    const who = (s.checks ?? []).map((x) => x.by);
    return el("li", {},
      s.url ? link(s.url, s.name) : el("b", {}, s.name),
      s.org ? ` · ${s.org}` : "",
      s.phone ? ` · ☎ ${s.phone}` : "",
      el("div", { class: "chk" }, `확인한 사람 ${new Set(who).size}명${who.length ? ` (${who.join(", ")})` : ""}`));
  }));
}

function conditions(card) {
  const lines = [];
  if (card.situations?.length) lines.push(["나오는 상황", card.situations.map((s) => C.sit.get(s)?.title ?? s).join(", ")]);
  if (card.when) lines.push(["모두 맞아야 나옴", condLine(card.when)]);
  if (card.when_any?.length) lines.push(["이 중 하나만 맞으면 나옴", card.when_any.map((g, n) => `(${n + 1}) ${condLine(g)}`).join(" / ")]);
  if (card.when_not) lines.push(["하나라도 맞으면 빠짐", condLine(card.when_not)]);
  if (card.boost) lines.push(["맞으면 먼저 고름", condLine(card.boost)]);
  if (lines.length === 1) lines.push(["그 밖의 조건", "없음. 상황만 맞으면 후보가 돼요"]);
  return el("ul", { class: "cond" }, lines.map(([k, v]) => el("li", {}, el("b", {}, `${k}: `), v)));
}

function cardSheet(id) {
  const c = C.card.get(id);
  if (!c) return el("p", { class: "error" }, `${id} 카드가 내용 파일에 없어요.`);
  const key = `card:${id}`;
  return el("article", { class: "sheet" },
    el("div", { class: "meta" },
      el("span", { class: "chip ink" }, id),
      el("span", { class: "chip" }, C.buckets[c.bucket] ?? c.bucket),
      el("span", { class: "chip" }, `우선순위 ${c.priority}`)),
    el("h2", {}, c.title),
    sec("왜 필요한가", el("p", {}, c.why)),
    sec("연락할 곳", c.contact_note ? el("p", {}, c.contact_note) : null, sourceList(c.contact_ids, "연락할 곳 없음")),
    sec("출처", sourceList(c.source_ids, "출처 없음")),
    sec("언제 나오나", conditions(c)),
    sec(`붙은 질문과 답 (${c.qa_ids?.length ?? 0}개)`, el("ol", { class: "qa" }, (c.qa_ids ?? []).map((qid, n) => qaItem(key, qid, n + 1)))),
    verdict(key, "card", c));
}

function qaItem(key, qid, n) {
  const q = C.qaById.get(qid);
  if (!q) return el("li", {}, `${qid} (질문 없음)`);
  const r = peek(key).qa?.[qid] ?? {};
  const noteBox = el("textarea", {
    placeholder: "이 답에서 고칠 곳과 근거 링크를 적어 주세요",
    oninput: (e) => { rec(key).qa ??= {}; rec(key).qa[qid] = { flag: true, note: e.target.value }; save(); },
  });
  noteBox.value = r.note ?? "";
  return el("li", {},
    el("p", { class: "q" }, `${n}. ${q.q}`),
    el("p", { class: "a" }, q.a),
    el("div", { class: "foot-row" },
      q.medical ? el("span", { class: "chip med" }, "의료 주제: 진단·약·증상 판단이 없는지 봐 주세요") : null,
      el("span", { class: "chip" }, TOPIC_LABEL[q.topic] ?? q.topic),
      el("button", {
        type: "button", class: "btn small flag", "aria-pressed": String(!!r.flag),
        onclick: () => {
          const R = rec(key);
          R.qa ??= {};
          if (R.qa[qid]?.flag) delete R.qa[qid];
          else { R.qa[qid] = { flag: true, note: "" }; R.status = "fix"; }
          save(); render();
        },
      }, r.flag ? "고칠 곳 표시됨" : "이 답에 고칠 곳 있음")),
    (q.source_ids?.length || q.contact_ids?.length) ? el("details", {}, el("summary", {}, "이 답의 출처"), sourceList([...(q.source_ids ?? []), ...(q.contact_ids ?? [])])) : null,
    r.flag ? noteBox : null);
}

function methodSheet(id) {
  const m = C.method.get(id);
  if (!m) return el("p", { class: "error" }, `${id} 방식이 내용 파일에 없어요.`);
  const cardTitle = (cid) => `${cid} ${C.card.get(cid)?.title ?? "(카드 없음)"}`;
  return el("article", { class: "sheet" },
    el("div", { class: "meta" },
      el("span", { class: "chip ink" }, C.sit.get(m.situation)?.title ?? m.situation),
      el("span", { class: "chip" }, `쓴 사람: ${(m.from ?? []).join(", ")}`)),
    el("h2", {}, m.title),
    el("p", {}, m.summary),
    el("div", { class: "two" },
      sec("장점", el("ul", {}, (m.pros ?? []).map((x) => el("li", {}, x)))),
      sec("단점", el("ul", {}, (m.cons ?? []).map((x) => el("li", {}, x))))),
    sec("비용 기준", el("p", {}, m.cost)),
    sec("가족 부담", el("p", {}, m.burden)),
    sec("바로 시작할 수 있나", el("p", {}, m.start_now)),
    sec("점수 규칙 (답과 맞으면 점수를 더하고, 1등 하나에 이유 문장을 붙임)",
      el("ul", {}, (m.rules ?? []).map((r) => el("li", {}, `${condLine({ [r.key]: r.is })} → +${r.score}점 · "${r.reason}"`)))),
    sec("먼저 넣을 할 일", el("ul", {}, (m.first_cards ?? []).map((c) => el("li", {}, cardTitle(c))))),
    m.exclude_cards?.length ? sec("뺄 할 일", el("ul", {}, m.exclude_cards.map((c) => el("li", {}, cardTitle(c))))) : null,
    sec("지켜볼 신호", el("ul", {}, (m.watch ?? []).map((x) => el("li", {}, x)))),
    sec("출처", sourceList(m.source_ids, "출처 없음")),
    verdict(`method:${id}`, "method", m));
}

function faqSheet(id) {
  const q = C.qaById.get(id);
  if (!q) return el("p", { class: "error" }, `${id} 질문이 내용 파일에 없어요.`);
  return el("article", { class: "sheet" },
    el("div", { class: "meta" },
      el("span", { class: "chip ink" }, TOPIC_LABEL[q.topic] ?? q.topic),
      q.medical ? el("span", { class: "chip med" }, "의료 주제") : null),
    el("h2", {}, q.q),
    el("p", {}, q.a),
    q.medical ? el("p", { class: "intro" }, "의료 주제라 진단, 약 이름, 복용량, 증상 판단이 들어 있지 않은지 특히 봐 주세요.") : null,
    sec("출처", sourceList([...(q.source_ids ?? []), ...(q.contact_ids ?? [])], "출처 없음")),
    verdict(`faq:${id}`, "faq", q));
}

const SRC_CHECKS = {
  page: [
    ["open", "링크를 직접 열어 원문을 봤어요"],
    ["name", "이름과 기관이 원문과 같아요"],
    ["phone", "전화번호가 맞아요 (번호가 없으면 체크)"],
    ["summary", "요약이 원문과 맞아요 (요약이 없으면 체크)"],
    ["usage", "이 자료를 쓰는 카드와 답의 내용이 원문과 맞아요"],
  ],
  place: [
    ["name", "이름과 설명이 실제로 있는 곳과 맞아요"],
    ["usage", "이 곳을 안내하는 카드와 답의 내용이 맞아요"],
  ],
};
SRC_CHECKS.contact = [
  ["open", "공식 안내에서 번호를 직접 확인했어요"],
  ["name", "이름과 기관이 맞아요"],
  ["phone", "전화번호가 맞아요"],
  ["usage", "이 번호를 안내하는 카드와 답의 내용이 맞아요"],
];

function sourceSheet(id) {
  const s = C.source.get(id);
  if (!s) return el("p", { class: "error" }, `${id} 자료가 내용 파일에 없어요.`);
  const uses = C.usedBy.get(id) ?? [];
  const who = (s.checks ?? []).map((x) => `${x.by} (${x.date})`);
  return el("article", { class: "sheet" },
    el("div", { class: "meta" },
      el("span", { class: "chip ink" }, kindLabel(s)),
      el("span", { class: "chip" }, `번호 ${s.id}`),
      el("span", { class: "chip" }, `쓴 사람: ${(s.from ?? []).join(", ")}`)),
    el("h2", {}, s.name),
    s.org ? el("p", {}, s.org) : null,
    s.url ? el("p", {}, el("a", { class: "big-link", href: s.url, target: "_blank", rel: "noopener noreferrer" }, "원문 열기 ↗"), el("br"), el("span", { class: "chk" }, s.url)) : null,
    sec("전화번호", el("p", {}, s.phone ?? "없음")),
    sec("요약", el("p", {}, s.summary || "비어 있음")),
    s.emergency_only ? sec("응급 안내 전용", el("p", {}, "응급 안내 화면에만 쓰는 자료예요.")) : null,
    sec("지금까지 확인한 사람", el("p", {}, who.length ? who.join(", ") : "아무도 없음")),
    sec(`이 자료를 쓰는 곳 (${uses.length}곳)`, uses.length ? el("div", {}, uses.map(useItem)) : el("p", { class: "empty" }, "쓰는 곳이 없어요")),
    verdict(`src:${id}`, "src", s));
}
function useItem(u) {
  if (u.kind === "card") {
    const c = C.card.get(u.id);
    return el("details", {}, el("summary", {}, `카드 ${u.id} · ${c?.title}`), el("p", {}, c?.why), c?.contact_note ? el("p", {}, `연락할 곳: ${c.contact_note}`) : null);
  }
  if (u.kind === "qa") {
    const q = C.qaById.get(u.id);
    return el("details", {}, el("summary", {}, `${q?.card_id ? `카드 ${q.card_id}` : "FAQ"} 질문 · ${q?.q}`), el("p", {}, q?.a));
  }
  const m = C.method.get(u.id);
  return el("details", {}, el("summary", {}, `돌봄 방식 · ${m?.title}`), el("p", {}, `${m?.summary} 비용 기준: ${m?.cost}`));
}

// 판정 칸. 카드는 상황 의견도 받는다.
function verdict(key, kind, item) {
  const r = peek(key);
  const isSrc = kind === "src";
  const checks = isSrc ? (SRC_CHECKS[item.kind] ?? SRC_CHECKS.page) : [];
  const allChecked = checks.every(([k]) => r.checks?.[k]);
  const set = (status) => {
    const R = rec(key);
    R.status = R.status === status ? undefined : status;
    if (isSrc && R.status === "ok") R.date = today();
    save(); render();
    if (R.status) toast(isSrc && R.status === "ok" ? `확인 기록: ${me().name}, ${R.date}` : "저장했어요");
  };
  const note = el("textarea", {
    id: `note-${key}`,
    placeholder: isSrc ? "문제가 있으면 무엇이 다른지와 새 링크를 적어 주세요" : "고칠 곳을 적어 주세요. 예: 지원 금액이 바뀜 (근거 링크)",
    oninput: (e) => { rec(key).note = e.target.value; save(); },
  });
  note.value = r.note ?? "";

  let sitBox = null;
  if (kind === "card") {
    const current = new Set(item.situations ?? []);
    const chosen = new Set(r.sits ?? item.situations ?? []);
    sitBox = el("div", {},
      el("p", { class: "hint" }, "이 카드가 어느 상황에 나와야 할까요? 지금 표시된 상황에서 바꾸고 싶을 때만 눌러 주세요."),
      el("div", { class: "sit-pick" }, C.situations.map((s) => el("button", {
        type: "button", "aria-pressed": String(chosen.has(s.id)),
        onclick: () => {
          const R = rec(key);
          const next = new Set(R.sits ?? item.situations ?? []);
          next.has(s.id) ? next.delete(s.id) : next.add(s.id);
          const same = next.size === current.size && [...next].every((x) => current.has(x));
          if (same) delete R.sits; else R.sits = C.situations.map((x) => x.id).filter((x) => next.has(x));
          save(); render();
        },
      }, s.title))));
  }

  return el("section", { class: "verdict" },
    el("h3", {}, isSrc ? "확인 결과" : "검수 결과"),
    isSrc ? el("ul", { class: "checklist" }, checks.map(([k, text]) => el("li", {}, el("label", {},
      el("input", { type: "checkbox", checked: !!r.checks?.[k], onchange: (e) => { const R = rec(key); R.checks ??= {}; R.checks[k] = e.target.checked; save(); render(); } }),
      el("span", {}, text))))) : null,
    el("div", { class: "choices" },
      el("button", {
        type: "button", class: "choice ok", "aria-pressed": String(r.status === "ok"),
        disabled: isSrc && !allChecked && r.status !== "ok",
        onclick: () => set("ok"),
      }, isSrc ? "확인했어요" : "괜찮아요"),
      el("button", { type: "button", class: "choice fix", "aria-pressed": String(r.status === "fix"), onclick: () => set("fix") }, isSrc ? "문제 있어요" : "고칠 곳 있어요")),
    isSrc && !allChecked && r.status !== "ok" ? el("p", { class: "hint" }, "위 항목을 모두 체크하면 \"확인했어요\"를 누를 수 있어요.") : null,
    r.status === "ok" && isSrc ? el("p", { class: "hint" }, `${me().name}, ${r.date} 확인으로 기록돼요.`) : null,
    sitBox,
    el("p", { class: "hint" }, "메모 (선택)"),
    note);
}

// ---------- 결과 ----------
function buildResult() {
  const r = me();
  const items = store.items[r.id] ?? {};
  const get = (k) => items[k] ?? {};
  const lines = [];
  const date = today();
  const count = (tab) => `${doneCount(tab)}/${itemsOf(tab).length}`;
  lines.push(`### 돌봄수첩 검수 결과: ${r.name} (${date})`, "");
  lines.push(`본 것: 할 일 카드 ${count("cards")} · 돌봄 방식 ${count("methods")} · FAQ ${count("faq")} · 자료 ${count("sources")}`, "");

  const fixes = [];
  for (const id of r.cards) {
    const x = get(`card:${id}`);
    const qa = Object.entries(x.qa ?? {}).filter(([, v]) => v.flag);
    if (x.status !== "fix" && !qa.length) continue;
    fixes.push(`- **카드 ${id}** ${C.card.get(id)?.title}${x.note ? `: ${oneLine(x.note)}` : ""}`);
    for (const [qid, v] of qa) {
      const q = C.qaById.get(qid);
      const n = (C.card.get(id)?.qa_ids ?? []).indexOf(qid) + 1;
      fixes.push(`  - 질문 ${n} "${q?.q}": ${oneLine(v.note) || "(메모 없음)"}`);
    }
  }
  for (const id of r.methods) {
    const x = get(`method:${id}`);
    if (x.status === "fix") fixes.push(`- **돌봄 방식** ${C.method.get(id)?.title} (\`${id}\`)${x.note ? `: ${oneLine(x.note)}` : ""}`);
  }
  for (const id of r.faq) {
    const x = get(`faq:${id}`);
    if (x.status === "fix") fixes.push(`- **FAQ** ${C.qaById.get(id)?.q} (\`${id}\`)${x.note ? `: ${oneLine(x.note)}` : ""}`);
  }
  lines.push("#### 고칠 곳", "", ...(fixes.length ? fixes : ["- 없음"]), "");

  const sits = r.cards.filter((id) => get(`card:${id}`).sits).map((id) => {
    const name = (ids) => ids.map((s) => C.sit.get(s)?.title ?? s).join(", ") || "(없음)";
    return `- 카드 ${id}: 지금 ${name(C.card.get(id)?.situations ?? [])} → 제안 ${name(get(`card:${id}`).sits)}`;
  });
  if (sits.length) lines.push("#### 상황 표시를 바꾸자는 의견", "", ...sits, "");

  const srcProblems = r.sources.filter((id) => get(`src:${id}`).status === "fix")
    .map((id) => `- \`${id}\` ${C.source.get(id)?.name}${get(`src:${id}`).note ? `: ${oneLine(get(`src:${id}`).note)}` : ""}`);
  if (srcProblems.length) lines.push("#### 문제가 있는 자료", "", ...srcProblems, "");

  const okCards = r.cards.filter((id) => get(`card:${id}`).status === "ok");
  const okMethods = r.methods.filter((id) => get(`method:${id}`).status === "ok");
  const okFaq = r.faq.filter((id) => get(`faq:${id}`).status === "ok");
  const okSrc = r.sources.filter((id) => get(`src:${id}`).status === "ok");
  lines.push("#### 문제없이 본 것", "");
  lines.push(`- 카드: ${okCards.join(", ") || "없음"}`);
  if (r.methods.length) lines.push(`- 돌봄 방식: ${okMethods.map((x) => `\`${x}\``).join(", ") || "없음"}`);
  if (r.faq.length) lines.push(`- FAQ: ${okFaq.map((x) => `\`${x}\``).join(", ") || "없음"}`);
  lines.push(`- 확인한 자료 ${okSrc.length}개: ${okSrc.map((x) => `\`${x}\``).join(", ") || "없음"}`);
  const notes = [
    ...okCards.filter((id) => get(`card:${id}`).note).map((id) => `- 카드 ${id}: ${oneLine(get(`card:${id}`).note)}`),
    ...okSrc.filter((id) => get(`src:${id}`).note).map((id) => `- 자료 \`${id}\`: ${oneLine(get(`src:${id}`).note)}`),
  ];
  if (notes.length) lines.push("", "#### 그 밖의 메모", "", ...notes);

  const data = {
    reviewer: r.name,
    date,
    checks: okSrc.map((id) => ({ source: id, by: r.name, date: get(`src:${id}`).date ?? date })),
    ok: { cards: okCards, methods: okMethods, faq: okFaq },
    fix: {
      cards: r.cards.filter((id) => get(`card:${id}`).status === "fix"),
      methods: r.methods.filter((id) => get(`method:${id}`).status === "fix"),
      faq: r.faq.filter((id) => get(`faq:${id}`).status === "fix"),
      sources: r.sources.filter((id) => get(`src:${id}`).status === "fix"),
    },
    situations: Object.fromEntries(r.cards.filter((id) => get(`card:${id}`).sits).map((id) => [id, get(`card:${id}`).sits])),
  };
  lines.push("", "<details><summary>기록용 데이터 (sources.json의 checks에 옮길 때 씀)</summary>", "", "```json", JSON.stringify(data, null, 1), "```", "", "</details>");
  return lines.join("\n");
}
function oneLine(s) {
  return String(s ?? "").replace(/\s*\n+\s*/g, " / ").trim();
}

function resultView() {
  const r = me();
  const text = buildResult();
  const box = el("textarea", { class: "out", readonly: true, "aria-label": "이슈에 붙일 댓글" });
  box.value = text;
  const issue = r.issue ? `${ISSUES_URL}/${r.issue}` : ISSUES_URL;
  return el("div", {},
    header(null),
    el("article", { class: "sheet" },
      el("h2", {}, "결과를 이슈에 남기기"),
      el("ol", { class: "steps" },
        el("li", {}, "아래 ", el("b", {}, "댓글 복사"), "를 눌러요."),
        el("li", {}, link(issue, r.issue ? `내 검수 이슈 #${r.issue}` : "검수 이슈"), "를 열어 댓글 칸에 붙여 넣고 Comment를 눌러요."),
        el("li", {}, "중간에 여러 번 올려도 괜찮아요. 마지막 댓글이 최신 결과예요.")),
      el("div", { class: "tools" },
        el("button", { type: "button", class: "btn primary", onclick: () => copy(text, box) }, "댓글 복사"),
        el("a", { class: "big-link", href: issue, target: "_blank", rel: "noopener noreferrer" }, "이슈 열기 ↗")),
      box,
      sec("다른 기기로 옮기기",
        el("p", { class: "intro" }, "검수 기록은 이 브라우저에만 있어요. 다른 기기에서 이어 하려면 파일로 저장해 그 기기에서 불러와 주세요."),
        el("div", { class: "tools" },
          el("button", { type: "button", class: "btn small", onclick: exportFile }, "기록 파일 저장"),
          el("label", { class: "btn small" }, "기록 파일 불러오기", el("input", { type: "file", accept: "application/json", hidden: true, onchange: importFile })),
          el("span", { class: "spacer" }),
          el("button", { type: "button", class: "btn small", onclick: clearMine }, `${r.name} 기록 지우기`)))));
}

async function copy(text, box) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    box.select();
    document.execCommand("copy");
  }
  toast("복사했어요. 이슈 댓글 칸에 붙여 넣어 주세요.");
}
function exportFile() {
  const blob = new Blob([JSON.stringify({ reviewer: store.reviewer, items: store.items[store.reviewer] ?? {} }, null, 1)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `review-${me().name}-${today()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
}
function importFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  file.text().then((t) => {
    const d = JSON.parse(t);
    if (!d.reviewer || typeof d.items !== "object") throw new Error("형식이 달라요");
    if (d.reviewer !== store.reviewer && !confirm(`이 파일은 다른 사람(${A.reviewers.find((x) => x.id === d.reviewer)?.name ?? d.reviewer})의 기록이에요. 그래도 불러올까요?`)) return;
    store.items[d.reviewer] = d.items;
    store.reviewer = d.reviewer;
    save();
    location.hash = `#${d.reviewer}/result`;
    render();
    toast("불러왔어요");
  }).catch((err) => alert(`불러오지 못했어요: ${err.message}`));
}
function clearMine() {
  if (!confirm(`${me().name} 님의 검수 기록을 이 브라우저에서 모두 지울까요? 되돌릴 수 없어요.`)) return;
  delete store.items[store.reviewer];
  save();
  render();
}

boot();
