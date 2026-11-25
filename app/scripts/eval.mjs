// 자리 하나의 AI 답을 시험 질문으로 여러 번 채점한다.
// 실행: npm run eval -- <자리 이름> [돌릴 횟수=2]   (app 폴더에서)
// 주의: 실제 API를 부르므로 돈이 든다. 손으로만 돌린다.
// 읽는 파일: evals/<자리 이름>.jsonl (한 줄에 시험 질문 하나), src/tasks/<자리 이름>.mjs
// 종료 코드: 0 모두 통과, 1 실패 또는 AI를 쓰지 못한 줄이 있음, 2 파일이 없거나 인자가 잘못됨
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCall } from "../src/ai/client.mjs";
import { gradeCase } from "../src/ai/grade.mjs";
import { loadPrompt } from "../src/ai/prompts.mjs";
import { runTask } from "../src/ai/task.mjs";
import { loadContent } from "../src/content.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [name, repeatArg] = process.argv.slice(2);
const repeat = repeatArg === undefined ? 2 : Number(repeatArg);

if (!name || !Number.isInteger(repeat) || repeat < 1) {
  console.error("사용법: npm run eval -- <자리 이름> [돌릴 횟수=2]");
  process.exit(2);
}

const taskFile = join(root, "src", "tasks", `${name}.mjs`);
const evalFile = join(root, "evals", `${name}.jsonl`);
if (!existsSync(taskFile)) {
  console.error(`자리 파일이 없습니다: src/tasks/${name}.mjs`);
  process.exit(2);
}
if (!existsSync(evalFile)) {
  console.error(`시험 질문 파일이 없습니다: evals/${name}.jsonl`);
  process.exit(2);
}

const cases = readFileSync(evalFile, "utf-8")
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line, i) => {
    try {
      return JSON.parse(line);
    } catch {
      console.error(`evals/${name}.jsonl ${i + 1}번째 줄이 JSON이 아닙니다.`);
      process.exit(2);
    }
  });

const mod = await import(pathToFileURL(taskFile).href);
const makeName = Object.keys(mod).find((key) => key.startsWith("make") && typeof mod[key] === "function");
if (!makeName) {
  console.error(`src/tasks/${name}.mjs에 make로 시작하는 함수가 없습니다.`);
  process.exit(2);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("ANTHROPIC_API_KEY가 없어 AI를 부르지 않습니다. 모두 usedAi:false로 나옵니다.");
}

const task = mod[makeName](loadContent());
const call = createCall();
const rows = [];
for (const testCase of cases) {
  for (let round = 1; round <= repeat; round++) {
    const { value, usedAi, reason } = await runTask(task, testCase.input, { call, loadPrompt });
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const { pass, problems } = gradeCase(text, testCase);
    rows.push({
      id: testCase.id,
      회차: round,
      통과: usedAi && pass,
      usedAi,
      reason: reason ?? "",
      problems: usedAi ? problems.join(" / ") : "AI를 쓰지 않아 채점하지 않음"
    });
  }
}

console.table(rows);
const passed = rows.filter((r) => r.통과).length;
console.log(`통과 ${passed}/${rows.length}`);
process.exit(passed === rows.length ? 0 : 1);
