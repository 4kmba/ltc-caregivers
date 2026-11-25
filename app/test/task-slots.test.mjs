import assert from "node:assert/strict";
import { test } from "node:test";
import { runTask } from "../src/ai/task.mjs";
import { loadPrompt } from "../src/ai/prompts.mjs";
import { makeFollowups } from "../src/tasks/followups.mjs";
import { makeSummary } from "../src/tasks/summary.mjs";
import { makeAnswer } from "../src/tasks/answer.mjs";
import { makeMedical, dropUnsafeSentences } from "../src/tasks/medical.mjs";

// 팀원이 채울 AI 자리 네 개. 입력과 값은 만들면서 바뀔 수 있어 최소만 묶는다.

const content = { qa: [{ id: "Q1", q: "검사는 어떻게 하나요?", a: "센터에서 문답으로 확인합니다." }] };

test("네 자리 모두 아직 만들지 않음", async () => {
  const call = async () => {
    throw new Error("부르면 안 됨");
  };
  const slots = [
    [makeFollowups(content), { situation: "s", answers: {} }],
    [makeSummary(content), { answered: [], followups: [], worry: "" }],
    [makeAnswer(content), { qaId: "Q1", answers: {} }],
    [makeMedical(content), { worry: "약이 걱정돼요" }],
  ];
  for (const [task, input] of slots) {
    const r = await runTask(task, input, { call, loadPrompt });
    assert.equal(r.reason, "not_built", task.name);
    assert.equal(r.usedAi, false, task.name);
  }
});

test("오늘 정리 대체 값은 답 나열", async () => {
  const r = await runTask(
    makeSummary(content),
    { answered: [{ q: "등급", a: "3등급" }], followups: [], worry: "잠을 못 주무세요" },
    { call: async () => ({ ok: false, reason: "x" }), loadPrompt: () => "시스템" }
  );
  assert.ok(r.value.includes("등급: 3등급"));
  assert.ok(r.value.includes("걱정: 잠을 못 주무세요"));
});

test("질문 답 대체 값은 qa.json 원문, 없는 번호는 빈 글", () => {
  const t = makeAnswer(content);
  assert.equal(t.fallback({ qaId: "Q1" }), "센터에서 문답으로 확인합니다.");
  assert.equal(t.fallback({ qaId: "없음" }), "");
});

test("보충 질문은 보기 2개 이상인 것만 2개까지 남김", () => {
  const t = makeFollowups(content);
  const data = { questions: [{ q: "a?", options: ["가"] }, { q: "b?", options: ["가", "나"] }, { q: "c?", options: ["다", "라"] }, { q: "d?", options: ["마", "바"] }] };
  assert.equal(t.validate(data).length, 2);
  assert.equal(t.validate({ questions: [{ q: "", options: ["가", "나"] }] }), null);
});

test("전화번호와 복용량 문장을 버린다", () => {
  const out = dropUnsafeSentences(["진료 때 약을 줄여도 되는지 물어보세요.", "하루 5mg으로 줄이세요.", "1577-1000에 전화하세요."]);
  assert.deepEqual(out, ["진료 때 약을 줄여도 되는지 물어보세요."]);
});

test("복용량과 전화번호 경계 사례", () => {
  assert.deepEqual(dropUnsafeSentences(["하루 2정 드세요", "10 ml 드세요", "02-123-4567로 연락", "3년 전부터 그러셨어요"]), ["3년 전부터 그러셨어요"]);
});

test("의료 질문은 안전한 문장만 2개까지, 없으면 null", () => {
  const t = makeMedical(content);
  assert.deepEqual(t.validate({ questions: ["가 질문?", "나 질문?", "다 질문?"] }), ["가 질문?", "나 질문?"]);
  assert.equal(t.validate({ questions: ["5mg 드세요"] }), null);
});
