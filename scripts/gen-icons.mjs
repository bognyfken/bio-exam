// Генерация иконки-ДНК (PWA) → public/icons/*.png + public/icon.svg
// Запуск: node scripts/gen-icons.mjs
// sharp берём из соседнего проекта NoEnergyDrink (тут своего package.json нет).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire('C:/Users/userPC/Desktop/Проект/NoEnergyDrink/package.json');
const sharp = require('sharp');

// ── Построение SVG двойной спирали ─────────────────────
const S = 512;
const cx = S / 2;
const yTop = 122, yBot = 390;
const ampl = 58;
const periods = 2.5;
const N = 120;

const pts = (phase) => {
  const arr = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = t * periods * 2 * Math.PI + phase;
    const x = cx + ampl * Math.sin(a);
    const y = yTop + t * (yBot - yTop);
    arr.push([x, y]);
  }
  return arr;
};
const toPath = (arr) => 'M' + arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');

const strandA = pts(0);
const strandB = pts(Math.PI);

// Перекладины-«ступеньки» (пары оснований) — равномерно по всей высоте
const rungs = [];
const rungCount = 13;
for (let r = 0; r < rungCount; r++) {
  const t = (r + 0.5) / rungCount;
  const a = t * periods * 2 * Math.PI;
  const x1 = cx + ampl * Math.sin(a);
  const x2 = cx + ampl * Math.sin(a + Math.PI);
  const y = yTop + t * (yBot - yTop);
  // ближе к «фасу» (sin≈±1, нити разведены) — ярче; у перекрестий — бледнее
  const spread = Math.abs(Math.sin(a));
  rungs.push({ x1, x2, y, op: (0.35 + 0.55 * spread).toFixed(2) });
}

const rungSvg = rungs.map((r) =>
  `<line x1="${r.x1.toFixed(1)}" y1="${r.y.toFixed(1)}" x2="${r.x2.toFixed(1)}" y2="${r.y.toFixed(1)}" stroke="url(#rung)" stroke-width="8" stroke-linecap="round" opacity="${r.op}"/>`
).join('\n    ');

// узелки на концах перекладин (нуклеотиды)
const nodes = rungs.map((r) =>
  `<circle cx="${r.x1.toFixed(1)}" cy="${r.y.toFixed(1)}" r="7" fill="#ffffff" opacity="${r.op}"/>` +
  `<circle cx="${r.x2.toFixed(1)}" cy="${r.y.toFixed(1)}" r="7" fill="#ffffff" opacity="${r.op}"/>`
).join('\n    ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a9c63"/>
      <stop offset="1" stop-color="#1c5435"/>
    </linearGradient>
    <linearGradient id="strand" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#d6efdf"/>
    </linearGradient>
    <linearGradient id="rung" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#cdebd8"/>
      <stop offset="1" stop-color="#ffffff"/>
    </linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <g>
    ${rungSvg}
    ${nodes}
    <path d="${toPath(strandB)}" fill="none" stroke="url(#strand)" stroke-width="15" stroke-linecap="round" opacity="0.78"/>
    <path d="${toPath(strandA)}" fill="none" stroke="url(#strand)" stroke-width="16" stroke-linecap="round"/>
  </g>
</svg>`;

writeFileSync(join(root, 'public', 'icon.svg'), svg);

// ── Растеризация ───────────────────────────────────────
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-512-maskable.png', size: 512 }, // фон full-bleed → подходит как maskable
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg)).resize(t.size, t.size).png().toFile(join(outDir, t.file));
  console.log('✓', t.file, `${t.size}px`);
}
console.log('Готово.');
