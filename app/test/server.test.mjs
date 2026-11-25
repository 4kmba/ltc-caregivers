import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createCall } from "../src/ai/client.mjs";
import { loadContent } from "../src/content.mjs";
import { createHandler } from "../src/server/handler.mjs";
import { CASES } from "./cases.mjs";

// node:http 서버(스펙 8절 온디바이스 원칙). 실제 AI는 부르지 않는다. 키를 비워 둔 createCall을 쓴다.

const content = loadContent();
const call = createCall({ apiKey: "" });
const fallCase = CASES.find((c) => c.situation === "fall");
const fallInput = { situation: fallCase.situation, answers: fallCase.answers, methodId: null, worry: fallCase.worry, followups: [] };

// 정적 파일은 임시 publicDir에 만든다.
const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), "dolbom-public-"));
fs.writeFileSync(path.join(publicDir, "index.html"), "<!doctype html><title>돌봄수첩</title>", "utf-8");
fs.writeFileSync(path.join(publicDir, "app.css"), "body{}", "utf-8");

const servers = [];
async function start(options) {
  const server = http.createServer(createHandler({ call, content, publicDir, ...options }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

let base; // 기본 모드(확인 전 자료 숨김)
let dev; // 개발 모드(SHOW_UNVERIFIED=1과 같음)
before(async () => {
  base = await start({});
  dev = await start({ showUnverified: true });
});
after(() => {
  for (const s of servers) s.close();
  fs.rmSync(publicDir, { recursive: true, force: true });
});

const post = (url, body) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

// fetch는 경로의 ..을 정리해 버리므로 원문 경로를 그대로 보낼 때 쓴다.
function rawGet(url, rawPath) {
  const { hostname, port } = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port, path: rawPath, method: "GET" }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
}

// 지금은 두 사람이 확인한 자료가 1개뿐이라 기본 모드에서는 카드가 거의 숨겨진다.
// 그래서 이 테스트는 showUnverified: true로 만든 handler로 한다.
test("키 없이도 할 일 목록이 나온다(개발 모드 handler)", async () => {
  const res = await post(`${dev}/api/task/pick-cards`, fallInput);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.equal(body.usedAi, false);
  assert.ok(body.value.items.length >= 3);
  const ids = new Set(content.cards.map((c) => c.id));
  for (const item of body.value.items) assert.ok(ids.has(item.card_id), item.card_id);
});

test("없는 자리는 404", async () => {
  const res = await post(`${base}/api/task/nope`, {});
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "not_found" });
});

test("자리 이름으로 경로를 조작할 수 없다", async () => {
  const res = await post(`${base}/api/task/%2e%2e%2fcommon`, {});
  assert.equal(res.status, 404);
});

test("너무 큰 본문은 413", async () => {
  const res = await post(`${base}/api/task/pick-cards`, JSON.stringify({ worry: "가".repeat(12 * 1024) }));
  assert.equal(res.status, 413);
  assert.deepEqual(await res.json(), { error: "too_large" });
});

test("깨진 JSON은 400", async () => {
  const res = await post(`${base}/api/task/pick-cards`, "{");
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: "bad_json" });
});

test("JSON 객체가 아닌 본문은 400", async () => {
  for (const body of ["[]", "null", "3"]) {
    const res = await post(`${base}/api/task/pick-cards`, body);
    assert.equal(res.status, 400, body);
  }
});

test("확인 전 내용은 기본으로 숨긴다", async () => {
  const res = await fetch(`${base}/api/content`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  // 상황은 모두 오지만 ready인 것(화면에 내놓을 상황)이 하나도 없다.
  assert.deepEqual(body.situations.filter((s) => s.ready), []);
});

test("개발 모드에서는 보인다", async () => {
  const body = await (await fetch(`${dev}/api/content`)).json();
  assert.ok(body.situations.filter((s) => s.ready).length >= 1);
});

test("허용한 모듈만 내보낸다", async () => {
  const ok = await fetch(`${base}/src/rules.mjs`);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get("content-type"), /^text\/javascript/);
  assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await rawGet(base, "/src/../server.mjs"), 404);
  assert.equal(await rawGet(base, "/src/%2e%2e/server.mjs"), 404);
  assert.equal((await fetch(`${base}/src/content.mjs`)).status, 404);
});

test("public의 파일을 내보낸다", async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-type"), /^text\/html/);
  assert.match(await index.text(), /돌봄수첩/);
  const css = await fetch(`${base}/app.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get("content-type"), /^text\/css/);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
});

test("public 밖의 파일은 내보내지 않는다", async () => {
  assert.equal(await rawGet(base, "/../package.json"), 404);
  assert.equal(await rawGet(base, "/%2e%2e/package.json"), 404);
  assert.equal(await rawGet(base, "/%2e%2e%2fpackage.json"), 404);
});

test("public 폴더가 없어도 API는 돈다", async () => {
  const url = await start({ publicDir: path.join(publicDir, "없는-폴더") });
  assert.equal((await fetch(`${url}/`)).status, 404);
  assert.equal((await fetch(`${url}/api/content`)).status, 200);
});

test("허용하지 않는 메서드는 405", async () => {
  const del = await fetch(`${base}/api/content`, { method: "DELETE" });
  assert.equal(del.status, 405);
  assert.deepEqual(await del.json(), { error: "method_not_allowed" });
  assert.equal((await fetch(`${base}/api/task/pick-cards`)).status, 405);
  assert.equal((await post(`${base}/api/content`, {})).status, 405);
});

test("로그에 남기지 않는다", async () => {
  const phone = "010-1234-5678";
  const printed = [];
  const names = ["log", "error", "warn", "info"];
  const saved = Object.fromEntries(names.map((n) => [n, console[n]]));
  for (const n of names) console[n] = (...args) => printed.push(args.map(String).join(" "));
  try {
    await post(`${dev}/api/task/pick-cards`, { ...fallInput, worry: `엄마 번호 ${phone}` });
    await post(`${dev}/api/task/pick-cards`, `{"worry":"${phone}"`);
    await post(`${dev}/api/task/nope`, { worry: phone });
    // 대체 값을 만들다 예외가 나는 입력도 보낸다(answers가 숫자).
    await post(`${dev}/api/task/pick-cards`, { situation: "fall", answers: 1, worry: phone });
  } finally {
    Object.assign(console, saved);
  }
  assert.ok(printed.every((line) => !line.includes(phone)), printed.join("\n"));
});
