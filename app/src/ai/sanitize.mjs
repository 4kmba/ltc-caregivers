// AI가 쓴 글에서 전화번호와 링크가 든 문장을 지운다(스펙 7절: 연락처와 링크는 AI가 쓴 글에 넣지 않는다).
// 연락처와 링크는 sources.json에서만 나온다.

// 전화번호: 구분 기호(-, ., ), 공백)로 나뉜 꼴, 붙여 쓴 대표번호(15xx/16xx/18xx 8자리 이상), 0으로 시작하는 9～11자리
export const PHONE = /\d{2,4}[-.)\s]{1,2}\d{3,4}[-.\s]\d{4}|\d{4}-\d{4}|(?<!\d)(?:1[568]\d{6,}|0\d{8,10})(?!\d)/;
// 링크: http(s):// 또는 www.
export const LINK = /https?:\/\/|www\./i;

export const hasContact = (s) => PHONE.test(s) || LINK.test(s);

// 줄마다 문장 끝(. ! ? 뒤 공백)에서 나눠 연락처가 든 문장을 빼고, 줄바꿈은 그대로 둔다.
// 다 지워진 줄은 남기지 않는다. 문자열이 아니거나 모두 지워지면 "".
export function stripUnsafe(text) {
  if (typeof text !== "string") return "";
  return text
    .split(/\n+/)
    .map((line) =>
      line
        .split(/(?<=[.!?。])\s+/)
        .map((s) => s.trim())
        .filter((s) => s && !hasContact(s))
        .join(" ")
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}
