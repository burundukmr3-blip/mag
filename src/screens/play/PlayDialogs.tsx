import { useState } from 'react';
import { confirmDialog } from '../../components/Dialogs.tsx';
import { Avatar } from '../../components/MediaView.tsx';
import { Modal } from '../../components/Modal.tsx';
import { PlayerFields } from '../../components/PlayerFields.tsx';
import { PLAYER_COLORS } from '../../lib/model.ts';
import { navigate } from '../../lib/router.ts';
import {
  activePlayers,
  addPlayer,
  cancelLogEntry,
  finishGame,
  getPlayer,
  MAX_PLAYERS,
  removePlayer,
  replacePlayer,
  setChooser,
  setRound,
  setScore,
  startFinal,
  updatePlayer,
} from '../../lib/session.ts';
import { playSound } from '../../lib/sound.ts';
import { act, endSession, undo, useStore } from '../../lib/store.ts';
import type { Game, PlayerInput, Session } from '../../lib/types.ts';
import { formatScore, signed } from '../../lib/utils.ts';

/** Игрок: имя, цвет, аватар, счёт, право хода, замена и удаление (С2, С3, С7, С9). */
export function PlayerDialog({ session, game, playerId, onClose }: { session: Session; game: Game; playerId: string; onClose: () => void }) {
  const player = getPlayer(session, playerId);
  const [form, setForm] = useState<PlayerInput>(() => ({ name: player?.name ?? '', color: player?.color ?? PLAYER_COLORS[0], avatar: player?.avatar }));
  const [score, setScoreText] = useState(String(player?.score ?? 0));
  const [mode, setMode] = useState<'edit' | 'replace' | 'remove'>('edit');
  const [resetScore, setResetScore] = useState(false);
  if (!player) return null;
  const values = [...new Set(game.rounds[session.roundIndex]?.values ?? [100, 200, 300])].slice(0, 5);
  const current = player.score;

  const save = () => {
    const name = form.name.trim() || player.name;
    if (mode === 'replace') act((d) => replacePlayer(d, playerId, { ...form, name }, resetScore));
    else {
      act((d) => {
        updatePlayer(d, playerId, { ...form, name });
        const n = Number(score.replace(',', '.').replace(/[\s\u00a0\u202f]/g, '').replace('−', '-'));
        if (Number.isFinite(n)) setScore(d, playerId, n);
      });
    }
    onClose();
  };

  const remove = (keep: boolean) => {
    act((d) => removePlayer(d, playerId, keep));
    onClose();
  };

  if (mode === 'remove') {
    return (
      <Modal title={`Удалить игрока «${player.name}» из игры?`} onClose={() => setMode('edit')}>
        <p className="dialog-text">Сейчас у игрока {formatScore(current)} очков. Что с ними сделать?</p>
        <div className="row-actions">
          <button className="btn primary" onClick={() => remove(true)}>
            Сохранить очки в итогах
          </button>
          <button className="btn danger" onClick={() => remove(false)}>
            Обнулить очки
          </button>
          <button className="btn ghost" onClick={() => setMode('edit')}>
            Отмена
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={mode === 'replace' ? `Замена игрока «${player.name}»` : player.name}
      onClose={onClose}
      footer={
        <>
          <button className="btn danger ghost" onClick={() => setMode('remove')}>
            Удалить из игры
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" onClick={save}>
            {mode === 'replace' ? 'Заменить' : 'Сохранить'}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {mode === 'replace' && <p className="muted">За стол садится другой человек. Введите его имя и цвет.</p>}
        <PlayerFields value={form} onChange={setForm} />
        {mode === 'edit' ? (
          <>
            <div className="score-edit">
              <label className="field">
                <span>Счёт (можно отрицательный)</span>
                <input type="text" inputMode="numeric" value={score} onChange={(e) => setScoreText(e.target.value)} />
              </label>
              <div className="score-quick">
                {values.map((v) => (
                  <span key={v} className="score-pair">
                    <button type="button" className="btn small" onClick={() => setScoreText(String((Number(score) || 0) - v))}>
                      −{v}
                    </button>
                    <button type="button" className="btn small" onClick={() => setScoreText(String((Number(score) || 0) + v))}>
                      +{v}
                    </button>
                  </span>
                ))}
              </div>
              {Number(score) !== current && Number.isFinite(Number(score)) && (
                <p className="muted small">Изменение: {signed(Number(score) - current)}</p>
              )}
            </div>
            <div className="row-actions">
              {session.chooser === playerId ? (
                <button type="button" className="btn" onClick={() => act((d) => setChooser(d, undefined))}>
                  Снять право хода
                </button>
              ) : (
                <button type="button" className="btn" onClick={() => act((d) => setChooser(d, playerId))}>
                  Передать право хода
                </button>
              )}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setMode('replace');
                  setForm({ name: '', color: player.color });
                }}
              >
                Заменить игрока…
              </button>
            </div>
          </>
        ) : (
          <label className="check">
            <input type="checkbox" checked={resetScore} onChange={(e) => setResetScore(e.target.checked)} /> Обнулить очки (сейчас {formatScore(current)})
          </label>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function PlayersDialog({ session, onEdit, onClose }: { session: Session; onEdit: (id: string) => void; onClose: () => void }) {
  const [adding, setAdding] = useState<PlayerInput | null>(null);
  const active = activePlayers(session);
  const removed = session.players.filter((p) => p.removed);
  const usedColors = new Set(active.map((p) => p.color));
  return (
    <Modal title="Игроки" onClose={onClose}>
      <ul className="players-list">
        {active.map((p) => (
          <li key={p.id}>
            <Avatar id={p.avatar} name={p.name} color={p.color} />
            <span className="grow">{p.name}</span>
            <b>{formatScore(p.score)}</b>
            <button className="btn small" onClick={() => onEdit(p.id)}>
              Изменить
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          className="add-player"
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.name.trim()) return;
            act((d) => addPlayer(d, { ...adding, name: adding.name.trim() }));
            setAdding(null);
          }}
        >
          <PlayerFields value={adding} onChange={setAdding} autoFocus />
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => setAdding(null)}>
              Отмена
            </button>
            <button className="btn primary" disabled={!adding.name.trim()}>
              Добавить
            </button>
          </div>
        </form>
      ) : (
        active.length < MAX_PLAYERS && (
          <button className="btn" onClick={() => setAdding({ name: '', color: PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[0] })}>
            + Добавить игрока
          </button>
        )
      )}
      {removed.length > 0 && (
        <>
          <h3>Выбывшие</h3>
          <ul className="players-list">
            {removed.map((p) => (
              <li key={p.id} className="muted">
                <Avatar id={p.avatar} name={p.name} color={p.color} size="sm" />
                <span className="grow">
                  {p.name} {p.removed === 'keep' ? `(очки сохранены: ${formatScore(p.score)})` : '(очки обнулены)'}
                </span>
                {active.length < MAX_PLAYERS && (
                  <button
                    className="btn small"
                    onClick={() =>
                      act((d) => {
                        const x = getPlayer(d, p.id);
                        if (x) delete x.removed;
                      })
                    }
                  >
                    Вернуть
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

/** Журнал игры: кто, на какой вопрос, как ответил; любую запись можно отменить (С8). */
export function LogDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const undoCount = useStore((s) => s.undo.length);
  const kinds = { correct: 'верно', wrong: 'неверно', skip: 'никто не ответил', manual: 'вручную', final: 'финал' };
  const log = [...session.log].reverse();
  return (
    <Modal
      title="Журнал игры"
      onClose={onClose}
      wide
      footer={
        <button className="btn" onClick={() => undo()} disabled={!undoCount}>
          ↶ Отменить последнее действие (Ctrl+Z)
        </button>
      }
    >
      {log.length === 0 ? (
        <p className="muted">Пока ничего не произошло.</p>
      ) : (
        <table className="log-table">
          <thead>
            <tr>
              <th>Время</th>
              <th>Вопрос</th>
              <th>Игрок</th>
              <th>Результат</th>
              <th>Очки</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id} className={e.cancelled ? 'cancelled' : ''}>
                <td>{new Date(e.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{e.label}</td>
                <td>{e.playerName ?? '—'}</td>
                <td>{e.kind === 'final' ? (e.delta >= 0 ? 'финал: верно' : 'финал: неверно') : kinds[e.kind]}</td>
                <td className={e.delta > 0 ? 'plus' : e.delta < 0 ? 'minus' : ''}>{e.delta ? signed(e.delta) : '—'}</td>
                <td>
                  {e.cancelled ? (
                    <span className="muted small">отменено</span>
                  ) : (
                    e.delta !== 0 && (
                      <button className="btn small" onClick={() => act((d) => cancelLogEntry(d, e.id))}>
                        Отменить
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export function PlayMenu({ session, game, onClose, onSettings }: { session: Session; game: Game; onClose: () => void; onSettings: () => void }) {
  const go = (fn: () => void) => {
    fn();
    onClose();
  };
  return (
    <Modal title="Меню игры" onClose={onClose}>
      <div className="menu-list">
        <h3>Раунды</h3>
        {game.rounds.map((r, i) => (
          <button
            key={r.id}
            className={`btn menu-item${session.phase !== 'final' && session.phase !== 'results' && session.roundIndex === i ? ' current' : ''}`}
            onClick={() => go(() => act((d) => setRound(d, game, i)))}
          >
            {r.name}
          </button>
        ))}
        {game.final.length > 0 && (
          <button
            className={`btn menu-item${session.phase === 'final' ? ' current' : ''}`}
            onClick={() =>
              go(() => {
                act((d) => startFinal(d, game));
                playSound('final', session.settings.sound);
              })
            }
          >
            Финал
          </button>
        )}
        <h3>Игра</h3>
        <button className="btn menu-item" onClick={onSettings}>
          Таймер и звук
        </button>
        <button
          className="btn menu-item"
          onClick={async () => {
            const ok = await confirmDialog({ title: 'Завершить игру?', text: 'Откроется итоговый экран с местами игроков.', ok: 'Завершить' });
            if (ok) go(() => act((d) => finishGame(d)));
          }}
        >
          Завершить игру и показать итоги
        </button>
        <button className="btn menu-item" onClick={() => go(() => navigate(`/edit/${game.id}`))}>
          Открыть редактор этой игры
        </button>
        <button className="btn menu-item" onClick={() => go(() => navigate('/'))}>
          В главное меню (игра сохранится)
        </button>
        <button
          className="btn menu-item danger ghost"
          onClick={async () => {
            const ok = await confirmDialog({ title: 'Прервать игру без сохранения результата?', text: 'Текущий счёт будет потерян.', ok: 'Прервать', danger: true });
            if (ok) {
              onClose();
              endSession();
              navigate('/');
            }
          }}
        >
          Прервать игру
        </button>
      </div>
    </Modal>
  );
}

export function PlaySettingsDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const s = session.settings;
  const set = (patch: Partial<Session['settings']>) => act((d) => Object.assign(d.settings, patch), false);
  return (
    <Modal title="Таймер и звук" onClose={onClose}>
      <label className="check">
        <input type="checkbox" checked={s.timerEnabled} onChange={(e) => set({ timerEnabled: e.target.checked })} /> Таймер на ответ
      </label>
      <label className="field inline">
        <span>Время на ответ, секунд</span>
        <input type="number" min={3} max={300} value={s.timerSeconds} onChange={(e) => set({ timerSeconds: Math.max(3, Number(e.target.value) || 20) })} />
      </label>
      <label className="field inline">
        <span>Время в финале, секунд</span>
        <input type="number" min={5} max={600} value={s.finalTimerSeconds} onChange={(e) => set({ finalTimerSeconds: Math.max(5, Number(e.target.value) || 60) })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={s.sound} onChange={(e) => set({ sound: e.target.checked })} /> Звуковые сигналы
      </label>
    </Modal>
  );
}
