import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newGame } from './model.ts';
import { applyImport, parseCsv, rowsToQuestions, SAMPLE_CSV } from './tableImport.ts';

describe('импорт таблицы', () => {
  it('разбирает CSV с кавычками, переносами строк и точкой с запятой', () => {
    const rows = parseCsv('Тема;Номинал;Вопрос;Ответ\r\n"Кино; мультфильмы";100;"Вопрос с ""кавычками""\nи переносом";Ответ\n');
    assert.deepEqual(rows, [
      ['Тема', 'Номинал', 'Вопрос', 'Ответ'],
      ['Кино; мультфильмы', '100', 'Вопрос с "кавычками"\nи переносом', 'Ответ'],
    ]);
  });

  it('определяет запятую как разделитель', () => {
    assert.deepEqual(parseCsv('a,b,"c,d"'), [['a', 'b', 'c,d']]);
  });

  it('сопоставляет колонки по заголовкам и сообщает об ошибках', () => {
    const { items, errors } = rowsToQuestions([
      ['Ответ', 'Вопрос', 'Тема', 'Стоимость'],
      ['Сентябрь', 'Первый месяц осени?', 'Месяцы', '100'],
      ['', '', 'Месяцы', '200'],
      ['Октябрь', 'Листопад?', '', 'двести'],
    ]);
    assert.equal(items.length, 1);
    assert.deepEqual(items[0], { line: 2, round: undefined, theme: 'Месяцы', value: 100, text: 'Первый месяц осени?', answer: 'Сентябрь', comment: '' });
    assert.equal(errors.length, 2);
  });

  it('без заголовка использует порядок Тема, Номинал, Вопрос, Ответ', () => {
    const { items } = rowsToQuestions([['Грибы', '300', 'Растут на пнях', 'Опята']]);
    assert.equal(items[0].theme, 'Грибы');
    assert.equal(items[0].value, 300);
  });

  it('добавляет вопросы в нужные раунды и убирает пустые заготовки тем', () => {
    const game = newGame('Тест');
    const { items } = rowsToQuestions(parseCsv(SAMPLE_CSV));
    const result = applyImport(game, items, 0);
    assert.deepEqual(
      result.rounds[0].themes.map((t) => t.name),
      ['Осенние месяцы'],
    );
    assert.equal(result.rounds[0].themes[0].questions.length, 2);
    assert.deepEqual(result.rounds[1].themes.map((t) => t.name), ['Грибы']);
    assert.equal(result.rounds[2].themes.length, 6, 'раунд без импорта не трогаем');
    assert.equal(game.rounds[0].themes.length, 6, 'исходная игра не меняется');
  });
});
