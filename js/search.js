// search.js — мгновенный поиск по title + subpoints + plainText.

import { el, clear, debounce, escapeHtml } from './util.js';

let index = null;

function buildIndex(tickets) {
  return tickets.map((t) => ({
    t,
    hay: (t.title + ' ' + t.subpoints.join(' ') + ' ' + t.plainText).toLowerCase(),
  }));
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

function run(ctx, q, resultsBox, countBox) {
  const query = q.trim().toLowerCase();
  clear(resultsBox);
  if (query.length < 2) { countBox.textContent = 'Введите минимум 2 символа'; return; }

  const hits = [];
  for (const item of index) {
    const inTitle = item.t.title.toLowerCase().includes(query);
    const pos = item.hay.indexOf(query);
    if (pos !== -1) hits.push({ item, inTitle, pos });
  }
  hits.sort((a, b) => (b.inTitle - a.inTitle) || (a.pos - b.pos));

  countBox.textContent = hits.length
    ? `Найдено: ${hits.length}` : 'Ничего не найдено';

  for (const { item } of hits.slice(0, 60)) {
    const t = item.t;
    const titleHtml = highlightTitle(t.title, query);
    resultsBox.appendChild(el('button', {
      class: 'search-result',
      onclick: () => ctx.openTicket(t.number),
    }, [
      el('div', { class: 'sr-section', text: `${t.section} · Билет ${t.number}` }),
      el('div', { class: 'sr-title', html: titleHtml }),
      el('div', { class: 'sr-snippet', html: snippet(t.plainText, query) }),
    ]));
  }
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

  const input = el('input', { type: 'text', placeholder: 'Поиск по билетам…',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
  const countBox = el('div', { class: 'search-count', text: 'Введите запрос — например «цепень», «митоз», «Вирхов»' });
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
  setTimeout(() => input.focus(), 50);
}
