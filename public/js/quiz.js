// quiz.js — режим «Тест» (MCQ из content/quiz.json).

import { el, clear, shuffle } from './util.js';
import { tests } from './store.js';

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

const state = {
  scope: 'all',
  count: 10,
  questions: [],
  pos: 0,
  answers: [],   // { q, picked, correct }
  scopeLabel: 'Все разделы',
};

function poolForScope(ctx) {
  const all = ctx.quiz || [];
  if (state.scope === 'all') return all;
  if (state.scope.startsWith('ticket:')) {
    const n = Number(state.scope.slice(7));
    return all.filter((q) => q.ticket === n);
  }
  const sec = ctx.data.sections.find((s) => s.id === state.scope);
  if (!sec) return [];
  const names = new Set(sec.tickets.map((t) => t.number));
  return all.filter((q) => names.has(q.ticket));
}

function renderSetup(ctx, container) {
  clear(container);

  if (!ctx.quiz || !ctx.quiz.length) {
    container.appendChild(el('div', { class: 'card empty' }, [
      el('h2', { class: 'h-title', text: 'Тесты' }),
      el('p', { text: 'Банк вопросов ещё не загружен (content/quiz.json пуст или недоступен). Тесты появятся после генерации вопросов.' }),
    ]));
    return;
  }

  // Scope select (только разделы/билеты, для которых есть вопросы)
  const counts = new Map();
  ctx.quiz.forEach((q) => counts.set(q.ticket, (counts.get(q.ticket) || 0) + 1));

  const sel = el('select', { id: 'quizScope' });
  sel.appendChild(el('option', { value: 'all', text: `Все разделы (${ctx.quiz.length} вопросов)` }));
  const og = el('optgroup', { label: 'По разделам' });
  ctx.data.sections.forEach((s) => {
    const n = s.tickets.reduce((acc, t) => acc + (counts.get(t.number) || 0), 0);
    if (n > 0) og.appendChild(el('option', { value: s.id, text: `${s.name} (${n})` }));
  });
  sel.appendChild(og);
  const ogt = el('optgroup', { label: 'Отдельный билет' });
  ctx.data.tickets.forEach((t) => {
    const n = counts.get(t.number) || 0;
    if (n > 0) ogt.appendChild(el('option', { value: 'ticket:' + t.number, text: `${t.number}. ${t.title} (${n})` }));
  });
  sel.appendChild(ogt);
  sel.value = state.scope;

  // Count chips
  const chips = el('div', { class: 'chips' });
  [['10', 10], ['20', 20], ['Все', 'all']].forEach(([label, val]) => {
    const c = el('button', { class: 'chip' + (state.count === val ? ' is-active' : ''), text: label,
      onclick: () => { state.count = val; chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('is-active')); c.classList.add('is-active'); } });
    chips.appendChild(c);
  });

  container.appendChild(el('div', { class: 'card quiz-setup' }, [
    el('h2', { class: 'h-title', text: 'Тест' }),
    el('div', {}, [ el('div', { class: 'field-label', text: 'Область' }), sel ]),
    el('div', {}, [ el('div', { class: 'field-label', text: 'Сколько вопросов' }), chips ]),
    el('button', { class: 'btn btn-primary', text: 'Начать тест', onclick: () => {
      state.scope = sel.value;
      state.scopeLabel = sel.options[sel.selectedIndex].text.replace(/\s*\(\d+.*\)$/, '');
      start(ctx, container);
    } }),
  ]));
}

function start(ctx, container) {
  let pool = shuffle(poolForScope(ctx));
  if (state.count !== 'all') pool = pool.slice(0, state.count);
  state.questions = pool;
  state.pos = 0;
  state.answers = [];
  if (!pool.length) { renderSetup(ctx, container); return; }
  renderQuestion(ctx, container);
}

function renderQuestion(ctx, container) {
  clear(container);
  const q = state.questions[state.pos];
  const total = state.questions.length;

  // варианты перемешиваем, запоминая позицию правильного
  const opts = q.options.map((text, i) => ({ text, correct: i === q.answer }));
  const shuffledOpts = shuffle(opts);

  const progress = el('div', { class: 'q-progress' }, [ el('i', { style: `width:${(state.pos / total) * 100}%` }) ]);
  const meta = el('div', { class: 'q-meta' }, [
    el('span', { text: `Вопрос ${state.pos + 1} из ${total}` }),
    el('span', { class: 'q-meta-sec', text: `${q.section} · Билет ${q.ticket}` }),
  ]);

  const optionsBox = el('div', { class: 'q-options' });
  const explainBox = el('div', { class: 'q-explain', hidden: true });
  const foot = el('div', { class: 'quiz-foot' });

  let answered = false;
  shuffledOpts.forEach((o, i) => {
    const btn = el('button', { class: 'q-option' }, [
      el('span', { class: 'opt-letter', text: LETTERS[i] }),
      el('span', { text: o.text }),
    ]);
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      optionsBox.querySelectorAll('.q-option').forEach((b, bi) => {
        b.disabled = true;
        if (shuffledOpts[bi].correct) b.classList.add('correct');
      });
      if (!o.correct) btn.classList.add('wrong');

      state.answers.push({ q, picked: o.text, correct: o.correct });

      explainBox.hidden = false;
      explainBox.innerHTML = `<b>${o.correct ? '✓ Верно.' : '✗ Неверно.'}</b> ${q.explain || ''}`;

      const isLast = state.pos === total - 1;
      foot.appendChild(el('button', { class: 'btn btn-primary', text: isLast ? 'Показать результат' : 'Дальше →',
        onclick: () => { state.pos++; isLast ? renderResult(ctx, container) : renderQuestion(ctx, container); } }));
    });
    optionsBox.appendChild(btn);
  });

  container.appendChild(el('div', { class: 'card' }, [
    progress, meta,
    el('div', { class: 'q-question', text: q.question }),
    optionsBox, explainBox, foot,
  ]));
}

function renderResult(ctx, container) {
  clear(container);
  const total = state.answers.length;
  const correct = state.answers.filter((a) => a.correct).length;
  const pct = total ? Math.round((correct / total) * 100) : 0;

  // по разделам
  const bySec = {};
  state.answers.forEach((a) => {
    const s = a.q.section || '—';
    bySec[s] = bySec[s] || { c: 0, t: 0 };
    bySec[s].t++; if (a.correct) bySec[s].c++;
  });

  tests.add({ date: Date.now(), scopeLabel: state.scopeLabel, correct, total,
    bySection: Object.fromEntries(Object.entries(bySec).map(([k, v]) => [k, v.c + '/' + v.t])) });
  ctx.onProgressChange();

  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : pct >= 40 ? '🙂' : '📚';

  const bars = el('div', { class: 'result-bars' });
  Object.entries(bySec).forEach(([name, v]) => {
    const p = Math.round((v.c / v.t) * 100);
    bars.appendChild(el('div', { class: 'rb-row' }, [
      el('span', { text: name }), el('span', { text: `${v.c}/${v.t}` }),
      el('div', { class: 'rb-track' }, [ el('i', { style: `width:${p}%` }) ]),
    ]));
  });

  const mistakes = state.answers.filter((a) => !a.correct);
  const mistakesBox = el('div', {});
  if (mistakes.length) {
    mistakesBox.appendChild(el('h2', { class: 'home-section-h', text: 'Разбор ошибок' }));
    mistakes.forEach((a) => {
      const m = el('div', { class: 'mistake' }, [
        el('div', { html: `<b>${a.q.question}</b>` }),
        el('div', { style: 'color:var(--err);font-size:.85rem;margin-top:3px', text: `Ваш ответ: ${a.picked}` }),
        el('div', { style: 'color:var(--ok);font-size:.85rem', text: `Верно: ${a.q.options[a.q.answer]}` }),
      ]);
      const link = el('a', { href: '#ticket-' + a.q.ticket, text: `→ Билет ${a.q.ticket} в Чтении`,
        style: 'font-size:.83rem;display:inline-block;margin-top:5px',
        onclick: (e) => { e.preventDefault(); ctx.openTicket(a.q.ticket); } });
      m.appendChild(link);
      mistakesBox.appendChild(m);
    });
  }

  container.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'result-score' }, [
      el('div', { style: 'font-size:2.6rem', text: emoji }),
      el('div', { class: 'num', text: `${correct} / ${total}` }),
      el('div', { style: 'color:var(--muted)', text: `${pct}% правильных` }),
    ]),
    bars,
    el('div', { class: 'flash-actions', style: 'margin-top:16px' }, [
      el('button', { class: 'btn', text: 'Новый тест', onclick: () => renderSetup(ctx, container) }),
      el('button', { class: 'btn btn-primary', text: 'Повторить', onclick: () => start(ctx, container) }),
    ]),
  ]));
  if (mistakes.length) container.appendChild(mistakesBox);
}

export function render(container, ctx) {
  renderSetup(ctx, container);
}
