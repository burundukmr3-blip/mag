import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSampleGame } from './sample.ts';
import {
  applyFinal,
  cancelLogEntry,
  closeQuestion,
  createSession,
  giveCat,
  isRoundComplete,
  markCorrect,
  markWrong,
  openQuestion,
  removeFinalTheme,
  removePlayer,
  selectAnswerer,
  setBet,
  setFinalResult,
  setScore,
  setStake,
  standings,
  startFinal,
} from './session.ts';
import type { Session } from './types.ts';

const settings = { timerEnabled: true, timerSeconds: 20, finalTimerSeconds: 60, sound: false };

function setup() {
  const game = createSampleGame();
  const s = createSession(
    game,
    [
      { name: 'Аня', color: '#f00' },
      { name: 'Боря', color: '#0f0' },
      { name: 'Вера', color: '#00f' },
    ],
    settings,
  );
  const [a, b, c] = s.players.map((p) => p.id);
  return { game, s, a, b, c };
}

const score = (s: Session, id: string) => s.players.find((p) => p.id === id)!.score;

describe('обычный вопрос', () => {
  it('верный ответ прибавляет очки, закрывает вопрос и передаёт ход', () => {
    const { game, s, a } = setup();
    const q = game.rounds[0].themes[0].questions[2];
    openQuestion(s, game, q.id);
    assert.equal(s.phase, 'question');
    selectAnswerer(s, a);
    markCorrect(s, game);
    assert.equal(score(s, a), 300);
    assert.equal(s.chooser, a);
    assert.ok(s.active?.finished && s.active.revealed);
    assert.ok(s.played.includes(q.id));
    closeQuestion(s, game);
    assert.equal(s.phase, 'board');
  });

  it('после неверного ответа вопрос остаётся открытым, повторно тот же игрок ответить не может', () => {
    const { game, s, a, b } = setup();
    const q = game.rounds[0].themes[0].questions[0];
    openQuestion(s, game, q.id);
    selectAnswerer(s, a);
    markWrong(s, game);
    assert.equal(score(s, a), -100);
    assert.equal(s.active?.finished, false);
    selectAnswerer(s, a);
    assert.equal(s.active?.selected, undefined);
    selectAnswerer(s, b);
    markCorrect(s, game);
    assert.equal(score(s, b), 100);
  });

  it('«Никто не ответил» не меняет очки', () => {
    const { game, s, a } = setup();
    const q = game.rounds[0].themes[1].questions[0];
    openQuestion(s, game, q.id);
    closeQuestion(s, game);
    assert.equal(score(s, a), 0);
    assert.ok(s.played.includes(q.id));
    assert.equal(s.log.at(-1)?.kind, 'skip');
  });

  it('раунд завершён, когда сыграны все карточки', () => {
    const { game, s } = setup();
    for (const t of game.rounds[0].themes) for (const q of t.questions) s.played.push(q.id);
    assert.ok(isRoundComplete(s, game));
  });
});

describe('особые карточки', () => {
  it('кот в мешке: отвечает только получивший, после ошибки вопрос закрыт', () => {
    const { game, s, a, b } = setup();
    const cat = game.rounds[0].themes.flatMap((t) => t.questions).find((q) => q.special === 'cat')!;
    openQuestion(s, game, cat.id);
    assert.equal(s.active?.stage, 'special');
    giveCat(s, game, b);
    selectAnswerer(s, a);
    assert.equal(s.active?.selected, b);
    markWrong(s, game);
    assert.equal(score(s, b), -cat.value);
    assert.ok(s.active?.finished);
  });

  it('вопрос со ставкой: очки равны ставке', () => {
    const { game, s, c } = setup();
    const q = game.rounds[1].themes.flatMap((t) => t.questions).find((x) => x.special === 'stake')!;
    openQuestion(s, game, q.id);
    setStake(s, c, 1500);
    markCorrect(s, game);
    assert.equal(score(s, c), 1500);
  });
});

describe('счёт и журнал', () => {
  it('ручная корректировка допускает отрицательный счёт и пишется в журнал', () => {
    const { s, a } = setup();
    setScore(s, a, -250);
    assert.equal(score(s, a), -250);
    assert.equal(s.log.at(-1)?.delta, -250);
  });

  it('отмена записи журнала возвращает очки', () => {
    const { game, s, a } = setup();
    openQuestion(s, game, game.rounds[0].themes[0].questions[4].id);
    selectAnswerer(s, a);
    markCorrect(s, game);
    const entry = s.log.at(-1)!;
    cancelLogEntry(s, entry.id);
    assert.equal(score(s, a), 0);
    cancelLogEntry(s, entry.id);
    assert.equal(score(s, a), 0, 'повторная отмена ничего не меняет');
  });

  it('удалённый с обнулением игрок не попадает в итоги', () => {
    const { s, a, b, c } = setup();
    setScore(s, a, 500);
    setScore(s, b, 500);
    setScore(s, c, 900);
    removePlayer(s, c, false);
    const table = standings(s);
    assert.deepEqual(
      table.map((x) => [x.player.name, x.place]),
      [
        ['Аня', 1],
        ['Боря', 1],
      ],
    );
  });
});

describe('финал', () => {
  it('участвуют только игроки с положительным счётом, ставки применяются', () => {
    const { game, s, a, b, c } = setup();
    setScore(s, a, 1000);
    setScore(s, b, 300);
    setScore(s, c, -100);
    startFinal(s, game);
    assert.equal(s.final?.stage, 'themes');
    assert.deepEqual(s.final?.participants, [a, b]);
    removeFinalTheme(s, game, game.final[0].id);
    removeFinalTheme(s, game, game.final[1].id);
    assert.equal(s.final?.stage, 'bets');
    assert.equal(s.final?.questionId, game.final[2].id);
    setBet(s, a, 5000);
    assert.equal(s.final?.bets[a], 1000, 'ставка не больше счёта');
    setBet(s, b, 200);
    setFinalResult(s, a, false);
    setFinalResult(s, b, true);
    applyFinal(s, game);
    assert.equal(score(s, a), 0);
    assert.equal(score(s, b), 500);
    assert.equal(score(s, c), -100);
    assert.equal(s.phase, 'results');
    assert.ok(s.finished);
  });
});
