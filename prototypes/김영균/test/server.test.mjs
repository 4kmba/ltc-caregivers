// API 키 없이 서버가 규칙 기본 목록과 카드 원문으로 동작하는지 본다.
import { test } from "node:test";
import assert from "node:assert/strict";

delete process.env.ANTHROPIC_API_KEY;
const { buildAnswer, buildPlan, cleanAnswers } = await import("../server.mjs");

test("화면에서 온 답 가운데 질문지에 없는 값은 버린다", () => {
  const answers = cleanAnswers({ stage: "change", grade: "g9", care: ["hospital", "space"], name: "홍길동" });
  assert.deepEqual(answers, { stage: "change", care: ["hospital"] });
});

test("AI가 없으면 규칙 기본 목록과 안내 문구를 보낸다", async () => {
  const plan = await buildPlan(cleanAnswers({ stage: "change", grade: "g3", care: ["hospital"] }));
  assert.equal(plan.mode, "rules");
  assert.equal(plan.notice, "지금은 AI 설명 없이 기본 목록을 보여 드려요");
  assert.ok(plan.items.length >= 3);
  for (const item of plan.items) {
    assert.ok(item.card.sources.length >= 1);
    assert.ok(item.card.questions.length >= 1);
  }
  assert.deepEqual(plan.emergency, []);
});

test("보충 질문 답에 응급 신호가 있으면 목록과 함께 알린다", async () => {
  const plan = await buildPlan(
    cleanAnswers({ stage: "change", followups: [{ question: "요즘 상태는요?", answer: "어제부터 불러도 대답이 없어요" }] })
  );
  assert.deepEqual(plan.emergency, ["medical"]);
});

test("AI가 없으면 질문의 답은 카드 원문을 그대로 보낸다", async () => {
  const res = await buildAnswer({}, "S3-05", 0);
  assert.equal(res.mode, "original");
  assert.equal(res.medical, true);
  assert.ok(res.text.length > 20);
  assert.equal(res.urgent, false);
  const urgent = await buildAnswer(cleanAnswers({ followups: [{ question: "상태는요?", answer: "죽고 싶다고 하세요" }] }), "S3-05", 0);
  assert.equal(urgent.urgent, true);
  assert.equal(await buildAnswer({}, "S3-05", 9), null);
  assert.equal(await buildAnswer({}, "없는카드", 0), null);
});
