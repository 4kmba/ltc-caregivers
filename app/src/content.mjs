// 내용 파일 다섯 개를 읽고, 서로 가리키는 번호가 맞는지 점검하고, 화면에 낼 수 있는 내용만 골라낸다.
// 화면과 서버는 이 모듈을 거쳐서만 내용을 읽는다.
import { readFileSync } from "node:fs";

const contentDir = new URL("../content/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, contentDir), "utf-8"));

export function loadContent() {
  const { basic, situations, conditional, topics } = read("situations.json");
  const { methods } = read("methods.json");
  const { cards, buckets } = read("cards.json");
  const { qa } = read("qa.json");
  const { sources } = read("sources.json");
  return { basic, situations, conditional, topics, methods, cards, buckets, qa, sources };
}

// 확인한 사람이 서로 다른 두 명 이상이면 확인된 자료다.
export function isVerified(source) {
  const people = new Set((source?.checks ?? []).map((c) => c.by).filter(Boolean));
  return people.size >= 2;
}

// 답의 키와 고를 수 있는 값. 카드 조건과 방식 점수 규칙이 이 값만 쓰는지 점검할 때 쓴다.
export function answerSpace(content) {
  const space = new Map();
  const add = (key, options) => {
    const values = space.get(key) ?? new Set();
    for (const o of options) values.add(o.value);
    space.set(key, values);
  };
  for (const screen of content.basic) for (const f of screen.fields) add(f.key, f.options);
  for (const s of content.situations) for (const q of s.questions) add(q.key, q.options);
  for (const q of content.conditional) add(q.key, q.options);
  space.set("situation", new Set(content.situations.map((s) => s.id)));
  return space;
}

function conditionGroups(card) {
  return [card.when, card.when_not, card.boost, ...(card.when_any ?? [])].filter(Boolean);
}

// 내용 파일 사이의 번호와 값이 맞는지 본다. 틀린 곳마다 한 줄씩 돌려준다.
export function validateContent(content) {
  const errors = [];
  const sourceIds = new Set();
  for (const s of content.sources) {
    if (sourceIds.has(s.id)) errors.push(`자료 번호가 겹칩니다: ${s.id}`);
    sourceIds.add(s.id);
  }
  const situationIds = new Set(content.situations.map((s) => s.id));
  const topicIds = new Set(content.topics.map((t) => t.id));
  const bucketIds = new Set(Object.keys(content.buckets));
  const cardById = new Map(content.cards.map((c) => [c.id, c]));
  const qaById = new Map(content.qa.map((q) => [q.id, q]));
  const space = answerSpace(content);

  if (cardById.size !== content.cards.length) errors.push("카드 번호가 겹칩니다");
  if (qaById.size !== content.qa.length) errors.push("질문 번호가 겹칩니다");

  const checkSources = (where, ids) => {
    for (const id of ids ?? []) if (!sourceIds.has(id)) errors.push(`${where}: 자료 목록에 없는 번호 ${id}`);
  };
  const checkCondition = (where, group) => {
    for (const [key, values] of Object.entries(group)) {
      const allowed = space.get(key);
      if (!allowed) {
        errors.push(`${where}: 질문에 없는 답 키 ${key}`);
        continue;
      }
      for (const v of values) if (!allowed.has(v)) errors.push(`${where}: ${key}에 없는 값 ${v}`);
    }
  };

  for (const card of content.cards) {
    const where = `카드 ${card.id}`;
    if (!card.situations?.length) errors.push(`${where}: 상황이 없습니다`);
    for (const s of card.situations ?? []) if (!situationIds.has(s)) errors.push(`${where}: 없는 상황 ${s}`);
    if (!bucketIds.has(card.bucket)) errors.push(`${where}: 없는 구간 ${card.bucket}`);
    if (!card.source_ids?.length) errors.push(`${where}: 출처가 없습니다`);
    checkSources(where, card.source_ids);
    checkSources(`${where} 연락할 곳`, card.contact_ids);
    for (const group of conditionGroups(card)) checkCondition(where, group);
    for (const id of card.qa_ids ?? []) {
      const q = qaById.get(id);
      if (!q) errors.push(`${where}: 없는 질문 ${id}`);
      else if (q.card_id !== card.id) errors.push(`${where}: 질문 ${id}의 card_id가 ${q.card_id}입니다`);
    }
  }

  for (const q of content.qa) {
    const where = `질문 ${q.id}`;
    if (!topicIds.has(q.topic)) errors.push(`${where}: 없는 주제 ${q.topic}`);
    if (q.card_id && !cardById.has(q.card_id)) errors.push(`${where}: 없는 카드 ${q.card_id}`);
    if (!q.source_ids?.length) errors.push(`${where}: 출처가 없습니다`);
    checkSources(where, q.source_ids);
    checkSources(`${where} 연락할 곳`, q.contact_ids);
  }

  for (const m of content.methods) {
    const where = `방식 ${m.id}`;
    const situation = content.situations.find((s) => s.id === m.situation);
    if (!situation) errors.push(`${where}: 없는 상황 ${m.situation}`);
    else if (!situation.compare) errors.push(`${where}: ${m.situation}은 비교 화면이 없는 상황입니다`);
    checkSources(where, m.source_ids);
    for (const r of m.rules) {
      checkCondition(where, { [r.key]: r.is });
      if (!(r.score > 0)) errors.push(`${where}: 점수가 0보다 커야 합니다 (${r.key})`);
      if (!r.reason?.trim()) errors.push(`${where}: 이유 문장이 없습니다 (${r.key})`);
    }
    for (const id of [...m.first_cards, ...m.exclude_cards]) {
      const card = cardById.get(id);
      if (!card) errors.push(`${where}: 없는 카드 ${id}`);
      else if (!card.situations.includes(m.situation)) errors.push(`${where}: 카드 ${id}는 ${m.situation} 상황의 카드가 아닙니다`);
    }
  }

  for (const s of content.situations) {
    const methodCount = content.methods.filter((m) => m.situation === s.id).length;
    if (s.compare && s.priority === "P0" && (methodCount < 2 || methodCount > 3)) {
      errors.push(`상황 ${s.id}: 비교 화면의 방식은 2～3개여야 하는데 ${methodCount}개입니다`);
    }
    if (s.questions.length > 3) errors.push(`상황 ${s.id}: 상황별 질문은 3개까지입니다`);
  }

  errors.push(...phoneErrors(content));
  return errors;
}

// 글에 적힌 전화번호가 자료 목록의 번호와 같은지 본다. 번호가 따로 적혀 서로 달라지는 일을 막는다.
// 대시가 들어간 번호(1577-1000)만 본다. 세 자리 번호는 금액이나 일수와 구분하기 어렵다.
const PHONE = /(?<![\d-])1\d{3}-\d{4}(?![\d-])/g;

export function phoneErrors(content) {
  const known = new Set(content.sources.map((s) => s.phone).filter(Boolean));
  const errors = [];
  const look = (where, text) => {
    for (const phone of String(text ?? "").match(PHONE) ?? []) {
      if (!known.has(phone)) errors.push(`${where}: 자료 목록에 없는 전화번호 ${phone}`);
    }
  };
  for (const c of content.cards) {
    look(`카드 ${c.id}`, c.why);
    look(`카드 ${c.id}`, c.contact_note);
  }
  for (const q of content.qa) look(`질문 ${q.id}`, q.a);
  for (const m of content.methods) look(`방식 ${m.id}`, [m.summary, m.start_now, m.cost, m.burden].join(" "));
  return errors;
}

// 화면에 낼 수 있는 내용만 남긴다. 확인한 사람이 둘이 안 되는 자료를 하나라도 가리키면 뺀다.
// showUnverified를 켜면 모두 남기고 verified 표시만 붙인다. 개발과 검수 때만 켠다.
export function visibleContent(content, { showUnverified = false } = {}) {
  const verified = new Set(content.sources.filter(isVerified).map((s) => s.id));
  const ok = (ids) => (ids ?? []).every((id) => verified.has(id));
  const mark = (item, isOk) => ({ ...item, verified: isOk });
  const keep = (list, test) =>
    list.map((item) => mark(item, test(item))).filter((item) => showUnverified || item.verified);

  const qa = keep(content.qa, (q) => ok(q.source_ids) && ok(q.contact_ids));
  const cards = keep(content.cards, (c) => ok(c.source_ids) && ok(c.contact_ids)).map((c) => ({
    ...c,
    qa_ids: c.qa_ids.filter((id) => qa.some((q) => q.id === id))
  }));
  const methods = keep(content.methods, (m) => ok(m.source_ids));
  const sources = keep(content.sources, (s) => verified.has(s.id));
  const situations = content.situations.map((s) => {
    const cardCount = cards.filter((c) => c.situations.includes(s.id)).length;
    const methodCount = methods.filter((m) => m.situation === s.id).length;
    // 카드가 3장보다 적거나, 비교 화면인데 방식이 2개보다 적으면 그 상황을 내지 않는다.
    const ready = cardCount >= 3 && (!s.compare || methodCount >= 2);
    return { ...s, ready, card_count: cardCount, method_count: methodCount };
  });
  return { ...content, qa, cards, methods, sources, situations };
}

// 자동 점검이 알려 줄 숫자. scripts/check-content.mjs가 표로 보여 준다.
export function reviewReport(content) {
  const visible = visibleContent(content);
  const all = visibleContent(content, { showUnverified: true });
  return {
    sources: { total: content.sources.length, verified: visible.sources.length },
    cards: { total: content.cards.length, visible: visible.cards.length },
    qa: { total: content.qa.length, visible: visible.qa.length },
    methods: { total: content.methods.length, visible: visible.methods.length },
    situations: all.situations.map((s) => {
      const v = visible.situations.find((x) => x.id === s.id);
      return {
        id: s.id,
        title: s.title,
        priority: s.priority,
        cards: `${v.card_count}/${s.card_count}`,
        methods: s.compare ? `${v.method_count}/${s.method_count}` : "-",
        ready: v.ready,
        watch: s.watch?.length ?? 0
      };
    }),
    // 확인이 한 명뿐이거나 없는 자료 가운데, 가리키는 카드와 답이 많은 것부터 보여 준다.
    unverified: content.sources
      .filter((s) => !isVerified(s))
      .map((s) => ({
        id: s.id,
        name: s.name,
        checks: s.checks.map((c) => c.by).join(", ") || "없음",
        used: [...content.cards, ...content.qa, ...content.methods].filter(
          (x) => x.source_ids?.includes(s.id) || x.contact_ids?.includes(s.id)
        ).length
      }))
      .filter((s) => s.used > 0)
      .sort((a, b) => b.used - a.used)
  };
}
