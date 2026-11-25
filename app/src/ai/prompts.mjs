// 프롬프트 파일 불러오기. 공통 지시(common.md)와 기능 지시(<이름>.md)를 빈 줄로 이어 붙인다.
// HTML 주석(<!-- -->)은 팀원용 메모이므로 AI에게 보내기 전에 지운다.
// 기능 파일이 없으면 null이다. 아직 만들지 않은 AI 자리라는 뜻이다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROMPTS_DIR = fileURLToPath(new URL("../../prompts/", import.meta.url));

function read(file) {
  try {
    return fs.readFileSync(file, "utf-8").replace(/<!--[\s\S]*?-->/g, "").trim();
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

export function loadPrompt(name, dir = PROMPTS_DIR) {
  const base = dir instanceof URL ? fileURLToPath(dir) : dir;
  const feature = read(path.join(base, `${name}.md`));
  if (feature === null) return null;
  const common = read(path.join(base, "common.md"));
  return common ? `${common}\n\n${feature}` : feature;
}
