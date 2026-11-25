import assert from "node:assert/strict";
import { test } from "node:test";
import { detectEmergency } from "../src/emergency.mjs";

// 보호자가 직접 적은 글에서 응급 신호를 낱말로 찾는다. AI를 부르기 전에 하고, AI에 맡기지 않는다(스펙 8절).

test("의식이 없다는 글에서 의료 응급 신호를 찾는다", () => {
  assert.deepEqual(detectEmergency(["어제부터 불러도 대답이 없어요"]), ["medical"]);
});

test("응급 낱말이 없으면 빈 목록을 돌려준다", () => {
  assert.deepEqual(detectEmergency(["밤에 자주 깨셔서 걱정이에요"]), []);
  assert.deepEqual(detectEmergency([]), []);
});

test("띄어쓰기를 빼거나 여러 번 넣어도 찾는다", () => {
  assert.deepEqual(detectEmergency(["불러도 대답이없어요"]), ["medical"]);
  assert.deepEqual(detectEmergency(["불러도 대답이   없어요"]), ["medical"]);
  assert.deepEqual(detectEmergency(["죽고싶다고 하세요"]), ["suicide"]);
});

test("신호가 여럿이면 모두 찾고, 글이 여러 칸에 나뉘어 있어도 찾는다", () => {
  assert.deepEqual(detectEmergency(["아버지가 때리려고 하세요", "어머니는 죽고 싶다고 하세요"]), ["violence", "suicide"]);
});
