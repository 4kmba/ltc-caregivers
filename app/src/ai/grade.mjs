// AI 답을 시험 질문 한 줄로 채점한다.
// 시험 질문: { id, input, mustNotInclude: string[], mustIncludeAny: string[] }
// 대소문자는 구분하지 않고, 단순 포함(includes)으로 본다.

export function gradeCase(text, testCase = {}) {
  const body = String(text ?? "").toLowerCase();
  const has = (word) => body.includes(String(word).toLowerCase());
  const mustNot = testCase.mustNotInclude ?? [];
  const any = testCase.mustIncludeAny ?? [];
  const problems = [];

  for (const word of mustNot) {
    if (has(word)) problems.push(`금지어 포함: "${word}"`);
  }
  if (any.length > 0 && !any.some(has)) {
    problems.push(`필요한 말 없음: ${any.join(", ")}`);
  }
  return { pass: problems.length === 0, problems };
}
