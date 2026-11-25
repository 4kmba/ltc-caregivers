// 수첩 페이지. 이후 맡는 자리: 김영균(틀), B2(오늘 정리한 내용), B3(질문에 답하기).
// 주소: #/page/new(이번 답으로 만들기), #/page/<id>(저장한 페이지), #/page/unsaved(저장하지 못한 페이지).
// 제목(날짜, 상황) 아래에 기본 정보 한 줄. 그다음 순서는 스펙 3절 7단계: 오늘 정리한 내용 / 지난번과 달라진 답 / 고른 방식 / 지금은 이 일부터 / 더 해 볼 만한 일 / 이럴 때 다시 열어 보세요 / 그날 열어 본 질문.
// 연락처와 링크는 sources에서만 꺼낸다. AI가 쓴 글(why, 요약, 답)에서 번호나 링크를 꺼내지 않는다.
// 모양은 11/25 디자인 캔버스의 수첩 페이지: 노랑 머리 띠(표지로, 날짜, 상황, 기본 정보 한 줄) 아래에 소제목과 내용이 30px 간격으로 놓인다.
// 아직 만들지 않은 "상황이 바뀌었어요"와 "카톡으로 보낼 글 복사"는 버튼을 두지 않는다.

const CONFIRM_LINE = "신청하기 전에 공단(1577-1000)이나 안내된 기관에 꼭 확인해 주세요.";
const URGENT_LINE = "위급할 수 있으면 먼저 119에 전화하세요.";
const REASSURE_LINE = "꼭 다 하지 않아도 괜찮아요. 필요한 것부터 살펴보세요.";
const MEDICAL_LINE = "참고만 하시고, 정확한 내용은 의료진과 상담하세요.";

// 머리 띠의 날짜는 "11.25" 꼴. 낭독기에는 "11월 25일"로 읽히게 한다.
const shortDate = (t) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
};
const longDate = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

export function render(root, ctx) {
  const { params } = ctx;
  if (params.arg === "new") return renderBuilding(root, ctx);
  const page = ctx.getPage(params.arg);
  if (!page) return renderMissing(root, ctx);
  renderPage(root, ctx, page, params.arg);
}

function renderMissing(root, ctx) {
  const { el } = ctx;
  ctx.put(root,
    el("section", { class: "sheet" }, el("h1", { class: "q-title" }, "이 기록을 찾지 못했어요"), el("p", { class: "q-lead" }, "지웠거나 다른 휴대폰에서 만든 기록일 수 있어요."), el("a", { class: "primary link-button", href: "#/" }, "처음 화면으로"))
  );
  ctx.settle();
}

async function renderBuilding(root, ctx) {
  const { el, session } = ctx;
  if (!session) return ctx.nav("#/", { replace: true });
  // 뒤로 가기로 다시 들어와도 같은 답으로 페이지를 두 번 만들지 않는다.
  if (session.builtPageId) return ctx.nav(`#/page/${session.builtPageId}`, { replace: true });

  // 걱정 칸과 보충 질문의 글을 AI에 보내기 전에 응급 신호를 한 번 더 본다.
  if (ctx.emergencyBeforeBuild()) return;

  const here = location.hash;
  ctx.put(root, el("section", { class: "sheet loading-sheet" }, ctx.simcheong("default"), el("h1", { class: "q-title" }, "제안을 고르는 중이에요"), el("p", { class: "loading", role: "status" }, "10초쯤 걸려요.")));
  ctx.settle();

  const result = await ctx.buildPage();
  if (location.hash !== here) return;
  if (result.error) {
    ctx.fill(root,
      el(
        "section",
        { class: "sheet" },
        el("h1", { class: "q-title" }, "제안을 불러오지 못했어요"),
        el("p", { class: "q-lead" }, "적어 주신 답은 그대로 있어요. 인터넷 연결을 확인하고 다시 눌러 주세요."),
        el("button", { class: "primary", type: "button", onclick: () => ctx.nav("#/page/new") }, "다시 불러오기")
      )
    );
    ctx.settle();
    return;
  }
  ctx.nav(`#/page/${encodeURIComponent(result.id ?? "unsaved")}`, { replace: true });
}

function section(el, title, ...children) {
  return el("section", { class: "page-section" }, el("h2", { class: "page-h2" }, title), ...children);
}

// 자료 번호 목록을 링크와 전화 버튼으로 바꾼다. 없는 번호(검수 전이라 빠진 자료)는 건너뛴다.
function contactList(ctx, ids) {
  const { el } = ctx;
  const found = (ids ?? []).map(ctx.sourceOf).filter(Boolean);
  if (!found.length) return null;
  return el(
    "ul",
    { class: "contacts" },
    found.map((s) =>
      el(
        "li",
        {},
        el("span", { class: "contact-name" }, s.name),
        s.phone ? el("a", { class: "call", href: `tel:${s.phone.replace(/-/g, "")}` }, ctx.icon("phone", 18), `${s.phone} 전화하기`) : null,
        s.url ? el("a", { class: "text-link", href: s.url, target: "_blank", rel: "noopener noreferrer" }, "홈페이지 열기") : null
      )
    )
  );
}

function sourceList(ctx, ids) {
  const { el } = ctx;
  const found = (ids ?? []).map(ctx.sourceOf).filter(Boolean);
  if (!found.length) return null;
  return el(
    "ul",
    { class: "sources" },
    found.map((s) => el("li", {}, s.url ? el("a", { class: "text-link", href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.name) : s.name, s.org ? ` (${s.org})` : ""))
  );
}

// 펼침 줄: 왼쪽 글, 오른쪽 아래 화살표. 펼치면 화살표가 뒤집힌다(CSS).
function toggleRow(ctx, label, cls = "") {
  const { el } = ctx;
  return el("button", { class: `toggle-row ${cls}`.trim(), type: "button", "aria-expanded": "false" }, el("span", {}, label), ctx.icon("down", 18));
}

function renderPage(root, ctx, page, pageId) {
  const { el } = ctx;
  const checks = new Set(Array.isArray(page.checks) ? page.checks : []);
  const opened = Array.isArray(page.opened) ? [...page.opened] : [];
  const urgent = Array.isArray(page.emergencyKinds) && page.emergencyKinds.length > 0;
  const items = (Array.isArray(page.items) ? page.items : []).filter((it) => ctx.cardOf(it?.card_id));
  const [first, ...rest] = items;
  const status = el("p", { class: "visually-hidden", role: "status" });

  function save(patch) {
    const ok = ctx.updatePage(pageId, patch);
    if (!ok) status.textContent = "이 휴대폰에 남기지 못했어요.";
    else Object.assign(page, patch);
  }

  // 그날 열어 본 질문. 한 줄씩 놓고 누르면 그때 본 답이 펼쳐진다. 질문을 새로 열 때마다 다시 그린다.
  const openedBox = el("div", { class: "opened" });
  function drawOpened() {
    ctx.fill(
      openedBox,
      opened.length
        ? el(
            "ul",
            { class: "opened-list" },
            opened.map((o) =>
              el("li", {}, el("details", { class: "opened-item" }, el("summary", {}, el("span", {}, o.q), ctx.icon("right", 18)), el("p", { class: "opened-a" }, o.a)))
            )
          )
        : el("p", { class: "page-meta" }, "제안 아래 질문을 누르면 그때 읽은 답이 여기에 남아요.")
    );
  }
  drawOpened();

  // 질문 하나. 처음 누르면 답을 받아 펼치고 page.opened에 저장한다. 다시 열면 저장한 글을 그대로 보여 준다.
  function askButton(qa) {
    const slot = el("div", { class: "answer-slot", "aria-live": "polite" });
    const btn = el("button", { class: "ask", type: "button", "aria-expanded": "false" }, el("span", {}, qa.q), ctx.icon("down", 18));
    const show = (text) =>
      ctx.fill(
        slot,
        el(
          "div",
          { class: "answer" },
          urgent ? el("p", { class: "urgent" }, URGENT_LINE) : null,
          qa.medical ? el("p", { class: "note" }, MEDICAL_LINE) : null,
          el("p", { class: "answer-text" }, text),
          sourceList(ctx, qa.source_ids)
        )
      );
    btn.addEventListener("click", async () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      if (!open) return ctx.fill(slot);
      const saved = opened.find((o) => o.qaId === qa.id);
      if (saved) return show(saved.a);
      ctx.fill(slot, el("p", { class: "loading" }, "답을 가져오는 중이에요."));
      const res = await ctx.api("answer", { qaId: qa.id, answers: page.answers });
      const text = res.ok && typeof res.value === "string" && res.value.trim() ? res.value : qa.a;
      if (!opened.some((o) => o.qaId === qa.id)) {
        opened.push({ qaId: qa.id, q: qa.q, a: text, at: Date.now() });
        save({ opened: [...opened] });
        drawOpened();
      }
      if (btn.getAttribute("aria-expanded") === "true") show(text);
    });
    return [btn, slot];
  }

  // 펼친 칸: 연락할 곳, 물어볼 질문, 출처, 확인 시점. withWhy면 "왜 지금"을 맨 위에 둔다(더 해 볼 만한 일).
  function detail(card, item, { withWhy = false } = {}) {
    const qas = (card.qa_ids ?? []).map(ctx.qaOf).filter(Boolean);
    return el(
      "div",
      { class: "detail" },
      withWhy ? el("section", {}, el("h3", {}, "지금 하면 좋은 이유"), el("p", {}, item.why || card.why)) : null,
      el("section", {}, el("h3", {}, "연락할 곳"), card.contact_note ? el("p", {}, card.contact_note) : null, contactList(ctx, card.contact_ids)),
      qas.length ? el("section", {}, el("h3", {}, "물어볼 질문"), qas.map(askButton)) : null,
      el("section", {}, el("h3", {}, "근거"), sourceList(ctx, card.source_ids)),
      el("p", { class: "page-meta" }, CONFIRM_LINE)
    );
  }

  // 체크 상자와 제목. 체크는 선택이고, 누르면 이 페이지에만 저장한다.
  function checkRow(card, item, { highlight = false } = {}) {
    const boxId = `check-${card.id}`;
    const box = el("input", { type: "checkbox", id: boxId, class: "check" });
    box.checked = checks.has(card.id);
    const row = el(
      "div",
      { class: `todo-row${box.checked ? " done" : ""}` },
      box,
      el(
        "label",
        { class: highlight ? "todo-title first-title" : "todo-title", for: boxId },
        highlight ? el("span", { class: "highlight" }, card.title) : card.title,
        item.isNew ? el("span", { class: "new-tag" }, "이번에 새로 나온 제안") : null
      )
    );
    box.addEventListener("change", () => {
      if (box.checked) checks.add(card.id);
      else checks.delete(card.id);
      row.classList.toggle("done", box.checked);
      save({ checks: [...checks] });
    });
    return row;
  }

  // 지금은 이 일부터: 먹색 테두리 흰 카드. 형광펜 제목 한 줄, "왜 지금", 괘선 위 "연락할 곳과 출처 보기".
  function firstCard(item) {
    const card = ctx.cardOf(item.card_id);
    const more = toggleRow(ctx, "연락처와 근거 보기", "first-more");
    const box = el("div", { class: "first-detail" });
    more.addEventListener("click", () => {
      const open = more.getAttribute("aria-expanded") !== "true";
      more.setAttribute("aria-expanded", String(open));
      ctx.fill(box, open ? detail(card, item) : null);
    });
    return el(
      "section",
      { class: "first-card" },
      el("h2", { class: "page-h2" }, "가장 먼저 살펴볼 제안"),
      checkRow(card, item, { highlight: true }),
      el("p", { class: "first-why" }, item.why || card.why),
      more,
      box
    );
  }

  // 더 해 볼 만한 일의 한 줄. 누르면 "왜 지금"과 연락할 곳이 펼쳐진다.
  function todo(item) {
    const card = ctx.cardOf(item.card_id);
    const more = el("button", { class: "more", type: "button", "aria-expanded": "false" }, "연락처와 근거 보기");
    const body = el("div", { class: "todo-body" }, more);
    more.addEventListener("click", () => {
      const open = more.getAttribute("aria-expanded") !== "true";
      more.setAttribute("aria-expanded", String(open));
      body.querySelector(".detail")?.remove();
      if (open) ctx.put(body, detail(card, item, { withWhy: true }));
    });
    return el("li", { class: "todo" }, checkRow(card, item), body);
  }

  const buckets = ctx.content.buckets ?? {};
  const moreGroups = Object.keys(buckets)
    .map((b) => ({ b, list: rest.filter((it) => it.bucket === b) }))
    .filter((g) => g.list.length);
  // 구간 이름이 없는 항목도 버리지 않는다.
  const orphan = rest.filter((it) => !(it.bucket in buckets));

  // 지난번에 답이 없던 칸(이번에 새로 붙은 질문)은 "달라진 답"이 아니므로 뺀다.
  const changes = (Array.isArray(page.changes) ? page.changes : []).filter((c) => c && c.before !== undefined && c.before !== null);
  // 기본 정보 한 줄(등급 · 받는 돌봄 · 진단 · 거동). "잘 모르겠어요"는 뺀다.
  const basicLine = ctx.basicLine(page.answers);
  const answerText = (key, v) => (v === undefined || v === null ? "답 없음" : ctx.labelOf(key, v));
  const medical = Array.isArray(page.medical) ? page.medical : [];
  const watch = Array.isArray(page.watch) ? page.watch : [];
  const hasDate = typeof page.createdAt === "number";

  const moreBlock = rest.length
    ? el(
        "details",
        { class: "more-todos" },
        el("summary", {}, el("span", {}, `더 살펴볼 제안 ${rest.length}개`), ctx.icon("down", 18)),
        moreGroups.map((g) => el("div", { class: "bucket" }, el("h3", {}, buckets[g.b]), el("ul", { class: "todo-ul" }, g.list.map(todo)))),
        orphan.length ? el("ul", { class: "todo-ul" }, orphan.map(todo)) : null
      )
    : null;

  ctx.put(
    root,
    el(
      "article",
      { class: "page" },
      el(
        "header",
        { class: "page-head" },
        el("a", { class: "page-back", href: "#/" }, ctx.icon("back", 20), "처음 화면"),
        hasDate ? el("p", { class: "page-date" }, el("span", { "aria-hidden": "true" }, shortDate(page.createdAt)), el("span", { class: "visually-hidden" }, longDate(page.createdAt))) : null,
        el("h1", { class: "page-situation" }, page.situationTitle ?? ""),
        basicLine ? el("p", { class: "basic-line" }, basicLine) : null
      ),
      page.usedAi === false ? el("p", { class: "ai-line" }, "지금은 제안마다 맞춤 설명을 붙이지 못했어요. 제안은 그대로 살펴보실 수 있어요.") : null,
      el("p", { class: "page-reassure" }, REASSURE_LINE),
      status,
      el(
        "div",
        { class: "page-body" },
        pageId === "unsaved" ? el("p", { class: "note" }, "이 기록을 휴대폰에 남기지 못했어요. 이 화면을 닫으면 사라져요.") : null,
        urgent ? el("p", { class: "urgent-line" }, URGENT_LINE, " ", el("a", { href: "#/emergency" }, "위급할 때 연락처 보기")) : null,

        // 정리할 답이 없으면(기본 정보만 답한 경우) 이 절을 숨긴다. 옛 페이지는 저장된 글을 그대로 보여 준다.
        typeof page.summary === "string" && page.summary.trim() ? section(el, "오늘 적은 내용", el("p", { class: "summary" }, page.summary)) : null,
        changes.length
          ? section(
              el,
              "지난번과 달라진 것",
              el(
                "ul",
                { class: "changes" },
                changes.map((c) =>
                  el(
                    "li",
                    {},
                    el("span", { class: "change-name" }, ctx.shortName(c.key)),
                    " ",
                    el("s", { class: "change-before" }, answerText(c.key, c.before)),
                    " ",
                    ctx.icon("arrow", 16),
                    el("span", { class: "visually-hidden" }, "에서"),
                    " ",
                    el("b", { class: "change-after" }, answerText(c.key, c.after))
                  )
                )
              )
            )
          : null,
        page.compare ? section(el, "고른 돌봄 방법", el("p", { class: "picked" }, page.methodTitle ?? "아직 정하지 않았어요")) : null,

        first ? firstCard(first) : section(el, "가장 먼저 살펴볼 제안", el("p", {}, "지금 답에 맞는 제안을 찾지 못했어요. 다른 상황을 골라 다시 받아 보세요.")),
        moreBlock,
        section(el, "이날 읽은 질문", openedBox),
        watch.length ? section(el, "이런 일이 생기면 다시 제안을 받아 보세요", el("ul", { class: "watch" }, watch.map((w) => el("li", {}, w)))) : null,
        medical.length
          ? section(el, "다음 진료 때 의료진에게 물어볼 질문", el("p", { class: "note" }, MEDICAL_LINE), el("ul", { class: "watch" }, medical.map((m) => el("li", {}, m))))
          : null,

        el(
          "footer",
          { class: "page-foot" },
          el("p", {}, CONFIRM_LINE),
          el(
            "div",
            { class: "page-foot-row" },
            el(
              "button",
              {
                class: "delete-button",
                type: "button",
                onclick: () => {
                  if (!window.confirm("이 기록을 지울까요? 지우면 되살릴 수 없어요.")) return;
                  if (pageId !== "unsaved") ctx.notebook.deletePage(pageId);
                  ctx.nav("#/");
                },
              },
              "이 기록 지우기"
            ),
            el("a", { class: "help-link", href: "#/emergency" }, "위급할 때 연락처")
          )
        )
      )
    )
  );
  ctx.settle({ help: false });
}
