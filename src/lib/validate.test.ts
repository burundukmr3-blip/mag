import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newGame } from './model.ts';
import { createSampleGame } from './sample.ts';
import type { MediaMeta } from './types.ts';
import { validateGame } from './validate.ts';

describe('проверка игры', () => {
  it('пример игры проходит без ошибок', () => {
    const issues = validateGame(createSampleGame(), new Map(), 100 * 1024 * 1024);
    assert.deepEqual(issues.filter((i) => i.level === 'error'), []);
  });

  it('пример содержит 3 раунда по 6 тем и 5 вопросов, номиналы ×1, ×2, ×3', () => {
    const game = createSampleGame();
    assert.equal(game.rounds.length, 3);
    game.rounds.forEach((r, ri) => {
      assert.equal(r.themes.length, 6);
      r.themes.forEach((t) => assert.deepEqual(t.questions.map((q) => q.value), [1, 2, 3, 4, 5].map((v) => v * 100 * (ri + 1))));
    });
  });

  it('находит пустые вопросы, повторы номиналов, пропавшие и большие файлы', () => {
    const game = newGame('Тест');
    const theme = game.rounds[0].themes[0];
    theme.questions[0].text = 'Вопрос';
    theme.questions[0].answer = 'Ответ';
    theme.questions[0].image = 'missing';
    theme.questions[1].value = theme.questions[0].value;
    theme.questions[2].text = 'Видео';
    theme.questions[2].video = 'big';
    const big: MediaMeta = { id: 'big', name: 'big.mp4', mime: 'video/mp4', size: 200 * 1024 * 1024, kind: 'video', createdAt: 0 };
    const issues = validateGame(game, new Map([['big', big]]), 100 * 1024 * 1024);
    const texts = issues.map((i) => i.text).join('\n');
    assert.match(texts, /пустой вопрос/);
    assert.match(texts, /пропал медиафайл/);
    assert.match(texts, /номинал 100 повторяется 2 раза/);
    assert.match(texts, /большое видео/);
  });
});
