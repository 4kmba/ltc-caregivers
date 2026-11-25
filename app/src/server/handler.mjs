// node:http 요청 처리기. 외부 웹 프레임워크를 쓰지 않는다.
// 온디바이스 원칙(스펙 8절): 요청 본문은 AI 자리에 넘기기만 하고, 저장하거나 console에 찍지 않는다.
//
// createHandler({ call, content, showUnverified = false, publicDir, loadPrompt, tasks }) → (req, res)
//   tasks: 테스트에서 자리 표를 바꿔 끼울 때만 쓴다. { 이름: 자리 객체 }
//   GET  /, /<파일>          publicDir의 파일
//   GET  /src/<이름>.mjs     브라우저가 쓰는 모듈. 허용 목록만
//   GET  /api/content        visibleContent(content, { showUnverified })
//   POST /api/task/<이름>    JSON 본문을 받아 runTask 결과 { value, usedAi, reason }를 그대로 돌려줌
// 오류 응답의 본문은 { error: "<짧은 영어 코드>" }만 담는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { visibleContent } from "../content.mjs";
import { runTask } from "../ai/task.mjs";
import { loadPrompt as realLoadPrompt } from "../ai/prompts.mjs";
import { makePickCards } from "../tasks/pick-cards.mjs";
import { makeFollowups } from "../tasks/followups.mjs";
import { makeSummary } from "../tasks/summary.mjs";
import { makeAnswer } from "../tasks/answer.mjs";
import { makeMedical } from "../tasks/medical.mjs";

const MAX_BODY = 32 * 1024;
const SRC_DIR = fileURLToPath(new URL("../", import.meta.url));

// AI 자리는 이 표에 있는 것만 부른다. URL의 이름을 loadPrompt에 그대로 넘기지 않으려는 것이다(경로 조작 방지).
const SLOTS = {
  "pick-cards": makePickCards,
  followups: makeFollowups,
  summary: makeSummary,
  answer: makeAnswer,
  medical: makeMedical
};

// 브라우저에 내보내는 모듈. 셋 다 다른 모듈을 가져오지 않는다.
const BROWSER_MODULES = new Set(["rules.mjs", "emergency.mjs", "notebook.mjs"]);

// HTML 응답에 붙인다. 바깥 스크립트, 분석, 추적을 브라우저가 막는다(스펙 8절).
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

function send(res, status, headers, body) {
  res.writeHead(status, { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", ...headers });
  res.end(body);
}

function sendJson(res, status, data, extra = {}) {
  send(res, status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }, JSON.stringify(data));
}

const sendError = (res, status, code, extra) => sendJson(res, status, { error: code }, extra);

// 본문을 스트림으로 읽는다. 32KB를 넘는 순간 더 모으지 않고 too_large를 돌려준다.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    function onData(chunk) {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.off("data", onData);
        req.off("end", onEnd);
        chunks.length = 0;
        // 남은 바이트는 메모리에 담지 않고 흘려보낸다.
        req.resume();
        resolve({ tooLarge: true });
        return;
      }
      chunks.push(chunk);
    }
    function onEnd() {
      resolve({ text: Buffer.concat(chunks).toString("utf-8") });
    }
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", reject);
    // 끊긴 요청은 error 없이 close만 올 때가 있다. 기다림이 남지 않게 끝낸다(이미 끝났으면 무시됨).
    req.on("close", () => {
      if (!req.complete) resolve({ aborted: true });
    });
  });
}

// 경로 조각을 풀고 base 안의 절대 경로로 바꾼다. base 밖이거나 풀 수 없으면 null.
// 점으로 시작하는 조각(.env, .git, ..)이 하나라도 있으면 내보내지 않는다.
function resolveInside(base, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  if (decoded.split(/[\\/]/).some((part) => part.startsWith("."))) return null;
  const root = path.resolve(base);
  const full = path.resolve(root, `.${path.sep}${decoded}`);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

// 심볼릭 링크는 내보내지 않는다. 중간 폴더가 링크여도 실제 위치가 base 밖이면 내보내지 않는다.
async function readFileOrNull(base, file) {
  try {
    const stat = await fs.promises.lstat(file);
    if (stat.isSymbolicLink()) return null;
    if (stat.isDirectory()) return readFileOrNull(base, path.join(file, "index.html"));
    if (!stat.isFile()) return null;
    const [realRoot, realFile] = await Promise.all([fs.promises.realpath(base), fs.promises.realpath(file)]);
    if (!realFile.startsWith(realRoot + path.sep)) return null;
    return { file, data: await fs.promises.readFile(file) };
  } catch {
    return null;
  }
}

// 클라이언트가 중간에 끊어서 생긴 오류. 정상적인 일이라 찍지 않는다.
function isClientAbort(err, req) {
  // 본문을 끝까지 읽은 요청도 destroyed가 되므로, 다 받지 못한(complete가 아닌) 경우만 끊김으로 본다.
  return err?.code === "ECONNRESET" || err?.message === "aborted" || (req.destroyed && !req.complete);
}

export function createHandler({ call, content, showUnverified = false, publicDir, loadPrompt = realLoadPrompt, tasks }) {
  // 자리 객체는 한 번만 만든다. 기본 모드에서는 확인 전 카드가 AI에도 대체 목록에도 들어가지 않는다.
  const visible = visibleContent(content, { showUnverified });
  const slots = tasks
    ? new Map(Object.entries(tasks))
    : new Map(Object.entries(SLOTS).map(([name, make]) => [name, make(visible)]));

  async function handleTask(req, res, name) {
    const task = slots.get(name);
    if (!task) return sendError(res, 404, "not_found");
    if (req.method !== "POST") return sendError(res, 405, "method_not_allowed", { Allow: "POST" });
    const body = await readBody(req);
    if (body.aborted) return res.destroy();
    if (body.tooLarge) return sendError(res, 413, "too_large", { Connection: "close" });
    let input;
    try {
      input = JSON.parse(body.text);
    } catch {
      return sendError(res, 400, "bad_json");
    }
    if (input === null || typeof input !== "object" || Array.isArray(input)) return sendError(res, 400, "bad_json");
    const result = await runTask(task, input, { call, loadPrompt });
    return sendJson(res, 200, { value: result.value, usedAi: result.usedAi, reason: result.reason });
  }

  async function handleStatic(req, res, urlPath) {
    if (req.method !== "GET" && req.method !== "HEAD") return sendError(res, 405, "method_not_allowed", { Allow: "GET, HEAD" });
    if (!publicDir) return sendError(res, 404, "not_found");
    const file = resolveInside(publicDir, urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath);
    const found = file && (await readFileOrNull(publicDir, file));
    if (!found) return sendError(res, 404, "not_found");
    const ext = path.extname(found.file).toLowerCase();
    const headers = { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Content-Length": found.data.length };
    if (ext === ".html") headers["Content-Security-Policy"] = CSP;
    return send(res, 200, headers, found.data);
  }

  async function handleModule(req, res, urlPath) {
    const name = urlPath.slice("/src/".length);
    if (!BROWSER_MODULES.has(name)) return sendError(res, 404, "not_found");
    if (req.method !== "GET" && req.method !== "HEAD") return sendError(res, 405, "method_not_allowed", { Allow: "GET, HEAD" });
    const data = await fs.promises.readFile(path.join(SRC_DIR, name));
    return send(res, 200, { "Content-Type": "text/javascript; charset=utf-8", "Content-Length": data.length }, data);
  }

  async function route(req, res) {
    // 경로는 정규화하지 않고 원문 그대로 본다. ?부터는 버린다.
    const urlPath = (req.url ?? "/").split("?")[0];
    if (urlPath === "/api/content") {
      if (req.method !== "GET" && req.method !== "HEAD") return sendError(res, 405, "method_not_allowed", { Allow: "GET, HEAD" });
      return sendJson(res, 200, visible);
    }
    if (urlPath.startsWith("/api/task/")) return handleTask(req, res, urlPath.slice("/api/task/".length));
    if (urlPath.startsWith("/api/")) return sendError(res, 404, "not_found");
    if (urlPath.startsWith("/src/")) return handleModule(req, res, urlPath);
    return handleStatic(req, res, urlPath);
  }

  return function handler(req, res) {
    route(req, res).catch((err) => {
      if (isClientAbort(err, req)) return res.destroy();
      // 예외 메시지에 본문 내용이 섞일 수 있어 이름만 찍는다.
      console.error("handler_error", err?.name);
      if (!res.headersSent) sendError(res, 500, "internal");
      else res.destroy();
    });
  };
}
