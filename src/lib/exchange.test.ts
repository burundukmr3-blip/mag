import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildExportBlob, parseExportBlob } from './exchange.ts';
import { createSampleGame } from './sample.ts';
import type { MediaRecord } from './types.ts';

describe('экспорт и импорт .svoya', () => {
  it('сохраняет игру и медиафайлы без потерь', async () => {
    const game = createSampleGame();
    const image: MediaRecord = {
      id: 'img1',
      name: 'кот.png',
      mime: 'image/png',
      size: 4,
      kind: 'image',
      createdAt: 1,
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }),
    };
    const video: MediaRecord = {
      id: 'vid1',
      name: 'клип.mp4',
      mime: 'video/mp4',
      size: 3,
      kind: 'video',
      createdAt: 2,
      blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'video/mp4' }),
    };
    const unused: MediaRecord = { ...image, id: 'unused' };
    game.rounds[0].themes[0].questions[0].image = 'img1';
    game.final[0].video = 'vid1';

    const blob = buildExportBlob(game, [image, video, unused]);
    const parsed = await parseExportBlob(blob);

    const plain = (x: unknown) => JSON.parse(JSON.stringify(x));
    assert.deepEqual(plain(parsed.game), plain(game));
    assert.deepEqual(
      parsed.media.map((m) => m.id),
      ['img1', 'vid1'],
      'неиспользуемые файлы не попадают в экспорт',
    );
    assert.deepEqual([...new Uint8Array(await parsed.media[0].blob.arrayBuffer())], [1, 2, 3, 4]);
    assert.deepEqual([...new Uint8Array(await parsed.media[1].blob.arrayBuffer())], [9, 8, 7]);
  });

  it('принимает JSON без медиафайлов и отклоняет чужие файлы', async () => {
    const game = createSampleGame();
    const parsed = await parseExportBlob(new Blob([JSON.stringify(game)]));
    assert.equal(parsed.game.name, game.name);
    await assert.rejects(parseExportBlob(new Blob(['просто текст'])));
  });
});
