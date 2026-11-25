import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePlan } from "../src/ai-check.mjs";

// AI가 고른 카드 응답에서 쓸 수 있는 항목만 남긴다. AI는 코드가 거른 후보 안에서만 고를 수 있다(스펙 7절).
const candidateIds = ["S1-01", "S2-02", "S3-05"];
const item = (card_id, bucket = "this_week", why = "넘어진 지 얼마 안 돼서예요") => ({ card_id, bucket, why });

test("후보에 없는 카드 번호는 버린다", () => {
  const result = { items: [item("S1-01"), item("S9-99"), item("S3-05")] };
  assert.deepEqual(validatePlan(result, candidateIds).map((x) => x.card_id), ["S1-01", "S3-05"]);
});

test("구간이 틀렸거나 왜 지금이 비어 있는 항목은 버리고, 왜 지금의 앞뒤 빈칸은 지운다", () => {
  const result = {
    items: [
      item("S1-01", "today"),
      item("S2-02", "this_month", "   "),
      { card_id: "S3-05", bucket: "know_ahead", why: 3 },
      null,
      item("S3-05", "know_ahead", "  미리 알아 두면 좋아요 ")
    ]
  };
  assert.deepEqual(validatePlan(result, candidateIds), [item("S3-05", "know_ahead", "미리 알아 두면 좋아요")]);
});

test("응답 모양이 아예 다르면 빈 목록을 돌려준다", () => {
  for (const broken of [null, undefined, "카드 목록", {}, { items: "S1-01" }]) {
    assert.deepEqual(validatePlan(broken, candidateIds), [], JSON.stringify(broken));
  }
});

test("같은 카드가 두 번 나오면 앞의 것만 남긴다", () => {
  const result = { items: [item("S1-01", "this_week", "앞"), item("S1-01", "this_month", "뒤")] };
  assert.deepEqual(validatePlan(result, candidateIds), [item("S1-01", "this_week", "앞")]);
});

test("7장보다 많이 고르면 앞의 7장만 받는다", () => {
  const ids = Array.from({ length: 9 }, (_, i) => `C-${i}`);
  const result = { items: ids.map((id) => item(id)) };
  assert.deepEqual(validatePlan(result, ids).map((x) => x.card_id), ids.slice(0, 7));
});
