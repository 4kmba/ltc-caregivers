import assert from "node:assert/strict";
import { test } from "node:test";
import { loadContent } from "../src/content.mjs";
import { detectEmergency, emergencyContacts } from "../src/emergency.mjs";

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

// 찾은 신호의 종류를 자료 목록의 연락처로 잇는다. 번호는 자료 목록에만 있다(스펙 5절, 8절).
const sources = ["emergency119", "mental_crisis", "police112", "hs_line109", "call129"].map((id) => ({ id, name: id }));
const ids = (list) => list.map((s) => s.id);

test("응급 신호가 있으면 119와 정신건강위기상담전화를 띄운다", () => {
  assert.deepEqual(ids(emergencyContacts(["medical"], sources)), ["emergency119", "mental_crisis"]);
});

test("응급 신호가 없으면 띄울 연락처가 없다", () => {
  assert.deepEqual(emergencyContacts([], sources), []);
});

test("폭력을 말하면 112를, 죽음이나 자살을 말하면 109를 함께 띄운다", () => {
  assert.deepEqual(ids(emergencyContacts(["violence"], sources)), ["emergency119", "mental_crisis", "police112"]);
  assert.deepEqual(ids(emergencyContacts(["suicide"], sources)), ["emergency119", "mental_crisis", "hs_line109"]);
  assert.deepEqual(
    ids(emergencyContacts(["medical", "violence", "suicide"], sources)),
    ["emergency119", "mental_crisis", "police112", "hs_line109"]
  );
});

test("응급 연락처 네 곳이 실제 자료 목록에 있다", () => {
  const all = loadContent().sources;
  const found = ids(emergencyContacts(["medical", "violence", "suicide"], all).filter(Boolean));
  assert.deepEqual(found, ["emergency119", "mental_crisis", "police112", "hs_line109"]);
});
