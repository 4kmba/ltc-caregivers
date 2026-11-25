// 돌봄수첩 서버를 켠다. 처리는 src/server/handler.mjs가 한다.
// 사용: npm start   (개발 중 확인 전 자료까지 보려면 SHOW_UNVERIFIED=1 npm start)
// 키 값은 어디에도 찍지 않는다. 있는지 없는지만 알린다.
// ANTHROPIC_LOG=debug를 켜지 말 것. SDK가 요청 본문(보호자의 답과 걱정 칸)을 찍는다.
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createCall } from "./src/ai/client.mjs";
import { loadContent } from "./src/content.mjs";
import { createHandler } from "./src/server/handler.mjs";

const port = Number(process.env.PORT) || 8787;
// 기본은 내 컴퓨터에서만 연다. 같은 Wi-Fi의 다른 사람이 팀 키로 AI를 부르지 못하게 하려는 것이다.
// Hugging Face Spaces 같은 컨테이너에서는 HOST=0.0.0.0, PORT=7860을 준다.
const host = process.env.HOST || "127.0.0.1";
const showUnverified = process.env.SHOW_UNVERIFIED === "1";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const publicDir = fileURLToPath(new URL("./public/", import.meta.url));

const handler = createHandler({ call: createCall(), content: loadContent(), showUnverified, publicDir });

const server = http.createServer(handler);
// 느리게 보내는 연결을 오래 붙들지 않는다. AI 응답 기다림(15초)보다 넉넉하게 둔다.
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;

server.listen(port, host, () => {
  console.log(`돌봄수첩 서버: http://${host.includes(":") ? `[${host}]` : host}:${port}`);
  console.log(hasKey ? "AI 키: 있음" : "AI 키: 없음(규칙 목록만)");
  console.log(showUnverified ? "개발 모드: 켬(확인 전 자료도 보임)" : "개발 모드: 끔");
});
