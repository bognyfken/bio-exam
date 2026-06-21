// version.js — выбор версии конспекта (краткая / расширенная).
//
// Глобальная версия по умолчанию хранится в settings.version ('brief'|'ext').
// Отдельные билеты можно переопределить тумблером в «Чтении» — переопределения
// лежат в settings.verByTicket. Если у билета нет расширенной версии (t.ext),
// всегда отдаём краткую.

import { settings } from './store.js';

/** Глобальная версия по умолчанию. */
export function defaultVersion() {
  return settings.get('version', 'brief') === 'ext' ? 'ext' : 'brief';
}
export function setDefaultVersion(v) {
  settings.set('version', v === 'ext' ? 'ext' : 'brief');
}

/** Версия конкретного билета: переопределение → иначе глобальная. */
export function ticketVersion(num) {
  const ov = settings.get('verByTicket', {})[String(num)];
  return ov === 'ext' || ov === 'brief' ? ov : defaultVersion();
}
export function setTicketVersion(num, v) {
  const ov = { ...settings.get('verByTicket', {}) };
  ov[String(num)] = v === 'ext' ? 'ext' : 'brief';
  settings.set('verByTicket', ov);
}

/** Есть ли у билета расширенная версия. */
export function hasExt(t) { return !!(t && t.ext); }

/**
 * Поля билета для заданной версии. Падение к краткой, если расширенной нет.
 * @returns {{ title, subpoints, bodyHtml, bodyMarkdown, plainText }}
 */
export function ticketView(t, version) {
  if (version === 'ext' && t.ext) {
    return {
      title: t.ext.title || t.title,
      subpoints: t.ext.subpoints,
      bodyHtml: t.ext.bodyHtml,
      bodyMarkdown: t.ext.bodyMarkdown,
      plainText: t.ext.plainText,
    };
  }
  return {
    title: t.title,
    subpoints: t.subpoints,
    bodyHtml: t.bodyHtml,
    bodyMarkdown: t.bodyMarkdown,
    plainText: t.plainText,
  };
}
