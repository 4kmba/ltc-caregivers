// 표지(첫 화면). 이후 맡는 자리: 김영균.
// 노랑 표지에 "돌봄 수첩", "새로 정리하기", 날짜순 지난 기록. 처음 온 사람에게는 지난 기록 대신 저장 안내를 보여 준다.
// 표지에는 "궁금한 것 찾아보기"를 넣지 않는다(뒤로 미룬 일).

const dateText = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

function remainText(page) {
  const items = Array.isArray(page.items) ? page.items : [];
  const checks = new Set(Array.isArray(page.checks) ? page.checks : []);
  const left = items.filter((it) => !checks.has(it?.card_id)).length;
  if (items.length === 0) return null;
  return left === 0 ? "할 일 모두 확인" : `남은 일 ${left}개`;
}

export function render(root, ctx) {
  const { el } = ctx;
  const pages = ctx.notebook.listPages();

  const history = pages.length
    ? el(
        "section",
        { class: "cover-history", "aria-labelledby": "history-title" },
        el("h2", { id: "history-title" }, "지난 기록"),
        el(
          "ul",
          { class: "history-list" },
          pages.map((p) =>
            el(
              "li",
              {},
              el(
                "a",
                { class: "history-item", href: `#/page/${encodeURIComponent(p.id)}` },
                el("span", { class: "history-date" }, typeof p.createdAt === "number" ? dateText(p.createdAt) : "날짜 없음"),
                el("span", { class: "history-line" }, [p.situationTitle, p.compare ? p.methodTitle ?? "방식은 아직 정하지 않음" : null, remainText(p)].filter(Boolean).join(" · "))
              )
            )
          )
        )
      )
    : el("p", { class: "cover-note" }, "기록은 이 휴대폰에만 저장돼요. 휴대폰을 바꾸거나 브라우저 기록을 지우면 수첩도 사라져요.");

  ctx.put(root,
    el(
      "section",
      { class: "cover" },
      ctx.simcheong("default"),
      el("h1", { class: "cover-title" }, "돌봄 수첩"),
      el("p", { class: "cover-lead" }, "상황이 바뀔 때마다 지금 할 일을 한 장으로 정리해 드려요."),
      el("button", { class: "primary on-yellow", type: "button", onclick: () => ctx.nav("#/new") }, "새로 정리하기"),
      history,
      el("p", { class: "cover-small" }, "답하신 내용은 맞는 할 일을 찾기 위해 AI에 보내요. 이름, 주소, 연락처는 적지 마세요."),
      el("p", { class: "cover-small" }, "신청하기 전에 공단(1577-1000)이나 안내된 기관에 꼭 확인해 주세요.")
    )
  );
  ctx.settle();
}
