// search.js — мгновенный поиск по title + subpoints + plainText.

import { el, clear, debounce, escapeHtml } from './util.js';

let index = null;

function buildIndex(tickets) {
  return tickets.map((t) => {
    const extText = t.ext ? t.ext.plainText : '';
    const extSub = t.ext ? t.ext.subpoints.join(' ') : '';
    const hay = [
      `билет ${t.number}`, `билет №${t.number}`, `№${t.number}`,
      t.section, t.title, t.subpoints.join(' '), t.plainText, extSub, extText,
    ].join(' ').toLowerCase();
    return { t, hay };
  });
}

function snippet(plain, q) {
  const i = plain.toLowerCase().indexOf(q);
  if (i === -1) return escapeHtml(plain.slice(0, 140)) + '…';
  const start = Math.max(0, i - 50);
  const seg = plain.slice(start, i + q.length + 90);
  const rel = i - start;
  return (start > 0 ? '…' : '') +
    escapeHtml(seg.slice(0, rel)) +
    '<mark>' + escapeHtml(seg.slice(rel, rel + q.length)) + '</mark>' +
    escapeHtml(seg.slice(rel + q.length)) + '…';
}

function resultCard(ctx, t, titleHtml, snipHtml) {
  return el('button', { class: 'search-result', onclick: () => ctx.openTicket(t.number) }, [
    el('div', { class: 'sr-section', text: `${t.section} · Билет ${t.number}` }),
    el('div', { class: 'sr-title', html: titleHtml }),
    el('div', { class: 'sr-snippet', html: snipHtml }),
  ]);
}

function run(ctx, q, resultsBox, countBox) {
  const query = q.trim().toLowerCase();
  clear(resultsBox);
  // Чисто числовой запрос ищем как номер билета — разрешаем даже 1 символ.
  const numQuery = /^\d+$/.test(query) ? Number(query) : null;

  // Пустой/короткий запрос — показываем все билеты (по умолчанию, как в глоссарии).
  if (query.length < 2 && numQuery === null) {
    countBox.innerHTML = `<b>${ctx.data.tickets.length}</b> билетов`;
    for (const t of ctx.data.tickets) {
      resultsBox.appendChild(resultCard(ctx, t, escapeHtml(t.title), numSnippet(t)));
    }
    return;
  }

  const hits = [];
  for (const item of index) {
    const exactNum = numQuery !== null && item.t.number === numQuery;
    const inTitle = item.t.title.toLowerCase().includes(query);
    const pos = item.hay.indexOf(query);
    if (exactNum || pos !== -1) hits.push({ item, exactNum, inTitle, pos: pos === -1 ? 1e9 : pos });
  }
  // Точное совпадение по номеру → выше; затем совпадение в заголовке; затем ближе к началу.
  hits.sort((a, b) => (b.exactNum - a.exactNum) || (b.inTitle - a.inTitle) || (a.pos - b.pos));

  countBox.textContent = hits.length ? `Найдено: ${hits.length}` : 'Ничего не найдено';

  for (const { item, exactNum } of hits.slice(0, 60)) {
    const t = item.t;
    const titleHtml = exactNum ? escapeHtml(t.title) : highlightTitle(t.title, query);
    const snip = exactNum ? numSnippet(t) : snippet(t.plainText, query);
    resultsBox.appendChild(resultCard(ctx, t, titleHtml, snip));
  }
}

// Сниппет для точного совпадения по номеру билета (запрос не встречается в тексте).
function numSnippet(t) {
  if (t.subpoints[0]) return escapeHtml(t.subpoints.join(' · ').slice(0, 150));
  return escapeHtml(t.plainText.slice(0, 140)) + '…';
}

function highlightTitle(title, q) {
  const i = title.toLowerCase().indexOf(q);
  if (i === -1) return escapeHtml(title);
  return escapeHtml(title.slice(0, i)) + '<mark>' +
    escapeHtml(title.slice(i, i + q.length)) + '</mark>' +
    escapeHtml(title.slice(i + q.length));
}

export function render(container, ctx) {
  if (!index) index = buildIndex(ctx.data.tickets);
  clear(container);

  const input = el('input', { type: 'search', placeholder: 'Поиск по билетам или номер (45)…',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const countBox = el('div', { class: 'search-count' });
  const resultsBox = el('div', { class: 'search-results' });

  const onInput = debounce(() => run(ctx, input.value, resultsBox, countBox), 150);
  input.addEventListener('input', onInput);

  container.appendChild(el('div', { class: 'search-box' }, [
    el('div', { class: 'search-input-wrap' }, [
      el('span', { html: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }),
      input,
    ]),
  ]));
  container.appendChild(countBox);
  container.appendChild(resultsBox);
  // По умолчанию показываем все билеты (как глоссарий), фильтруем по вводу.
  run(ctx, '', resultsBox, countBox);
}
