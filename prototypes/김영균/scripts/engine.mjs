// Node에서 화면과 같은 규칙 엔진을 쓰기 위한 도우미. 테스트와 점검 스크립트가 쓴다.
import { readFileSync } from "node:fs";
import { createEngine } from "../public/logic.js";

const dataDir = new URL("../public/data/", import.meta.url);
const load = (name) => JSON.parse(readFileSync(new URL(name, dataDir), "utf-8"));

export const deck = load("cards.json");
export const questions = load("questions.json");
export const followups = load("followups.json");
export const engine = createEngine({ deck, questions, followups });
