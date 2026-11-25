// 수첩 페이지를 브라우저 저장소(localStorage)에만 두는 모듈. 서버로 보내지 않는다.
// 브라우저에서도 돌아야 하므로 node: 모듈과 다른 파일을 가져오지 않는다.

const KEY = "dolbom.pages.v1";
const VERSION = 1;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function makeId(now) {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${now}-${Math.random().toString(36).slice(2, 8)}`;
}

// 저장된 값을 읽는다. 깨졌거나 모르는 형식이면 빈 기록으로 본다.
function read(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (raw == null) return [];
    const data = JSON.parse(raw);
    if (!isObject(data) || data.version !== VERSION || !Array.isArray(data.pages)) return [];
    return data.pages.filter(isObject);
  } catch {
    return [];
  }
}

// 저장에 성공하면 true. 사생활 모드나 용량 초과로 던지면 false.
function write(storage, pages) {
  try {
    storage.setItem(KEY, JSON.stringify({ version: VERSION, pages }));
    return true;
  } catch {
    return false;
  }
}

export function createNotebook(storage, now = Date.now) {
  const time = (p) => (typeof p.createdAt === "number" && Number.isFinite(p.createdAt) ? p.createdAt : 0);
  // 같은 시각이면 배열 뒤쪽(나중에 저장한 것)이 먼저 온다.
  const newestFirst = (pages) =>
    pages
      .map((p, i) => ({ p, i }))
      .sort((x, y) => time(y.p) - time(x.p) || y.i - x.i)
      .map((x) => x.p);

  return {
    savePage(page) {
      const createdAt = now();
      const saved = { ...page, id: makeId(createdAt), createdAt };
      const ok = write(storage, [...read(storage), saved]);
      return ok ? saved.id : null;
    },
    listPages() {
      return newestFirst(read(storage));
    },
    getPage(id) {
      return read(storage).find((p) => p.id === id) ?? null;
    },
    updatePage(id, patch) {
      const pages = read(storage);
      const i = pages.findIndex((p) => p.id === id);
      if (i < 0) return null;
      const updated = { ...pages[i], ...patch, id: pages[i].id, createdAt: pages[i].createdAt };
      pages[i] = updated;
      return write(storage, pages) ? updated : null;
    },
    deletePage(id) {
      const pages = read(storage);
      const rest = pages.filter((p) => p.id !== id);
      if (rest.length === pages.length) return false;
      return write(storage, rest);
    },
    clearAll() {
      try {
        storage.removeItem(KEY);
      } catch {
        // 지우지 못해도 화면이 멈추지 않게 한다.
      }
    },
    lastAnswers() {
      const [latest] = newestFirst(read(storage));
      return latest && isObject(latest.answers) ? latest.answers : null;
    },
  };
}

// 지난 답과 새 답을 비교해 바뀐 것만 돌려준다. 순서는 새 답 기준, 그다음 지난 답에만 있던 것.
export function changedAnswers(prev, next) {
  if (!isObject(prev) || !isObject(next)) return [];
  const a = prev;
  const b = next;
  const keys = [...Object.keys(b), ...Object.keys(a).filter((k) => !(k in b))];
  return keys
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((key) => ({ key, before: a[key], after: b[key] }));
}

// 지난 페이지에서 끝낸 카드는 done, 지난 페이지에 없던 카드는 isNew. 원본은 바꾸지 않는다.
export function carryChecks(prevPage, nextItems) {
  const list = (v) => (Array.isArray(v) ? v : []);
  const checks = new Set(list(prevPage?.checks));
  const before = new Set(list(prevPage?.items).map((x) => x?.card_id));
  return list(nextItems).filter(isObject).map((item) => {
    const copy = { ...item };
    if (checks.has(item.card_id)) copy.done = true;
    if (prevPage && !before.has(item.card_id)) copy.isNew = true;
    return copy;
  });
}
