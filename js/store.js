// store.js — прогресс в localStorage.
//   bio.cards  → { [ticketNumber]: { box, status, lastSeen } }   (Лейтнер, 3 коробки)
//   bio.tests  → [ { date, scopeLabel, correct, total, bySection } ]  (история)
//   bio.theme  → 'light' | 'dark' | null
//
// На file:// localStorage может быть недоступен — оборачиваем в try/catch,
// деградируем до in-memory, чтобы интерфейс не падал.

const KEY = {
  cards: 'bio.cards', tests: 'bio.tests', theme: 'bio.theme',
  settings: 'bio.settings',
  quizSession: 'bio.quizSession', cardSession: 'bio.cardSession',
};
const mem = {}; // фолбэк, если localStorage недоступен

function lsGet(k) {
  try { return localStorage.getItem(k); } catch { return mem[k] ?? null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch { mem[k] = v; }
}
function lsRemove(k) {
  try { localStorage.removeItem(k); } catch { delete mem[k]; }
}

function readJSON(k, fallback) {
  const raw = lsGet(k);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
function writeJSON(k, v) { lsSet(k, JSON.stringify(v)); }

// ── Карточки / статус билета ───────────────────────────
export const cards = {
  all() { return readJSON(KEY.cards, {}); },
  get(num) {
    const c = this.all()[num];
    return c || { box: 1, status: 'new', lastSeen: 0 };
  },
  // result: 'know' | 'dont'
  grade(num, result, now) {
    const data = this.all();
    const cur = data[num] || { box: 1, status: 'new', lastSeen: 0 };
    if (result === 'know') {
      cur.box = Math.min(3, (cur.box || 1) + 1);
      cur.status = cur.box >= 3 ? 'known' : 'learning';
    } else {
      cur.box = 1;
      cur.status = 'learning';
    }
    cur.lastSeen = now || 0;
    data[num] = cur;
    writeJSON(KEY.cards, data);
    return cur;
  },
  // Явная отметка «выучено» (из режима Чтение) — кладём в коробку 3.
  setKnown(num, known, now) {
    const data = this.all();
    const cur = data[num] || { box: 1, status: 'new', lastSeen: 0 };
    if (known) { cur.status = 'known'; cur.box = 3; }
    else { cur.status = 'learning'; cur.box = Math.min(cur.box, 2); }
    cur.lastSeen = now || cur.lastSeen || 0;
    data[num] = cur;
    writeJSON(KEY.cards, data);
    return cur;
  },
  isKnown(num) { return this.get(num).status === 'known'; },
  knownNumbers() {
    const d = this.all();
    return Object.keys(d).filter((n) => d[n].status === 'known').map(Number);
  },
};

// ── История тестов ─────────────────────────────────────
export const tests = {
  all() { return readJSON(KEY.tests, []); },
  add(entry) {
    const list = this.all();
    list.unshift(entry);
    writeJSON(KEY.tests, list.slice(0, 50));
  },
};

// ── Тема ───────────────────────────────────────────────
export const theme = {
  get() { return lsGet(KEY.theme); },
  set(v) { if (v) lsSet(KEY.theme, v); },
};

// ── Настройки ──────────────────────────────────────────
//   version       → 'brief' | 'ext'  (версия конспекта по умолчанию)
//   verByTicket   → { [num]: 'brief' | 'ext' }  (переопределения по билетам)
export const settings = {
  all() { return readJSON(KEY.settings, {}); },
  get(k, dflt) { const v = this.all()[k]; return v === undefined ? dflt : v; },
  set(k, val) { const s = this.all(); s[k] = val; writeJSON(KEY.settings, s); },
};

// ── Незавершённые сессии (тест / карточки) ─────────────
// Хранит снимок прогресса, чтобы продолжить после ухода в другой режим
// или перезагрузки PWA. null — нет активной сессии.
export const session = {
  getQuiz() { return readJSON(KEY.quizSession, null); },
  setQuiz(v) { if (v) writeJSON(KEY.quizSession, v); else lsRemove(KEY.quizSession); },
  getCards() { return readJSON(KEY.cardSession, null); },
  setCards(v) { if (v) writeJSON(KEY.cardSession, v); else lsRemove(KEY.cardSession); },
};

// ── Сброс всего прогресса ──────────────────────────────
export function resetAll() {
  // Сбрасываем прогресс и незавершённые сессии; настройки (тема/версия) не трогаем.
  lsRemove(KEY.cards);
  lsRemove(KEY.tests);
  lsRemove(KEY.quizSession);
  lsRemove(KEY.cardSession);
}
