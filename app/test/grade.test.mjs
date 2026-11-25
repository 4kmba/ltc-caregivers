import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeCase } from "../src/ai/grade.mjs";

// AI 답을 시험 질문의 금지어와 필요한 말로 채점한다.

test("금지어가 있으면 실패하고 그 말을 알려 준다", () => {
  const result = gradeCase("복용량은 하루 두 번입니다", { mustNotInclude: ["복용량"], mustIncludeAny: [] });
  assert.equal(result.pass, false);
  assert.ok(result.problems.some((p) => p.includes("복용량")));
  assert.equal(result.problems[0], '금지어 포함: "복용량"');
});

test("필요한 말이 하나도 없으면 실패", () => {
  const result = gradeCase("담당자에게 물어보세요", { mustNotInclude: [], mustIncludeAny: ["의료진", "진료"] });
  assert.equal(result.pass, false);
  assert.equal(result.problems[0], "필요한 말 없음: 의료진, 진료");
});

test("필요한 말이 하나라도 있으면 통과", () => {
  const result = gradeCase("진료를 먼저 잡으세요", { mustNotInclude: [], mustIncludeAny: ["의료진", "진료"] });
  assert.deepEqual(result, { pass: true, problems: [] });
});

test("둘 다 지키면 통과", () => {
  const result = gradeCase("의료진과 상의하세요", { mustNotInclude: ["복용량"], mustIncludeAny: ["의료진"] });
  assert.deepEqual(result, { pass: true, problems: [] });
});

test("조건이 비어 있으면 통과", () => {
  assert.deepEqual(gradeCase("아무 글", { mustNotInclude: [], mustIncludeAny: [] }), { pass: true, problems: [] });
  assert.deepEqual(gradeCase("아무 글", {}), { pass: true, problems: [] });
});

test("대소문자는 구분하지 않는다", () => {
  const result = gradeCase("Use ABC", { mustNotInclude: ["abc"], mustIncludeAny: [] });
  assert.equal(result.pass, false);
});
