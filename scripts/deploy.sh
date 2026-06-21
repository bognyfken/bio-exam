#!/usr/bin/env bash
# Деплой сайта. Основной хостинг — GitHub Pages (ветка gh-pages = содержимое public/).
# Запуск из корня проекта:  bash scripts/deploy.sh
set -e

cd "$(dirname "$0")/.."

echo "→ Пуш main…"
git push origin main

echo "→ Выкатываю public/ в ветку gh-pages…"
git subtree push --prefix public origin gh-pages

echo ""
echo "✓ GitHub Pages обновлён: https://bognyfken.github.io/bio-exam/"
echo "  (обновление вживую — до ~1 минуты)"
echo ""
echo "Напоминание: если менялся контент или ассеты — подними VERSION в public/sw.js,"
echo "иначе у установивших PWA останется старый кэш."
echo ""
echo "Опционально — продублировать на Cloudflare Pages (нужен .env):"
echo "  set -a; . ./.env; set +a"
echo "  npx wrangler pages deploy public --project-name=bio-exam --branch=main"
