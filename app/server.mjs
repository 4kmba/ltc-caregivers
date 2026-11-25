// 돌봄수첩 서버를 켠다. 처리는 src/server/handler.mjs가 한다.
// 사용: npm start   (개발 중 확인 전 자료까지 보려면 SHOW_UNVERIFIED=1 npm start)
// 키 값은 어디에도 찍지 않는다. 있는지 없는지만 알린다.
import http from "node:http";
import { fileURLToPath } from "node:url";
import { createCall } from "./src/ai/client.mjs";
import { loadContent } from "./src/content.mjs";
import { createHandler } from "./src/server/handler.mjs";

const port = Number(process.env.PORT) || 8787;
const showUnverified = process.env.SHOW_UNVERIFIED === "1";
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const publicDir = fileURLToPath(new URL("./public/", import.meta.url));

const handler = createHandler({ call: createCall(), content: loadContent(), showUnverified, publicDir });

http.createServer(handler).listen(port, () => {
  console.log(`돌봄수첩 서버: http://localhost:${port}`);
  console.log(hasKey ? "AI 키: 있음" : "AI 키: 없음(규칙 목록만)");
  console.log(showUnverified ? "개발 모드: 켬(확인 전 자료도 보임)" : "개발 모드: 끔");
});
