import type {
  FinalQuestion,
  Game,
  GameSettings,
  Playback,
  Question,
  QuestionContent,
  Round,
  Theme,
} from './types.ts';
import { uid } from './utils.ts';

export const DEFAULT_THEMES = 6;
export const DEFAULT_QUESTIONS = 5;
export const DEFAULT_ROUNDS = 3;

export const PLAYER_COLORS = ['#e74c3c', '#2ecc71', '#3498db', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#ec4899'];

/** Номиналы раунда по умолчанию: ×1, ×2, ×3 от 100…500 (И3). */
export function defaultValues(roundIndex: number, count = DEFAULT_QUESTIONS): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * 100 * (roundIndex + 1));
}

export function defaultPlayback(): Playback {
  return { autoplay: true, muted: false };
}

export function defaultGameSettings(): GameSettings {
  return { timerEnabled: true, timerSeconds: 20, finalTimerSeconds: 60 };
}

export function newQuestion(value: number, patch: Partial<Question> = {}): Question {
  return { id: uid(), value, text: '', answer: '', comment: '', special: 'none', playback: defaultPlayback(), ...patch };
}

export function newTheme(name: string, values: number[]): Theme {
  return { id: uid(), name, questions: values.map((v) => newQuestion(v)) };
}

export function newRound(index: number, themes = DEFAULT_THEMES, questions = DEFAULT_QUESTIONS): Round {
  const values = defaultValues(index, questions);
  return {
    id: uid(),
    name: `Раунд ${index + 1}`,
    values,
    themes: Array.from({ length: themes }, (_, i) => newTheme(`Тема ${i + 1}`, values)),
  };
}

export function newFinalQuestion(theme = 'Тема финала'): FinalQuestion {
  return { id: uid(), theme, text: '', answer: '', comment: '', playback: defaultPlayback() };
}

export function newGame(name: string): Game {
  const now = Date.now();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    rounds: Array.from({ length: DEFAULT_ROUNDS }, (_, i) => newRound(i)),
    final: [newFinalQuestion()],
    settings: defaultGameSettings(),
  };
}

/** Новая копия игры с новыми идентификаторами (Р1). Медиафайлы общие. */
export function copyGame(game: Game, name: string): Game {
  const now = Date.now();
  return {
    ...structuredClone(game),
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    rounds: game.rounds.map((r) => ({
      ...structuredClone(r),
      id: uid(),
      themes: r.themes.map((t) => ({
        ...structuredClone(t),
        id: uid(),
        questions: t.questions.map((q) => ({ ...structuredClone(q), id: uid() })),
      })),
    })),
    final: game.final.map((f) => ({ ...structuredClone(f), id: uid() })),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function optStr(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

function optNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function normalizeContent(raw: Record<string, unknown>): QuestionContent {
  const pb = (raw.playback ?? {}) as Record<string, unknown>;
  return {
    text: str(raw.text),
    answer: str(raw.answer),
    comment: str(raw.comment),
    image: optStr(raw.image),
    answerImage: optStr(raw.answerImage),
    video: optStr(raw.video),
    videoUrl: optStr(raw.videoUrl),
    audio: optStr(raw.audio),
    playback: {
      start: optNum(pb.start),
      end: optNum(pb.end),
      autoplay: pb.autoplay === undefined ? true : Boolean(pb.autoplay),
      muted: Boolean(pb.muted),
    },
  };
}

/** Приводит данные из файла или старой версии к актуальной структуре. */
export function normalizeGame(raw: unknown): Game {
  const g = (raw ?? {}) as Record<string, unknown>;
  const rounds = Array.isArray(g.rounds) ? g.rounds : [];
  const settings = (g.settings ?? {}) as Record<string, unknown>;
  const defaults = defaultGameSettings();
  return {
    id: str(g.id) || uid(),
    name: str(g.name) || 'Без названия',
    createdAt: num(g.createdAt, Date.now()),
    updatedAt: num(g.updatedAt, Date.now()),
    rounds: rounds.map((rr, ri) => {
      const r = rr as Record<string, unknown>;
      const themes = Array.isArray(r.themes) ? r.themes : [];
      const values = Array.isArray(r.values) ? r.values.map((v) => num(v, 0)).filter((v) => v > 0) : [];
      return {
        id: str(r.id) || uid(),
        name: str(r.name) || `Раунд ${ri + 1}`,
        values: values.length ? values : defaultValues(ri),
        themes: themes.map((tt) => {
          const t = tt as Record<string, unknown>;
          const questions = Array.isArray(t.questions) ? t.questions : [];
          return {
            id: str(t.id) || uid(),
            name: str(t.name),
            questions: questions.map((qq) => {
              const q = qq as Record<string, unknown>;
              const special = q.special === 'cat' || q.special === 'stake' ? q.special : 'none';
              return {
                ...normalizeContent(q),
                id: str(q.id) || uid(),
                value: num(q.value, 0),
                special,
                catTheme: optStr(q.catTheme),
                catValue: optNum(q.catValue),
              } satisfies Question;
            }),
          };
        }),
      };
    }),
    final: (Array.isArray(g.final) ? g.final : []).map((ff) => {
      const f = ff as Record<string, unknown>;
      return { ...normalizeContent(f), id: str(f.id) || uid(), theme: str(f.theme) };
    }),
    settings: {
      timerEnabled: settings.timerEnabled === undefined ? defaults.timerEnabled : Boolean(settings.timerEnabled),
      timerSeconds: num(settings.timerSeconds, defaults.timerSeconds),
      finalTimerSeconds: num(settings.finalTimerSeconds, defaults.finalTimerSeconds),
    },
  };
}

export interface QuestionLocation {
  question: Question;
  theme: Theme;
  round: Round;
  roundIndex: number;
  themeIndex: number;
}

export function findQuestion(game: Game, questionId: string): QuestionLocation | undefined {
  for (let roundIndex = 0; roundIndex < game.rounds.length; roundIndex++) {
    const round = game.rounds[roundIndex];
    for (let themeIndex = 0; themeIndex < round.themes.length; themeIndex++) {
      const theme = round.themes[themeIndex];
      const question = theme.questions.find((q) => q.id === questionId);
      if (question) return { question, theme, round, roundIndex, themeIndex };
    }
  }
  return undefined;
}

export function allQuestions(game: Game): QuestionLocation[] {
  const out: QuestionLocation[] = [];
  game.rounds.forEach((round, roundIndex) =>
    round.themes.forEach((theme, themeIndex) =>
      theme.questions.forEach((question) => out.push({ question, theme, round, roundIndex, themeIndex })),
    ),
  );
  return out;
}

/** Вопросы темы в порядке номинала — так они стоят на табло. */
export function sortedQuestions(theme: Theme): Question[] {
  return theme.questions
    .map((q, i) => [q, i] as const)
    .sort((a, b) => a[0].value - b[0].value || a[1] - b[1])
    .map(([q]) => q);
}

export function countQuestions(game: Game): number {
  return game.rounds.reduce((n, r) => n + r.themes.reduce((m, t) => m + t.questions.length, 0), 0);
}

export function mediaIdsOf(content: QuestionContent): string[] {
  return [content.image, content.answerImage, content.video, content.audio].filter((x): x is string => !!x);
}

export function gameMediaIds(game: Game): string[] {
  const ids = new Set<string>();
  for (const { question } of allQuestions(game)) mediaIdsOf(question).forEach((id) => ids.add(id));
  for (const f of game.final) mediaIdsOf(f).forEach((id) => ids.add(id));
  return [...ids];
}

export function questionLabel(loc: QuestionLocation): string {
  return `${loc.theme.name || 'Без темы'} · ${loc.question.value}`;
}

export function hasMedia(content: QuestionContent): boolean {
  return mediaIdsOf(content).length > 0 || !!content.videoUrl;
}

// ——— Изменения игры в редакторе (функции меняют черновик) ———

export function moveQuestion(game: Game, questionId: string, targetThemeId: string): void {
  const loc = findQuestion(game, questionId);
  const target = game.rounds.flatMap((r) => r.themes).find((t) => t.id === targetThemeId);
  if (!loc || !target || loc.theme.id === targetThemeId) return;
  loc.theme.questions = loc.theme.questions.filter((q) => q.id !== questionId);
  target.questions.push(loc.question);
}

export function deleteQuestion(game: Game, questionId: string): void {
  const loc = findQuestion(game, questionId);
  if (loc) loc.theme.questions = loc.theme.questions.filter((q) => q.id !== questionId);
}

export function duplicateQuestion(game: Game, questionId: string): string | undefined {
  const loc = findQuestion(game, questionId);
  if (!loc) return;
  const copy = { ...structuredClone(loc.question), id: uid() };
  loc.theme.questions.push(copy);
  return copy.id;
}

/** Следующий номинал для нового вопроса темы. */
export function nextValue(round: Round, theme: Theme): number {
  const used = new Set(theme.questions.map((q) => q.value));
  const free = round.values.find((v) => !used.has(v));
  if (free) return free;
  const max = Math.max(0, ...theme.questions.map((q) => q.value));
  const step = round.values[0] || 100;
  return max + step;
}

/** Расставляет номиналы раунда по порядку во всех темах, недостающие вопросы добавляет. */
export function applyRoundValues(round: Round): void {
  for (const theme of round.themes) {
    const sorted = sortedQuestions(theme);
    sorted.forEach((q, i) => {
      if (i < round.values.length) q.value = round.values[i];
    });
    for (let i = sorted.length; i < round.values.length; i++) sorted.push(newQuestion(round.values[i]));
    theme.questions = sorted;
  }
}
