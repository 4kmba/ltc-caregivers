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

// 할 일 후보: 상황과 조건이 맞는 카드. 고른 돌봄 방식이 빼라고 한 카드는 빼고,
// 방식이 가리키는 카드에는 first 표시를 붙여 AI에게 넘긴다.
// 방식을 아직 못 정했으면 method 없이 부른다.
export function candidateCards(cards, answers, method = null) {
  const excluded = method?.exclude_cards ?? [];
  const firsts = method?.first_cards ?? [];
  return cards
    .filter((card) => cardMatches(card, answers) && !excluded.includes(card.id))
    .map((card) => ({ ...card, first: firsts.includes(card.id) }));
}

// 규칙 기본 목록: AI가 실패했을 때 후보 가운데 size장을 코드로 고른다.
// "먼저" 표시가 붙은 카드와 상황의 꼭 넣을 카드를 맨 앞에 넣고, 세 구간이 비지 않게 구간마다 하나씩 넣은 뒤 나머지를 채운다.
export const BUCKETS = ["this_week", "this_month", "know_ahead"];

// when에 걸린 조건이 많을수록 이 사람의 상황에 가까운 카드로 보고 앞에 둔다.
// 조건 수가 같으면 priority 숫자가 작은 카드가 앞이다.
function bySpecificity(a, b) {
  const n = (c) => Object.keys(c.when ?? {}).length;
  return n(b) - n(a) || a.priority - b.priority;
}

// mustIds는 상황마다 적어 둔 "꼭 넣을 카드"(situations.json의 must_cards)다.
// 조건이 없어 누구에게나 필요한 카드는 조건 수로 줄 세우면 뒤로 밀리므로, 방식의 먼저 카드 다음에 넣는다.
// 후보에 없는 번호(조건이 맞지 않는 카드)는 넣지 않는다.
export function ruleList(candidates, answers, size = 6, mustIds = []) {
  const picked = candidates.filter((c) => c.first);
  for (const id of mustIds) {
    const card = candidates.find((c) => c.id === id);
    if (card && !picked.includes(card)) picked.push(card);
  }
  const rest = candidates.filter((c) => !picked.includes(c)).sort(bySpecificity);
  for (const bucket of BUCKETS) {
    if (picked.some((c) => c.bucket === bucket)) continue;
    const one = rest.find((c) => c.bucket === bucket);
    if (one) picked.push(one);
  }
  for (const c of rest) if (!picked.includes(c)) picked.push(c);
  return picked.slice(0, size);
}

// 돌봄 방식 점수: 고른 상황의 방식마다 답에 맞는 규칙의 점수를 더한다. AI를 쓰지 않는다.
// reason은 맞은 규칙 가운데 점수가 가장 큰 규칙의 이유 문장이다.
// 1등이 하나뿐이고 0점보다 클 때만 fits(잘 맞을 수 있음)를 붙인다. 동점이면 결정을 대신하지 않는다.
export function rankMethods(methods, answers) {
  const ranked = methods
    .filter((method) => method.situation === answers.situation)
    .map((method) => {
      const matched = method.rules.filter((r) => overlaps(answers[r.key], r.is));
      const top = [...matched].sort((a, b) => b.score - a.score)[0];
      return { method, score: matched.reduce((sum, r) => sum + r.score, 0), reason: top?.reason ?? null };
    })
    // sort는 같은 점수끼리 원래 순서를 지키므로, 동점이면 파일에 적힌 순서대로 놓인다.
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  const soleTop = best && best.score > 0 && !(second && second.score === best.score);
  return ranked.map((r, i) => ({ ...r, fits: soleTop && i === 0 }));
}
