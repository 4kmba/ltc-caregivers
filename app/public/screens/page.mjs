// 수첩 페이지. 이후 맡는 자리: 김영균(틀), B2(오늘 정리한 내용), B3(질문에 답하기).
// 주소: #/page/new(이번 답으로 만들기), #/page/<id>(저장한 페이지), #/page/unsaved(저장하지 못한 페이지).
// 순서는 스펙 3절 7단계: 오늘 정리한 내용 / 지난번과 달라진 답 / 고른 방식 / 지금은 이 일부터 / 더 해 볼 만한 일 / 이럴 때 다시 열어 보세요 / 그날 열어 본 질문.
// 연락처와 링크는 sources에서만 꺼낸다. AI가 쓴 글(why, 요약, 답)에서 번호나 링크를 꺼내지 않는다.

const CONFIRM_LINE = "신청하기 전에 공단(1577-1000)이나 안내된 기관에 꼭 확인해 주세요.";
const URGENT_LINE = "위급할 수 있는 상황이면 먼저 119에 전화하세요.";
const MEDICAL_LINE = "참고만 하시고, 정확한 내용은 의료진과 상담하세요.";

const dateText = (t) => new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

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
    el("section", { class: "sheet" }, el("h1", {}, "이 페이지를 찾지 못했어요"), el("p", {}, "지웠거나 다른 휴대폰에서 만든 페이지일 수 있어요."), el("a", { class: "primary link-button", href: "#/" }, "표지로"))
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
  ctx.put(root, el("section", { class: "sheet loading-sheet" }, ctx.simcheong("default"), el("h1", {}, "정리하는 중"), el("p", { class: "loading", role: "status" }, "답에 맞는 할 일을 고르고 있어요. 잠시만 기다려 주세요.")));
  ctx.settle();

  const result = await ctx.buildPage();
  if (location.hash !== here) return;
  if (result.error) {
    ctx.fill(root,
      el(
        "section",
        { class: "sheet" },
        el("h1", {}, "목록을 불러오지 못했어요"),
        el("p", {}, "인터넷 연결이나 서버에 문제가 있어요. 답은 그대로 있으니 다시 시도해 주세요."),
        el("button", { class: "primary", type: "button", onclick: () => ctx.nav("#/page/new") }, "다시 시도")
      )
    );
    ctx.settle();
    return;
  }
  ctx.nav(`#/page/${encodeURIComponent(result.id ?? "unsaved")}`, { replace: true });
}

function section(el, title, ...children) {
  return el("section", { class: "page-section" }, el("h2", {}, title), ...children);
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
        s.phone ? el("a", { class: "call", href: `tel:${s.phone.replace(/-/g, "")}` }, `${s.phone} 전화하기`) : null,
        s.url ? el("a", { class: "text-link", href: s.url, target: "_blank", rel: "noopener noreferrer" }, "누리집 열기") : null
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
    if (!ok) status.textContent = "이 휴대폰에 저장하지 못했어요.";
    else Object.assign(page, patch);
  }

  // 그날 열어 본 질문. 질문을 새로 열 때마다 다시 그린다.
  const openedBox = el("div", { id: "opened" });
  function drawOpened() {
    ctx.fill(openedBox,
      opened.length
        ? el("ul", { class: "opened-list" }, opened.map((o) => el("li", {}, el("p", { class: "opened-q" }, o.q), el("p", { class: "opened-a" }, o.a))))
        : el("p", { class: "meta" }, "할 일의 질문을 누르면 그때 본 답이 여기에 남아요.")
    );
  }
  drawOpened();

  // 질문 하나. 처음 누르면 답을 받아 펼치고 page.opened에 저장한다. 다시 열면 저장한 글을 그대로 보여 준다.
  function askButton(qa) {
    const slot = el("div", { class: "answer-slot", "aria-live": "polite" });
    const btn = el("button", { class: "ask", type: "button", "aria-expanded": "false" }, qa.q);
    const show = (text) =>
      ctx.fill(slot,
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
      ctx.fill(slot, el("p", { class: "loading" }, "답을 정리하는 중이에요."));
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

  function detail(card, item) {
    const qas = (card.qa_ids ?? []).map(ctx.qaOf).filter(Boolean);
    return el(
      "div",
      { class: "detail" },
      el("section", {}, el("h3", {}, "왜 지금"), el("p", {}, item.why || card.why)),
      el("section", {}, el("h3", {}, "연락할 곳"), card.contact_note ? el("p", {}, card.contact_note) : null, contactList(ctx, card.contact_ids)),
      qas.length ? el("section", {}, el("h3", {}, "물어볼 질문"), qas.map(askButton)) : null,
      el("section", {}, el("h3", {}, "출처"), sourceList(ctx, card.source_ids)),
      el("p", { class: "meta" }, CONFIRM_LINE)
    );
  }

  function todo(item, { highlight = false } = {}) {
    const card = ctx.cardOf(item.card_id);
    const boxId = `check-${card.id}`;
    const li = el("li", { class: `todo${checks.has(card.id) ? " done" : ""}` });
    const box = el("input", { type: "checkbox", id: boxId });
    box.checked = checks.has(card.id);
    box.addEventListener("change", () => {
      if (box.checked) checks.add(card.id);
      else checks.delete(card.id);
      li.classList.toggle("done", box.checked);
      save({ checks: [...checks] });
    });
    const more = el("button", { class: "more", type: "button", "aria-expanded": "false" }, "자세히 보기");
    const body = el("div", { class: "todo-body" }, more);
    more.addEventListener("click", () => {
      const open = more.getAttribute("aria-expanded") !== "true";
      more.setAttribute("aria-expanded", String(open));
      body.querySelector(".detail")?.remove();
      if (open) ctx.put(body, detail(card, item));
    });
    ctx.put(li,
      el(
        "div",
        { class: "todo-row" },
        box,
        el("label", { class: "todo-title", for: boxId }, highlight ? el("span", { class: "highlight" }, card.title) : card.title, item.isNew ? el("span", { class: "new-tag" }, "새로 추가됨") : null)
      ),
      body
    );
    return li;
  }

  const buckets = ctx.content.buckets ?? {};
  const moreGroups = Object.keys(buckets)
    .map((b) => ({ b, list: rest.filter((it) => it.bucket === b) }))
    .filter((g) => g.list.length);
  // 구간 이름이 없는 항목도 버리지 않는다.
  const orphan = rest.filter((it) => !(it.bucket in buckets));

  const changes = Array.isArray(page.changes) ? page.changes : [];
  const answerText = (key, v) => (v === undefined || v === null ? "답 없음" : ctx.labelOf(key, v));
  const medical = Array.isArray(page.medical) ? page.medical : [];
  const watch = Array.isArray(page.watch) ? page.watch : [];

  ctx.put(root,
    el(
      "article",
      { class: "sheet page" },
      el("div", { class: "page-band", "aria-hidden": "true" }),
      el("div", { class: "topbar" }, el("a", { class: "text-button", href: "#/" }, "표지로")),
      el(
        "h1",
        { class: "page-title" },
        el("span", { class: "page-date" }, typeof page.createdAt === "number" ? dateText(page.createdAt) : ""),
        el("span", { class: "page-situation" }, page.situationTitle ?? "")
      ),
      status,
      pageId === "unsaved" ? el("p", { class: "note" }, "이 휴대폰에 저장하지 못했어요. 이 화면을 닫으면 페이지가 사라져요.") : null,
      page.usedAi === false ? el("p", { class: "note" }, "지금은 AI 설명 없이 기본 목록을 보여 드려요") : null,
      urgent ? el("p", { class: "urgent-line" }, URGENT_LINE, " ", el("a", { href: "#/emergency" }, "연락처 보기")) : null,

      section(el, "오늘 정리한 내용", el("p", { class: "summary" }, page.summary || "정리할 답이 없어요.")),
      changes.length
        ? section(el, "지난번과 달라진 답", el("ul", { class: "changes" }, changes.map((c) => el("li", {}, `${ctx.questionText(c.key)}${/[?？]$/.test(ctx.questionText(c.key)) ? " " : ": "}${answerText(c.key, c.before)} → ${answerText(c.key, c.after)}`))))
        : null,
      page.compare ? section(el, "고른 방식", el("p", { class: "picked" }, page.methodTitle ?? "아직 정하지 않았어요")) : null,

      first
        ? section(el, "지금은 이 일부터", el("ul", { class: "todo-ul first" }, todo(first, { highlight: true })))
        : section(el, "지금은 이 일부터", el("p", {}, "지금 답으로는 보여 드릴 할 일이 없어요.")),
      rest.length
        ? el(
            "details",
            { class: "page-section more-todos" },
            el("summary", {}, `더 해 볼 만한 일 ${rest.length}개`),
            moreGroups.map((g) => el("div", { class: "bucket" }, el("h3", {}, buckets[g.b]), el("ul", { class: "todo-ul" }, g.list.map((it) => todo(it))))),
            orphan.length ? el("ul", { class: "todo-ul" }, orphan.map((it) => todo(it))) : null
          )
        : null,
      watch.length ? section(el, "이럴 때 다시 열어 보세요", el("ul", { class: "watch" }, watch.map((w) => el("li", {}, w)))) : null,
      medical.length
        ? section(el, "다음 진료 때 의료진에게 물어볼 질문", el("p", { class: "note" }, MEDICAL_LINE), el("ul", {}, medical.map((m) => el("li", {}, m))))
        : null,
      section(el, "그날 열어 본 질문", openedBox),

      el(
        "div",
        { class: "after" },
        el("p", { class: "meta" }, CONFIRM_LINE),
        el(
          "button",
          {
            class: "text-button",
            type: "button",
            onclick: () => {
              if (!window.confirm("이 페이지를 지울까요? 지우면 되살릴 수 없어요.")) return;
              if (pageId !== "unsaved") ctx.notebook.deletePage(pageId);
              ctx.nav("#/");
            },
          },
          "이 페이지 지우기"
        )
      )
    )
  );
  ctx.settle();
}
