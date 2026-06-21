// app.js — точка входа: загрузка контента, парсинг, роутер, навигация, тема.

import { parseKonspekt } from './parser.js';
import { el, clear } from './util.js';
import { theme as themeStore, cards } from './store.js';
import { defaultVersion, setDefaultVersion } from './version.js';
import * as Home from './home.js';
import * as Reading from './reading.js';
import * as Cards from './cards.js';
import * as Quiz from './quiz.js';
import * as Search from './search.js';
import * as Glossary from './glossary.js';
import { parseGlossary } from './glossary.js';

const views = {
  home: document.getElementById('view-home'),
  read: document.getElementById('view-read'),
  cards: document.getElementById('view-cards'),
  quiz: document.getElementById('view-quiz'),
  search: document.getElementById('view-search'),
  gloss: document.getElementById('view-gloss'),
};
const MODE_TITLES = { home: 'Биология', read: 'Чтение', cards: 'Карточки', quiz: 'Тест', search: 'Поиск', gloss: 'Глоссарий' };

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

// ── Настройки (шестерёнка) ─────────────────────────────
function openSettings() {
  const scrimEl = el('div', { class: 'modal-scrim' });
  const sheet = el('div', { class: 'modal-sheet', role: 'dialog', 'aria-label': 'Настройки' });
  const close = () => scrimEl.remove();

  sheet.appendChild(el('div', { class: 'modal-head' }, [
    el('h2', { text: 'Настройки' }),
    el('button', { class: 'icon-btn', 'aria-label': 'Закрыть', html:
      '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      onclick: close }),
  ]));

  // Версия конспекта по умолчанию (только если есть расширенная)
  if (ctx?.data?.hasExt) {
    const seg = el('div', { class: 'seg' });
    const mk = (val, label) => {
      const b = el('button', { class: 'seg-btn' + (defaultVersion() === val ? ' is-active' : ''), text: label,
        onclick: () => {
          setDefaultVersion(val);
          seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('is-active'));
          b.classList.add('is-active');
          // «Чтение» строится один раз — сбрасываем флаг, чтобы билеты без своего
          // переопределения подхватили новую версию по умолчанию при следующем входе.
          Reading.resetRenderFlag();
          if (currentMode === 'read') go('read');
        } });
      return b;
    };
    seg.appendChild(mk('brief', 'Краткая'));
    seg.appendChild(mk('ext', 'Расширенная'));
    sheet.appendChild(el('div', { class: 'modal-field' }, [
      el('div', { class: 'field-label', text: 'Версия конспекта по умолчанию' }),
      seg,
      el('p', { class: 'modal-hint', text: 'Краткая — для повторения, расширенная — чтобы разобраться. Любой билет можно переключить отдельно прямо в «Чтении».' }),
    ]));
  }

  scrimEl.appendChild(sheet);
  scrimEl.addEventListener('click', (e) => { if (e.target === scrimEl) close(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  document.body.appendChild(scrimEl);
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
      // Изначально все разделы свёрнуты — раскрываются тапом по заголовку.
      const group = el('div', { class: 'nav-group collapsed' });
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
  else if (mode === 'gloss') Glossary.render(container, ctx);

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
  const [mdRes, extRes, quizRes, glossRes] = await Promise.allSettled([
    fetch('content/konspekt.md').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    fetch('content/konspekt-ext.md').then((r) => (r.ok ? r.text() : null)),
    fetch('content/quiz.json').then((r) => (r.ok ? r.json() : [])),
    fetch('content/glossary.md').then((r) => (r.ok ? r.text() : null)),
  ]);
  if (mdRes.status !== 'fulfilled') throw new Error('Не удалось загрузить конспект: ' + mdRes.reason);
  const data = parseKonspekt(mdRes.value);

  // Расширенная версия — опциональна. Прикрепляем к билетам по номеру (t.ext).
  data.hasExt = false;
  if (extRes.status === 'fulfilled' && extRes.value) {
    try {
      const ext = parseKonspekt(extRes.value);
      data.tickets.forEach((t) => {
        const e = ext.byNumber.get(t.number);
        if (e) {
          t.ext = {
            title: e.title, subpoints: e.subpoints, bodyHtml: e.bodyHtml,
            bodyMarkdown: e.bodyMarkdown, plainText: e.plainText,
          };
          data.hasExt = true;
        }
      });
    } catch (e) { console.warn('Расширенный конспект не разобран:', e); }
  }

  const quiz = (quizRes.status === 'fulfilled' && Array.isArray(quizRes.value)) ? quizRes.value : [];

  // Глоссарий — опционален.
  let glossary = null;
  if (glossRes.status === 'fulfilled' && glossRes.value) {
    try { glossary = parseGlossary(glossRes.value); }
    catch (e) { console.warn('Глоссарий не разобран:', e); }
  }

  return { data, quiz, glossary };
}

async function main() {
  initTheme();
  initNavTabs();
  document.getElementById('navToggle').addEventListener('click', () => drawer.classList.contains('is-open') ? closeDrawer() : openDrawer());
  document.getElementById('settingsToggle').addEventListener('click', openSettings);
  scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  try {
    const { data, quiz, glossary } = await loadContent();
    ctx = { data, quiz, glossary, go, openTicket, openDrawer, onProgressChange };

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

// ── Service worker (офлайн) ────────────────────────────
// Регистрируем только по http(s) — на file:// SW недоступен.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW не зарегистрирован:', e));
  });
}
