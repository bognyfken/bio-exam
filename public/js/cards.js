// cards.js — режим «Карточки» (флэшкарты + система Лейтнера, 3 коробки).
// 1 билет = 1 карточка. Лицо: «Билет N. Название» + подпункты. Оборот: тело ответа.

import { el, clear, shuffle } from './util.js';
import { cards as store } from './store.js';

const state = {
  queue: [],      // массив ticket-объектов в порядке показа
  pos: 0,
  flipped: false,
  session: { know: 0, dont: 0 },
  scope: 'all',   // 'all' | section.id | 'ticket:N'
};

// Очередь с учётом Лейтнера: карточки из меньших коробок — чаще/раньше.
function buildQueue(tickets) {
  const weighted = tickets.map((t) => {
    const c = store.get(t.number);
    const box = c.box || 1;
    return { t, box, lastSeen: c.lastSeen || 0 };
  });
  // Сортируем: меньшая коробка раньше; внутри — давно не виденные раньше; +лёгкий шум.
  const shuffled = shuffle(weighted);
  shuffled.sort((a, b) => (a.box - b.box) || (a.lastSeen - b.lastSeen));
  return shuffled.map((w) => w.t);
}

function ticketsForScope(ctx) {
  if (state.scope === 'all') return ctx.data.tickets;
  if (state.scope.startsWith('ticket:')) {
    const n = Number(state.scope.slice(7));
    const t = ctx.data.byNumber.get(n);
    return t ? [t] : [];
  }
  const sec = ctx.data.sections.find((s) => s.id === state.scope);
  return sec ? sec.tickets.slice() : [];
}

function startSession(ctx, container) {
  const pool = ticketsForScope(ctx);
  state.queue = buildQueue(pool);
  state.pos = 0;
  state.flipped = false;
  state.session = { know: 0, dont: 0 };
  renderCard(ctx, container);
}

function renderSetup(ctx, container) {
  clear(container);
  const sel = el('select', { id: 'cardScope' });
  sel.appendChild(el('option', { value: 'all', text: `Все билеты (${ctx.data.tickets.length})` }));
  const og = el('optgroup', { label: 'По разделам' });
  ctx.data.sections.forEach((s) =>
    og.appendChild(el('option', { value: s.id, text: `${s.name} (${s.tickets.length})` })));
  sel.appendChild(og);
  const ogt = el('optgroup', { label: 'Отдельный билет' });
  ctx.data.tickets.forEach((t) =>
    ogt.appendChild(el('option', { value: 'ticket:' + t.number, text: `${t.number}. ${t.title}` })));
  sel.appendChild(ogt);
  sel.value = state.scope;

  container.appendChild(el('div', { class: 'card cards-setup' }, [
    el('h2', { class: 'h-title', text: 'Карточки' }),
    el('p', { class: 'flash-hint', style: 'text-align:left;margin:0 0 6px;padding:0',
      text: 'Переворот — тап по карточке или пробел. «Знаю» поднимает карточку по коробкам Лейтнера, «Не знаю» возвращает в начало.' }),
    el('div', {}, [ el('div', { class: 'field-label', text: 'Набор' }), sel ]),
    el('button', { class: 'btn btn-primary', text: 'Начать',
      onclick: () => { state.scope = sel.value; startSession(ctx, container); } }),
  ]));
}

function renderCard(ctx, container) {
  clear(container);
  if (state.pos >= state.queue.length) return renderDone(ctx, container);

  const t = state.queue[state.pos];
  const remaining = state.queue.length - state.pos;

  const stats = el('div', { class: 'flash-stats' }, [
    el('span', { html: `Осталось <b>${remaining}</b>` }),
    el('span', { html: `Знаю <b>${state.session.know}</b>` }),
    el('span', { html: `Не знаю <b>${state.session.dont}</b>` }),
  ]);

  const front = el('div', { class: 'flash-face flash-front' }, [
    el('div', { class: 'flash-eyebrow', text: `${t.section} · Билет ${t.number}` }),
    el('div', { class: 'flash-q-title', text: t.title }),
    el('ul', { style: 'margin:0;padding-left:20px;color:var(--muted)' },
      t.subpoints.map((s) => el('li', { text: s }))),
    el('div', { class: 'flash-hint', text: 'Нажми, чтобы увидеть ответ' }),
  ]);
  const back = el('div', { class: 'flash-face flash-back' }, [
    el('div', { class: 'flash-eyebrow', text: `Ответ · Билет ${t.number}` }),
    el('div', { class: 'prose', html: t.bodyHtml }),
  ]);
  const card = el('div', { class: 'flashcard' + (state.flipped ? ' flipped' : '') }, [
    el('div', { class: 'flash-inner' }, [front, back]),
  ]);
  card.addEventListener('click', () => { state.flipped = !state.flipped; card.classList.toggle('flipped'); });

  const grade = (result) => {
    store.grade(t.number, result, Date.now());
    state.session[result === 'know' ? 'know' : 'dont']++;
    if (result === 'dont') {
      // вернуть карточку ближе к концу текущей сессии (повторить скоро)
      const reinsertAt = Math.min(state.queue.length, state.pos + 4);
      state.queue.splice(reinsertAt, 0, t);
    }
    state.pos++;
    state.flipped = false;
    ctx.onProgressChange();
    renderCard(ctx, container);
  };

  const actions = el('div', { class: 'flash-actions' }, [
    el('button', { class: 'btn know-no', text: 'Не знаю', onclick: () => grade('dont') }),
    el('button', { class: 'btn know-yes', text: 'Знаю', onclick: () => grade('know') }),
  ]);

  const topbar = el('div', { class: 'read-toolbar' }, [
    el('button', { class: 'btn btn-sm btn-ghost', text: '← Набор', onclick: () => renderSetup(ctx, container) }),
    el('span', { class: 'spacer' }),
    el('button', { class: 'btn btn-sm', text: '🔀 Перемешать',
      onclick: () => { state.queue = shuffle(state.queue.slice(state.pos)); state.pos = 0; state.flipped = false; renderCard(ctx, container); } }),
  ]);

  container.appendChild(el('div', { class: 'flashwrap' }, [topbar, stats, card, actions]));
  bindKeys(card, grade);
}

function renderDone(ctx, container) {
  clear(container);
  container.appendChild(el('div', { class: 'card done-banner' }, [
    el('div', { class: 'big', text: '🎉' }),
    el('h2', { text: 'Набор пройден!' }),
    el('p', { class: 'flash-hint', style: 'position:static',
      text: `Знаю: ${state.session.know} · Не знаю: ${state.session.dont}` }),
    el('div', { class: 'flash-actions', style: 'margin-top:14px' }, [
      el('button', { class: 'btn', text: 'Сменить набор', onclick: () => renderSetup(ctx, container) }),
      el('button', { class: 'btn btn-primary', text: 'Заново', onclick: () => startSession(ctx, container) }),
    ]),
  ]));
}

// Клавиатура: пробел — переворот, ←/→ — не знаю/знаю.
let keyHandler = null;
function bindKeys(card, grade) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); card.click(); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); grade('know'); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); grade('dont'); }
  };
  document.addEventListener('keydown', keyHandler);
}

export function render(container, ctx) {
  // Каждый вход в режим — экран выбора набора (сессии не накапливаем).
  renderSetup(ctx, container);
}

export function unmount() {
  if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
}
