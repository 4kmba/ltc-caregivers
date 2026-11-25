import assert from "node:assert/strict";
import { test } from "node:test";
import { carryChecks, changedAnswers, createNotebook } from "../src/notebook.mjs";

// Map으로 만든 가짜 저장소. 브라우저의 localStorage와 같은 세 메서드만 가진다.
const KEY = "dolbom.pages.v1";
function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}
const page = (extra = {}) => ({ date: "2026-11-25", situation: "fall", answers: { grade: "3" }, methodId: null, items: [], opened: [], checks: [], ...extra });
function clockedNotebook(storage) {
  let t = 0;
  const book = createNotebook(storage, () => ++t);
  return book;
}

test("저장한 페이지를 최신 순으로 돌려준다", () => {
  const book = clockedNotebook(fakeStorage());
  const first = book.savePage(page({ situation: "A" }));
  const second = book.savePage(page({ situation: "B" }));
  assert.deepEqual(book.listPages().map((p) => p.id), [second, first]);
  assert.equal(book.getPage(first).createdAt, 1);
});

test("지우면 그 페이지만 사라진다", () => {
  const book = clockedNotebook(fakeStorage());
  const a = book.savePage(page());
  const b = book.savePage(page());
  assert.equal(book.deletePage(a), true);
  assert.deepEqual(book.listPages().map((p) => p.id), [b]);
  assert.equal(book.deletePage("없는 id"), false);
});

test("모두 지우면 저장소 키가 없다", () => {
  const storage = fakeStorage();
  const book = clockedNotebook(storage);
  book.savePage(page());
  book.clearAll();
  assert.equal(storage.getItem(KEY), null);
});

test("지난번 답을 돌려준다", () => {
  const book = clockedNotebook(fakeStorage());
  assert.equal(book.lastAnswers(), null);
  book.savePage(page({ answers: { grade: "2" } }));
  book.savePage(page({ answers: { grade: "3" } }));
  assert.deepEqual(book.lastAnswers(), { grade: "3" });
});

test("바뀐 답만 고른다", () => {
  const prev = { grade: "3", care: "home" };
  const next = { grade: "3", care: "facility" };
  assert.deepEqual(changedAnswers(prev, next), [{ key: "care", before: "home", after: "facility" }]);
  assert.deepEqual(changedAnswers(null, next), []);
  assert.deepEqual(changedAnswers({ a: [1, 2] }, { a: [1, 2], b: "x" }), [{ key: "b", before: undefined, after: "x" }]);
  assert.deepEqual(changedAnswers({ a: [1] }, { a: [1, 2] }).map((c) => c.key), ["a"]);
  assert.deepEqual(changedAnswers({ old: 1 }, {}).map((c) => c.key), ["old"]);
});

test("끝낸 일은 체크를 남기고 새 일에 표시한다", () => {
  const prevPage = { items: [{ card_id: "A" }], checks: ["A"] };
  const result = carryChecks(prevPage, [{ card_id: "A" }, { card_id: "B" }]);
  assert.equal(result[0].done, true);
  assert.equal(result[0].isNew, undefined);
  assert.equal(result[1].isNew, true);
  assert.equal(result[1].done, undefined);
});

test("첫 페이지에서는 새로 추가됨 표시를 붙이지 않는다", () => {
  const result = carryChecks(null, [{ card_id: "A" }]);
  assert.equal(result[0].isNew, undefined);
});

test("carryChecks는 원본을 바꾸지 않는다", () => {
  const next = [{ card_id: "A" }];
  carryChecks({ items: [], checks: ["A"] }, next);
  assert.deepEqual(next, [{ card_id: "A" }]);
});

test("깨진 값이면 빈 기록", () => {
  const storage = fakeStorage();
  storage.setItem(KEY, "not json");
  const book = clockedNotebook(storage);
  assert.deepEqual(book.listPages(), []);
  assert.equal(book.lastAnswers(), null);
});

test("다른 version 값이면 빈 기록", () => {
  const storage = fakeStorage();
  storage.setItem(KEY, JSON.stringify({ version: 2, pages: [{ id: "x", createdAt: 1 }] }));
  assert.deepEqual(clockedNotebook(storage).listPages(), []);
  storage.setItem(KEY, JSON.stringify({ version: 1, pages: "no" }));
  assert.deepEqual(clockedNotebook(storage).listPages(), []);
});

test("배열 안의 객체가 아닌 항목은 버린다", () => {
  const storage = fakeStorage();
  storage.setItem(KEY, JSON.stringify({ version: 1, pages: [1, null, "s", { id: "ok", createdAt: 1 }] }));
  assert.deepEqual(clockedNotebook(storage).listPages().map((p) => p.id), ["ok"]);
});

test("updatePage는 id와 createdAt을 바꾸지 못한다", () => {
  const book = clockedNotebook(fakeStorage());
  const id = book.savePage(page());
  const updated = book.updatePage(id, { id: "다른", createdAt: 999, checks: ["A"] });
  assert.equal(updated.id, id);
  assert.equal(updated.createdAt, 1);
  assert.deepEqual(book.getPage(id).checks, ["A"]);
  assert.equal(book.updatePage("없는 id", { checks: [] }), null);
});

test("저장소가 던지면 savePage는 null, 나머지는 빈 기록", () => {
  const broken = {
    getItem: () => { throw new Error("denied"); },
    setItem: () => { throw new Error("quota"); },
    removeItem: () => { throw new Error("denied"); },
  };
  const book = createNotebook(broken, () => 1);
  assert.equal(book.savePage(page()), null);
  assert.deepEqual(book.listPages(), []);
  assert.equal(book.getPage("x"), null);
  assert.doesNotThrow(() => book.clearAll());
});
