// 할 일 목록을 고르는 규칙. 서버도 AI도 없이 브라우저에서 돈다. Node 테스트도 이 파일을 그대로 쓴다.
// 데이터(카드, 고정 질문, 보충 질문)는 밖에서 읽어 createEngine에 넘긴다.

export const BUCKETS = ["this_week", "this_month", "know_ahead"];
const HAS_GRADE = ["g1", "g2", "g3", "g4", "g5", "cognitive"];
const PLAN_SIZE = 6;
const MAX_BOOSTED = 4;

// "왜 넣었나요"에 답을 보여 줄 때 붙이는 짧은 질문 이름.
const FIELD_NAMES = {
  stage: "지금 상황", relation: "관계", age: "나이", diagnoses: "진단", mobility: "거동", talk: "대화",
  grade: "등급", care: "받는 돌봄", lives_together: "함께 사는지", works: "일", hours: "직접 돌볼 시간",
  budget: "한 달 비용", split: "비용 나누기", hospital_stay: "입원", sudden_change: "최근 변화", service_fit: "지금 서비스"
};

// 응급 신호는 키워드로 확인한다. 목록에 없는 표현은 놓칠 수 있다.
const EMERGENCY_RULES = [
  {
    kind: "medical",
    words: ["대답이 없", "대답을 안", "반응이 없", "의식이 없", "의식을 잃", "깨워도", "숨을 안", "숨을 못", "숨쉬기", "숨이 차", "쓰러", "경련", "발작", "피를 토", "피를 많이", "말이 어눌", "한쪽이 마비", "마비가 왔"]
  },
  {
    kind: "violence",
    words: ["때리", "때려", "폭력", "주먹", "흉기", "칼을", "목을 조", "위협"]
  },
  {
    kind: "suicide",
    words: ["죽고 싶", "죽어버리", "죽어 버리", "죽겠다고", "자살", "목숨을", "살기 싫", "그만 살"]
  }
];

export function detectEmergency(texts) {
  const joined = texts.filter(Boolean).join(" ").replace(/\s+/g, " ");
  const compact = joined.replace(/\s/g, "");
  return EMERGENCY_RULES.filter((rule) =>
    rule.words.some((w) => joined.includes(w) || compact.includes(w.replace(/\s/g, "")))
  ).map((rule) => rule.kind);
}

// 1번 답이 "잘 모르겠어요"이면 등급과 지금 받는 돌봄으로 단계를 짐작한다.
export function resolveStage(answers) {
  const stage = answers.stage;
  if (stage && stage !== "unknown") return stage;
  const care = answers.care ?? [];
  if (care.includes("hospital")) return "change";
  if (care.includes("nursing_home")) return "facility";
  if (HAS_GRADE.includes(answers.grade)) return "new_grade";
  return "suspect";
}

function valuesOf(answer) {
  if (answer === undefined || answer === null || answer === "") return [];
  return Array.isArray(answer) ? answer : [answer];
}

function hits(answer, allowed) {
  return valuesOf(answer).filter((v) => allowed.includes(v));
}

function allMatch(cond, answers) {
  return Object.entries(cond ?? {}).every(([key, allowed]) => hits(answers[key], allowed).length > 0);
}

// when의 조건은 모두 맞아야 하고, when_not은 하나도 맞으면 안 되고,
// when_any가 있으면 그 묶음 가운데 하나는 통째로 맞아야 한다.
export function matches(card, answers) {
  if (!allMatch(card.when, answers)) return false;
  for (const [key, blocked] of Object.entries(card.when_not ?? {})) {
    if (hits(answers[key], blocked).length) return false;
  }
  if (card.when_any && !card.when_any.some((group) => allMatch(group, answers))) return false;
  return true;
}

export function createEngine({ deck, questions, followups }) {
  const cardById = new Map(deck.cards.map((c) => [c.id, c]));
  const fields = new Map(questions.flatMap((q) => q.fields).map((f) => [f.key, f]));
  for (const f of followups.questions) fields.set(f.key, { key: f.key, type: "one", options: f.options });

  function label(key, value) {
    return fields.get(key)?.options.find((o) => o.value === value)?.label ?? value;
  }

  // 보호자에게 보일 보충 질문: 조건이 맞는 선택형 질문과, 늘 묻는 걱정 한 줄.
  function pickFollowups(answers) {
    const view = { ...answers, stage: resolveStage(answers) };
    return followups.questions.filter((q) => matches(q, view));
  }

  function worryTopics(text) {
    if (!text) return [];
    const joined = String(text).replace(/\s+/g, " ");
    const compact = joined.replace(/\s/g, "");
    return followups.worry_topics.filter((t) =>
      t.words.some((w) => joined.includes(w) || compact.includes(w.replace(/\s/g, "")))
    );
  }

  // 화면에서 온 답 가운데 질문지에 있는 값만 남긴다.
  function cleanAnswers(raw) {
    const answers = {};
    for (const [key, field] of fields) {
      const allowed = field.options.map((o) => o.value);
      const value = raw?.[key];
      if (field.type === "many") {
        if (Array.isArray(value)) answers[key] = value.filter((v) => allowed.includes(v));
      } else if (allowed.includes(value)) {
        answers[key] = value;
      }
    }
    if (typeof raw?.worry === "string" && raw.worry.trim()) answers.worry = raw.worry.trim().slice(0, 300);
    return answers;
  }

  function isBoosted(card, answers) {
    return Boolean(card.boost) && allMatch(card.boost, answers);
  }

  // 이 카드를 왜 넣었는지 보호자의 답으로 설명한다.
  function reasonsFor(card, answers, topics) {
    const picked = [];
    const add = (key, allowed) => {
      for (const v of hits(answers[key], allowed)) {
        const text = `${FIELD_NAMES[key] ?? key}: ${label(key, v)}`;
        if (!picked.includes(text)) picked.push(text);
      }
    };
    for (const [key, allowed] of Object.entries(card.when ?? {})) add(key, allowed);
    const group = card.when_any?.find((g) => allMatch(g, answers));
    for (const [key, allowed] of Object.entries(group ?? {})) add(key, allowed);
    if (isBoosted(card, answers)) for (const [key, allowed] of Object.entries(card.boost)) add(key, allowed);
    const lines = [];
    const worried = topics.filter((t) => t.cards.includes(card.id)).map((t) => t.label);
    if (worried.length) lines.push(`걱정으로 적어 주신 '${worried.join("', '")}'에 맞는 일이에요.`);
    if (picked.length) lines.push(`고르신 답(${picked.join(", ")})에 맞춰 넣었어요.`);
    if (!lines.length) lines.push("지금 상황이면 대부분 챙겨야 하는 일이에요.");
    return lines;
  }

  function specificity(card) {
    return Object.keys(card.when ?? {}).length + (card.when_any ? 1 : 0);
  }

  // 목록 고르기:
  // 1. 단계와 조건이 맞는 카드를 후보로 둔다.
  // 2. 보충 질문이나 걱정과 맞는 카드를 먼저(최대 4장), 그다음 세 구간이 비지 않게 하나씩, 나머지는 조건이 많이 맞는 순서로 채운다.
  // 3. 보호자가 숨긴 카드는 빼고, 직접 넣은 카드는 더한다.
  function buildPlan(rawAnswers, { hidden = [], added = [] } = {}) {
    const answers = cleanAnswers(rawAnswers);
    const stage = resolveStage(answers);
    const topics = worryTopics(answers.worry);
    const worryIds = new Set(topics.flatMap((t) => t.cards));
    const usable = (c) => !hidden.includes(c.id) && matches(c, answers);

    const pool = deck.cards.filter((c) => usable(c) && c.stages.includes(stage));
    if (pool.length < 3) {
      const plain = deck.cards
        .filter((c) => c.stages.includes(stage) && !pool.includes(c) && !hidden.includes(c.id))
        .filter((c) => Object.keys(c.when ?? {}).every((k) => k === "grade") && !c.when_not && !c.when_any)
        .filter((c) => matches(c, answers));
      pool.push(...plain);
    }
    const front = (c) => isBoosted(c, answers) || worryIds.has(c.id);
    pool.sort((a, b) => front(b) - front(a) || specificity(b) - specificity(a) || a.priority - b.priority);

    const picked = pool.filter(front).slice(0, MAX_BOOSTED);
    for (const bucket of BUCKETS) {
      if (picked.some((c) => c.bucket === bucket)) continue;
      const first = pool.find((c) => c.bucket === bucket && !picked.includes(c));
      if (first) picked.push(first);
    }
    for (const c of pool) {
      if (picked.length >= PLAN_SIZE) break;
      if (!picked.includes(c)) picked.push(c);
    }
    for (const id of added) {
      const c = cardById.get(id);
      if (c && !hidden.includes(id) && !picked.includes(c)) picked.push(c);
    }

    const order = (c) => BUCKETS.indexOf(c.bucket) * 1000 - (front(c) ? 100 : 0) + c.priority;
    picked.sort((a, b) => order(a) - order(b));

    const items = picked.map((c) => ({
      card_id: c.id,
      bucket: c.bucket,
      reasons: added.includes(c.id) && !pool.includes(c) ? ["직접 수첩에 넣으셨어요."] : reasonsFor(c, answers, topics)
    }));
    const extras = deck.cards
      .filter((c) => usable(c) && !picked.includes(c) && c.stages.includes(stage))
      .sort((a, b) => a.priority - b.priority)
      .map((c) => c.id);

    return {
      stage,
      emergency: detectEmergency([answers.worry]),
      items,
      extras,
      hiddenCount: hidden.length
    };
  }

  return { cardById, cleanAnswers, pickFollowups, worryTopics, buildPlan, label };
}
