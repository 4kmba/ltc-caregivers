// 돌봄 방법 비교. 이후 맡는 자리: A2.
// rankMethods(rules.mjs)의 결과를 같은 모양의 카드 목록으로 보여 준다. AI를 쓰지 않는다(스펙 7절).
// 모양은 11/25 디자인 개선안 ver2의 비교 화면: 흰 머리 아래 바탕 위에 흰 카드. 카드에는 좋은 점·어려운 점을 두 줄로 보이고,
// 비용 기준·가족 부담·시작하려면은 "비용·가족 부담 더 보기"에 접어 둔다.
// "한눈에 비교" 표는 만들지 않았다. methods.json의 비용·부담은 방법마다 문장이라, 표 칸에 넣을 같은 꼴의 짧은 값이 없다.
// 디자인 규칙(스펙 8절): 번호를 붙이지 않고, "잘 맞을 수 있음"은 먹색 테두리와 태그 글, 이유 한 줄로 표시한다(노랑 태그는 거들 뿐).

// 값이 여러 개면 한 줄씩 나눠 적는다.
const lines = (el, v) => (Array.isArray(v) ? v : [v]).filter(Boolean).map((x) => el("span", { class: "dd-line" }, x));
const present = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

export function render(root, ctx) {
  const { el, session } = ctx;
  if (!session) return ctx.nav("#/", { replace: true });
  const ranked = ctx.rankMethods(ctx.content.methods, { ...ctx.currentAnswers(), situation: session.situation });
  if (ranked.length === 0) return ctx.nav("#/page/new", { replace: true });

  const pick = (methodId) => {
    session.methodId = methodId;
    session.builtPageId = null;
    ctx.nav("#/page/new");
  };
  const back = session.followupQs?.length ? "#/q/more" : "#/q/worry";
  // 더 확인하면 좋은 것: 이번에 건너뛴 상황별 질문과 조건부 질문. 답하면 비교가 더 정확해진다.
  const skipped = ctx.steps().filter((s) => s.kind === "pick" && !(s.q.key in session.answers));

  function methodCard({ method, fits, reason }) {
    const points = [
      ["좋은 점", method.pros],
      ["어려운 점", method.cons],
    ].filter(([, v]) => present(v));
    const more = [
      ["비용 기준", method.cost],
      ["가족 부담", method.burden],
      ["시작하려면", method.start_now],
    ].filter(([, v]) => present(v));
    return el(
      "section",
      { class: `method${fits ? " fits" : ""}`, "aria-label": method.title },
      el(
        "div",
        { class: "method-top" },
        fits ? el("span", { class: "fits-tag" }, ctx.icon("check", 14), "답하신 상황과 잘 맞을 수 있어요") : null,
        fits && reason ? el("p", { class: "fits-reason" }, reason) : null,
        el("h2", { class: "method-title" }, method.title),
        method.summary ? el("p", { class: "method-summary" }, method.summary) : null
      ),
      points.length
        ? el("ul", { class: "method-points" }, points.map(([k, v]) => el("li", {}, el("span", { class: "point-name" }, k), el("span", { class: "point-lines" }, lines(el, v)))))
        : null,
      more.length
        ? el(
            "details",
            { class: "method-more" },
            el("summary", {}, el("span", {}, "비용·가족 부담 더 보기"), ctx.icon("down", 20)),
            el("dl", { class: "method-table" }, more.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, lines(el, v))]))
          )
        : null,
      el("button", { class: fits ? "method-pick filled" : "method-pick", type: "button", onclick: () => pick(method.id) }, "이 방법으로 제안 받기")
    );
  }

  ctx.put(
    root,
    el(
      "section",
      { class: "compare" },
      el(
        "header",
        { class: "compare-head" },
        el("a", { class: "back-link", href: back }, ctx.icon("back", 24), "이전"),
        el("p", { class: "q-situation" }, ctx.situationOf(session.situation)?.title ?? ""),
        el("h1", { class: "compare-title" }, `돌봄 방법 ${ranked.length}가지`),
        el("p", { class: "compare-lead" }, "결정은 가족과 의료진이 함께 해 주세요.")
      ),
      el(
        "div",
        { class: "compare-body" },
        ranked.map(methodCard),
        skipped.length
          ? el(
              "div",
              { class: "compare-more" },
              el("h2", {}, `건너뛴 질문이 ${skipped.length}개 있어요`),
              el("p", {}, "'이전'을 눌러 건너뛴 질문에 답하면 비교가 더 정확해져요."),
              el("ul", {}, skipped.map((s) => el("li", {}, s.q.text)))
            )
          : null,
        el("button", { class: "under-link", type: "button", onclick: () => pick(null) }, "방법은 나중에 정할게요"),
        el("p", { class: "compare-note" }, "방법을 정하지 않아도, 어느 방법에서나 도움이 될 제안부터 보여 드려요.")
      )
    )
  );
  ctx.settle();
}
