// 내용 파일을 점검하고 검수가 얼마나 남았는지 보여 준다.
// 실행: npm run check:content  (app 폴더에서)
// 번호가 틀린 곳이 있으면 종료 코드 1로 끝난다.
import { loadContent, reviewReport, validateContent } from "../src/content.mjs";

const content = loadContent();
const errors = validateContent(content);
const report = reviewReport(content);

console.log("## 화면에 나오는 내용 (두 사람이 확인한 자료만 가리키는 것)");
console.table({
  자료: `${report.sources.verified} / ${report.sources.total}`,
  "할 일 카드": `${report.cards.visible} / ${report.cards.total}`,
  "질문과 답": `${report.qa.visible} / ${report.qa.total}`,
  "돌봄 방식": `${report.methods.visible} / ${report.methods.total}`
});

console.log("\n## 상황별 (확인된 수 / 전체). 카드 3장, 비교 화면이면 방식 2개가 확인돼야 화면에 나옵니다");
console.table(
  report.situations.map((s) => ({
    상황: s.title,
    우선순위: s.priority,
    카드: s.cards,
    방식: s.methods,
    "지켜볼 신호": s.watch,
    "화면에 나옴": s.ready ? "예" : "아니요"
  }))
);

console.log("\n## 확인이 더 필요한 자료 (가리키는 카드·답·방식이 많은 순, 상위 15개)");
console.table(
  report.unverified.slice(0, 15).map((s) => ({ 번호: s.id, 이름: s.name, "확인한 사람": s.checks, 쓰는곳: s.used }))
);
console.log(`확인이 더 필요한 자료는 모두 ${report.unverified.length}개입니다.`);

if (errors.length) {
  console.error(`\n## 고쳐야 할 곳 ${errors.length}개`);
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log("\n번호와 값이 모두 맞습니다.");
