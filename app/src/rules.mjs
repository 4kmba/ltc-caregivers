// 보호자의 답으로 할 일 카드를 거르는 규칙. AI 없이도 돌아가야 한다(스펙 6절).

// 답 하나가 허용된 값과 겹치는지 본다. 여러 개를 고르는 답은 배열로 온다.
function overlaps(answer, allowed) {
  if (answer === undefined || answer === null) return false;
  const values = Array.isArray(answer) ? answer : [answer];
  return values.some((v) => allowed.includes(v));
}

// 카드 한 장이 보호자가 고른 상황과 답에 맞는지 본다.
// 조건 묶음 하나의 조건이 모두 맞는지 본다.
function allMatch(group, answers) {
  return Object.entries(group ?? {}).every(([key, allowed]) => overlaps(answers[key], allowed));
}

// when의 조건은 모두 맞아야 하고, when_not의 조건은 하나도 맞으면 안 된다.
// when_any는 묶음 가운데 하나만 맞으면 된다. 묶음이 없으면 조건이 없는 것으로 본다.
export function cardMatches(card, answers) {
  if (!card.situations.includes(answers.situation)) return false;
  const blocked = Object.entries(card.when_not ?? {}).some(([key, values]) => overlaps(answers[key], values));
  const anyGroups = card.when_any ?? [];
  const anyOk = anyGroups.length === 0 || anyGroups.some((group) => allMatch(group, answers));
  return allMatch(card.when, answers) && !blocked && anyOk;
}
