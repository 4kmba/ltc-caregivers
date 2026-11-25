// 돌봄 방식 비교. 이후 맡는 자리: A2.
// 지금은 rankMethods(rules.mjs)의 결과를 같은 모양의 카드 목록으로만 보여 준다. AI를 쓰지 않는다(스펙 7절).
// A2가 채울 것: "더 확인하면 좋은 것"(답하지 않은 질문), 카드 모양 다듬기.
// 디자인 규칙(스펙 8절): 번호를 붙이지 않고, "잘 맞을 수 있음"은 색이 아니라 먹색 테두리 태그와 이유 한 줄로만 표시한다.

function list(el, title, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return el("div", { class: "method-row" }, el("h3", {}, title), el("ul", {}, items.map((x) => el("li", {}, x))));
}

function row(el, title, text) {
  if (!text) return null;
  return el("div", { class: "method-row" }, el("h3", {}, title), el("p", {}, text));
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

  ctx.put(root,
    el(
      "section",
      { class: "sheet" },
      el("div", { class: "topbar" }, el("a", { class: "text-button", href: back }, "이전")),
      el("h1", {}, "돌봄 방식을 비교해 보세요"),
      el("p", { class: "note" }, "참고용 정리입니다. 결정은 가족과 의료진이 함께 하세요."),
      el(
        "ul",
        { class: "methods" },
        ranked.map(({ method, fits, reason }) =>
          el(
            "li",
            { class: "method" },
            el("h2", {}, method.title),
            fits ? el("p", { class: "fits" }, el("span", { class: "fits-tag" }, "우리 상황과 잘 맞을 수 있음"), reason ? el("span", { class: "fits-reason" }, reason) : null) : null,
            el("p", { class: "method-summary" }, method.summary),
            list(el, "장점", method.pros),
            list(el, "단점", method.cons),
            row(el, "비용 기준", method.cost),
            row(el, "가족 부담", method.burden),
            row(el, "바로 시작할 수 있는지", method.start_now),
            el("button", { class: "secondary", type: "button", onclick: () => pick(method.id) }, "이 방식으로 정리하기")
          )
        )
      ),
      el("button", { class: "secondary", type: "button", onclick: () => pick(null) }, "아직 못 정했어요"),
      el("p", { class: "meta" }, "아직 못 정했어도 어느 방식을 고르든 필요한 할 일을 정리해 드려요.")
    )
  );
  ctx.settle();
}
