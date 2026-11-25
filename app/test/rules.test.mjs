import assert from "node:assert/strict";
import { test } from "node:test";
import { candidateCards, cardMatches, rankMethods, ruleList } from "../src/rules.mjs";

// 카드 한 장이 보호자의 답에 맞는지 본다. 스펙 6절 "할 일 후보 거르기"의 첫 조각이다.

test("고른 상황이 카드의 상황에 없으면 맞지 않는다", () => {
  const card = { situations: ["fall"] };
  assert.equal(cardMatches(card, { situation: "fall" }), true);
  assert.equal(cardMatches(card, { situation: "hospital" }), false);
});

test("when의 조건은 모두 맞아야 한다", () => {
  const card = { situations: ["fall"], when: { lives_together: ["yes"], mobility: ["assist", "bed"] } };
  assert.equal(cardMatches(card, { situation: "fall", lives_together: "yes", mobility: "bed" }), true);
  assert.equal(cardMatches(card, { situation: "fall", lives_together: "no", mobility: "bed" }), false);
  assert.equal(cardMatches(card, { situation: "fall", lives_together: "yes" }), false, "답하지 않은 조건은 맞지 않은 것으로 본다");
});

test("여러 개를 고르는 답은 하나만 겹쳐도 when에 맞는다", () => {
  const card = { situations: ["fall"], when: { diagnoses: ["dementia"] } };
  assert.equal(cardMatches(card, { situation: "fall", diagnoses: ["stroke", "dementia"] }), true);
  assert.equal(cardMatches(card, { situation: "fall", diagnoses: ["stroke"] }), false);
});

test("when_not의 조건이 하나라도 맞으면 뺀다", () => {
  const card = { situations: ["symptom"], when_not: { diagnoses: ["dementia"], talk: ["hard"] } };
  assert.equal(cardMatches(card, { situation: "symptom", diagnoses: ["stroke"], talk: "normal" }), true);
  assert.equal(cardMatches(card, { situation: "symptom", diagnoses: ["stroke", "dementia"], talk: "normal" }), false);
  assert.equal(cardMatches(card, { situation: "symptom", diagnoses: ["stroke"], talk: "hard" }), false);
  assert.equal(cardMatches(card, { situation: "symptom" }), true, "답하지 않은 조건으로는 빼지 않는다");
});

test("when_any는 묶음 가운데 하나만 맞으면 된다", () => {
  // 실제 카드 S1-01과 같은 모양: 알아보는 중이거나, 대화가 가끔 어렵거나, 진단을 모르면
  const card = {
    situations: ["suspect", "symptom"],
    when_any: [{ situation: ["suspect"] }, { talk: ["sometimes", "hard"] }, { diagnoses: ["unknown"] }]
  };
  assert.equal(cardMatches(card, { situation: "suspect", talk: "normal", diagnoses: ["stroke"] }), true);
  assert.equal(cardMatches(card, { situation: "symptom", talk: "hard", diagnoses: ["stroke"] }), true);
  assert.equal(cardMatches(card, { situation: "symptom", talk: "normal", diagnoses: ["unknown"] }), true);
  assert.equal(cardMatches(card, { situation: "symptom", talk: "normal", diagnoses: ["stroke"] }), false);
});

test("when_any의 한 묶음 안에 조건이 여럿이면 모두 맞아야 그 묶음이 맞는다", () => {
  const card = { situations: ["fall"], when_any: [{ lives_together: ["no"], daytime_family: ["no"] }] };
  assert.equal(cardMatches(card, { situation: "fall", lives_together: "no", daytime_family: "no" }), true);
  assert.equal(cardMatches(card, { situation: "fall", lives_together: "no", daytime_family: "yes" }), false);
});

test("when_any가 비어 있으면 조건이 없는 것으로 본다", () => {
  assert.equal(cardMatches({ situations: ["fall"], when_any: [] }, { situation: "fall" }), true);
});

// 할 일 후보 거르기. 상황과 조건이 맞는 카드만 후보로 둔다(스펙 6절).
const deck = [
  { id: "a", situations: ["fall"] },
  { id: "b", situations: ["fall"], when: { lives_together: ["yes"] } },
  { id: "c", situations: ["hospital"] },
  { id: "d", situations: ["fall"] }
];

test("상황과 조건이 맞는 카드만 후보가 된다", () => {
  const ids = candidateCards(deck, { situation: "fall", lives_together: "no" }).map((c) => c.id);
  assert.deepEqual(ids, ["a", "d"]);
});

test("고른 돌봄 방식이 빼라고 한 카드는 후보에서 빠진다", () => {
  const method = { first_cards: [], exclude_cards: ["d"] };
  const ids = candidateCards(deck, { situation: "fall" }, method).map((c) => c.id);
  // b는 함께 사는지 답하지 않아 원래 빠지고, d는 방식이 빼라고 해서 빠진다.
  assert.deepEqual(ids, ["a"]);
});

test("고른 돌봄 방식이 가리키는 카드에는 먼저 표시가 붙는다", () => {
  const method = { first_cards: ["d"], exclude_cards: [] };
  const firsts = candidateCards(deck, { situation: "fall" }, method).map((c) => [c.id, c.first]);
  assert.deepEqual(firsts, [["a", false], ["d", true]]);
});

test("방식을 아직 못 정했으면 먼저 표시가 붙는 카드가 없다", () => {
  const firsts = candidateCards(deck, { situation: "fall" }).map((c) => c.first);
  assert.deepEqual(firsts, [false, false]);
});

// 규칙 기본 목록. AI가 실패했을 때 후보 가운데 6장 안팎을 코드로 고른다(스펙 6절).
const card = (id, bucket, priority, extra = {}) => ({ id, situations: ["fall"], bucket, priority, first: false, ...extra });

test("먼저 표시가 붙은 카드는 우선순위가 낮아도 맨 앞에 들어간다", () => {
  const pool = [
    card("p1", "this_week", 1),
    card("p2", "this_week", 2),
    card("p3", "this_month", 3),
    card("p4", "know_ahead", 4),
    card("p5", "this_week", 5),
    card("p6", "this_month", 6),
    card("late", "this_week", 9, { first: true })
  ];
  const ids = ruleList(pool, { situation: "fall" }).map((c) => c.id);
  assert.equal(ids[0], "late");
  assert.equal(ids.length, 6);
});

test("세 구간에 후보가 있으면 구간마다 한 장 이상 들어간다", () => {
  const pool = [1, 2, 3, 4, 5, 6, 7].map((n) => card(`w${n}`, "this_week", n));
  pool.push(card("m", "this_month", 8), card("k", "know_ahead", 9));
  const buckets = ruleList(pool, { situation: "fall" }).map((c) => c.bucket);
  assert.ok(buckets.includes("this_month"), buckets.join(","));
  assert.ok(buckets.includes("know_ahead"), buckets.join(","));
});

test("조건이 많이 걸린 카드부터, 같으면 우선순위가 높은 카드부터 채운다", () => {
  const two = { when: { lives_together: ["yes"], mobility: ["bed"] } };
  const one = { when: { lives_together: ["yes"] } };
  const pool = [
    card("none-p1", "this_week", 1),
    card("one-p4", "this_week", 4, one),
    card("none-p2", "this_week", 2),
    card("two-p7", "this_week", 7, two),
    card("one-p3", "this_week", 3, one),
    card("none-p5", "this_week", 5),
    card("none-p6", "this_week", 6)
  ];
  const ids = ruleList(pool, { situation: "fall" }).map((c) => c.id);
  assert.deepEqual(ids, ["two-p7", "one-p3", "one-p4", "none-p1", "none-p2", "none-p5"]);
});

test("상황마다 꼭 넣을 카드는 조건이 없어도 먼저 들어간다", () => {
  const two = { when: { lives_together: ["yes"], mobility: ["bed"] } };
  const pool = [1, 2, 3, 4, 5, 6].map((n) => card(`two-${n}`, "this_week", n, two));
  pool.push(card("plain-must", "this_week", 9));
  const ids = ruleList(pool, { situation: "fall" }, 6, ["plain-must"]).map((c) => c.id);
  assert.equal(ids.length, 6);
  assert.ok(ids.includes("plain-must"), ids.join(","));
});

test("꼭 넣을 카드가 후보에 없으면(조건이 안 맞으면) 넣지 않는다", () => {
  const pool = [card("a", "this_week", 1), card("b", "this_month", 2)];
  const ids = ruleList(pool, { situation: "fall" }, 6, ["not-candidate"]).map((c) => c.id);
  assert.deepEqual(ids.sort(), ["a", "b"]);
});

test("방식의 먼저 카드가 꼭 넣을 카드보다 앞에 온다", () => {
  const pool = [card("must", "this_week", 1), card("first", "this_week", 9, { first: true })];
  const ids = ruleList(pool, { situation: "fall" }, 6, ["must"]).map((c) => c.id);
  assert.deepEqual(ids.slice(0, 2), ["first", "must"]);
});

// 돌봄 방식 점수. AI를 쓰지 않고 방식마다 적어 둔 규칙으로 점수를 낸다(스펙 6절).
const rule = (key, is, score, reason = `${key} 이유`) => ({ key, is, score, reason });
const methodsFixture = [
  { id: "home", situation: "fall", rules: [rule("daytime_family", ["yes"], 2), rule("risk", ["no"], 1)] },
  { id: "rehab", situation: "fall", rules: [rule("diagnoses", ["fracture"], 2), rule("risk", ["yes"], 1)] },
  { id: "stay", situation: "hospital", rules: [rule("risk", ["yes"], 2)] }
];

test("방식마다 답에 맞는 규칙의 점수를 더하고, 고른 상황의 방식만 돌려준다", () => {
  const ranked = rankMethods(methodsFixture, { situation: "fall", daytime_family: "yes", risk: "no", diagnoses: ["stroke"] });
  assert.deepEqual(ranked.map((r) => [r.method.id, r.score]), [["home", 3], ["rehab", 0]]);
});

test("점수가 높은 방식이 앞에 오고, 같으면 파일에 적힌 순서를 지킨다", () => {
  const three = [...methodsFixture, { id: "short", situation: "fall", rules: [rule("risk", ["yes"], 1)] }];
  const ranked = rankMethods(three, { situation: "fall", risk: "yes", diagnoses: ["fracture"] });
  assert.deepEqual(ranked.map((r) => [r.method.id, r.score]), [["rehab", 3], ["short", 1], ["home", 0]]);
  // rehab과 short가 1점으로 같으면 파일 순서대로 rehab이 앞이다.
  const tied = rankMethods(three, { situation: "fall", risk: "yes" });
  assert.deepEqual(tied.map((r) => [r.method.id, r.score]), [["rehab", 1], ["short", 1], ["home", 0]]);
});

test("1등이 하나뿐이면 잘 맞을 수 있음과 가장 큰 점수를 준 규칙의 이유를 붙인다", () => {
  const ranked = rankMethods(methodsFixture, { situation: "fall", daytime_family: "yes", risk: "no" });
  assert.deepEqual(
    ranked.map((r) => [r.method.id, r.fits, r.reason]),
    [["home", true, "daytime_family 이유"], ["rehab", false, null]]
  );
});

test("1등이 둘 이상이거나 모두 0점이면 잘 맞을 수 있음을 붙이지 않는다", () => {
  const tied = rankMethods(methodsFixture, { situation: "fall", daytime_family: "yes", diagnoses: ["fracture"] });
  assert.deepEqual(tied.map((r) => r.fits), [false, false], "두 방식이 2점으로 같다");
  const zero = rankMethods(methodsFixture, { situation: "fall" });
  assert.deepEqual(zero.map((r) => r.fits), [false, false]);
});
