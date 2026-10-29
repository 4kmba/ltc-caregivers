// 프로토타입을 휴대폰·브라우저에서 열어 보기 위한 작은 정적 서버. 외부 패키지 없이 Node만 있으면 된다.
// 실행: node prototypes/백민경/serve.js  →  http://localhost:5173
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 5173;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(root, urlPath === "/" ? "index.html" : urlPath);
  // 이 폴더 밖의 파일은 내주지 않는다
  if (!file.startsWith(root) || !types[path.extname(file)]) {
    res.writeHead(404);
    return res.end("not found");
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("not found");
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] });
    res.end(data);
  });
}).listen(port, () => console.log(`http://localhost:${port}`));
