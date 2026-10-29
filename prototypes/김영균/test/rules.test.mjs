import { test } from "node:test";
import assert from "node:assert/strict";
import { BUCKETS, candidateCards, deck, detectEmergency, questions, resolveStage, ruleList } from "../src/rules.mjs";
import { limitSentences, validatePlan } from "../src/ai.mjs";

const STAGES = Object.keys(deck.stages);
const fields = new Map(questions.flatMap((q) => q.fields).map((f) => [f.key, f]));
const GRADES = fields.get("grade").options.map((o) => o.value);

test("카드는 30장에서 50장이고, 단계마다 8장 이상이다", () => {
  assert.ok(deck.cards.length >= 30 && deck.cards.length <= 50, `${deck.cards.length}장`);
  for (const stage of STAGES) {
    const n = deck.cards.filter((c) => c.stages.includes(stage)).length;
    assert.ok(n >= 8, `${stage}: ${n}장`);
  }
});

test("카드마다 할 일, 이유, 연락처, 질문과 답, 출처가 있다", () => {
  const ids = new Set();
  for (const c of deck.cards) {
    assert.ok(!ids.has(c.id), `중복 ID ${c.id}`);
    ids.add(c.id);
    assert.ok(c.title && c.why && c.contact, c.id);
    assert.ok(BUCKETS.includes(c.bucket), c.id);
    assert.ok(c.stages.length && c.stages.every((s) => STAGES.includes(s)), c.id);
    assert.ok(c.qa.length >= 1 && c.qa.length <= 2, c.id);
    for (const qa of c.qa) assert.ok(qa.q && qa.a, c.id);
    assert.ok(c.source_keys.length >= 1, c.id);
    for (const key of c.source_keys) assert.ok(deck.sources[key]?.url, `${c.id}의 출처 ${key}`);
  }
});

test("카드 조건은 고정 질문에 있는 답만 쓴다", () => {
  for (const c of deck.cards) {
    for (const cond of [c.when ?? {}, c.when_not ?? {}]) {
      for (const [key, values] of Object.entries(cond)) {
        const field = fields.get(key);
        assert.ok(field, `${c.id}: 없는 질문 ${key}`);
        const allowed = field.options.map((o) => o.value);
        for (const v of values) assert.ok(allowed.includes(v), `${c.id}: ${key}=${v}`);
      }
    }
  }
});

test("1번이 '잘 모르겠어요'이면 등급과 돌봄으로 단계를 짐작한다", () => {
  assert.equal(resolveStage({ stage: "facility" }), "facility");
  assert.equal(resolveStage({ stage: "unknown", care: ["hospital"] }), "change");
  assert.equal(resolveStage({ stage: "unknown", grade: "g3" }), "new_grade");
  assert.equal(resolveStage({ stage: "unknown", grade: "none" }), "suspect");
  assert.equal(resolveStage({}), "suspect");
});

test("규칙 기본 목록은 어떤 단계와 등급에서도 3～7개를 낸다", () => {
  for (const stage of [...STAGES, "unknown"]) {
    for (const grade of GRADES) {
      const list = ruleList({ stage, grade });
      assert.ok(list.length >= 3 && list.length <= 7, `${stage}/${grade}: ${list.length}개`);
      for (const item of list) assert.ok(BUCKETS.includes(item.bucket) && item.why);
    }
  }
});

test("후보 카드는 단계와 조건이 맞는 것만 고른다", () => {
  const ids = candidateCards({ stage: "suspect", grade: "none", diagnoses: ["dementia"] }).map((c) => c.id);
  assert.ok(ids.includes("S1-06"), "등급 없음이면 등급 신청 카드");
  assert.ok(!ids.includes("S1-01"), "치매 진단이 있으면 선별검사 카드는 빠진다");
  assert.ok(!ids.includes("S1-07"), "신청 중이 아니면 방문조사 카드는 빠진다");
});

test("응급 신호를 키워드로 찾는다", () => {
  assert.deepEqual(detectEmergency(["어제부터 불러도 대답이 없어요"]), ["medical"]);
  assert.deepEqual(detectEmergency(["아버지가 자꾸 때리려고 해요"]), ["violence"]);
  assert.deepEqual(detectEmergency(["어머니가 죽고 싶다고 하세요"]), ["suicide"]);
  assert.deepEqual(detectEmergency(["다음 주 화요일에 퇴원해요", "식사는 잘 하세요"]), []);
  assert.deepEqual(detectEmergency([]), []);
});

test("AI가 고른 항목 가운데 후보에 없거나 형식이 틀린 것은 버린다", () => {
  const ids = ["A", "B", "C"];
  const result = {
    items: [
      { card_id: "A", bucket: "this_week", why: "이유" },
      { card_id: "A", bucket: "this_week", why: "중복" },
      { card_id: "Z", bucket: "this_week", why: "없는 카드" },
      { card_id: "B", bucket: "someday", why: "없는 구간" },
      { card_id: "C", bucket: "know_ahead", why: " " }
    ]
  };
  assert.deepEqual(validatePlan(result, ids), [{ card_id: "A", bucket: "this_week", why: "이유" }]);
  assert.deepEqual(validatePlan(null, ids), []);
  assert.deepEqual(validatePlan({ items: "깨진 값" }, ids), []);
});

test("AI 답은 앞의 5문장까지만 남긴다", () => {
  const text = "하나입니다. 둘인가요? 셋! 넷입니다. 다섯입니다. 여섯입니다. 일곱입니다.";
  assert.equal(limitSentences(text), "하나입니다. 둘인가요? 셋! 넷입니다. 다섯입니다.");
  assert.equal(limitSentences("마침표 없는 한 문장"), "마침표 없는 한 문장");
  assert.equal(limitSentences(null), null);
});
