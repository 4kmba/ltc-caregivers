// AI 응답 검증(스펙 7절). AI를 부르는 코드와 떼어 두어 키 없이도 테스트한다.
import { BUCKETS } from "./rules.mjs";

// 카드 고르기 응답에서 쓸 수 있는 항목만 남긴다.
// 후보에 없는 카드 번호, 없는 구간, 비어 있는 "왜 지금"은 버린다. 응답 모양이 다르면 빈 목록이다.
// 같은 카드는 앞의 것만 남기고, 스펙 7절의 5～7장에 맞춰 7장까지만 받는다.
const MAX_CARDS = 7;

export function validatePlan(result, candidateIds) {
  const items = Array.isArray(result?.items) ? result.items : [];
  const seen = new Set();
  return items
    .filter((item) => item && candidateIds.includes(item.card_id) && BUCKETS.includes(item.bucket))
    .filter((item) => typeof item.why === "string" && item.why.trim())
    .filter((item) => !seen.has(item.card_id) && seen.add(item.card_id))
    .slice(0, MAX_CARDS)
    .map((item) => ({ card_id: item.card_id, bucket: item.bucket, why: item.why.trim() }));
}
