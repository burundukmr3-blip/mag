import { useEffect, useState } from 'react';
import { db } from './db.ts';
import type { MediaKind, MediaMeta, MediaRecord } from './types.ts';

export const ACCEPT: Record<MediaKind, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif',
  video: 'video/mp4,video/webm,.mp4,.webm,.m4v',
  audio: 'audio/*,.mp3,.ogg,.wav,.m4a,.aac,.flac,.opus',
};

export const KIND_LABEL: Record<MediaKind, string> = { image: 'Картинка', video: 'Видео', audio: 'Аудио' };

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
};

export function guessMime(name: string, mime: string): string {
  if (mime) return mime;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

export function kindOf(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return null;
}

export function toMeta(rec: MediaRecord): MediaMeta {
  const { blob: _blob, ...meta } = rec;
  return meta;
}

const urlCache = new Map<string, string>();

export async function getMediaUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const rec = await db.get<MediaRecord>('media', id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export function forgetMediaUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

/** undefined — загружается, null — файла нет в хранилище. */
export function useMediaUrl(id: string | undefined): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(() => (id ? urlCache.get(id) : null));
  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let alive = true;
    const cached = urlCache.get(id);
    if (cached) setUrl(cached);
    else {
      setUrl(undefined);
      getMediaUrl(id).then((u) => alive && setUrl(u), () => alive && setUrl(null));
    }
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export async function getMediaRecords(ids: string[]): Promise<MediaRecord[]> {
  const out: MediaRecord[] = [];
  for (const id of ids) {
    const rec = await db.get<MediaRecord>('media', id);
    if (rec) out.push(rec);
  }
  return out;
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  return (await db.get<MediaRecord>('media', id))?.blob ?? null;
}

/** Картинка из буфера обмена: Clipboard API, если браузер его поддерживает. */
export async function readClipboardImage(): Promise<File | null> {
  const clip = navigator.clipboard as Clipboard | undefined;
  if (!clip?.read) return null;
  const items = await clip.read();
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith('image/'));
    if (type) {
      const blob = await item.getType(type);
      return new File([blob], `из-буфера.${type.split('/')[1] || 'png'}`, { type });
    }
  }
  return null;
}

export function imageFromPaste(e: { clipboardData: DataTransfer | null }): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return new File([file], file.name && file.name !== 'image.png' ? file.name : `из-буфера.${item.type.split('/')[1] || 'png'}`, { type: item.type });
    }
  }
  return null;
}
