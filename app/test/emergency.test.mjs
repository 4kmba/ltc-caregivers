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

// 보호자가 실제로 적을 법한 문장으로 판별 기준을 고정한다. 놓치는 쪽이 잘못 띄우는 쪽보다 위험하므로,
// 애매한 문장은 잡는 쪽에 둔다. 목록을 고칠 때는 여기 예문을 먼저 더한다.
const SHOULD_DETECT = [
  // 의료: 무엇이(대답, 숨, 눈…) 어떻게 됐는지(없, 안, 못…)를 짝지어 찾는다. 낱말 사이에 말이 끼어도 찾는다.
  ["불러도 대답을 잘 안 하세요", ["medical"]],
  ["반응이 없으세요", ["medical"]],
  ["의식을 잃으셨어요", ["medical"]],
  ["부르면 눈을 안 떠요", ["medical"]],
  ["깨워도 안 일어나세요", ["medical"]],
  ["숨을 잘 못 쉬세요", ["medical"]],
  ["숨을 쉬기 힘들어하세요", ["medical"]],
  ["숨이 차서 헐떡이세요", ["medical"]],
  ["숨소리가 이상해요", ["medical"]],
  ["입술이 파래졌어요", ["medical"]],
  ["갑자기 말이 어눌해지셨어요", ["medical"]],
  ["한쪽 팔다리에 힘이 없어요", ["medical"]],
  ["화장실에서 쓰러지셨어요", ["medical"]],
  ["경련을 하세요", ["medical"]],
  ["피를 토하셨어요", ["medical"]],
  // 과거 이력 뒤에 지금 일이 이어지면, 지금 일은 그대로 잡는다.
  ["예전에 쓰러지신 적 있는데 지금은 숨을 못 쉬세요", ["medical"]],
  // 부정 표현이 찾은 말이 아니라 뒤의 다른 말에 붙으면 내리지 않는다.
  ["경련이 멈추지 않아요", ["medical"]],
  ["쓰러지셨는데 아무도 없었어요", ["medical"]],
  // 폭력: 행동을 찾는다.
  ["아버지가 어머니를 때려요", ["violence"]],
  ["주먹으로 치셨어요", ["violence"]],
  ["칼로 위협했어요", ["violence"]],
  ["칼을 들고 소리를 지르세요", ["violence"]],
  ["목을 조르려고 했어요", ["violence"]],
  // 자살: 어떤 맥락에서도 내리지 않는다.
  ["살기 싫다고 하세요", ["suicide"]],
  ["저도 그만 살고 싶어요", ["suicide"]],
  ["죽고 싶다는 말은 안 해요", ["suicide"]],
  ["죽고 싶다고 하실까 봐 걱정돼요", ["suicide"]]
];

const SHOULD_PASS = [
  // HW6 목록이 잘못 잡던 문장
  "숨쉬기 운동을 하세요",
  "칼을 갈아 주셨어요",
  "폭력적인 드라마를 보세요",
  // 부정
  "경련은 없었어요",
  "발작은 없었어요",
  "때리지는 않아요",
  "다행히 쓰러지진 않았어요",
  "숨이 차지는 않으세요",
  // 과거 이력
  "예전에 쓰러지신 적 있어요",
  // 걱정 칸에 많이 적을 미래형 걱정
  "밤에 쓰러지실까 봐 걱정돼요",
  "또 때리실까 봐 무서워요",
  // 대상만 있고 이상 상태가 없는 문장, 비슷하게 생긴 낱말
  "눈이 침침하다고 하세요",
  "의식은 또렷하세요",
  "약을 숨기고 안 드세요",
  "대답은 잘 하시고 밥을 안 드세요",
  "반찬을 칼로 잘라 드려요",
  "주사를 맞으셨어요",
  "제가 너무 힘들어서 죽겠어요",
  "밤에 자주 깨셔서 걱정이에요",
  "낙상이 걱정돼요"
];

for (const [text, kinds] of SHOULD_DETECT) {
  test(`잡아야 함: ${text}`, () => {
    assert.deepEqual(detectEmergency([text]), kinds);
  });
}

for (const text of SHOULD_PASS) {
  test(`넘겨야 함: ${text}`, () => {
    assert.deepEqual(detectEmergency([text]), []);
  });
}

test("다른 칸에 나뉜 글을 이어 붙여 짝짓지 않는다", () => {
  assert.deepEqual(detectEmergency(["불러도 대답", "없어요"]), []);
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
