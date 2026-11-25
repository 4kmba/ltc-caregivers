import assert from "node:assert/strict";
import { test } from "node:test";
import { createCall, buildRequest, MODEL } from "../src/ai/client.mjs";

// AI 호출 통로: 응답과 오류를 reason으로 바꾸는 부분만 시험한다. 실제 API는 부르지 않는다.
const textReply = (text, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "text", text }] });
const input = (schema = null) => ({ system: "s", user: "u", schema });
const callWith = (create) => createCall({ apiKey: "test-key", create });
const SCHEMA = { type: "object" };

test("키가 없으면 부르지 않고 no_key", async () => {
  let called = false;
  const call = createCall({ apiKey: "", create: async () => { called = true; } });
  assert.deepEqual(await call(input()), { ok: false, reason: "no_key" });
  assert.equal(called, false);
});

test("JSON 응답을 풀어 준다", async () => {
  const call = callWith(async () => textReply('{"a":1}'));
  assert.deepEqual(await call(input(SCHEMA)), { ok: true, data: { a: 1 } });
});

test("형식이 없으면 글을 그대로 준다", async () => {
  const call = callWith(async () => textReply("안녕"));
  assert.deepEqual(await call(input()), { ok: true, data: "안녕" });
});

test("글 아닌 블록은 건너뛰고 글 블록만 이어 붙인다", async () => {
  const call = callWith(async () => ({
    stop_reason: "end_turn",
    content: [{ type: "thinking", thinking: "x" }, { type: "text", text: '{"a":' }, { type: "text", text: "1}" }],
  }));
  assert.deepEqual(await call(input(SCHEMA)), { ok: true, data: { a: 1 } });
});

test("대체 모델로 넘어간 뒤의 글만 쓰고 그 앞의 글은 버린다", async () => {
  const call = callWith(async () => ({
    stop_reason: "end_turn",
    content: [
      { type: "text", text: "거절된 모델이 쓰다 만 글" },
      { type: "fallback", from: { model: "a" }, to: { model: "b" } },
      { type: "text", text: '{"a":2}' },
    ],
  }));
  assert.deepEqual(await call(input(SCHEMA)), { ok: true, data: { a: 2 } });
});

test("거절은 refusal", async () => {
  const call = callWith(async () => textReply("", "refusal"));
  assert.deepEqual(await call(input(SCHEMA)), { ok: false, reason: "refusal" });
});

test("잘린 응답은 bad_output", async () => {
  const call = callWith(async () => textReply('{"a":', "max_tokens"));
  assert.deepEqual(await call(input(SCHEMA)), { ok: false, reason: "bad_output" });
});

test("깨진 JSON은 bad_output", async () => {
  const call = callWith(async () => textReply("not json"));
  assert.deepEqual(await call(input(SCHEMA)), { ok: false, reason: "bad_output" });
});

test("빈 응답은 bad_output", async () => {
  const call = callWith(async () => ({ stop_reason: "end_turn", content: [] }));
  assert.deepEqual(await call(input(SCHEMA)), { ok: false, reason: "bad_output" });
});

test("시간 초과는 timeout", async () => {
  const call = callWith(async () => { const e = new Error("t"); e.name = "APIConnectionTimeoutError"; throw e; });
  assert.deepEqual(await call(input()), { ok: false, reason: "timeout" });
});

test("다른 오류는 error", async () => {
  const call = callWith(async () => { throw new Error("x"); });
  assert.deepEqual(await call(input()), { ok: false, reason: "error" });
});

test("요청 객체는 schema가 있을 때만 출력 형식을 붙인다", () => {
  const withSchema = buildRequest({ system: "s", user: "u", schema: SCHEMA });
  assert.equal(withSchema.model, MODEL);
  assert.deepEqual(withSchema.output_config.format, { type: "json_schema", schema: SCHEMA });
  const without = buildRequest({ system: "s", user: "u", schema: null });
  assert.equal("format" in without.output_config, false);
});
