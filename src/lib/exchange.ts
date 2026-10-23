// Экспорт игры в один файл .svoya вместе с картинками, видео и аудио (Р13).
// Формат: 8 байт «SVOYAGM1», 4 байта длины манифеста (little-endian), манифест JSON,
// затем содержимое файлов подряд. Blob собирается без копирования больших видео в память.
import { gameMediaIds, normalizeGame } from './model.ts';
import type { Game, MediaMeta, MediaRecord } from './types.ts';

export const MAGIC = 'SVOYAGM1';
export const FILE_EXT = '.svoya';

interface ManifestMedia extends MediaMeta {
  offset: number;
  length: number;
}

interface Manifest {
  format: 'svoya-igra';
  version: 1;
  exportedAt: number;
  game: Game;
  media: ManifestMedia[];
}

export function buildExportBlob(game: Game, media: MediaRecord[]): Blob {
  const used = new Set(gameMediaIds(game));
  let offset = 0;
  const entries: ManifestMedia[] = [];
  const blobs: Blob[] = [];
  for (const rec of media) {
    if (!used.has(rec.id)) continue;
    const { blob, ...meta } = rec;
    entries.push({ ...meta, size: blob.size, offset, length: blob.size });
    blobs.push(blob);
    offset += blob.size;
  }
  const manifest: Manifest = { format: 'svoya-igra', version: 1, exportedAt: Date.now(), game, media: entries };
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(header.buffer).setUint32(8, json.byteLength, true);
  return new Blob([header, json, ...blobs], { type: 'application/octet-stream' });
}

export interface ParsedExport {
  game: Game;
  media: MediaRecord[];
}

export async function parseExportBlob(file: Blob): Promise<ParsedExport> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const magic = new TextDecoder().decode(head.slice(0, 8));
  if (magic !== MAGIC) {
    // Обычный JSON с игрой без медиафайлов тоже принимаем.
    const text = await file.text();
    if (text.trimStart().startsWith('{')) {
      const raw = JSON.parse(text);
      return { game: normalizeGame(raw.game ?? raw), media: [] };
    }
    throw new Error('Это не файл игры «Своя игра» (.svoya)');
  }
  const jsonLength = new DataView(head.buffer).getUint32(8, true);
  const dataStart = 12 + jsonLength;
  if (dataStart > file.size) throw new Error('Файл повреждён: не хватает данных');
  const manifest = JSON.parse(await file.slice(12, dataStart).text()) as Manifest;
  if (manifest.format !== 'svoya-igra') throw new Error('Неизвестный формат файла');
  const media: MediaRecord[] = manifest.media.map(({ offset, length, ...meta }) => {
    const start = dataStart + offset;
    if (start + length > file.size) throw new Error(`Файл повреждён: нет данных для «${meta.name}»`);
    return { ...meta, size: length, blob: file.slice(start, start + length, meta.mime) };
  });
  return { game: normalizeGame(manifest.game), media };
}
