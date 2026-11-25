import assert from "node:assert/strict";
import { test } from "node:test";
import { runTask } from "../src/ai/task.mjs";

// AI 기능 틀. 프롬프트가 없거나 AI가 실패하면 기능마다 정한 대체 값을 돌려준다.

const FALLBACK = { from: "fallback" };

function makeTask(over = {}) {
  return {
    name: "x",
    schema: { type: "object" },
    buildUser: (input) => `입력:${input.q}`,
    validate: (data) => data,
    fallback: () => FALLBACK,
    ...over,
  };
}

test("프롬프트가 없으면 대체 값", async () => {
  let called = false;
  const r = await runTask(makeTask(), { q: 1 }, {
    call: async () => { called = true; return { ok: true, data: {} }; },
    loadPrompt: () => null,
  });
  assert.deepEqual(r, { value: FALLBACK, usedAi: false, reason: "not_built" });
  assert.equal(called, false);
});

test("호출 실패 이유를 그대로 넘긴다", async () => {
  const r = await runTask(makeTask(), {}, {
    call: async () => ({ ok: false, reason: "timeout" }),
    loadPrompt: () => "지시",
  });
  assert.deepEqual(r, { value: FALLBACK, usedAi: false, reason: "timeout" });
});

test("검사에서 떨어지면 invalid", async () => {
  const r = await runTask(makeTask({ validate: () => null }), {}, {
    call: async () => ({ ok: true, data: {} }),
    loadPrompt: () => "지시",
  });
  assert.deepEqual(r, { value: FALLBACK, usedAi: false, reason: "invalid" });
});

test("validate가 undefined를 돌려줘도 invalid", async () => {
  const r = await runTask(makeTask({ validate: () => undefined }), {}, {
    call: async () => ({ ok: true, data: {} }),
    loadPrompt: () => "지시",
  });
  assert.equal(r.reason, "invalid");
});

test("성공하면 검사한 값", async () => {
  const r = await runTask(makeTask({ validate: (d) => ({ ok: d.n }) }), {}, {
    call: async () => ({ ok: true, data: { n: 3 } }),
    loadPrompt: () => "지시",
  });
  assert.deepEqual(r, { value: { ok: 3 }, usedAi: true, reason: null });
});

test("call이 예외를 던지면 error와 대체 값", async () => {
  const r = await runTask(makeTask(), {}, {
    call: async () => { throw new Error("boom"); },
    loadPrompt: () => "지시",
  });
  assert.deepEqual(r, { value: FALLBACK, usedAi: false, reason: "error" });
});

test("validate가 예외를 던지면 error와 대체 값", async () => {
  const r = await runTask(makeTask({ validate: () => { throw new Error("x"); } }), {}, {
    call: async () => ({ ok: true, data: {} }),
    loadPrompt: () => "지시",
  });
  assert.deepEqual(r, { value: FALLBACK, usedAi: false, reason: "error" });
});

test("buildUser와 loadPrompt가 던져도 error", async () => {
  const deps = { call: async () => ({ ok: true, data: {} }) };
  const a = await runTask(makeTask({ buildUser: () => { throw new Error("x"); } }), {}, { ...deps, loadPrompt: () => "지시" });
  assert.equal(a.reason, "error");
  const b = await runTask(makeTask(), {}, { ...deps, loadPrompt: () => { throw new Error("x"); } });
  assert.equal(b.reason, "error");
});

test("보낼 내용을 맞게 넘긴다", async () => {
  const task = makeTask();
  let seen;
  await runTask(task, { q: 7 }, {
    call: async (args) => { seen = args; return { ok: true, data: {} }; },
    loadPrompt: (name) => `지시:${name}`,
  });
  assert.deepEqual(seen, { system: "지시:x", user: "입력:7", schema: task.schema });
});

test("validate에 data와 input을 함께 넘긴다", async () => {
  let args;
  await runTask(makeTask({ validate: (d, i) => { args = [d, i]; return d; } }), { q: 1 }, {
    call: async () => ({ ok: true, data: { a: 1 } }),
    loadPrompt: () => "지시",
  });
  assert.deepEqual(args, [{ a: 1 }, { q: 1 }]);
});
