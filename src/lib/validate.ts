// Проверка игры перед запуском (Р15).
import { hasMedia, mediaIdsOf } from './model.ts';
import type { Game, MediaMeta, QuestionContent } from './types.ts';
import { formatBytes } from './utils.ts';

export interface Issue {
  level: 'error' | 'warning';
  text: string;
  roundIndex?: number;
  themeId?: string;
  questionId?: string;
  finalId?: string;
}

export function validateGame(game: Game, media: Map<string, MediaMeta>, videoWarnBytes: number): Issue[] {
  const issues: Issue[] = [];

  const checkContent = (c: QuestionContent, where: string, ref: Partial<Issue>) => {
    if (!c.text.trim() && !hasMedia(c)) issues.push({ level: 'error', text: `${where}: пустой вопрос`, ...ref });
    if (!c.answer.trim() && !c.answerImage) issues.push({ level: 'warning', text: `${where}: не указан ответ`, ...ref });
    for (const id of mediaIdsOf(c)) {
      const meta = media.get(id);
      if (!meta) issues.push({ level: 'error', text: `${where}: пропал медиафайл`, ...ref });
      else if (meta.kind === 'video' && meta.size > videoWarnBytes)
        issues.push({ level: 'warning', text: `${where}: большое видео «${meta.name}» (${formatBytes(meta.size)})`, ...ref });
    }
    if (c.videoUrl) issues.push({ level: 'warning', text: `${where}: видео по ссылке — нужен интернет`, ...ref });
  };

  if (!game.rounds.length) issues.push({ level: 'error', text: 'В игре нет ни одного раунда' });

  game.rounds.forEach((round, roundIndex) => {
    const rname = round.name || `Раунд ${roundIndex + 1}`;
    if (!round.themes.length) issues.push({ level: 'warning', text: `${rname}: нет тем`, roundIndex });
    round.themes.forEach((theme) => {
      const tname = `${rname} · ${theme.name || 'тема без названия'}`;
      if (!theme.name.trim()) issues.push({ level: 'warning', text: `${tname}: у темы нет названия`, roundIndex, themeId: theme.id });
      if (!theme.questions.length) issues.push({ level: 'warning', text: `${tname}: нет вопросов`, roundIndex, themeId: theme.id });
      const seen = new Map<number, number>();
      theme.questions.forEach((q) => seen.set(q.value, (seen.get(q.value) ?? 0) + 1));
      for (const [value, count] of seen) {
        if (count > 1) issues.push({ level: 'warning', text: `${tname}: номинал ${value} повторяется ${count} раза`, roundIndex, themeId: theme.id });
      }
      theme.questions.forEach((q) => {
        const ref = { roundIndex, themeId: theme.id, questionId: q.id };
        if (q.value <= 0) issues.push({ level: 'warning', text: `${tname} · ${q.value}: номинал должен быть больше нуля`, ...ref });
        checkContent(q, `${tname} · ${q.value}`, ref);
      });
    });
  });

  if (!game.final.length) issues.push({ level: 'warning', text: 'Финал не задан: игра закончится без финального раунда' });
  game.final.forEach((f) => {
    const where = `Финал · ${f.theme || 'тема без названия'}`;
    if (!f.theme.trim()) issues.push({ level: 'warning', text: `${where}: у темы нет названия`, finalId: f.id });
    checkContent(f, where, { finalId: f.id });
  });

  return issues;
}
