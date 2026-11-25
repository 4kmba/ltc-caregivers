// 상황 고르기, 기본 정보, 상황별 질문, 걱정 한 줄, 보충 질문. 이후 맡는 자리: A1.
// 주소: #/new(상황 고르기), #/q/<단계>(basic: 지난번 기본 정보 요약, basic-1..5, sq-<키>, cq-<키>, worry, more).
// 단계 목록과 보낼 답은 app.js(steps, currentAnswers)가 만들고, 이 파일은 그리기만 한다.
// 모양은 11/25 디자인 개선안 ver2의 질문 화면: 흰 종이 위쪽에 이전·단계·진행 막대·상황 이름, 그 아래 질문과 보기, 맨 아래에 고정된 "다음"과 "나중에 답할게요".

const ADVANCE_MS = 350;
const AI_NOTICE = "개인정보 보호를 위해 이름, 주소, 연락처는 답변에 적지 말아 주세요. 답변하신 내용은 AI가 읽고 알맞은 제안을 고르는 데 쓰여요.";

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

// 보기 버튼 하나. 왼쪽 표시(하나만 고르면 동그라미, 여러 개면 둥근 네모)와 고른 뒤의 체크는 꾸밈이라 낭독기가 읽지 않는다.
function choiceButton(ctx, { label, value, single, chosen }) {
  const { el } = ctx;
  const stateAttr = single ? "aria-checked" : "aria-pressed";
  return el(
    "button",
    { class: `choice${single ? "" : " many"}`, type: "button", role: single ? "radio" : null, [stateAttr]: String(chosen) },
    el("span", { class: "choice-mark", "aria-hidden": "true" }, ctx.icon("check", 14)),
    el("span", { class: "choice-label" }, label)
  );
}

// 보기 묶음. 하나만 고르는 보기는 라디오로, 여러 개 고르는 보기는 누름 버튼으로 읽힌다.
function choiceGroup(ctx, field, legendText, { onPick, hint } = {}) {
  const { el, session } = ctx;
  const single = field.type !== "many";
  const stateAttr = single ? "aria-checked" : "aria-pressed";
  const buttons = field.options.map((opt) => choiceButton(ctx, { label: opt.label, value: opt.value, single, chosen: isChosen(session, field, opt.value) }));
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
    hint ? el("p", { class: "q-hint" }, hint) : !single ? el("p", { class: "q-hint" }, "여러 개 고를 수 있어요.") : null,
    el("div", { class: "choices", role: single ? "radiogroup" : null }, buttons)
  );
}

// 질문 화면의 틀(디자인 ver2). 흰 종이 위쪽에 왼쪽 "이전"(48px), 오른쪽 단계 표시("3 / 6"), 6px 진행 막대, 그 아래 상황 이름.
// step은 { current, total } 또는 글자. body에 질문과 보기를, actions에 맨 아래 고정 버튼을 넣는다.
function frame(ctx, { backHash, title, step, progress }) {
  const { el } = ctx;
  const bar = el("span", { class: "q-progress-bar" });
  // 진행 막대 길이는 CSSOM으로 정한다(CSP가 HTML의 style 속성을 막으므로).
  if (typeof progress === "number") bar.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
  const stepNode =
    step && typeof step === "object"
      ? el(
          "span",
          { class: "q-step" },
          el("span", { "aria-hidden": "true" }, String(step.current), el("span", { class: "q-step-total" }, ` / ${step.total}`)),
          el("span", { class: "visually-hidden" }, `전체 ${step.total}단계 중 ${step.current}단계`)
        )
      : step
        ? el("span", { class: "q-step" }, step)
        : null;
  const body = el("div", { class: "q-body" });
  const actions = el("div", { class: "q-actions" });
  const section = el(
    "section",
    { class: "q-screen" },
    el(
      "div",
      { class: "q-head" },
      el("div", { class: "q-head-row" }, el("a", { class: "back-link", href: backHash }, ctx.icon("back", 24), "이전"), stepNode),
      typeof progress === "number" ? el("div", { class: "q-progress", "aria-hidden": "true" }, bar) : null,
      title ? el("p", { class: "q-situation" }, title) : null
    ),
    body,
    actions
  );
  return { section, body, actions };
}

// ---- 상황 고르기 ----
function renderSituations(root, ctx) {
  const { el, content } = ctx;
  // ready가 아닌 상황(검수를 마치지 못한 상황)은 내지 않는다. 개발 모드에서는 서버가 ready를 넓게 준다.
  const ready = content.situations.filter((s) => s.ready);
  const { section, body } = frame(ctx, { backHash: "#/", title: "제안 받기" });
  ctx.put(
    body,
    el("h1", { class: "q-title" }, "지금 어떤 일이 있나요?"),
    el("p", { class: "q-lead" }, "가장 가까운 것 하나를 골라 주세요."),
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
                  ctx.newSession(s.id);
                  ctx.nav(`#/q/${ctx.steps()[0].id}`);
                },
              },
              el("span", { class: "choice-title" }, s.title),
              s.hint ? el("span", { class: "choice-hint" }, s.hint) : null
            )
          )
        )
      : el("p", { class: "note" }, "아직 고를 수 있는 상황이 없어요. 내용 확인이 끝나는 대로 열어 둘게요.")
  );
  ctx.put(root, section);
  ctx.settle();
}

// ---- 질문 단계 ----
export function render(root, ctx) {
  const { params } = ctx;
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
  const followups = step.kind === "followups";
  const parts = frame(ctx, {
    backHash,
    title: ctx.situationOf(session.situation)?.title,
    step: followups ? "조금 더 여쭤볼게요" : { current: index + 1, total: counted },
    progress: followups ? 1 : (index + 1) / counted,
  });
  ctx.put(root, parts.section);

  if (step.kind === "basic-summary") return renderBasicSummary(parts, ctx, step, nextHash);
  if (step.kind === "basic" || step.kind === "pick") return renderPick(parts, ctx, step, nextHash);
  if (step.kind === "worry") return renderWorry(parts, ctx, nextHash);
  return renderFollowups(parts, ctx);
}

function renderPick({ body, actions }, ctx, step, nextHash) {
  const { el, session } = ctx;
  let fields;
  let title;
  if (step.kind === "basic") {
    title = step.screen.title;
    fields = step.screen.fields.map((f) => ({ field: f, legend: f.label ?? step.screen.title, hint: step.screen.hint }));
  } else {
    title = step.q.text;
    fields = [{ field: step.q, legend: step.q.text, hint: step.q.hint }];
  }
  const isPick = step.kind === "pick";
  const one = fields.length === 1;
  // 칸 하나에 하나만 고르는 질문은 고르면 바로 넘어간다. 지난 답이 골라져 있어도 새로 누를 때만 넘어간다.
  const auto = one && fields[0].field.type !== "many";
  let advancing = false;
  const next = el("button", { class: "primary", type: "button", onclick: () => ctx.nav(nextHash()) }, "다음");
  const refresh = () => (next.disabled = !isPick && !fields.every(({ field }) => fieldDone(session, field)));
  // 칸 하나짜리 질문은 제목이 질문이므로 묶음 이름은 낭독기에만 들려주고, 설명은 제목 아래에 둔다.
  const groups = fields.map(({ field, legend, hint }) =>
    choiceGroup(ctx, field, one ? el("span", { class: "visually-hidden" }, legend) : legend, {
      hint: one ? null : hint,
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
  const lead = one ? fields[0].hint ?? (fields[0].field.type === "many" ? "여러 개 고를 수 있어요." : null) : null;
  ctx.put(body, el("h1", { class: "q-title" }, title), lead ? el("p", { class: "q-lead" }, lead) : null, el("div", { class: "q-fields" }, groups));
  ctx.put(
    actions,
    next,
    isPick
      ? el(
          "button",
          {
            class: "skip-button",
            type: "button",
            onclick: () => {
              delete session.answers[step.q.key];
              session.followupQs = null;
              ctx.nav(nextHash());
            },
          },
          "나중에 답할게요"
        )
      : null
  );
  ctx.settle();
}

// 지난번 기본 정보 요약 카드. 잘 안 바뀌는 칸의 답을 한두 줄로 보여 주고 [그대로예요] [고칠 게 있어요]를 묻는다.
// 고칠 게 있다고 하면 그 자리에서 해당 칸의 보기를 펼친다.
function renderBasicSummary({ body, actions }, ctx, step, nextHash) {
  const { el, session } = ctx;
  // 칸 하나짜리 화면의 답은 한 줄에 모으고, 칸 여러 개인 화면(보호자 여건)은 화면마다 한 줄로 둔다.
  // 칸 이름이 "~는지"처럼 묻는 말이면 보기 이름만으로 뜻이 통하므로 칸 이름을 붙이지 않는다.
  const part = (f) => {
    const label = ctx.knownLabel(f.key, session.answers[f.key]);
    if (!label) return "";
    return f.label && !/지$/.test(f.label) ? `${f.label}: ${label}` : label;
  };
  const single = step.screens.filter((sc) => sc.fields.length === 1).flatMap((sc) => sc.fields.map(part));
  const multi = step.screens.filter((sc) => sc.fields.length > 1).map((sc) => sc.fields.map(part).filter(Boolean).join(" · "));
  const lines = [single.filter(Boolean).join(" · "), ...multi].filter(Boolean);

  const card = el(
    "div",
    { class: "basic-summary" },
    lines.length ? lines.map((l) => el("p", { class: "basic-summary-line" }, l)) : el("p", { class: "q-lead" }, "지난번에는 모두 “잘 모르겠어요”로 답하셨어요.")
  );
  const editBox = el("div", { class: "basic-summary-edit" });

  function edit() {
    const fields = step.screens.flatMap((sc) => sc.fields.map((f) => ({ field: f, legend: f.label ? `${sc.title} · ${f.label}` : sc.title, hint: sc.hint })));
    const next = el("button", { class: "primary", type: "button", onclick: () => ctx.nav(nextHash()) }, "다음");
    const refresh = () => (next.disabled = !fields.every(({ field }) => fieldDone(session, field)));
    const groups = fields.map(({ field, legend, hint }) => choiceGroup(ctx, field, legend, { hint, onPick: refresh }));
    refresh();
    ctx.fill(editBox, el("p", { class: "q-lead" }, "바뀐 것만 다시 골라 주세요."), el("div", { class: "q-fields" }, groups));
    ctx.fill(actions, next);
    editBox.querySelector("button")?.focus();
  }

  ctx.put(body, el("h1", { class: "q-title" }, "지난번에 적은 내용이에요"), el("p", { class: "q-lead" }, "지금도 맞나요?"), card, editBox);
  ctx.put(
    actions,
    el("button", { class: "primary", type: "button", onclick: () => ctx.nav(nextHash()) }, "지금도 맞아요"),
    el("button", { class: "secondary", type: "button", onclick: () => edit() }, "바뀐 게 있어요")
  );
  ctx.settle();
}

function renderWorry({ body, actions }, ctx, nextHash) {
  const { el, session } = ctx;
  const box = el("textarea", { id: "worry", maxlength: "300", rows: "3", "aria-describedby": "worry-note" });
  box.value = session.worry;
  box.addEventListener("input", () => (session.worry = box.value));
  ctx.put(
    body,
    el("h1", { class: "q-title" }, el("label", { for: "worry" }, "요즘 가장 걱정되는 일을 한 줄로 적어 주세요")),
    el("p", { class: "q-lead" }, "비워 두고 넘어가도 돼요."),
    box,
    el("p", { class: "q-note", id: "worry-note" }, AI_NOTICE)
  );
  ctx.put(
    actions,
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

async function renderFollowups({ body, actions }, ctx) {
  const { el, session } = ctx;
  const here = location.hash;
  if (session.followupQs === null) {
    ctx.put(body, el("h1", { class: "q-title" }, "조금만 더 여쭤볼게요"), el("p", { class: "loading", role: "status" }, "이어서 여쭤볼 것을 고르고 있어요."));
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

  // 기다리는 동안 붙은 바닥 글을 지우고 같은 틀에 다시 그린다.
  const root = body.closest(".q-screen")?.parentNode;
  root?.querySelector(".site-footer")?.remove();
  ctx.fill(body);
  ctx.fill(actions);

  const picked = new Map(session.followupAnswers.map((f) => [f.q, f.a]));
  const blocks = session.followupQs.map((fq, n) => {
    const id = `fq-${n}`;
    const prev = picked.get(fq.q) ?? "";
    const typedPrev = fq.options.includes(prev) ? "" : prev;
    let choice = fq.options.includes(prev) ? prev : null;
    const buttons = fq.options.map((o) => choiceButton(ctx, { label: o, value: o, single: true, chosen: o === choice }));
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
      el("label", { for: id, class: "q-hint" }, "직접 적기"),
      typed
    );
    return { block, read: () => ({ q: fq.q, a: choice ?? typed.value.trim(), typed: !choice ? typed.value.trim() : "" }) };
  });

  ctx.put(
    body,
    el("h1", { class: "q-title" }, "조금만 더 여쭤볼게요"),
    el("p", { class: "q-lead" }, "모르면 비워 두고 넘어가도 돼요."),
    el("div", { class: "q-fields" }, blocks.map((b) => b.block)),
    el("p", { class: "q-note", id: "fq-note" }, AI_NOTICE)
  );
  ctx.put(
    actions,
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
