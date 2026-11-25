import assert from "node:assert/strict";
import { test } from "node:test";
import { cardMatches } from "../src/rules.mjs";

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
