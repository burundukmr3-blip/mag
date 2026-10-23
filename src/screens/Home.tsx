import { useEffect, useState } from 'react';
import { confirmDialog, promptDialog } from '../components/Dialogs.tsx';
import { storageEstimate } from '../lib/db.ts';
import { FILE_EXT } from '../lib/exchange.ts';
import { countQuestions } from '../lib/model.ts';
import { navigate } from '../lib/router.ts';
import { createSampleGame } from '../lib/sample.ts';
import {
  addGame,
  createGame,
  deleteGame,
  duplicateGame,
  endSession,
  exportGame,
  importGameFile,
  toast,
  updateGame,
  useStore,
} from '../lib/store.ts';
import { formatBytes, formatDate, pickFiles, plural } from '../lib/utils.ts';

export function Home() {
  const games = useStore((s) => s.games);
  const session = useStore((s) => s.session);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    storageEstimate().then(setStorage);
  }, [games]);

  const create = async () => {
    const name = await promptDialog({ title: 'Новая игра', label: 'Название', value: 'Новая игра', ok: 'Создать' });
    if (!name) return;
    const game = createGame(name);
    navigate(`/edit/${game.id}`);
  };

  const rename = async (id: string, current: string) => {
    const name = await promptDialog({ title: 'Переименовать игру', label: 'Название', value: current, ok: 'Сохранить' });
    if (name) updateGame(id, (d) => void (d.name = name));
  };

  const remove = async (id: string, name: string) => {
    const ok = await confirmDialog({
      title: `Удалить игру «${name}»?`,
      text: 'Это нельзя отменить. Картинки и видео останутся в медиатеке, их можно удалить там. Перед удалением можно сделать экспорт.',
      ok: 'Удалить',
      danger: true,
    });
    if (ok) deleteGame(id);
  };

  const importFile = async () => {
    const [file] = await pickFiles(`${FILE_EXT},.json`);
    if (!file) return;
    setBusy(true);
    try {
      const game = await importGameFile(file);
      toast(`Игра «${game.name}» импортирована`);
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : 'Не удалось импортировать файл', 'error');
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (id: string) => {
    setBusy(true);
    try {
      await exportGame(id);
    } catch (err) {
      console.error(err);
      toast('Не удалось сделать экспорт', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sample = () => {
    const game = addGame(createSampleGame());
    toast(`Добавлена игра «${game.name}»`);
  };

  const unfinished = session && !session.finished ? session : null;

  return (
    <div className="page home">
      <header className="page-head">
        <h1 className="logo">Своя игра</h1>
        <span className="spacer" />
        <button className="btn ghost" onClick={() => navigate('/library')}>
          Медиатека
        </button>
        <button className="btn ghost" onClick={() => navigate('/history')}>
          История игр
        </button>
        <button className="btn ghost" onClick={() => navigate('/settings')}>
          Настройки
        </button>
      </header>

      {unfinished && (
        <div className="resume">
          <div>
            <b>Незаконченная игра «{unfinished.gameName}»</b>
            <div className="muted small">
              {unfinished.players
                .filter((p) => !p.removed)
                .map((p) => `${p.name}: ${p.score}`)
                .join(' · ')}{' '}
              · сохранено {formatDate(unfinished.updatedAt)}
            </div>
          </div>
          <span className="spacer" />
          <button className="btn primary big" onClick={() => navigate('/play')}>
            ▶ Продолжить
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              const ok = await confirmDialog({ title: 'Прервать незаконченную игру?', text: 'Счёт будет потерян.', ok: 'Прервать', danger: true });
              if (ok) endSession();
            }}
          >
            Прервать
          </button>
        </div>
      )}

      {session?.finished && (
        <div className="resume">
          <span>Последняя игра «{session.gameName}» завершена.</span>
          <span className="spacer" />
          <button className="btn" onClick={() => navigate('/play')}>
            Итоги
          </button>
        </div>
      )}

      <div className="home-actions">
        <button className="btn primary" onClick={create}>
          + Новая игра
        </button>
        <button className="btn" onClick={importFile} disabled={busy}>
          Импорт из файла ({FILE_EXT})
        </button>
        <button className="btn" onClick={sample}>
          Добавить пример «Осень и Хэллоуин»
        </button>
      </div>

      {games.length === 0 ? (
        <div className="empty-state">
          <p>Игр пока нет.</p>
          <p className="muted">Создайте новую игру, импортируйте файл или начните с готового примера «Осень и Хэллоуин».</p>
        </div>
      ) : (
        <div className="games-grid">
          {games.map((g) => {
            const n = countQuestions(g);
            return (
              <article key={g.id} className="game-card">
                <h2 title={g.name}>{g.name}</h2>
                <p className="muted small">
                  {g.rounds.length} {plural(g.rounds.length, ['раунд', 'раунда', 'раундов'])} · {n} {plural(n, ['вопрос', 'вопроса', 'вопросов'])}
                  {g.final.length ? ` · финал` : ''}
                </p>
                <p className="muted small">Изменена {formatDate(g.updatedAt)}</p>
                <div className="game-card-actions">
                  <button className="btn primary" onClick={() => navigate(`/setup/${g.id}`)}>
                    ▶ Играть
                  </button>
                  <button className="btn" onClick={() => navigate(`/edit/${g.id}`)}>
                    Редактировать
                  </button>
                </div>
                <div className="game-card-actions small">
                  <button className="btn small ghost" onClick={() => rename(g.id, g.name)}>
                    Переименовать
                  </button>
                  <button
                    className="btn small ghost"
                    onClick={() => {
                      const copy = duplicateGame(g.id);
                      if (copy) toast(`Создана копия «${copy.name}»`);
                    }}
                  >
                    Копировать
                  </button>
                  <button className="btn small ghost" onClick={() => doExport(g.id)} disabled={busy}>
                    Экспорт
                  </button>
                  <button className="btn small ghost danger" onClick={() => remove(g.id, g.name)}>
                    Удалить
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <footer className="page-foot muted small">
        Все игры, картинки и видео хранятся только в этом браузере на этом устройстве. Чтобы перенести игру на другое устройство, используйте «Экспорт» и
        «Импорт из файла».
        {storage && storage.quota > 0 && (
          <>
            {' '}
            Занято {formatBytes(storage.usage)} из доступных {formatBytes(storage.quota)}.
          </>
        )}
      </footer>
    </div>
  );
}
