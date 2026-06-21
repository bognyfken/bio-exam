// parser.js — разбор konspekt.md в структуру { sections, tickets }.
//
// РЕАЛЬНЫЙ формат файла (отличается от §2 брифа — контент = источник правды):
//   #  …                      → заголовок документа (игнорируем)
//   ## РАЗДЕЛ I. НАЗВАНИЕ      → РАЗДЕЛ (section)
//   ### N. Название           → БИЛЕТ (ticket)
//   **а) Заголовок.** текст…  → подпункт билета (жирный лид-ин в начале строки)
//   🧠 …                       → мнемоника
//   ⚠️ …                       → ловушка
//
// Парсер устойчив к мелким вариациям и не зависит от конкретных билетов.

const RE_TICKET = /^###\s+(\d+)\.\s*(.+?)\s*$/;
const RE_SUBPOINT = /^\*\*\s*([а-яё])\)\s*(.+?)\*\*/u;
const RE_SECTION_PREFIX = /^РАЗДЕЛ\s+[IVXLCDM]+\.\s*/u;

function sentenceCase(str) {
  const lower = str.toLocaleLowerCase('ru');
  return lower.charAt(0).toLocaleUpperCase('ru') + lower.slice(1);
}

// Раздел вида "✅ КОНСПЕКТ ЗАВЕРШЁН…" — служебный, не раздел с билетами.
function isRealSection(name) {
  return !/✅|ЗАВЕРШЁН|ЗАВЕРШЕН/u.test(name);
}

function stripMarkdownInline(s) {
  return s
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

// marked может быть глобалом (UMD) или модулем — берём parse откуда есть.
function getMarked() {
  const m = (typeof window !== 'undefined' && window.marked) || null;
  if (!m) throw new Error('marked не загружен');
  if (typeof m.parse === 'function') return m;
  if (typeof m === 'function') return { parse: m };
  throw new Error('marked: нет parse()');
}

// HTML → чистый текст (для поиска), без зависимости от DOM при рендере.
function htmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || '').replace(/\s+/g, ' ').trim();
}

// Помечаем абзацы-мнемоники и абзацы-ловушки классами после рендера marked.
function decorate(html) {
  return html
    .replace(/<p>(\s*)🧠/g, '<p class="callout callout-mnemo">$1🧠')
    .replace(/<p>(\s*)⚠️?/g, '<p class="callout callout-trap">$1⚠️');
}

/**
 * Разбирает markdown-конспект.
 * @returns {{sections: Array, tickets: Array, byNumber: Map}}
 */
export function parseKonspekt(md) {
  const marked = getMarked();
  const lines = md.split(/\r?\n/);

  const sections = [];
  const tickets = [];
  let curSection = null;
  let curTicket = null;
  let bodyBuf = [];

  const flushTicket = () => {
    if (!curTicket) return;
    const bodyMarkdown = bodyBuf.join('\n').trim();
    const rawHtml = marked.parse(bodyMarkdown);
    curTicket.bodyMarkdown = bodyMarkdown;
    curTicket.bodyHtml = decorate(rawHtml);
    curTicket.plainText = htmlToText(rawHtml);
    tickets.push(curTicket);
    if (curSection) curSection.tickets.push(curTicket);
    curTicket = null;
    bodyBuf = [];
  };

  for (const line of lines) {
    // Раздел: ## …  (но не ### …)
    if (/^##\s+/.test(line) && !/^###\s+/.test(line)) {
      flushTicket();
      const rawName = line.replace(/^##\s+/, '').trim();
      if (isRealSection(rawName)) {
        const display = sentenceCase(rawName.replace(RE_SECTION_PREFIX, '').trim());
        curSection = {
          id: `section-${sections.length + 1}`,
          rawName,
          name: display,
          index: sections.length,
          tickets: [],
        };
        sections.push(curSection);
      } else {
        curSection = null; // служебный H2 — игнор
      }
      continue;
    }

    // Билет: ### N. Название
    const tm = line.match(RE_TICKET);
    if (tm) {
      flushTicket();
      curTicket = {
        id: `ticket-${tm[1]}`,
        number: parseInt(tm[1], 10),
        title: stripMarkdownInline(tm[2].trim()),
        section: curSection ? curSection.name : '',
        sectionId: curSection ? curSection.id : null,
        subpoints: [],
        bodyMarkdown: '',
        bodyHtml: '',
        plainText: '',
      };
      continue;
    }

    // Прочий H3 (например подзаголовок документа) до первого билета — пропускаем
    if (/^###\s+/.test(line) && !curTicket) continue;

    if (curTicket) {
      // Подпункт билета (жирный лид-ин) — собираем как «вопрос», строку оставляем в теле
      const sm = line.match(RE_SUBPOINT);
      if (sm) {
        curTicket.subpoints.push(stripMarkdownInline(`${sm[1]}) ${sm[2]}`));
        // В кратком конспекте подпункты идут подряд без пустых строк — marked
        // склеивает их в один абзац. Вставляем пустую строку перед подпунктом,
        // чтобы каждый стал отдельным абзацем (а), б), в) — с новой строки).
        // Идемпотентно: если строка-разделитель уже есть, ничего не добавляем.
        const prev = bodyBuf[bodyBuf.length - 1];
        if (bodyBuf.length && prev.trim() !== '') bodyBuf.push('');
      }
      bodyBuf.push(line);
    }
  }
  flushTicket();

  // Убираем разделы без билетов (служебные)
  const realSections = sections.filter((s) => s.tickets.length > 0);
  realSections.forEach((s, i) => { s.index = i; });

  const byNumber = new Map(tickets.map((t) => [t.number, t]));
  return { sections: realSections, tickets, byNumber };
}
