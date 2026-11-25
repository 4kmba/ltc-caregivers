// 표지(첫 화면). 이후 맡는 자리: 김영균.
// 모양은 11/25 디자인 캔버스의 표지: 노랑 전면에 "돌봄 / 수첩" 두 줄, 오른쪽 가장자리의 날짜 인덱스 탭(최근 5장),
// 아래쪽에 "새로 정리하기"와 저장 안내·"즉시 도움이 필요할 때" 한 줄.
// 처음 온 사람에게는 탭 대신 저장 안내 문구를 보여 준다. "궁금한 것 찾아보기"와 돌보는 대상 칸은 아직 없다(뒤로 미룬 일).

const TABS = 5;

// 탭의 날짜는 "11.25" 꼴. 낭독기에는 "11월 25일"로 읽히게 한다.
const shortDate = (t) => {
  const d = new Date(t);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
};
const longDate = (t) => new Date(t).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

function remainText(page) {
  const items = Array.isArray(page.items) ? page.items : [];
  const checks = new Set(Array.isArray(page.checks) ? page.checks : []);
  const left = items.filter((it) => !checks.has(it?.card_id)).length;
  if (items.length === 0) return null;
  return left === 0 ? "할 일 모두 확인" : `할 일 ${left}개 남음`;
}

export function render(root, ctx) {
  const { el } = ctx;
  const pages = ctx.notebook.listPages().slice(0, TABS);

  // 최근 기록일수록 탭이 길고 밝다(tab-1이 가장 최근).
  const tabs = pages.length
    ? el(
        "nav",
        { class: "cover-tabs", "aria-label": "지난 기록" },
        el("p", { class: "cover-tabs-title", "aria-hidden": "true" }, "지난 기록"),
        el(
          "ul",
          { class: "cover-tab-list" },
          pages.map((p, i) => {
            const hasDate = typeof p.createdAt === "number";
            return el(
              "li",
              {},
              el(
                "a",
                { class: `cover-tab tab-${i + 1}`, href: `#/page/${encodeURIComponent(p.id)}` },
                el("span", { class: "cover-tab-date", "aria-hidden": hasDate ? "true" : null }, hasDate ? shortDate(p.createdAt) : "날짜 없음"),
                hasDate ? el("span", { class: "visually-hidden" }, longDate(p.createdAt)) : null,
                el("span", { class: "cover-tab-line" }, [ctx.situationOf(p.situation)?.short ?? p.situationTitle, remainText(p)].filter(Boolean).join(", "))
              )
            );
          })
        )
      )
    : el("p", { class: "cover-note" }, "기록은 이 휴대폰에만 저장돼요. 휴대폰을 바꾸거나 브라우저 기록을 지우면 수첩도 사라져요.");

  ctx.put(
    root,
    el(
      "section",
      { class: "cover" },
      el(
        "div",
        { class: "cover-top" },
        ctx.simcheong("default"),
        el("h1", { class: "cover-title" }, "돌봄", el("br"), "수첩"),
        el("p", { class: "cover-lead" }, "상황이 바뀔 때마다 한 장씩 정리해요")
      ),
      tabs,
      el(
        "div",
        { class: "cover-bottom" },
        el("p", { class: "cover-small" }, "답하신 내용은 맞는 할 일을 찾기 위해 AI에 보내요. 이름, 주소, 연락처는 적지 마세요."),
        el("p", { class: "cover-small" }, "신청하기 전에 공단(1577-1000)이나 안내된 기관에 꼭 확인해 주세요."),
        el("button", { class: "cover-start", type: "button", onclick: () => ctx.nav("#/new") }, "새로 정리하기"),
        el(
          "div",
          { class: "cover-foot" },
          el("span", { class: "cover-saved" }, ctx.icon("lock", 16), "이 휴대폰에만 저장돼요"),
          el("a", { class: "cover-help", href: "#/emergency" }, "즉시 도움이 필요할 때")
        )
      )
    )
  );
  ctx.settle({ help: false });
}
