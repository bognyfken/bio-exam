// reading.js — режим «Чтение»: билеты, сгруппированные по разделам,
// сворачиваемые, с блоком вопроса (подпункты), плашками и якорями.

import { el, escapeHtml, clear } from './util.js';
import { cards } from './store.js';

let rendered = false;

function ticketNode(t, ctx) {
  const known = cards.isKnown(t.number);

  const knownBtn = el('button', {
    class: 'ticket-known-btn' + (known ? ' is-known' : ''),
    'aria-pressed': String(known),
    text: known ? '✓ Выучено' : 'Выучить',
    onclick: (e) => {
      e.stopPropagation();
      const nowKnown = !knownBtn.classList.contains('is-known');
      cards.setKnown(t.number, nowKnown, Date.now());
      knownBtn.classList.toggle('is-known', nowKnown);
      knownBtn.textContent = nowKnown ? '✓ Выучено' : 'Выучить';
      knownBtn.setAttribute('aria-pressed', String(nowKnown));
      ctx.onProgressChange();
    },
  });

  const chev = el('span', { class: 'ticket-chev', html:
    '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' });

  const head = el('div', { class: 'ticket-head' }, [
    el('span', { class: 'ticket-num', text: String(t.number) }),
    el('div', { class: 'ticket-titlewrap' }, [
      el('div', { class: 'ticket-title', text: t.title }),
      el('div', { class: 'ticket-sub', text: t.section }),
    ]),
    knownBtn,
    chev,
  ]);

  // Блок вопроса из подпунктов
  const bodyChildren = [];
  if (t.subpoints.length) {
    const ul = el('ul', {}, t.subpoints.map((s) => el('li', { text: s })));
    bodyChildren.push(el('div', { class: 'ticket-question' }, [ul]));
  }
  bodyChildren.push(el('div', { class: 'prose', html: t.bodyHtml }));

  const body = el('div', { class: 'ticket-body' }, bodyChildren);

  const node = el('article', { class: 'ticket', id: t.id }, [head, body]);
  head.addEventListener('click', () => node.classList.toggle('open'));
  return node;
}

export function render(container, ctx) {
  if (rendered) return; // строим один раз; статусы обновляем точечно
  clear(container);

  const toolbar = el('div', { class: 'read-toolbar' }, [
    el('button', { class: 'btn btn-sm', text: 'Развернуть всё',
      onclick: () => container.querySelectorAll('.ticket').forEach((n) => n.classList.add('open')) }),
    el('button', { class: 'btn btn-sm', text: 'Свернуть всё',
      onclick: () => container.querySelectorAll('.ticket').forEach((n) => n.classList.remove('open')) }),
    el('span', { class: 'spacer' }),
    el('button', { class: 'icon-btn', 'aria-label': 'К списку билетов', html:
      '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      onclick: () => ctx.openDrawer() }),
  ]);
  container.appendChild(toolbar);

  for (const section of ctx.data.sections) {
    container.appendChild(el('h2', { class: 'read-section-label', text: section.name }));
    for (const t of section.tickets) container.appendChild(ticketNode(t, ctx));
  }
  rendered = true;
}

// Обновить кнопки «Выучено» (после смены статусов в карточках/сбросе).
export function refreshKnown(container) {
  container.querySelectorAll('.ticket').forEach((node) => {
    const num = Number(node.id.replace('ticket-', ''));
    const btn = node.querySelector('.ticket-known-btn');
    if (!btn) return;
    const known = cards.isKnown(num);
    btn.classList.toggle('is-known', known);
    btn.textContent = known ? '✓ Выучено' : 'Выучить';
    btn.setAttribute('aria-pressed', String(known));
  });
}

export function openTicket(container, num) {
  const node = container.querySelector('#ticket-' + num);
  if (!node) return;
  node.classList.add('open');
  requestAnimationFrame(() => node.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  node.classList.add('flash-target');
  setTimeout(() => node.classList.remove('flash-target'), 1200);
}

export function resetRenderFlag() { rendered = false; }
