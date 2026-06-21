// home.js — стартовый экран: прогресс по разделам, история тестов, сброс.

import { el, clear, fmtDate } from './util.js';
import { cards, tests, resetAll } from './store.js';

function sectionProgress(ctx) {
  return ctx.data.sections.map((s) => {
    const total = s.tickets.length;
    const known = s.tickets.filter((t) => cards.isKnown(t.number)).length;
    return { name: s.name, total, known, pct: total ? Math.round((known / total) * 100) : 0 };
  });
}

export function render(container, ctx) {
  clear(container);
  const totalTickets = ctx.data.tickets.length;
  const knownCount = ctx.data.tickets.filter((t) => cards.isKnown(t.number)).length;
  const learning = ctx.data.tickets.filter((t) => cards.get(t.number).status === 'learning').length;
  const overallPct = totalTickets ? Math.round((knownCount / totalTickets) * 100) : 0;
  const history = tests.all();

  // Герой
  container.appendChild(el('div', { class: 'home-hero' }, [
    el('div', { class: 'emoji', text: '🧬' }),
    el('h1', { text: 'Биология' }),
    el('p', { text: 'Подготовка к экзамену · Лечебное дело / Педиатрия' }),
  ]));

  // Сводка
  container.appendChild(el('div', { class: 'stat-grid' }, [
    stat(overallPct + '%', 'выучено'),
    stat(knownCount + ' / ' + totalTickets, 'билетов'),
    stat(String(learning), 'в процессе'),
  ]));

  // Быстрые действия
  container.appendChild(el('div', { class: 'quick-actions' }, [
    el('button', { class: 'btn', onclick: () => ctx.go('cards'), html:
      '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9h6M8 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Карточки</span>' }),
    el('button', { class: 'btn', onclick: () => ctx.go('quiz'), html:
      '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Пройти тест</span>' }),
  ]));

  // Прогресс по разделам
  container.appendChild(el('h2', { class: 'home-section-h', text: 'Прогресс по разделам' }));
  const progWrap = el('div', { class: 'card' });
  for (const p of sectionProgress(ctx)) {
    progWrap.appendChild(el('div', { class: 'prog-row' }, [
      el('div', { class: 'top' }, [
        el('span', { text: p.name }),
        el('span', { class: 'pct', text: `${p.known}/${p.total}` }),
      ]),
      el('div', { class: 'prog-track' }, [ el('i', { style: `width:${p.pct}%` }) ]),
    ]));
  }
  container.appendChild(progWrap);

  // История тестов
  container.appendChild(el('h2', { class: 'home-section-h', text: 'Последние тесты' }));
  if (!history.length) {
    container.appendChild(el('div', { class: 'card empty', text: 'Пока нет пройденных тестов. Начни в разделе «Тест».' }));
  } else {
    const hist = el('div', { class: 'card' });
    for (const h of history.slice(0, 8)) {
      const pct = Math.round((h.correct / h.total) * 100);
      hist.appendChild(el('div', { class: 'history-item' }, [
        el('div', {}, [
          el('div', { text: h.scopeLabel }),
          el('div', { class: 'h-meta', text: fmtDate(h.date) }),
        ]),
        el('div', { class: 'h-score', style: `color:${pct >= 70 ? 'var(--ok)' : pct >= 40 ? 'var(--mnemo-ink)' : 'var(--err)'}`,
          text: `${h.correct}/${h.total}` }),
      ]));
    }
    container.appendChild(hist);
  }

  // Сброс
  container.appendChild(el('div', { style: 'margin-top:22px;text-align:center' }, [
    el('button', { class: 'btn btn-danger btn-sm', text: 'Сбросить прогресс',
      onclick: () => {
        if (confirm('Сбросить весь прогресс: статусы билетов, коробки Лейтнера и историю тестов? Это необратимо.')) {
          resetAll();
          ctx.onProgressChange();
          render(container, ctx);
        }
      } }),
  ]));
}

function stat(value, label) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'v', text: value }),
    el('div', { class: 'l', text: label }),
  ]);
}
