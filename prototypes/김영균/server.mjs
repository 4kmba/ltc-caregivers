// 로컬에서 화면을 미리 보기 위한 정적 파일 서버. 실제 공유는 public/ 폴더만 올리면 된다.
// 실행: npm start
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 3000);
const publicDir = new URL("./public/", import.meta.url);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.endsWith("/") ? `${path.slice(1)}index.html` : path.slice(1);
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
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
}
