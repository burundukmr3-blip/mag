import { useMemo, useState } from 'react';
import { confirmDialog } from '../components/Dialogs.tsx';
import { addMediaChecked, MediaPreview } from '../components/MediaField.tsx';
import { ACCEPT, getMediaBlob, guessMime, kindOf, KIND_LABEL } from '../lib/media.ts';
import { navigate } from '../lib/router.ts';
import { deleteMedia, mediaUsage, toast, useStore } from '../lib/store.ts';
import type { MediaKind } from '../lib/types.ts';
import { downloadBlob, formatBytes, formatDate, pickFiles, plural } from '../lib/utils.ts';

type Filter = MediaKind | 'all' | 'unused';

/** Медиатека: все загруженные файлы в одном месте (Р12, Р16). */
export function Library() {
  const media = useStore((s) => s.media);
  const games = useStore((s) => s.games);
  const rosters = useStore((s) => s.rosters);
  const session = useStore((s) => s.session);
  const warnMB = useStore((s) => s.settings.videoWarnMB);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'date' | 'size' | 'name'>('date');

  const usage = useMemo(() => mediaUsage({ games, rosters, session }), [games, rosters, session]);
  const total = media.reduce((n, m) => n + m.size, 0);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = media.filter(
      (m) =>
        (filter === 'all' || (filter === 'unused' ? !usage.has(m.id) : m.kind === filter)) && (!q || m.name.toLowerCase().includes(q)),
    );
    return filtered.sort((a, b) => (sort === 'size' ? b.size - a.size : sort === 'name' ? a.name.localeCompare(b.name, 'ru') : b.createdAt - a.createdAt));
  }, [media, filter, query, sort, usage]);

  const upload = async () => {
    const files = await pickFiles([ACCEPT.image, ACCEPT.video, ACCEPT.audio].join(','), true);
    let added = 0;
    for (const file of files) {
      const kind = kindOf(guessMime(file.name, file.type));
      if (!kind) {
        toast(`Неподдерживаемый файл: ${file.name}`, 'error');
        continue;
      }
      if (await addMediaChecked(file, kind)) added++;
    }
    if (added) toast(`Добавлено файлов: ${added}`);
  };

  const remove = async (id: string, name: string) => {
    const used = usage.get(id) ?? [];
    const ok = await confirmDialog({
      title: `Удалить «${name}»?`,
      text: used.length ? `Файл используется: ${used.slice(0, 3).join('; ')}${used.length > 3 ? ` и ещё ${used.length - 3}` : ''}. В этих местах он пропадёт.` : 'Файл нигде не используется.',
      ok: 'Удалить',
      danger: true,
    });
    if (ok) deleteMedia(id);
  };

  const removeUnused = async () => {
    const unused = media.filter((m) => !usage.has(m.id));
    if (!unused.length) return toast('Неиспользуемых файлов нет');
    const size = unused.reduce((n, m) => n + m.size, 0);
    const ok = await confirmDialog({
      title: `Удалить неиспользуемые файлы (${unused.length})?`,
      text: `Освободится ${formatBytes(size)}.`,
      ok: 'Удалить',
      danger: true,
    });
    if (ok) unused.forEach((m) => deleteMedia(m.id));
  };

  const download = async (id: string, name: string) => {
    const blob = await getMediaBlob(id);
    if (blob) downloadBlob(blob, name);
  };

  return (
    <div className="page library">
      <header className="page-head">
        <button className="btn ghost" onClick={() => history.length > 1 ? history.back() : navigate('/')}>
          ← Назад
        </button>
        <h1>Медиатека</h1>
        <span className="spacer" />
        <button className="btn" onClick={removeUnused}>
          Удалить неиспользуемые
        </button>
        <button className="btn primary" onClick={upload}>
          + Загрузить файлы
        </button>
      </header>
      <p className="muted">
        {media.length} {plural(media.length, ['файл', 'файла', 'файлов'])}, всего {formatBytes(total)}. Файлы можно повторно использовать в любых вопросах и играх.
        Видео больше {warnMB} МБ отмечены — их лучше сжать.
      </p>
      <div className="toolbar">
        {(['all', 'image', 'video', 'audio', 'unused'] as Filter[]).map((f) => (
          <button key={f} className={`btn small${filter === f ? ' primary' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'Все' : f === 'unused' ? 'Не используются' : KIND_LABEL[f]}
          </button>
        ))}
        <input className="search" placeholder="Поиск по названию" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="date">Сначала новые</option>
          <option value="size">Сначала большие</option>
          <option value="name">По названию</option>
        </select>
      </div>
      {list.length === 0 ? (
        <div className="empty-state muted">Файлов нет.</div>
      ) : (
        <div className="media-grid">
          {list.map((m) => {
            const used = usage.get(m.id) ?? [];
            const big = m.kind === 'video' && m.size > warnMB * 1024 * 1024;
            return (
              <article key={m.id} className="media-card">
                <MediaPreview id={m.id} kind={m.kind} />
                <span className="media-card-name" title={m.name}>
                  {m.name}
                </span>
                <span className={`small${big ? ' warn-text' : ' muted'}`}>
                  {KIND_LABEL[m.kind]} · {formatBytes(m.size)}
                  {big && ' · большой'}
                </span>
                <span className="muted small">{formatDate(m.createdAt)}</span>
                <span className="small media-usage" title={used.join('\n')}>
                  {used.length ? `Используется: ${used[0]}${used.length > 1 ? ` и ещё ${used.length - 1}` : ''}` : 'Не используется'}
                </span>
                <div className="row-actions">
                  <button className="btn small" onClick={() => download(m.id, m.name)}>
                    Скачать
                  </button>
                  <button className="btn small danger ghost" onClick={() => remove(m.id, m.name)}>
                    Удалить
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
