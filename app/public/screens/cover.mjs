// 표지(첫 화면). 이후 맡는 자리: 김영균.
// 모양은 11/25 디자인 개선안 ver2의 표지: 노랑 머리("돌봄수첩") 안에 흰 "최근 기록" 카드,
// 그 아래 바탕 위에 "지난 기록" 목록(최근 기록을 뺀 나머지, 5개까지), 맨 아래 화면 폭 가득한 "우리 상황에 맞는 제안 받기"와 저장 안내·"위급할 때 연락처".
// 처음 온 사람에게는 최근 기록 카드 대신 저장 안내 문단을 보여 준다. "궁금한 것 찾기"와 돌보는 대상 칸은 아직 없다(뒤로 미룬 일).

const PAST = 5;

// 목록의 날짜는 "11.18" 꼴. 낭독기에는 "11월 18일"로 읽히게 한다.
const shortDate = (t) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
};
const monthDay = (t) => new Date(t).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
const longDate = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

const hasDate = (p) => typeof p.createdAt === "number";

// 최근 기록 카드에 보일 제안: 체크하지 않은 첫 제안, 다 체크했으면 첫 제안.
function firstOpenCard(ctx, page) {
  const items = (Array.isArray(page.items) ? page.items : []).map((it) => ctx.cardOf(it?.card_id)).filter(Boolean);
  const checks = new Set(Array.isArray(page.checks) ? page.checks : []);
  return items.find((c) => !checks.has(c.id)) ?? items[0] ?? null;
}

export function render(root, ctx) {
  const { el } = ctx;
  const pages = ctx.notebook.listPages();
  const [latest, ...older] = pages;
  const past = older.slice(0, PAST);
  const shortName = (p) => ctx.situationOf(p.situation)?.short ?? p.situationTitle ?? "";
  const href = (p) => `#/page/${encodeURIComponent(p.id)}`;

  let recent;
  if (latest) {
    const card = firstOpenCard(ctx, latest);
    const meta = [hasDate(latest) ? monthDay(latest.createdAt) : null, shortName(latest)].filter(Boolean).join(" · ");
    recent = el(
      "section",
      { class: "recent", "aria-label": "최근 기록" },
      meta ? el("p", { class: "recent-meta" }, meta) : null,
      el("h2", { class: "recent-title" }, "가장 먼저 살펴볼 제안"),
      card ? el("p", { class: "recent-todo" }, card.title) : null,
      el("a", { class: "recent-go", href: href(latest) }, "이어서 보기", ctx.icon("right", 20))
    );
  } else {
    recent = el("p", { class: "cover-note" }, "기록은 이 휴대폰에만 남아요. 휴대폰을 바꾸거나 인터넷 사용 기록을 지우면 함께 지워져요.");
  }

  const pastList = past.length
    ? el(
        "nav",
        { class: "past", "aria-labelledby": "past-title" },
        el("h2", { class: "past-title", id: "past-title" }, "지난 기록"),
        el(
          "ul",
          { class: "past-list" },
          past.map((p) =>
            el(
              "li",
              {},
              el(
                "a",
                { class: "past-row", href: href(p) },
                el("span", { class: "past-date", "aria-hidden": hasDate(p) ? "true" : null }, hasDate(p) ? shortDate(p.createdAt) : "날짜 없음"),
                hasDate(p) ? el("span", { class: "visually-hidden" }, longDate(p.createdAt)) : null,
                el("span", { class: "past-name" }, shortName(p)),
                ctx.icon("right", 20)
              )
            )
          )
        )
      )
    : null;

  ctx.put(
    root,
    el(
      "section",
      { class: "cover" },
      el(
        "header",
        { class: "cover-head" },
        ctx.simcheong("default"),
        el(
          "div",
          { class: "cover-titles" },
          el("h1", { class: "cover-title" }, "돌봄수첩"),
          el("p", { class: "cover-lead" }, "질문 몇 가지에 답하면 지금 도움이 될 제안을 골라 드려요")
        ),
        recent
      ),
      pastList,
      el(
        "div",
        { class: "cover-bottom" },
        el("p", { class: "cover-small" }, "이름, 주소, 연락처는 적지 마세요. 답하신 내용은 제안을 고르는 데만 AI에 보내요."),
        el("p", { class: "cover-small" }, "신청하기 전에 공단(1577-1000)이나 안내된 기관에 꼭 확인해 주세요."),
        el("button", { class: "primary cover-start", type: "button", onclick: () => ctx.nav("#/new") }, ctx.icon("plus", 20), "우리 상황에 맞는 제안 받기"),
        el(
          "div",
          { class: "cover-foot" },
          el("span", { class: "cover-saved" }, ctx.icon("lock", 16), "이 휴대폰에만 남아요"),
          el("a", { class: "help-link", href: "#/emergency" }, ctx.icon("phone", 18), "위급할 때 연락처")
        )
      )
    )
  );
  ctx.settle({ help: false });
}
