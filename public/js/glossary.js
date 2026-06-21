// glossary.js — режим «Глоссарий»: термины с определениями из content/glossary.md.
// Поиск (термин + определение), фильтр по разделу и по «★ методичке»,
// группировка по первой букве, цветовая метка раздела. Состояние фильтров
// сохраняется в памяти на время сессии (вернулся в режим — фильтр на месте).

import { el, clear, debounce, escapeHtml } from './util.js';

// Палитра разделов (легибельна в светлой и тёмной теме). По порядку I…VII.
const SECTION_COLORS = ['#2A7D6F', '#7A5BA6', '#C2783A', '#3E7CB1', '#5E8C4E', '#3FA6A0', '#B0506B'];
const RE_GSECTION = /^##\s+Раздел\s+([IVXLC]+)\.\s*(.+?)\s*$/u;
const RU = ['А','Б','В','Г','Д','Е','Ж','З','И','К','Л','М','Н','О','П','Р','С','Т','У','Ф','Х','Ц','Ч','Ш','Щ','Э','Ю','Я'];

const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е');
const firstLetter = (t) => {
  const c = t.replace(/[«"*]/g, '').charAt(0).toUpperCase();
  return c === 'Ё' ? 'Е' : c;
};

// ── Парсер glossary.md (## Раздел …  +  markdown-таблицы) ──
export function parseGlossary(md) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  const terms = [];
  let cur = null;

  for (const line of lines) {
    const sm = line.match(RE_GSECTION);
    if (sm) {
      const idx = sections.length;
      // имя без хвостового «(123)»
      const name = sm[2].replace(/\s*\(\d+\)\s*$/, '').trim();
      cur = { id: `gsec-${idx + 1}`, roman: sm[1], name, color: SECTION_COLORS[idx % SECTION_COLORS.length], index: idx };
      sections.push(cur);
      continue;
    }
    if (!cur || !/^\|/.test(line)) continue;

    const cells = line.split('|');
    if (cells.length < 4) continue;
    const rawTerm = cells[1].trim();
    const def = cells.slice(2, cells.length - 1).join('|').trim();
    if (!rawTerm || !def) continue;
    if (/^термин$/i.test(rawTerm) || /^[-\s:]+$/.test(rawTerm)) continue; // шапка/разделитель

    const star = /★/.test(rawTerm);
    const term = rawTerm.replace(/★/g, '').replace(/\*\*/g, '').trim();
    terms.push({ term, def, star, section: cur, plain: norm(`${term} ${def}`) });
  }
  return { sections, terms };
}

// ── Состояние режима ───────────────────────────────────
const state = { activeSection: 'all', onlyMeth: false, query: '' };

function defHtml(s) {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>');
}

function highlightTerm(term, q) {
  const nq = norm(q);
  if (nq.length < 2) return escapeHtml(term);
  const idx = norm(term).indexOf(nq);
  if (idx < 0) return escapeHtml(term);
  return escapeHtml(term.slice(0, idx)) +
    '<mark>' + escapeHtml(term.slice(idx, idx + nq.length)) + '</mark>' +
    escapeHtml(term.slice(idx + nq.length));
}

function filtered(gloss) {
  const nq = norm(state.query.trim());
  return gloss.terms.filter((e) => {
    if (state.activeSection !== 'all' && e.section.id !== state.activeSection) return false;
    if (state.onlyMeth && !e.star) return false;
    if (nq) return e.plain.includes(nq);
    return true;
  });
}

export function render(container, ctx) {
  clear(container);
  const gloss = ctx.glossary;

  if (!gloss || !gloss.terms.length) {
    container.appendChild(el('div', { class: 'card empty' }, [
      el('h2', { class: 'h-title', text: 'Глоссарий' }),
      el('p', { text: 'Глоссарий ещё не загружен (content/glossary.md пуст или недоступен).' }),
    ]));
    return;
  }

  // Поиск
  const input = el('input', { type: 'search', placeholder: 'Поиск термина или определения…',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: state.query });
  const countBox = el('div', { class: 'search-count' });
  const pills = el('div', { class: 'g-pills' });
  const alpha = el('nav', { class: 'g-alpha', 'aria-label': 'Алфавитный указатель' });
  const list = el('div', { class: 'g-list' });

  const rerender = () => paint(gloss, list, alpha, countBox, pills);

  input.addEventListener('input', debounce(() => { state.query = input.value; rerender(); }, 150));

  container.appendChild(el('div', { class: 'g-controls' }, [
    el('div', { class: 'search-box', style: 'position:static;padding:0' }, [
      el('div', { class: 'search-input-wrap' }, [
        el('span', { html: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }),
        input,
      ]),
    ]),
    countBox,
    pills,
    alpha,
  ]));
  container.appendChild(list);

  buildPills(gloss, pills, rerender);
  paint(gloss, list, alpha, countBox, pills);
}

function buildPills(gloss, pills, rerender) {
  clear(pills);
  const counts = {};
  gloss.terms.forEach((e) => { counts[e.section.id] = (counts[e.section.id] || 0) + 1; });
  const methN = gloss.terms.filter((e) => e.star).length;

  const mk = (cls, pressed, children, onclick) => {
    const b = el('button', { class: 'g-pill' + cls, 'aria-pressed': String(pressed), onclick }, children);
    return b;
  };

  pills.appendChild(mk('', state.activeSection === 'all' && !state.onlyMeth,
    [el('span', { text: 'Все' }), el('span', { class: 'g-num', text: String(gloss.terms.length) })],
    () => { state.activeSection = 'all'; state.onlyMeth = false; rerender(); }));

  gloss.sections.forEach((s) => {
    pills.appendChild(mk(state.activeSection === s.id ? ' is-active' : '', state.activeSection === s.id, [
      el('span', { class: 'g-swatch', style: `background:${s.color}` }),
      el('span', { class: 'g-num', text: s.roman }),
      el('span', { text: s.name }),
      el('span', { class: 'g-num', text: String(counts[s.id] || 0) }),
    ], () => { state.activeSection = state.activeSection === s.id ? 'all' : s.id; rerender(); }));
  });

  pills.appendChild(mk(' g-pill-meth' + (state.onlyMeth ? ' is-active' : ''), state.onlyMeth,
    [el('span', { text: '★ Методичка' }), el('span', { class: 'g-num', text: String(methN) })],
    () => { state.onlyMeth = !state.onlyMeth; rerender(); }));
}

function paint(gloss, list, alpha, countBox, pills) {
  const items = filtered(gloss).slice()
    .sort((a, b) => a.term.replace(/[«"*]/g, '').localeCompare(b.term.replace(/[«"*]/g, ''), 'ru'));

  // группировка по первой букве
  const groups = {}; const order = [];
  items.forEach((e) => { const L = firstLetter(e.term); if (!groups[L]) { groups[L] = []; order.push(L); } groups[L].push(e); });

  clear(list);
  if (!items.length) {
    list.appendChild(el('div', { class: 'card empty' }, [
      el('div', { html: '<b>Ничего не найдено.</b>' }),
      el('div', { style: 'color:var(--muted);margin-top:4px', text: 'Другое слово или сбросьте фильтр раздела.' }),
    ]));
  }

  order.forEach((L) => {
    const block = el('div', { class: 'g-letterblock' });
    block.appendChild(el('h2', { class: 'g-letter', id: 'gL-' + L },
      [el('span', { text: L }), el('span', { class: 'g-lc', text: String(groups[L].length) })]));
    groups[L].forEach((e) => {
      block.appendChild(el('article', { class: 'g-card', style: `--cc:${e.section.color}` }, [
        el('div', { class: 'g-head' }, [
          el('h3', { class: 'g-term', html: highlightTerm(e.term, state.query) }),
          el('div', { class: 'g-tags' }, [
            e.star ? el('span', { class: 'g-star', text: '★ методичка' }) : null,
            el('span', { class: 'g-tag', text: `${e.section.roman} · ${e.section.name}` }),
          ]),
        ]),
        el('p', { class: 'g-def', html: defHtml(e.def) }),
      ]));
    });
    list.appendChild(block);
  });

  // счётчик
  countBox.innerHTML = items.length === gloss.terms.length
    ? `<b>${gloss.terms.length}</b> терминов`
    : `Показано <b>${items.length}</b> из ${gloss.terms.length}`;

  // алфавит
  const present = new Set(order);
  clear(alpha);
  RU.forEach((L) => {
    if (present.has(L)) alpha.appendChild(el('a', { href: '#gL-' + L, text: L,
      onclick: (ev) => { ev.preventDefault(); document.getElementById('gL-' + L)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }));
    else alpha.appendChild(el('span', { class: 'g-empty', text: L }));
  });

  buildPills(gloss, pills, () => paint(gloss, list, alpha, countBox, pills));
}
