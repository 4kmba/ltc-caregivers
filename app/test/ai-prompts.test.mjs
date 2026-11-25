import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { loadPrompt, PROMPTS_DIR } from "../src/ai/prompts.mjs";

// 프롬프트 파일을 공통 지시와 기능 지시로 나눠 불러온다. 스펙 7절.

function tempDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prompts-"));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text, "utf-8");
  return dir;
}

test("공통 지시 뒤에 기능 지시를 붙인다", () => {
  const dir = tempDir({ "common.md": "공통", "x.md": "기능" });
  assert.equal(loadPrompt("x", dir), "공통\n\n기능");
});

test("기능 파일이 없으면 null", () => {
  assert.equal(loadPrompt("x", tempDir({ "common.md": "공통" })), null);
});

test("공통 파일이 없으면 기능 파일만 돌려준다", () => {
  assert.equal(loadPrompt("x", tempDir({ "x.md": "기능" })), "기능");
});

test("앞뒤 공백은 지우고 한글도 그대로 읽는다", () => {
  const dir = tempDir({ "common.md": "\n  공통 지시  \n\n", "x.md": "\n기능 지시\n" });
  assert.equal(loadPrompt("x", dir), "공통 지시\n\n기능 지시");
});

test("기본 폴더는 app/prompts 절대 경로이고 common.md가 있다", () => {
  assert.ok(path.isAbsolute(PROMPTS_DIR));
  assert.ok(fs.existsSync(path.join(PROMPTS_DIR, "common.md")));
});
