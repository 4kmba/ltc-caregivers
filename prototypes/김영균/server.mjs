// 맞춤 돌봄 할 일 목록 프로토타입 서버.
// 실행: npm start  (API 키가 없으면 규칙 기본 목록으로만 동작한다)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { aiEnabled, describeAnswers, makeAnswer, makeFollowups, makePlan, MODEL } from "./src/ai.mjs";
import {
  candidateCards,
  cardById,
  detectEmergency,
  publicCard,
  questions,
  resolveStage,
  ruleList,
  sourcesOf
} from "./src/rules.mjs";

const PORT = Number(process.env.PORT ?? 3000);
const publicDir = new URL("./public/", import.meta.url);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

const NOTICE_NO_AI = "지금은 AI 설명 없이 기본 목록을 보여 드려요";

// 화면에서 온 답 가운데 질문지에 있는 값만 남긴다. 보호자의 답은 저장하지 않는다.
export function cleanAnswers(raw) {
  const answers = {};
  for (const q of questions) {
    for (const field of q.fields) {
      const allowed = field.options.map((o) => o.value);
      const value = raw?.[field.key];
      if (field.type === "many") {
        if (Array.isArray(value)) answers[field.key] = value.filter((v) => allowed.includes(v));
      } else if (allowed.includes(value)) {
        answers[field.key] = value;
      }
    }
  }
  if (Array.isArray(raw?.followups)) {
    answers.followups = raw.followups.slice(0, 3).map((f) => ({
      question: String(f?.question ?? "").slice(0, 200),
      answer: String(f?.answer ?? "").slice(0, 300)
    }));
  }
  return answers;
}

function emergencyTexts(answers) {
  return (answers.followups ?? []).map((f) => f.answer);
}

export async function buildPlan(answers) {
  const summary = describeAnswers(answers, questions);
  const candidates = candidateCards(answers);
  let items = null;
  let mode = "ai";
  if (candidates.length >= 3) items = await makePlan(summary, candidates);
  // 남은 항목이 3개보다 적거나 AI가 실패하면 규칙 기본 목록으로 바꾼다.
  if (!items || items.length < 3) {
    items = ruleList(answers);
    mode = "rules";
  }
  return {
    stage: resolveStage(answers),
    mode,
    notice: mode === "rules" ? NOTICE_NO_AI : null,
    emergency: detectEmergency(emergencyTexts(answers)),
    items: items.map((it) => ({ bucket: it.bucket, why: it.why, card: publicCard(cardById.get(it.card_id)) }))
  };
}

export async function buildAnswer(answers, cardId, qIndex) {
  const card = cardById.get(cardId);
  const qa = card?.qa?.[qIndex];
  if (!qa) return null;
  const text = await makeAnswer(describeAnswers(answers, questions), card, qIndex);
  return {
    text: text ?? qa.a,
    mode: text ? "ai" : "original",
    medical: Boolean(qa.medical),
    // 응급 신호가 있었던 사람에게는 답마다 119 안내를 고정 문구로 붙인다.
    urgent: detectEmergency(emergencyTexts(answers)).length > 0,
    sources: sourcesOf(card)
  };
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20_000) throw new Error("요청이 너무 큽니다");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function handleApi(req, res, path) {
  if (req.method === "GET" && path === "/api/questions") {
    return send(res, 200, { questions, ai: aiEnabled() });
  }
  if (req.method !== "POST") return send(res, 405, { error: "POST만 받습니다" });
  const body = await readJson(req);
  const answers = cleanAnswers(body.answers);
  if (path === "/api/followups") {
    const list = await makeFollowups(describeAnswers(answers, questions));
    return send(res, 200, { questions: list ?? [] });
  }
  // 응급 확인은 AI를 기다리지 않도록 목록과 따로 묻는다.
  if (path === "/api/emergency") {
    return send(res, 200, { emergency: detectEmergency(emergencyTexts(answers)) });
  }
  if (path === "/api/plan") {
    return send(res, 200, await buildPlan(answers));
  }
  if (path === "/api/answer") {
    const result = await buildAnswer(answers, String(body.card_id), Number(body.q_index));
    return result ? send(res, 200, result) : send(res, 404, { error: "없는 질문입니다" });
  }
  return send(res, 404, { error: "없는 주소입니다" });
}

async function handleStatic(res, path) {
  const file = path === "/" ? "index.html" : path.slice(1);
  if (file.includes("..") || !TYPES[extname(file)]) {
    res.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(new URL(file, publicDir));
    res.writeHead(200, { "content-type": TYPES[extname(file)] });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
}

export const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  try {
    if (path.startsWith("/api/")) await handleApi(req, res, path);
    else await handleStatic(res, path);
  } catch (err) {
    console.warn(`[server] ${err.message}`);
    send(res, 400, { error: "요청을 처리하지 못했습니다" });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    const ai = aiEnabled() ? `AI 켜짐 (${MODEL})` : "AI 꺼짐: ANTHROPIC_API_KEY가 없어 규칙 기본 목록만 씁니다";
    console.log(`http://localhost:${PORT}  ${ai}`);
  });
}
