// AI 기능 틀. 모든 AI 자리는 이 틀을 지나간다(스펙 7절).
// 프롬프트가 아직 없거나 AI가 실패하면, 기능마다 정한 대체 값을 돌려준다.
//
// task = {
//   name: string,                         // 프롬프트 파일 이름과 같음
//   schema: object | null,                // JSON 형식을 받을 때만
//   buildUser(input) → string,            // AI에게 보낼 글. 스펙 7절에 적은 것만 넣음
//   validate(data, input) → value | null, // 쓸 수 없으면 null
//   fallback(input) → value,              // AI 없이 돌려줄 값
// }
// runTask(task, input, { call, loadPrompt }) → Promise<{ value, usedAi: boolean, reason: string | null }>
//
// reason: null(성공), "not_built"(프롬프트 없음), call이 돌려준 이유("timeout" 등),
//         "invalid"(validate가 null), "error"(예외).
// fallback이 던지는 것은 기능 작성자의 버그이므로 감싸지 않는다.

export async function runTask(task, input, { call, loadPrompt }) {
  const fail = (reason) => ({ value: task.fallback(input), usedAi: false, reason });
  let outcome;
  try {
    const system = loadPrompt(task.name);
    if (system === null) return fail("not_built");
    const result = await call({ system, user: task.buildUser(input), schema: task.schema });
    if (!result.ok) return fail(result.reason);
    const value = task.validate(result.data, input);
    if (value === null || value === undefined) return fail("invalid");
    outcome = { value, usedAi: true, reason: null };
  } catch {
    return fail("error");
  }
  return outcome;
}
