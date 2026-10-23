// Импорт вопросов из таблицы CSV или Excel (Р14).
// Колонки: Раунд (необязательно), Тема, Номинал, Вопрос, Ответ, Комментарий (необязательно).
import { newQuestion, newRound, newTheme } from './model.ts';
import type { Game, Question } from './types.ts';
import { clone } from './utils.ts';

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function detectDelimiter(line: string): string {
  const counts = [';', ',', '\t'].map((d) => {
    let n = 0;
    let quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (!quoted && ch === d) n++;
    }
    return [d, n] as const;
  });
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}

export interface ImportRow {
  line: number;
  round?: string;
  theme: string;
  value: number;
  text: string;
  answer: string;
  comment: string;
}

type Column = 'round' | 'theme' | 'value' | 'text' | 'answer' | 'comment';

const HEADERS: [Column, string[]][] = [
  ['round', ['раунд', 'round']],
  ['theme', ['тема', 'категория', 'theme', 'category']],
  ['value', ['номинал', 'стоимость', 'цена', 'очки', 'баллы', 'value', 'points', 'price']],
  ['comment', ['комментарий', 'примечание', 'comment', 'note']],
  ['answer', ['ответ', 'answer']],
  ['text', ['вопрос', 'question']],
];

function headerColumn(cell: string): Column | undefined {
  const c = cell.trim().toLowerCase();
  if (!c) return undefined;
  return HEADERS.find(([, names]) => names.some((n) => c.includes(n)))?.[0];
}

export function rowsToQuestions(rows: string[][]): { items: ImportRow[]; errors: string[] } {
  const errors: string[] = [];
  if (!rows.length) return { items: [], errors: ['Таблица пустая'] };
  const header = rows[0].map(headerColumn);
  const hasHeader = header.includes('theme') || header.includes('text');
  const map: Partial<Record<Column, number>> = {};
  if (hasHeader) header.forEach((col, i) => col && map[col] === undefined && (map[col] = i));
  else Object.assign(map, { theme: 0, value: 1, text: 2, answer: 3, comment: 4 });
  const cell = (r: string[], col: Column) => (map[col] === undefined ? '' : (r[map[col]!] ?? '').trim());
  const items: ImportRow[] = [];
  let lastTheme = '';
  rows.slice(hasHeader ? 1 : 0).forEach((r, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const theme = cell(r, 'theme') || lastTheme;
    const text = cell(r, 'text');
    const answer = cell(r, 'answer');
    const value = Number(cell(r, 'value').replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
    if (!theme) return void errors.push(`Строка ${line}: не указана тема`);
    if (!Number.isFinite(value) || value <= 0) return void errors.push(`Строка ${line}: номинал должен быть положительным числом`);
    if (!text && !answer) return void errors.push(`Строка ${line}: нет ни вопроса, ни ответа`);
    lastTheme = theme;
    items.push({ line, round: cell(r, 'round') || undefined, theme, value: Math.round(value), text, answer, comment: cell(r, 'comment') });
  });
  return { items, errors };
}

function resolveRound(game: Game, round: string | undefined, fallback: number): number {
  if (!round) return fallback;
  const n = Number(round.replace(/[^\d]/g, ''));
  const byName = game.rounds.findIndex((r) => r.name.trim().toLowerCase() === round.trim().toLowerCase());
  if (byName >= 0) return byName;
  if (Number.isInteger(n) && n >= 1 && n <= 10) return n - 1;
  return fallback;
}

/**
 * Добавляет вопросы в игру. Темы ищутся по названию в нужном раунде, недостающие создаются.
 * Если в теме уже есть пустой вопрос с тем же номиналом — он заполняется, иначе вопрос добавляется.
 */
export function applyImport(source: Game, items: ImportRow[], defaultRound: number): Game {
  const game = clone(source);
  const touched = new Set<number>();
  for (const item of items) {
    const ri = resolveRound(game, item.round, defaultRound);
    while (game.rounds.length <= ri) game.rounds.push(newRound(game.rounds.length, 0));
    const round = game.rounds[ri];
    let theme = round.themes.find((t) => t.name.trim().toLowerCase() === item.theme.toLowerCase());
    if (!theme) {
      theme = newTheme(item.theme, []);
      round.themes.push(theme);
      touched.add(ri);
    }
    const patch = { text: item.text, answer: item.answer, comment: item.comment };
    const empty = theme.questions.find((q) => q.value === item.value && isBlank(q));
    if (empty) Object.assign(empty, patch);
    else theme.questions.push(newQuestion(item.value, patch));
  }
  // В раундах, куда импорт добавил темы, убираем пустые заготовки «Тема N» из новой игры.
  for (const ri of touched) {
    const round = game.rounds[ri];
    round.themes = round.themes.filter((t) => !/^Тема \d+$/.test(t.name) || !t.questions.every(isBlank));
  }
  return game;
}

function isBlank(q: Question): boolean {
  return !q.text && !q.answer && !q.image && !q.answerImage && !q.video && !q.videoUrl && !q.audio;
}

export const SAMPLE_CSV =
  'Раунд;Тема;Номинал;Вопрос;Ответ;Комментарий\n' +
  '1;Осенние месяцы;100;Какой месяц открывает календарную осень?;Сентябрь;\n' +
  '1;Осенние месяцы;200;Этот месяц в старину на Руси называли «листопад».;Октябрь;\n' +
  '2;Грибы;200;Ядовитый гриб с красной шляпкой в белых точках.;Мухомор;\n';
