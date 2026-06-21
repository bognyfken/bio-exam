// app.js — точка входа: загрузка контента, парсинг, роутер, навигация, тема.

import { parseKonspekt } from './parser.js';
import { el, clear } from './util.js';
import { theme as themeStore, cards } from './store.js';
import * as Home from './home.js';
import * as Reading from './reading.js';
import * as Cards from './cards.js';
import * as Quiz from './quiz.js';
import * as Search from './search.js';

const views = {
  home: document.getElementById('view-home'),
  read: document.getElementById('view-read'),
  cards: document.getElementById('view-cards'),
  quiz: document.getElementById('view-quiz'),
  search: document.getElementById('view-search'),
};
const MODE_TITLES = { home: 'Биология', read: 'Чтение', cards: 'Карточки', quiz: 'Тест', search: 'Поиск' };

let ctx = null;
let currentMode = null;

// ── Тема ───────────────────────────────────────────────
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
function currentEffectiveTheme() {
  const set = document.documentElement.getAttribute('data-theme');
  if (set) return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function initTheme() {
  applyTheme(themeStore.get());
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = currentEffectiveTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next); themeStore.set(next);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content',
      next === 'dark' ? '#1a2023' : '#2e7d4f');
  });
}

// ── Drawer ─────────────────────────────────────────────
const drawer = document.getElementById('drawer');
const scrim = document.getElementById('drawerScrim');
function openDrawer() { drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false'); scrim.hidden = false;
  document.getElementById('navToggle').setAttribute('aria-expanded', 'true'); }
function closeDrawer() { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); scrim.hidden = true;
  document.getElementById('navToggle').setAttribute('aria-expanded', 'false'); }

function buildNav(mode) {
  const list = document.getElementById('drawerList');
  clear(list);
  if (mode === 'number') {
    let curSection = null;
    for (const t of ctx.data.tickets) {
      if (t.section !== curSection) { curSection = t.section; list.appendChild(el('div', { class: 'nav-sep', text: curSection })); }
      list.appendChild(navItem(t));
    }
  } else {
    for (const s of ctx.data.sections) {
      const group = el('div', { class: 'nav-group' });
      const head = el('button', { class: 'nav-group-head' }, [
        el('span', { text: s.name }),
        el('span', { class: 'chev', html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' }),
      ]);
      head.addEventListener('click', () => group.classList.toggle('collapsed'));
      group.appendChild(head);
      s.tickets.forEach((t) => group.appendChild(navItem(t)));
      list.appendChild(group);
    }
  }
}
function navItem(t) {
  const known = cards.isKnown(t.number);
  return el('button', { class: 'nav-item' + (known ? ' known' : ''), dataset: { num: String(t.number) },
    onclick: () => { ctx.openTicket(t.number); closeDrawer(); } }, [
    el('span', { class: 'num', text: String(t.number) }),
    el('span', { class: 'label', text: t.title }),
    el('span', { class: 'known-dot' }),
  ]);
}
function initNavTabs() {
  const bySec = document.getElementById('navBySection');
  const byNum = document.getElementById('navByNumber');
  bySec.addEventListener('click', () => { bySec.classList.add('is-active'); byNum.classList.remove('is-active');
    bySec.setAttribute('aria-selected', 'true'); byNum.setAttribute('aria-selected', 'false'); buildNav('section'); });
  byNum.addEventListener('click', () => { byNum.classList.add('is-active'); bySec.classList.remove('is-active');
    byNum.setAttribute('aria-selected', 'true'); bySec.setAttribute('aria-selected', 'false'); buildNav('number'); });
}

// ── Роутер ─────────────────────────────────────────────
function go(mode) {
  if (!views[mode]) mode = 'home';
  if (currentMode === 'cards' && mode !== 'cards') Cards.unmount?.();
  currentMode = mode;

  Object.entries(views).forEach(([m, node]) => { node.hidden = m !== mode; });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.mode === mode));
  document.getElementById('topbarTitle').textContent = MODE_TITLES[mode];

  const container = views[mode];
  if (mode === 'home') Home.render(container, ctx);
  else if (mode === 'read') Reading.render(container, ctx);
  else if (mode === 'cards') Cards.render(container, ctx);
  else if (mode === 'quiz') Quiz.render(container, ctx);
  else if (mode === 'search') Search.render(container, ctx);

  window.scrollTo({ top: 0 });
}

function openTicket(num) {
  go('read');
  // reading рендерится синхронно; ждём кадр для скролла
  requestAnimationFrame(() => Reading.openTicket(views.read, num));
}

function onProgressChange() {
  // Обновить отметки «выучено» в Чтении и точки в навигации
  Reading.refreshKnown(views.read);
  document.querySelectorAll('#drawerList .nav-item').forEach((node) => {
    const n = Number(node.dataset.num);
    node.classList.toggle('known', cards.isKnown(n));
  });
}

// ── Загрузка контента ──────────────────────────────────
async function loadContent() {
  const [mdRes, quizRes] = await Promise.allSettled([
    fetch('content/konspekt.md').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    fetch('content/quiz.json').then((r) => (r.ok ? r.json() : [])),
  ]);
  if (mdRes.status !== 'fulfilled') throw new Error('Не удалось загрузить конспект: ' + mdRes.reason);
  const data = parseKonspekt(mdRes.value);
  const quiz = (quizRes.status === 'fulfilled' && Array.isArray(quizRes.value)) ? quizRes.value : [];
  return { data, quiz };
}

async function main() {
  initTheme();
  initNavTabs();
  document.getElementById('navToggle').addEventListener('click', () => drawer.classList.contains('is-open') ? closeDrawer() : openDrawer());
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  try {
    const { data, quiz } = await loadContent();
    ctx = { data, quiz, go, openTicket, openDrawer, onProgressChange };

    document.getElementById('loading').remove();
    buildNav('section');

    document.querySelectorAll('.tab').forEach((tab) =>
      tab.addEventListener('click', () => go(tab.dataset.mode)));

    // Стартовый режим: по hash (#ticket-N) или Главная
    const m = location.hash.match(/^#ticket-(\d+)$/);
    if (m) openTicket(Number(m[1]));
    else go('home');
  } catch (err) {
    const loading = document.getElementById('loading');
    if (loading) loading.innerHTML = `<p style="color:var(--err)">Ошибка загрузки: ${err.message}</p>
      <p style="color:var(--muted);font-size:.85rem">Открой сайт через сервер (wrangler / serve), а не как файл — fetch не работает по file://.</p>`;
    console.error(err);
  }
}

main();
