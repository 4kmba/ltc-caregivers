// 응급 안내와 "즉시 도움이 필요할 때". 이후 맡는 자리: 김영균.
// 두 가지로 열린다.
// - 직접 적은 글에서 응급 신호를 찾았을 때(app.js checkEmergency): 찾은 신호에 맞는 연락처를 보여 주고, 닫으면 하던 단계로 간다.
// - 모든 화면 아래 링크로 열었을 때: 신호 종류와 상관없이 연락처를 모두 보여 준다.
// 연락처는 emergencyContacts(emergency.mjs)가 sources에서 꺼낸 것만 쓴다. 색에만 기대지 않도록 경고 문구와 제목을 붙인다.
// 모양은 11/25 디자인 개선안 ver2의 응급 화면: 위쪽 빨강 띠("위급할 수 있어요"), 첫 연락처는 84px 빨강 채움 버튼, 나머지는 72px 먹색 테두리 버튼.

const ALL_KINDS = ["medical", "violence", "suicide"];

const HINT = {
  emergency119: "의식이 없거나 숨쉬기 어렵거나 크게 다쳤을 때",
  police112: "누군가 맞거나 다칠 위험이 있을 때",
  hs_line109: "죽고 싶다는 말을 들었을 때, 24시간",
  mental_crisis: "마음이 위급할 때 24시간 상담",
};

// 버튼에 보일 짧은 이름. 자료 목록의 name은 출처 제목("정책브리핑: …")이라 버튼에 그대로 쓰면 어색하다.
// 번호는 여기 적지 않고 자료 목록의 phone에서만 꺼낸다.
const LABEL = {
  emergency119: "구급 신고",
  police112: "경찰 신고",
  hs_line109: "자살예방상담전화",
  mental_crisis: "정신건강위기상담전화",
};

function callLabel(s) {
  if (LABEL[s.id]) return `${s.phone} ${LABEL[s.id]}`;
  // 이름에 번호가 이미 들어 있으면 번호를 앞에 다시 붙이지 않는다.
  return s.name.includes(s.phone) ? s.name : `${s.phone} ${s.name}`;
}

const tel = (phone) => `tel:${phone.replace(/-/g, "")}`;

export function render(root, ctx) {
  const { el } = ctx;
  const pending = ctx.pendingEmergency;
  const kinds = pending?.kinds?.length ? pending.kinds : ALL_KINDS;
  const contacts = ctx.contactsFor(kinds).filter((s) => s.phone);
  const [first, ...others] = contacts;
  // 보호자가 적은 글 가운데 신호가 잡힌 것. 이 브라우저 안에서만 보여 주고 서버로 보내지 않는다.
  const quotes = Array.isArray(pending?.quote) ? pending.quote : [];
  // 폭력이나 자살 연락처가 이번 목록에 없을 때만 112·109 안내를 붙인다.
  const shown = new Set(contacts.map((s) => s.id));
  const moreNote = !(shown.has("police112") && shown.has("hs_line109"));

  const close = el(
    "button",
    {
      class: "under-link",
      type: "button",
      onclick: () => {
        const next = pending?.next;
        ctx.clearPendingEmergency();
        if (next) ctx.nav(next, { replace: true });
        else if (history.length > 1) history.back();
        else ctx.nav("#/");
      },
    },
    pending ? "전화했어요. 이어서 보기" : "이전 화면으로"
  );

  ctx.put(
    root,
    el(
      "section",
      { class: "emergency", "aria-labelledby": "emergency-title" },
      el("p", { class: "emergency-band" }, ctx.icon("alert", 24), "위급할 수 있어요"),
      el(
        "div",
        { class: "emergency-top" },
        el("h1", { id: "emergency-title", class: "emergency-title" }, "먼저 전화하세요"),
        pending
          ? el("p", { class: "emergency-lead", role: "alert" }, "적어 주신 내용에 위급할 수 있는 말이 있어요. 돌봄수첩은 위급한지 판단할 수 없어요. 조금이라도 걱정되면 지금 전화하세요.")
          : el("p", { class: "emergency-lead" }, "돌봄수첩은 위급한지 판단할 수 없어요. 조금이라도 걱정되면 지금 전화하세요."),
        quotes.length
          ? el("figure", { class: "emergency-quote" }, el("figcaption", { class: "emergency-quote-title" }, "적어 주신 내용"), quotes.map((q) => el("blockquote", {}, q)))
          : null
      ),
      el(
        "div",
        { class: "emergency-calls" },
        first
          ? el(
              "a",
              { class: "call-first", href: tel(first.phone) },
              ctx.icon("phone", 30),
              el("span", { class: "call-text" }, el("span", { class: "call-name" }, callLabel(first)), HINT[first.id] ? el("span", { class: "call-sub" }, HINT[first.id]) : null)
            )
          : // 자료 목록에 연락처가 아직 없을 때(검수 전 기본 모드). 번호를 코드에 적지 않고 고정 문구만 보여 준다.
            el("p", { class: "note" }, "연락처를 불러오지 못했어요. 위급할 수 있으면 먼저 119에 전화하세요."),
        others.map((s) =>
          el(
            "a",
            { class: "call-other", href: tel(s.phone) },
            el("span", { class: "call-text" }, el("span", { class: "call-name" }, LABEL[s.id] ?? s.name), el("span", { class: "call-number" }, s.phone)),
            ctx.icon("phone", 24)
          )
        )
      ),
      el(
        "div",
        { class: "emergency-bottom" },
        moreNote ? el("p", { class: "emergency-note" }, "폭력이 걱정되면 112에, 죽고 싶다는 말을 들으셨으면 109에 전화하세요.") : null,
        close
      )
    )
  );
  ctx.settle({ help: false });
}
