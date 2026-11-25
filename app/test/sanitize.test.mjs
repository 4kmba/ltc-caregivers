import assert from "node:assert/strict";
import { test } from "node:test";
import { stripUnsafe } from "../src/ai/sanitize.mjs";
import { validatePlan } from "../src/ai-check.mjs";
import { makeSummary } from "../src/tasks/summary.mjs";
import { makeAnswer } from "../src/tasks/answer.mjs";

// AI가 쓴 글에서 전화번호와 링크가 든 문장을 지운다(스펙 7절).

test("전화번호가 든 문장만 지운다", () => {
  assert.equal(stripUnsafe("먼저 주민센터에 물어보세요. 1577-1000에 전화하세요. 다음 진료 때 이야기해 보세요."), "먼저 주민센터에 물어보세요. 다음 진료 때 이야기해 보세요.");
});

test("링크가 든 문장을 지운다", () => {
  assert.equal(stripUnsafe("자세한 내용은 https://example.com 에 있어요. 천천히 정리해 보세요."), "천천히 정리해 보세요.");
  assert.equal(stripUnsafe("www.example.com을 보세요"), "");
  assert.equal(stripUnsafe("HTTP://a.kr 참고"), "");
});

test("안전한 글과 숫자가 든 글은 그대로 둔다", () => {
  assert.equal(stripUnsafe("3년 전부터 그러셨어요."), "3년 전부터 그러셨어요.");
  assert.equal(stripUnsafe("  앞뒤 공백  "), "앞뒤 공백");
});

test("문자열이 아니거나 모두 지워지면 빈 글", () => {
  assert.equal(stripUnsafe(null), "");
  assert.equal(stripUnsafe(42), "");
  assert.equal(stripUnsafe("02-123-4567로 전화하세요"), "");
});

test("왜 지금에 전화번호나 링크가 있으면 그 항목을 버린다", () => {
  const items = [
    { card_id: "A", bucket: "this_week", why: "1577-1000에 전화하세요" },
    { card_id: "B", bucket: "this_week", why: "https://x.kr 을 보세요" },
    { card_id: "C", bucket: "this_week", why: "지금 해 두면 좋아요. 1577-1000으로 전화하세요." },
  ];
  const out = validatePlan({ items }, ["A", "B", "C"]);
  assert.deepEqual(out.map((x) => [x.card_id, x.why]), [["C", "지금 해 두면 좋아요."]]);
});

test("오늘 정리와 질문 답에 연락처가 있으면 null로 대체 값을 쓴다", () => {
  const content = { qa: [] };
  const s = makeSummary(content);
  assert.equal(s.validate("1577-1000에 전화하세요"), null);
  assert.equal(s.validate("낙상 뒤라 걱정이 커요. www.a.kr 참고"), "낙상 뒤라 걱정이 커요.");
  const a = makeAnswer(content);
  assert.equal(a.validate("https://a.kr"), null);
  assert.equal(a.validate("센터에서 확인해요."), "센터에서 확인해요.");
});
