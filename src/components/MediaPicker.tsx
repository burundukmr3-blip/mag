import { useMemo, useState } from 'react';
import { KIND_LABEL } from '../lib/media.ts';
import { useStore } from '../lib/store.ts';
import type { MediaKind } from '../lib/types.ts';
import { formatBytes } from '../lib/utils.ts';
import { MediaPreview } from './MediaField.tsx';
import { Modal } from './Modal.tsx';

/** Выбор уже загруженного файла из медиатеки (Р12). */
export function MediaPicker({ kind, onPick, onClose }: { kind: MediaKind; onPick: (id: string) => void; onClose: () => void }) {
  const media = useStore((s) => s.media);
  const [query, setQuery] = useState('');
  const list = useMemo(
    () => media.filter((m) => m.kind === kind && m.name.toLowerCase().includes(query.trim().toLowerCase())),
    [media, kind, query],
  );
  return (
    <Modal title={`Медиатека: ${KIND_LABEL[kind].toLowerCase()}`} onClose={onClose} wide>
      <input className="search" placeholder="Поиск по названию файла" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      {list.length === 0 ? (
        <p className="muted">Подходящих файлов нет. Загрузите файл кнопкой «Выбрать файл».</p>
      ) : (
        <div className="media-grid">
          {list.map((m) => (
            <button key={m.id} className="media-card pick" onClick={() => onPick(m.id)}>
              <MediaPreview id={m.id} kind={m.kind} />
              <span className="media-card-name" title={m.name}>
                {m.name}
              </span>
              <span className="muted small">{formatBytes(m.size)}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
