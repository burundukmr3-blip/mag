import { useState, type DragEvent } from 'react';
import { ACCEPT, guessMime, imageFromPaste, kindOf, KIND_LABEL, readClipboardImage, useMediaUrl } from '../lib/media.ts';
import { addMedia, getState, toast, useStore } from '../lib/store.ts';
import type { MediaKind, MediaMeta } from '../lib/types.ts';
import { formatBytes, pickFiles } from '../lib/utils.ts';
import { confirmDialog } from './Dialogs.tsx';
import { MediaPicker } from './MediaPicker.tsx';
import { MediaImage } from './MediaView.tsx';

const ALLOWED: Record<MediaKind, (mime: string) => boolean> = {
  image: (m) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(m),
  video: (m) => ['video/mp4', 'video/webm'].includes(m),
  audio: (m) => m.startsWith('audio/'),
};

const FORMATS: Record<MediaKind, string> = {
  image: 'JPG, PNG, WebP',
  video: 'MP4, WebM',
  audio: 'MP3, OGG, WAV, M4A',
};

/** Добавляет файл в медиатеку с проверкой типа и размера (Р6, Р7, Р9, Р16). */
export async function addMediaChecked(file: File, expected: MediaKind): Promise<MediaMeta | null> {
  const mime = guessMime(file.name, file.type);
  const kind = kindOf(mime);
  if (kind !== expected || !ALLOWED[expected](mime)) {
    toast(`Нужен файл: ${KIND_LABEL[expected].toLowerCase()} (${FORMATS[expected]}). «${file.name}» не подходит.`, 'error');
    return null;
  }
  const limitMB = getState().settings.videoWarnMB;
  if (kind === 'video' && file.size > limitMB * 1024 * 1024) {
    const ok = await confirmDialog({
      title: 'Большое видео',
      text: `«${file.name}» весит ${formatBytes(file.size)} — больше ${limitMB} МБ. Видео может медленно запускаться и займёт много места на устройстве. Добавить всё равно?`,
      ok: 'Добавить',
    });
    if (!ok) return null;
  }
  return addMedia(file);
}

interface Props {
  kind: MediaKind;
  label: string;
  value?: string;
  onChange: (id: string | undefined) => void;
}

export function MediaField({ kind, label, value, onChange }: Props) {
  const media = useStore((s) => s.media);
  const warnMB = useStore((s) => s.settings.videoWarnMB);
  const [picking, setPicking] = useState(false);
  const [over, setOver] = useState(false);
  const meta = value ? media.find((m) => m.id === value) : undefined;

  const take = async (file: File | null | undefined) => {
    if (!file) return;
    const added = await addMediaChecked(file, kind);
    if (added) onChange(added.id);
  };

  const choose = async () => take((await pickFiles(ACCEPT[kind]))[0]);

  const fromClipboard = async () => {
    try {
      const file = await readClipboardImage();
      if (file) take(file);
      else toast('В буфере обмена нет картинки. Скопируйте картинку и нажмите на поле, затем Ctrl+V.', 'error');
    } catch {
      toast('Браузер не дал доступ к буферу. Нажмите на поле и вставьте Ctrl+V (⌘V).', 'error');
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    take(e.dataTransfer.files[0]);
  };

  return (
    <div className="media-field">
      <div className="mf-label">{label}</div>
      {value ? (
        <div className="mf-current" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <MediaPreview id={value} kind={kind} />
          <div className="mf-meta">
            {meta ? (
              <>
                <span className="mf-name" title={meta.name}>
                  {meta.name}
                </span>
                <span className={`mf-size${kind === 'video' && meta.size > warnMB * 1024 * 1024 ? ' warn' : ''}`}>
                  {formatBytes(meta.size)}
                  {kind === 'video' && meta.size > warnMB * 1024 * 1024 && ` — больше ${warnMB} МБ`}
                </span>
              </>
            ) : (
              <span className="mf-size warn">Файл пропал из хранилища</span>
            )}
          </div>
          <div className="mf-actions">
            <button className="btn small" onClick={choose}>
              Заменить
            </button>
            <button className="btn small" onClick={() => setPicking(true)}>
              Из медиатеки
            </button>
            <button className="btn small ghost" onClick={() => onChange(undefined)}>
              Убрать
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`mf-drop${over ? ' over' : ''}`}
          tabIndex={0}
          onPaste={(e) => {
            const file = imageFromPaste(e);
            if (file && kind === 'image') {
              e.preventDefault();
              take(file);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <div className="mf-hint">
            Перетащите файл сюда{kind === 'image' && ' или нажмите на поле и вставьте Ctrl+V'} · {FORMATS[kind]}
          </div>
          <div className="mf-actions">
            <button className="btn small" onClick={choose}>
              Выбрать файл
            </button>
            {kind === 'image' && (
              <button className="btn small" onClick={fromClipboard}>
                Вставить из буфера
              </button>
            )}
            <button className="btn small" onClick={() => setPicking(true)}>
              Из медиатеки
            </button>
          </div>
        </div>
      )}
      {picking && (
        <MediaPicker
          kind={kind}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            onChange(id);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

export function MediaPreview({ id, kind }: { id: string; kind: MediaKind }) {
  const url = useMediaUrl(id);
  if (kind === 'image') return <MediaImage id={id} className="mf-thumb" />;
  if (!url) return <div className="mf-thumb media-placeholder">{url === undefined ? '…' : 'нет файла'}</div>;
  if (kind === 'video') return <video className="mf-thumb" src={url} controls preload="metadata" />;
  return <audio className="mf-audio" src={url} controls preload="metadata" />;
}
