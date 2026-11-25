import { test } from "node:test";
import assert from "node:assert/strict";
import { BUCKETS, detectEmergency, matches, resolveStage } from "../public/logic.js";
import { deck, engine, followups, questions } from "../scripts/engine.mjs";
import { CASES, checkCase } from "../scripts/run-cases.mjs";

const STAGES = Object.keys(deck.stages);
const fields = new Map(questions.flatMap((q) => q.fields).map((f) => [f.key, f]));
for (const f of followups.questions) fields.set(f.key, f);
const GRADES = fields.get("grade").options.map((o) => o.value);
const QA_MIN = 4;

test("카드는 30장에서 50장이고, 단계마다 8장 이상이다", () => {
  assert.ok(deck.cards.length >= 30 && deck.cards.length <= 50, `${deck.cards.length}장`);
  for (const stage of STAGES) {
    const n = deck.cards.filter((c) => c.stages.includes(stage)).length;
    assert.ok(n >= 8, `${stage}: ${n}장`);
  }
});

test(`카드마다 할 일, 이유, 연락처, 질문과 답 ${QA_MIN}개 이상, 출처가 있다`, () => {
  const ids = new Set();
  for (const c of deck.cards) {
    assert.ok(!ids.has(c.id), `중복 ID ${c.id}`);
    ids.add(c.id);
    assert.ok(c.title && c.why && c.contact, c.id);
    assert.ok(BUCKETS.includes(c.bucket), c.id);
    assert.ok(c.stages.length && c.stages.every((s) => STAGES.includes(s)), c.id);
    assert.ok(c.qa.length >= QA_MIN, `${c.id}: 질문 ${c.qa.length}개`);
    const asked = new Set();
    for (const qa of c.qa) {
      assert.ok(qa.q && qa.a, c.id);
      assert.ok(!asked.has(qa.q), `${c.id}: 같은 질문 ${qa.q}`);
      asked.add(qa.q);
      for (const key of qa.source_keys ?? []) assert.ok(deck.sources[key]?.url, `${c.id} 답의 출처 ${key}`);
    }
    assert.ok(c.source_keys.length >= 1, c.id);
    for (const key of c.source_keys) assert.ok(deck.sources[key]?.url, `${c.id}의 출처 ${key}`);
  }
});

test("마크다운 취소선이 되는 반각 물결표를 쓰지 않는다", () => {
  const text = JSON.stringify(deck) + JSON.stringify(followups) + JSON.stringify(questions);
  assert.ok(!text.includes("~"), "반각 ~ 대신 전각 ～를 쓴다");
});

test("카드와 보충 질문의 조건은 질문지에 있는 답만 쓴다", () => {
  const conds = (c) => [c.when, c.when_not, c.boost, ...(c.when_any ?? [])].filter(Boolean);
  for (const c of [...deck.cards, ...followups.questions]) {
    for (const cond of conds(c)) {
      for (const [key, values] of Object.entries(cond)) {
        const field = fields.get(key);
        assert.ok(field, `${c.id ?? c.key}: 없는 질문 ${key}`);
        const allowed = field.options.map((o) => o.value);
        for (const v of values) assert.ok(allowed.includes(v), `${c.id ?? c.key}: ${key}=${v}`);
      }
    }
  }
});

test("걱정 주제가 가리키는 카드는 모두 있다", () => {
  for (const t of followups.worry_topics) for (const id of t.cards) assert.ok(engine.cardById.has(id), `${t.label}: ${id}`);
});

test("1번이 '잘 모르겠어요'이면 등급과 돌봄으로 단계를 짐작한다", () => {
  assert.equal(resolveStage({ stage: "facility" }), "facility");
  assert.equal(resolveStage({ stage: "unknown", care: ["hospital"] }), "change");
  assert.equal(resolveStage({ stage: "unknown", grade: "g3" }), "new_grade");
  assert.equal(resolveStage({ stage: "unknown", grade: "none" }), "suspect");
  assert.equal(resolveStage({}), "suspect");
});

test("when_any는 묶음 가운데 하나만 맞으면 된다", () => {
  const card = { when_any: [{ grade: ["g1", "g2"] }, { diagnoses: ["dementia"] }] };
  assert.ok(matches(card, { grade: "g1" }));
  assert.ok(matches(card, { grade: "g4", diagnoses: ["dementia"] }));
  assert.ok(!matches(card, { grade: "g4", diagnoses: ["stroke"] }));
});

test("어떤 단계와 등급에서도 목록이 3～7개다", () => {
  for (const stage of [...STAGES, "unknown"]) {
    for (const grade of GRADES) {
      const plan = engine.buildPlan({ stage, grade });
      assert.ok(plan.items.length >= 3 && plan.items.length <= 7, `${stage}/${grade}: ${plan.items.length}개`);
      for (const item of plan.items) assert.ok(BUCKETS.includes(item.bucket) && item.reasons.length);
    }
  }
});

test("숨긴 카드는 빠지고 다른 카드로 채우며, 직접 넣은 카드는 들어간다", () => {
  const answers = CASES.find((c) => c.id === "C5").answers;
  const first = engine.buildPlan(answers);
  const target = first.items[0].card_id;
  const hidden = engine.buildPlan(answers, { hidden: [target] });
  assert.ok(!hidden.items.some((it) => it.card_id === target));
  assert.ok(hidden.items.length >= first.items.length - 1);
  const extra = first.extras[0];
  const added = engine.buildPlan(answers, { added: [extra] });
  assert.ok(added.items.some((it) => it.card_id === extra));
});

test("보충 질문은 답에 맞는 것만 나온다", () => {
  const keys = (a) => engine.pickFollowups(a).map((q) => q.key);
  assert.deepEqual(keys({ stage: "suspect", care: ["family"] }), []);
  assert.deepEqual(keys({ stage: "change", care: ["hospital"] }), ["hospital_stay", "sudden_change"]);
  assert.deepEqual(keys({ stage: "new_grade", care: ["daycare"] }), ["service_fit"]);
  assert.deepEqual(keys({ stage: "facility", care: ["daycare", "nursing_home"] }), ["sudden_change"]);
});

test("질문지에 없는 답은 버린다", () => {
  const answers = engine.cleanAnswers({ stage: "change", grade: "g9", care: ["hospital", "space"], name: "홍길동", hospital_stay: "long", worry: "  비용  " });
  assert.deepEqual(answers, { stage: "change", care: ["hospital"], hospital_stay: "long", worry: "비용" });
});

test("응급 신호를 키워드로 찾는다", () => {
  assert.deepEqual(detectEmergency(["어제부터 불러도 대답이 없어요"]), ["medical"]);
  assert.deepEqual(detectEmergency(["아버지가 자꾸 때리려고 해요"]), ["violence"]);
  assert.deepEqual(detectEmergency(["어머니가 죽고 싶다고 하세요"]), ["suicide"]);
  assert.deepEqual(detectEmergency(["다음 주 화요일에 퇴원해요", "식사는 잘 하세요"]), []);
  assert.deepEqual(detectEmergency([]), []);
  assert.deepEqual(engine.buildPlan({ stage: "change", worry: "불러도 대답이 없어요" }).emergency, ["medical"]);
});

for (const c of CASES) {
  test(`사례 ${c.id}: 넣어야 할 카드는 들어가고 맞지 않는 카드는 빠진다`, () => {
    const r = checkCase(c);
    assert.deepEqual(r.missing, [], "빠진 카드");
    assert.deepEqual(r.forbidden, [], "나오면 안 되는 카드");
    assert.ok(r.emergencyOk, "응급 신호");
  });
}
