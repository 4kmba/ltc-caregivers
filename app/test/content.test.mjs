import assert from "node:assert/strict";
import { test } from "node:test";
import { isVerified, loadContent, phoneErrors, validateContent, visibleContent } from "../src/content.mjs";

const content = loadContent();

test("내용 파일의 번호와 값이 서로 맞다", () => {
  assert.deepEqual(validateContent(content), []);
});

test("P0 상황 일곱 개가 있고, 상황마다 카드가 3장 이상 있다", () => {
  const p0 = content.situations.filter((s) => s.priority === "P0");
  assert.equal(p0.length, 7);
  for (const s of p0) {
    const n = content.cards.filter((c) => c.situations.includes(s.id)).length;
    assert.ok(n >= 3, `${s.id}: 카드 ${n}장`);
  }
});

test("비교 화면이 있는 P0 상황 네 개는 방식이 2～3개다", () => {
  const compare = content.situations.filter((s) => s.priority === "P0" && s.compare);
  assert.deepEqual(compare.map((s) => s.id).sort(), ["caregiver_out", "fall", "hospital", "symptom"]);
});

test("모든 질문에 잘 모르겠어요가 있다", () => {
  const fields = [
    ...content.basic.flatMap((b) => b.fields),
    ...content.situations.flatMap((s) => s.questions),
    ...content.conditional
  ];
  for (const f of fields) assert.ok(f.options.some((o) => o.value === "unknown"), f.key);
});

test("이름, 연락처, 주소를 묻는 질문이 없다", () => {
  const keys = content.basic.flatMap((b) => b.fields.map((f) => f.key));
  for (const banned of ["name", "phone", "address", "relation", "age"]) assert.ok(!keys.includes(banned), banned);
});

// 아래 테스트는 실제 내용 대신 작은 예시로 규칙만 확인한다.
function fixture(checksA, checksB) {
  return {
    basic: [],
    situations: [{ id: "fall", title: "낙상", compare: false, priority: "P0", questions: [] }],
    conditional: [],
    topics: [{ id: "health", title: "증상과 약" }],
    buckets: { this_week: "이번 주" },
    methods: [],
    sources: [
      { id: "a", name: "A", phone: "1577-1000", checks: checksA },
      { id: "b", name: "B", checks: checksB }
    ],
    cards: ["c1", "c2", "c3"].map((id, i) => ({
      id,
      situations: ["fall"],
      bucket: "this_week",
      title: id,
      source_ids: i === 0 ? ["a", "b"] : ["a"],
      contact_ids: [],
      qa_ids: [`${id}-q1`]
    })),
    qa: ["c1", "c2", "c3"].map((id) => ({ id: `${id}-q1`, card_id: id, topic: "health", q: "?", a: "!", source_ids: ["a"] }))
  };
}

const two = [{ by: "김영균", date: "2026-11-25" }, { by: "유정민", date: "2026-11-26" }];
const one = [{ by: "김영균", date: "2026-11-25" }];

test("서로 다른 두 사람이 확인해야 확인된 자료다", () => {
  assert.equal(isVerified({ checks: two }), true);
  assert.equal(isVerified({ checks: one }), false);
  assert.equal(isVerified({ checks: [...one, ...one] }), false, "같은 사람이 두 번 확인한 것은 한 명으로 센다");
  assert.equal(isVerified({ checks: [] }), false);
});

test("확인이 한 명뿐인 자료를 가리키는 카드는 화면에서 빠진다", () => {
  const v = visibleContent(fixture(two, one));
  assert.deepEqual(v.cards.map((c) => c.id), ["c2", "c3"]);
  assert.deepEqual(v.qa.map((q) => q.id), ["c1-q1", "c2-q1", "c3-q1"]);
  // 카드가 3장보다 적어 상황이 화면에 나오지 않는다.
  assert.equal(v.situations[0].ready, false);
});

test("모두 두 사람이 확인하면 상황이 화면에 나온다", () => {
  const v = visibleContent(fixture(two, two));
  assert.equal(v.cards.length, 3);
  assert.equal(v.situations[0].ready, true);
});

test("showUnverified를 켜면 모두 남기고 확인 여부만 표시한다", () => {
  const v = visibleContent(fixture(two, one), { showUnverified: true });
  assert.equal(v.cards.length, 3);
  assert.equal(v.cards.find((c) => c.id === "c1").verified, false);
  assert.equal(v.cards.find((c) => c.id === "c2").verified, true);
});

test("글에 적힌 전화번호가 자료 목록에 없으면 알려 준다", () => {
  const f = fixture(two, two);
  assert.deepEqual(phoneErrors(f), []);
  f.qa[0].a = "공단 1577-1000이나 1899-9988에 물어보세요.";
  assert.deepEqual(phoneErrors(f), ["질문 c1-q1: 자료 목록에 없는 전화번호 1899-9988"]);
});

test("자료 목록에 없는 번호를 가리키면 알려 준다", () => {
  const f = fixture(two, two);
  f.cards[0].source_ids.push("zzz");
  assert.ok(validateContent(f).some((e) => e.includes("자료 목록에 없는 번호 zzz")));
});
