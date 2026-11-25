// 응급 안내와 "즉시 도움이 필요할 때". 이후 맡는 자리: 김영균.
// 두 가지로 열린다.
// - 직접 적은 글에서 응급 신호를 찾았을 때(app.js checkEmergency): 찾은 신호에 맞는 연락처를 보여 주고, 닫으면 하던 단계로 간다.
// - 모든 화면 아래 링크로 열었을 때: 신호 종류와 상관없이 연락처를 모두 보여 준다.
// 연락처는 emergencyContacts(emergency.mjs)가 sources에서 꺼낸 것만 쓴다. 색에만 기대지 않도록 빨강 띠 아래에 제목을 둔다.

const ALL_KINDS = ["medical", "violence", "suicide"];

const HINT = {
  emergency119: "의식이 없거나 숨쉬기 어렵거나 크게 다쳤을 때",
  police112: "누군가 맞거나 다칠 위험이 있을 때",
  hs_line109: "죽고 싶다는 말을 들었을 때, 24시간",
  mental_crisis: "마음이 위급할 때 24시간 상담",
};

export function render(root, ctx) {
  const { el } = ctx;
  const pending = ctx.pendingEmergency;
  const kinds = pending?.kinds?.length ? pending.kinds : ALL_KINDS;
  const contacts = ctx.contactsFor(kinds);

  const close = el(
    "button",
    {
      class: "secondary",
      type: "button",
      onclick: () => {
        const next = pending?.next;
        ctx.clearPendingEmergency();
        if (next) ctx.nav(next, { replace: true });
        else if (history.length > 1) history.back();
        else ctx.nav("#/");
      },
    },
    pending ? "안내를 닫고 이어서 하기" : "돌아가기"
  );

  ctx.put(root,
    el(
      "section",
      { class: "emergency", "aria-labelledby": "emergency-title" },
      el("div", { class: "emergency-band", "aria-hidden": "true" }),
      el("h1", { id: "emergency-title" }, "즉시 도움이 필요할 때"),
      pending
        ? el("p", { role: "alert" }, "적어 주신 내용에 위급할 수 있는 상황이 있어요. 할 일 목록보다 먼저 전화해 주세요.")
        : el("p", {}, "위급할 수 있는 상황이면 먼저 아래로 전화하세요."),
      contacts.length
        ? el(
            "ul",
            { class: "emergency-list" },
            contacts.map((s, i) =>
              el(
                "li",
                {},
                s.phone
                  ? el(
                      "a",
                      { class: `call-urgent${i === 0 ? "" : " soft"}`, href: `tel:${s.phone.replace(/-/g, "")}` },
                      el("span", { class: "call-name" }, `${s.phone} ${s.name}`),
                      HINT[s.id] ? el("small", {}, HINT[s.id]) : null
                    )
                  : el("p", {}, s.name)
              )
            )
          )
        : // 자료 목록에 연락처가 아직 없을 때(검수 전 기본 모드). 번호를 코드에 적지 않고 고정 문구만 보여 준다.
          el("p", { class: "note" }, "연락처 목록을 불러오지 못했어요. 위급할 수 있는 상황이면 먼저 119에 전화하세요."),
      close
    )
  );
  ctx.settle();
}
