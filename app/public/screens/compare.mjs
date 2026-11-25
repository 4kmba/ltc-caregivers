// 돌봄 방식 비교. 이후 맡는 자리: A2.
// rankMethods(rules.mjs)의 결과를 같은 모양의 카드 목록으로 보여 준다. AI를 쓰지 않는다(스펙 7절).
// 모양은 11/25 디자인 캔버스의 비교 화면: 노랑 머리 아래 흰 카드, 항목은 두 칸 표(dl).
// 디자인 규칙(스펙 8절): 번호를 붙이지 않고, "잘 맞을 수 있음"은 색이 아니라 먹색 테두리와 태그, 이유 한 줄로만 표시한다.

// 표의 한 줄. 값이 여러 개(장점, 단점)면 한 줄씩 나눠 적는다.
function rows(el, pairs) {
  return pairs
    .filter(([, v]) => (Array.isArray(v) ? v.length : v))
    .flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, Array.isArray(v) ? v.map((x) => el("span", { class: "dd-line" }, x)) : v)]);
}

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

  ctx.put(
    root,
    el(
      "section",
      { class: "compare" },
      el(
        "div",
        { class: "compare-head" },
        el(
          "div",
          { class: "head-row" },
          el("a", { class: "icon-button", href: back, "aria-label": "이전 화면으로" }, ctx.icon("back")),
          el("span", { class: "q-situation" }, ctx.situationOf(session.situation)?.title ?? "")
        ),
        el("h1", { class: "compare-title" }, "고를 수 있는 돌봄 방법"),
        el("p", { class: "compare-lead" }, "비교해 보시라고 나란히 놓았어요. 결정은 가족과 의료진이 함께 해 주세요.")
      ),
      el(
        "div",
        { class: "compare-body" },
        ranked.map(({ method, fits, reason }) =>
          el(
            "section",
            { class: `method${fits ? " fits" : ""}`, "aria-label": method.title },
            el(
              "div",
              { class: "method-top" },
              fits ? el("span", { class: "fits-tag" }, "우리 상황과 잘 맞을 수 있음") : null,
              el("h2", { class: "method-title" }, method.title),
              fits && reason ? el("p", { class: "fits-reason" }, reason) : null,
              method.summary ? el("p", { class: "method-summary" }, method.summary) : null
            ),
            el(
              "dl",
              { class: "method-table" },
              rows(el, [
                ["좋은 점", method.pros],
                ["걸리는 점", method.cons],
                ["비용 기준", method.cost],
                ["가족 부담", method.burden],
                ["시작하려면", method.start_now],
              ])
            ),
            el("button", { class: fits ? "method-pick filled" : "method-pick", type: "button", onclick: () => pick(method.id) }, "이 방법으로 제안 받기")
          )
        ),
        skipped.length
          ? el(
              "div",
              { class: "compare-more" },
              el("h2", {}, `건너뛴 질문이 ${skipped.length}개 있어요`),
              el("p", {}, "이전 화면으로 돌아가 답하면 비교가 더 정확해져요."),
              el("ul", {}, skipped.map((s) => el("li", {}, s.q.text)))
            )
          : null,
        el("button", { class: "not-yet", type: "button", onclick: () => pick(null) }, "방법은 나중에 정할게요"),
        el("p", { class: "compare-note" }, "어느 방법을 고르든 도움이 될 제안부터 보여 드려요.")
      )
    )
  );
  ctx.settle();
}
