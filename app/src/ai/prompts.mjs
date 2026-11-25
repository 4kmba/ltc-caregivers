// 프롬프트 파일 불러오기. 공통 지시(common.md)와 기능 지시(<이름>.md)를 빈 줄로 이어 붙인다.
// 기능 파일이 없으면 null이다. 아직 만들지 않은 AI 자리라는 뜻이다.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const PROMPTS_DIR = fileURLToPath(new URL("../../prompts/", import.meta.url));

function readTrimmed(file) {
  try {
    return fs.readFileSync(file, "utf-8").trim();
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export function loadPrompt(name, dir = PROMPTS_DIR) {
  const feature = readTrimmed(`${dir.replace(/\/?$/, "/")}${name}.md`);
  if (feature === null) return null;
  const common = readTrimmed(`${dir.replace(/\/?$/, "/")}common.md`);
  return common ? `${common}\n\n${feature}` : feature;
}
