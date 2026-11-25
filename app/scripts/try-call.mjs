// 팀원이 자기 API 키가 되는지 확인하는 스크립트. 실제로 API를 한 번 부르므로 몇십 원이 든다.
// 실행: ANTHROPIC_API_KEY=키 npm run try-call   (app/ 안에서)
// 확인할 것: 400 오류가 없는지, 글 블록이 JSON으로 풀리는지, 15초 안에 끝나는지.
import Anthropic from "@anthropic-ai/sdk";
import { buildRequest, collectText } from "../src/ai/client.mjs";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.log("ANTHROPIC_API_KEY가 없습니다. 이렇게 실행하세요: ANTHROPIC_API_KEY=키 npm run try-call");
  process.exit(1);
}

const schema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { card_id: { type: "string" }, why: { type: "string" } },
        required: ["card_id", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const system = "당신은 장기요양 가족 보호자의 돌봄 결정을 돕습니다. 후보 카드 가운데 지금 읽을 만한 것을 고르고 이유를 한 줄로 씁니다.";
const user = [
  "보호자의 걱정: 어머니가 최근 자주 넘어지세요.",
  "후보 카드:",
  "- S1-01: 낙상 뒤에 먼저 확인할 것",
  "- S2-02: 집 안 미끄럼 방지 용구",
  "- S3-05: 요양등급 재신청 시점",
].join("\n");

const client = new Anthropic({ apiKey, timeout: 15000, maxRetries: 0 });
const started = Date.now();
try {
  const res = await client.beta.messages.create(buildRequest({ system, user, schema }));
  console.log("걸린 시간(ms):", Date.now() - started);
  console.log("stop_reason:", res.stop_reason);
  console.log("블록 type:", res.content.map((b) => b.type));
  for (const b of res.content.filter((x) => x.type === "fallback")) {
    console.log(`대체 모델로 넘어감: ${b.from?.model} → ${b.to?.model}`);
  }
  const text = collectText(res.content);
  try {
    console.log("풀어 낸 JSON:", JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log("JSON으로 풀리지 않음. 받은 글:", text);
  }
  console.log("usage:", res.usage);
} catch (err) {
  console.log("실패(ms):", Date.now() - started);
  console.log(err?.status ?? "", err?.message ?? err);
  process.exit(1);
}
