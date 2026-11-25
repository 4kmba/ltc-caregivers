import assert from "node:assert/strict";
import { test } from "node:test";
import { runTask } from "../src/ai/task.mjs";
import { makeFollowups } from "../src/tasks/followups.mjs";
import { makeSummary } from "../src/tasks/summary.mjs";
import { makeAnswer } from "../src/tasks/answer.mjs";
import { makeMedical, dropUnsafeSentences } from "../src/tasks/medical.mjs";

// 팀원이 채울 AI 자리 네 개. 입력과 값은 만들면서 바뀔 수 있어 최소만 묶는다.

const content = { qa: [{ id: "Q1", q: "검사는 어떻게 하나요?", a: "센터에서 문답으로 확인합니다." }] };

test("프롬프트가 없으면 네 자리 모두 대체 값", async () => {
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
    const r = await runTask(task, input, { call, loadPrompt: () => null });
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

test("놓치던 복용량과 전화번호 꼴을 버린다", () => {
  const bad = ["5 MG 드세요", "5㎎ 드세요", "10㎖ 드세요", "0.5mcg 드세요", "1000IU 드세요", "하루 1포 드세요", "한 알 드세요", "두 정 드세요", "반 알 드세요", "02)123-4567로 연락", "02 123 4567로 연락", "02.123.4567로 연락", "15771000으로 연락", "0212345678로 연락"];
  for (const s of bad) assert.deepEqual(dropUnsafeSentences([s]), [], s);
});

test("숫자나 수 표현이 있어도 안전한 문장은 남긴다", () => {
  const ok = ["3년 전부터 그러셨어요", "하루 두 번 산책하세요", "2026년 11월에 물어보세요"];
  assert.deepEqual(dropUnsafeSentences(ok), ok);
});

test("모든 AI 자리의 schema는 object마다 additionalProperties false", async () => {
  const { loadContent } = await import("../src/content.mjs");
  const { makePickCards } = await import("../src/tasks/pick-cards.mjs");
  const c = loadContent();
  const check = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "object") {
      assert.equal(node.additionalProperties, false, path);
      assert.deepEqual([...(node.required ?? [])].sort(), Object.keys(node.properties ?? {}).sort(), `${path} required`);
    }
    for (const [k, v] of Object.entries(node)) check(v, `${path}.${k}`);
  };
  for (const t of [makeFollowups(c), makeMedical(c), makePickCards(c)]) {
    assert.ok(t.schema, t.name);
    check(t.schema, t.name);
  }
  assert.equal(makeSummary(c).schema, null);
  assert.equal(makeAnswer(c).schema, null);
});
