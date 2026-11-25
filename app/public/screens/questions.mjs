// 상황 고르기, 기본 정보, 상황별 질문, 걱정 한 줄, 보충 질문. 이후 맡는 자리: A1.
// 주소: #/new(상황 고르기), #/q/<단계>(basic-1..5 또는 basic, sq-<키>, cq-<키>, worry, more).
// 단계 목록과 보낼 답은 app.js(steps, currentAnswers)가 만들고, 이 파일은 그리기만 한다.

const ADVANCE_MS = 350;
const AI_NOTICE = "답하신 내용은 맞는 할 일을 찾기 위해 AI에 보내요. 이름, 주소, 연락처는 적지 마세요.";

// 답을 바꾸면 보충 질문을 다시 받는다(답에 따라 비어 있는 정보가 달라지므로).
function choose(session, field, value) {
  session.followupQs = null;
  if (field.type === "one") {
    session.answers[field.key] = value;
    return;
  }
  const current = new Set(session.answers[field.key] ?? []);
  const exclusive = field.exclusive ?? [];
  if (current.has(value)) current.delete(value);
  else if (exclusive.includes(value)) {
    current.clear();
    current.add(value);
  } else {
    exclusive.forEach((x) => current.delete(x));
    current.add(value);
  }
  if (current.size) session.answers[field.key] = [...current];
  else delete session.answers[field.key];
}

function isChosen(session, field, value) {
  const v = session.answers[field.key];
  return field.type === "many" ? (v ?? []).includes(value) : v === value;
}

function fieldDone(session, field) {
  const v = session.answers[field.key];
  return field.type === "many" ? Array.isArray(v) && v.length > 0 : Boolean(v);
}

// 보기 묶음. 하나만 고르는 보기는 라디오로, 여러 개 고르는 보기는 누름 버튼으로 읽힌다.
function choiceGroup(ctx, field, legendText, { onPick, hint } = {}) {
  const { el, session } = ctx;
  const single = field.type !== "many";
  const stateAttr = single ? "aria-checked" : "aria-pressed";
  const buttons = field.options.map((opt) =>
    el("button", { class: `choice${single ? "" : " many"}`, type: "button", role: single ? "radio" : null, [stateAttr]: String(isChosen(session, field, opt.value)) }, opt.label)
  );
  buttons.forEach((b, k) =>
    b.addEventListener("click", () => {
      choose(session, field, field.options[k].value);
      buttons.forEach((x, j) => x.setAttribute(stateAttr, String(isChosen(session, field, field.options[j].value))));
      onPick?.();
    })
  );
  return el(
    "fieldset",
    { class: "field" },
    el("legend", {}, legendText),
    hint ? el("p", { class: "meta" }, hint) : !single ? el("p", { class: "meta" }, "여러 개 고를 수 있어요.") : null,
    el("div", { class: "choices", role: single ? "radiogroup" : null }, buttons)
  );
}

function topbar(ctx, backHash, stepText) {
  const { el } = ctx;
  return el(
    "div",
    { class: "topbar" },
    el("a", { class: "text-button", href: backHash }, backHash === "#/" ? "표지로" : "이전"),
    stepText ? el("span", { class: "step" }, stepText) : null
  );
}

// ---- 상황 고르기 ----
function renderSituations(root, ctx) {
  const { el, content } = ctx;
  // ready가 아닌 상황(검수를 마치지 못한 상황)은 내지 않는다. 개발 모드에서는 서버가 ready를 넓게 준다.
  const ready = content.situations.filter((s) => s.ready);
  ctx.put(root,
    el(
      "section",
      { class: "sheet" },
      topbar(ctx, "#/", null),
      el("h1", {}, "지금 어떤 상황인가요?"),
      el("p", { class: "meta" }, "가장 가까운 것 하나를 골라 주세요."),
      ready.length
        ? el(
            "div",
            { class: "choices situations" },
            ready.map((s) =>
              el(
                "button",
                {
                  class: "choice situation",
                  type: "button",
                  onclick: () => {
                    const session = ctx.newSession(s.id);
                    ctx.nav(`#/q/${ctx.steps()[0].id}`);
                    return session;
                  },
                },
                el("span", { class: "choice-title" }, s.title),
                s.hint ? el("span", { class: "choice-hint" }, s.hint) : null
              )
            )
          )
        : el("p", { class: "note" }, "아직 두 사람이 확인을 마친 상황이 없어요. 검수가 끝나면 여기에 상황이 나와요.")
    )
  );
  ctx.settle();
}

// ---- 질문 단계 ----
export function render(root, ctx) {
  const { el, params } = ctx;
  if (params.head === "new") return renderSituations(root, ctx);
  const session = ctx.session;
  if (!session) return ctx.nav("#/new", { replace: true });

  const list = ctx.steps();
  const index = list.findIndex((s) => s.id === params.arg);
  if (index < 0) return ctx.nav(`#/q/${list[0].id}`, { replace: true });
  const step = list[index];
  const backHash = index === 0 ? "#/new" : `#/q/${list[index - 1].id}`;
  const nextHash = () => {
    const fresh = ctx.steps();
    const i = fresh.findIndex((s) => s.id === step.id);
    return `#/q/${fresh[i + 1].id}`;
  };
  // 보충 질문은 몇 개일지 모르므로 단계 수에서 뺀다.
  const counted = list.filter((s) => s.kind !== "followups").length;
  const stepText = step.kind === "followups" ? "보충 질문" : `${index + 1} / ${counted}`;
  const sheet = el("section", { class: "sheet" }, topbar(ctx, backHash, stepText));
  ctx.put(root, sheet);

  if (step.kind === "basic" || step.kind === "basic-all" || step.kind === "pick") return renderPick(sheet, ctx, step, nextHash);
  if (step.kind === "worry") return renderWorry(sheet, ctx, nextHash);
  return renderFollowups(sheet, ctx);
}

function renderPick(sheet, ctx, step, nextHash) {
  const { el, session } = ctx;
  let fields;
  let title;
  let lead = null;
  if (step.kind === "basic") {
    title = step.screen.title;
    fields = step.screen.fields.map((f) => ({ field: f, legend: f.label ?? step.screen.title, hint: step.screen.hint }));
  } else if (step.kind === "basic-all") {
    title = "지난번에 적은 기본 정보예요";
    lead = "달라진 곳만 고쳐 주세요.";
    fields = ctx.content.basic.flatMap((screen) => screen.fields.map((f) => ({ field: f, legend: f.label ? `${screen.title} · ${f.label}` : screen.title, hint: screen.hint })));
  } else {
    title = step.q.text;
    fields = [{ field: step.q, legend: step.q.text, hint: step.q.hint }];
  }
  const isPick = step.kind === "pick";
  // 칸 하나에 하나만 고르는 질문은 고르면 바로 넘어간다.
  const auto = fields.length === 1 && fields[0].field.type !== "many";
  let advancing = false;
  const next = el("button", { class: "primary", type: "button", onclick: () => ctx.nav(nextHash()) }, "다음");
  const refresh = () => (next.disabled = !isPick && !fields.every(({ field }) => fieldDone(session, field)));
  const groups = fields.map(({ field, legend, hint }) =>
    choiceGroup(ctx, field, fields.length === 1 ? el("span", { class: "visually-hidden" }, legend) : legend, {
      hint,
      onPick: () => {
        refresh();
        if (auto && !advancing) {
          advancing = true;
          setTimeout(() => ctx.nav(nextHash()), ADVANCE_MS);
        }
      },
    })
  );
  refresh();
  ctx.put(sheet,
    el("h1", {}, title),
    lead ? el("p", { class: "meta" }, lead) : null,
    groups,
    next,
    isPick
      ? el(
          "button",
          {
            class: "text-button block",
            type: "button",
            onclick: () => {
              delete session.answers[step.q.key];
              session.followupQs = null;
              ctx.nav(nextHash());
            },
          },
          "건너뛰기"
        )
      : null
  );
  ctx.settle();
}

function renderWorry(sheet, ctx, nextHash) {
  const { el, session } = ctx;
  const box = el("textarea", { id: "worry", maxlength: "300", rows: "3", "aria-describedby": "worry-note" });
  box.value = session.worry;
  box.addEventListener("input", () => (session.worry = box.value));
  ctx.put(sheet,
    el("h1", {}, el("label", { for: "worry" }, "요즘 가장 걱정되는 일을 한 줄로 적어 주세요")),
    el("p", { class: "meta" }, "비워 두고 넘어가도 돼요."),
    box,
    el("p", { class: "meta", id: "worry-note" }, AI_NOTICE),
    el(
      "button",
      {
        class: "primary",
        type: "button",
        onclick: () => {
          session.worry = box.value;
          // 직접 적은 글은 AI를 부르기 전에 응급 신호부터 본다.
          ctx.checkEmergency([session.worry], nextHash());
        },
      },
      "다음"
    )
  );
  ctx.settle();
}

async function renderFollowups(sheet, ctx) {
  const { el, session } = ctx;
  const here = location.hash;
  if (session.followupQs === null) {
    ctx.put(sheet, el("h1", {}, "조금만 더 여쭤볼게요"), el("p", { class: "loading", role: "status" }, "질문을 준비하는 중이에요."));
    ctx.settle();
    const res = await ctx.api("followups", { situation: session.situation, answers: ctx.currentAnswers() });
    const list = res.ok && Array.isArray(res.value) ? res.value : [];
    session.followupQs = list
      .filter((x) => typeof x?.q === "string" && Array.isArray(x.options))
      .slice(0, 2)
      .map((x) => ({ q: x.q, options: x.options.filter((o) => typeof o === "string") }));
    session.followupAnswers = [];
    session.followupTyped = [];
    if (location.hash !== here) return;
  }
  // 보충 질문이 없으면(AI가 꺼졌거나 실패) 건너뛴다. 이 단계는 기록에 남기지 않는다.
  if (session.followupQs.length === 0) return ctx.nav(ctx.afterQuestions(), { replace: true });

  const root = sheet.parentNode;
  ctx.fill(root);
  const fresh = el("section", { class: "sheet" });
  ctx.put(root, fresh);
  const list = ctx.steps();
  ctx.put(fresh,
    el("div", { class: "topbar" }, el("a", { class: "text-button", href: `#/q/${list[list.length - 2].id}` }, "이전"), el("span", { class: "step" }, "보충 질문"))
  );

  const picked = new Map(session.followupAnswers.map((f) => [f.q, f.a]));
  const blocks = session.followupQs.map((fq, n) => {
    const id = `fq-${n}`;
    const prev = picked.get(fq.q) ?? "";
    const typedPrev = fq.options.includes(prev) ? "" : prev;
    let choice = fq.options.includes(prev) ? prev : null;
    const buttons = fq.options.map((o) => el("button", { class: "choice", type: "button", role: "radio", "aria-checked": String(o === choice) }, o));
    const typed = el("input", { id, type: "text", maxlength: "200", class: "text-input", "aria-describedby": "fq-note" });
    typed.value = typedPrev;
    buttons.forEach((b, k) =>
      b.addEventListener("click", () => {
        // 고른 보기를 다시 누르면 지운다(모르면 비워 둬도 되므로).
        choice = choice === fq.options[k] ? null : fq.options[k];
        if (choice) typed.value = "";
        buttons.forEach((x, j) => x.setAttribute("aria-checked", String(fq.options[j] === choice)));
      })
    );
    typed.addEventListener("input", () => {
      if (typed.value.trim()) {
        choice = null;
        buttons.forEach((x) => x.setAttribute("aria-checked", "false"));
      }
    });
    const block = el(
      "fieldset",
      { class: "field" },
      el("legend", {}, `${n + 1}. ${fq.q}`),
      el("div", { class: "choices", role: "radiogroup" }, buttons),
      el("label", { for: id, class: "meta" }, "직접 적기"),
      typed
    );
    return { block, read: () => ({ q: fq.q, a: choice ?? typed.value.trim(), typed: !choice ? typed.value.trim() : "" }) };
  });

  ctx.put(fresh,
    el("h1", {}, "조금만 더 여쭤볼게요"),
    el("p", { class: "meta" }, "모르면 비워 두고 넘어가도 돼요."),
    blocks.map((b) => b.block),
    el("p", { class: "meta", id: "fq-note" }, AI_NOTICE),
    el(
      "button",
      {
        class: "primary",
        type: "button",
        onclick: () => {
          const read = blocks.map((b) => b.read());
          session.followupAnswers = read.filter((r) => r.a).map(({ q, a }) => ({ q, a }));
          session.followupTyped = read.map((r) => r.typed).filter(Boolean);
          // 걱정 칸과 보충 질문에 직접 적은 글을 함께 본다. 이미 띄운 신호는 다시 띄우지 않는다.
          ctx.checkEmergency([session.worry, ...read.map((r) => r.typed)], ctx.afterQuestions());
        },
      },
      "다음"
    )
  );
  ctx.settle();
}
