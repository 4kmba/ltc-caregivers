// 화면 흐름: 응급 확인 → 질문 1～6 → 정리하는 중 → 한 장 또는 실패.
// AI가 쓴 글은 textContent로만 넣는다. 링크와 전화번호는 sources.json에서만 꺼낸다.

import { QUESTIONS, NOTE_MAX } from "/questions.js";

const CLIENT_TIMEOUT_MS = 35_000; // 서버의 30초 제한보다 조금 길게

const $ = (id) => document.getElementById(id);

let sources = { items: [], fallbackIds: [] };
let answers = {};
let step = 0;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function show(id) {
  for (const screen of document.querySelectorAll(".screen")) screen.hidden = screen.id !== id;
  window.scrollTo(0, 0);
  const heading = $(id).querySelector("h1");
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

const findSource = (id) => sources.items.find((item) => item.id === id);

function supportItem(item) {
  const li = el("li", "support");
  li.append(el("p", "support-name", item.name), el("p", "support-org", item.org), el("p", "support-summary", item.summary));
  const links = el("div", "support-links");
  const link = el("a", "link", "공식 페이지 열기");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  links.append(link);
  if (item.phone) {
    const tel = el("a", "link tel", `전화 ${item.phone}`);
    tel.href = `tel:${item.phone.replace(/[^0-9]/g, "")}`;
    links.append(tel);
  }
  li.append(links);
  return li;
}

function fillSupports(list, ids) {
  list.replaceChildren(...ids.map(findSource).filter(Boolean).map(supportItem));
}

// ---- 응급 확인 ----

function restart() {
  answers = {};
  step = 0;
  show("screen-check");
}

document.querySelector('[data-emergency="yes"]').addEventListener("click", () => show("screen-emergency"));
document.querySelector('[data-emergency="no"]').addEventListener("click", () => {
  step = 0;
  renderQuestion();
  show("screen-question");
});
for (const button of document.querySelectorAll('[data-action="restart"]')) button.addEventListener("click", restart);

// ---- 질문 1～6 ----

function isAnswered(question) {
  if (question.note) return true;
  return question.parts.every((part) => {
    const value = answers[part.key];
    return part.multiple ? Array.isArray(value) && value.length > 0 : Boolean(value);
  });
}

function choiceGroup(part, showLabel) {
  const group = el("div", "group");
  group.setAttribute("role", "group");
  if (showLabel) {
    const label = el("p", "group-label", part.label);
    label.id = `label-${part.key}`;
    group.setAttribute("aria-labelledby", label.id);
    group.append(label);
  } else {
    group.setAttribute("aria-label", part.label);
  }
  const choices = el("div", "choices");
  for (const choice of part.choices) {
    const button = el("button", "choice", choice);
    button.type = "button";
    const selected = part.multiple ? (answers[part.key] ?? []).includes(choice) : answers[part.key] === choice;
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      if (part.multiple) {
        const current = new Set(answers[part.key] ?? []);
        current.has(choice) ? current.delete(choice) : current.add(choice);
        answers[part.key] = [...current];
      } else {
        answers[part.key] = choice;
      }
      renderQuestion();
    });
    choices.append(button);
  }
  group.append(choices);
  return group;
}

function noteField() {
  const wrap = el("div", "group");
  const area = el("textarea", "note");
  area.id = "note";
  area.maxLength = NOTE_MAX;
  area.rows = 5;
  area.placeholder = "예: 퇴원 후 밤에 자주 깨세요. 형제끼리 돌봄을 어떻게 나눌지 고민이에요.";
  area.setAttribute("aria-label", "더 알려 주고 싶은 것");
  area.value = answers.note ?? "";
  const count = el("p", "count", `${area.value.length} / ${NOTE_MAX}`);
  area.addEventListener("input", () => {
    answers.note = area.value;
    count.textContent = `${area.value.length} / ${NOTE_MAX}`;
  });
  wrap.append(area, count);
  return wrap;
}

function renderQuestion() {
  const question = QUESTIONS[step];
  $("q-step").textContent = `질문 ${step + 1} / ${QUESTIONS.length}`;
  $("q-bar").style.width = `${((step + 1) / QUESTIONS.length) * 100}%`;
  $("q-title").textContent = question.title;
  $("q-hint").textContent = question.hint ?? "";
  $("q-hint").hidden = !question.hint;

  const body = $("q-body");
  if (question.note) {
    // 입력 중에 다시 그리면 커서가 사라지므로 이미 있으면 그대로 둔다.
    if (!$("note")) body.replaceChildren(noteField());
  } else {
    const showLabels = question.parts.length > 1;
    body.replaceChildren(...question.parts.map((part) => choiceGroup(part, showLabels)));
  }

  const isLast = step === QUESTIONS.length - 1;
  $("q-next").textContent = isLast ? "정리하기" : "다음";
  $("q-next").disabled = !isAnswered(question);
}

$("q-back").addEventListener("click", () => {
  if (step === 0) return show("screen-check");
  step -= 1;
  renderQuestion();
  show("screen-question");
});

$("q-next").addEventListener("click", () => {
  if (!isAnswered(QUESTIONS[step])) return;
  if (step === QUESTIONS.length - 1) return submit();
  step += 1;
  renderQuestion();
  show("screen-question");
});

// ---- 정리하기 ----

async function submit() {
  show("screen-loading");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch("/api/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(answers),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error("정리 실패");
    renderCard(data.card);
    show("screen-card");
  } catch {
    show("screen-failure");
  } finally {
    clearTimeout(timer);
  }
}

$("retry").addEventListener("click", submit);

function optionCard(option) {
  const card = el("article", "option");
  card.append(el("h3", "option-name", option.name));
  const rows = [
    ["장점", option.pros],
    ["단점", option.cons],
    ["비용 기준", option.cost_basis],
    ["가족 부담", option.family_burden],
  ];
  const list = el("dl", "option-rows");
  for (const [label, text] of rows) list.append(el("dt", "", label), el("dd", "", text));
  card.append(list);
  return card;
}

function renderCard(card) {
  $("card-decision").textContent = card.decision;
  $("card-options").replaceChildren(...card.options.map(optionCard));

  // 목록에 있는 번호만 남는다. 하나도 없으면 고정 안내를 보여 준다.
  const known = card.supportIds.filter((id) => findSource(id));
  fillSupports($("card-supports"), known.length > 0 ? known : sources.fallbackIds);

  $("card-medical-block").hidden = card.medicalQuestions.length === 0;
  $("card-medical").replaceChildren(...card.medicalQuestions.map((q) => el("li", "", q)));
}

// ---- 시작 ----

async function loadSources() {
  try {
    const response = await fetch("/sources.json");
    sources = await response.json();
  } catch {
    return; // 자료를 못 읽어도 질문은 진행한다. 실패 화면은 비어 있는 목록으로 나온다.
  }
  fillSupports($("failure-supports"), sources.fallbackIds);
  $("card-checked").textContent = `지원과 연락처는 공공기관 공식 페이지에서 ${sources.checkedDate}에 확인한 것만 보여 줘요.`;
  const emergency = findSource(sources.emergencyId);
  if (emergency) $("emergency-source").textContent = `출처: ${emergency.org} (${emergency.url.replace("https://", "")})`;
}

loadSources();
