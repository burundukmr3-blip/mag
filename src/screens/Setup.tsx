import { useMemo, useState } from 'react';
import { confirmDialog, promptDialog } from '../components/Dialogs.tsx';
import { PlayerFields } from '../components/PlayerFields.tsx';
import { PLAYER_COLORS } from '../lib/model.ts';
import { navigate } from '../lib/router.ts';
import { createSession, MAX_PLAYERS, MIN_PLAYERS } from '../lib/session.ts';
import { deleteRoster, getGame, getState, saveRoster, startSession, toast, useStore } from '../lib/store.ts';
import type { PlayerInput, SessionSettings } from '../lib/types.ts';
import { validateGame } from '../lib/validate.ts';
import { IssueList } from './editor/Panels.tsx';

function defaultPlayers(): PlayerInput[] {
  return [
    { name: 'Игрок 1', color: PLAYER_COLORS[0] },
    { name: 'Игрок 2', color: PLAYER_COLORS[1] },
    { name: 'Игрок 3', color: PLAYER_COLORS[2] },
  ];
}

/** Подготовка игры: выбор игры, игроки (С1, С4), таймер и звук, проверка (Р15). */
export function Setup({ id }: { id?: string }) {
  const games = useStore((s) => s.games);
  const rosters = useStore((s) => s.rosters);
  const media = useStore((s) => s.media);
  const appSettings = useStore((s) => s.settings);
  const [gameId, setGameId] = useState(() => (id && games.some((g) => g.id === id) ? id : (games[0]?.id ?? '')));
  const game = games.find((g) => g.id === gameId);
  const [players, setPlayers] = useState<PlayerInput[]>(() => rosters[0]?.players ?? defaultPlayers());
  const [startRound, setStartRound] = useState(0);
  const [showIssues, setShowIssues] = useState(false);
  const [settings, setSettings] = useState<SessionSettings>(() => {
    const g = getGame(id) ?? games[0];
    const s = getState().settings;
    return {
      timerEnabled: g?.settings.timerEnabled ?? s.timerEnabled,
      timerSeconds: g?.settings.timerSeconds ?? s.timerSeconds,
      finalTimerSeconds: g?.settings.finalTimerSeconds ?? s.finalTimerSeconds,
      sound: s.sound,
    };
  });

  const issues = useMemo(
    () => (game ? validateGame(game, new Map(media.map((m) => [m.id, m])), appSettings.videoWarnMB * 1024 * 1024) : []),
    [game, media, appSettings.videoWarnMB],
  );
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  const named = players.filter((p) => p.name.trim());
  const canStart = !!game && named.length >= MIN_PLAYERS && named.length === players.length;

  const pickGame = (gid: string) => {
    setGameId(gid);
    setStartRound(0);
    const g = getGame(gid);
    if (g) setSettings((s) => ({ ...s, ...g.settings }));
  };

  const updatePlayer = (i: number, p: PlayerInput) => setPlayers((list) => list.map((x, j) => (j === i ? p : x)));

  const addPlayer = () => {
    const used = new Set(players.map((p) => p.color));
    setPlayers((list) => [...list, { name: `Игрок ${list.length + 1}`, color: PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0] }]);
  };

  const saveList = async () => {
    const name = await promptDialog({ title: 'Сохранить список игроков', label: 'Название списка', value: named.map((p) => p.name).join(', '), ok: 'Сохранить' });
    if (!name) return;
    saveRoster(name, players);
    toast(`Список «${name}» сохранён`);
  };

  const start = async () => {
    if (!game || !canStart) return;
    const current = getState().session;
    if (current && !current.finished) {
      const ok = await confirmDialog({
        title: 'Есть незаконченная игра',
        text: `Игра «${current.gameName}» не закончена. Начать новую? Счёт старой игры будет потерян.`,
        ok: 'Начать новую',
        danger: true,
      });
      if (!ok) return;
    }
    if (errors.length) {
      const ok = await confirmDialog({
        title: `В игре ${errors.length} ошибок`,
        text: 'Есть пустые вопросы или пропавшие файлы. Начать всё равно?',
        ok: 'Начать',
      });
      if (!ok) return;
    }
    startSession(createSession(game, players.map((p) => ({ ...p, name: p.name.trim() })), settings, startRound));
    navigate('/play');
  };

  if (!games.length) {
    return (
      <div className="center-note">
        <p>Сначала создайте игру.</p>
        <button className="btn primary" onClick={() => navigate('/')}>
          К списку игр
        </button>
      </div>
    );
  }

  return (
    <div className="page setup">
      <header className="page-head">
        <button className="btn ghost" onClick={() => navigate('/')}>
          ← Игры
        </button>
        <h1>Подготовка к игре</h1>
      </header>

      <section className="setup-section">
        <label className="field">
          <span>Игра</span>
          <select value={gameId} onChange={(e) => pickGame(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        {game && game.rounds.length > 1 && (
          <label className="field inline">
            <span>Начать с раунда</span>
            <select value={startRound} onChange={(e) => setStartRound(Number(e.target.value))}>
              {game.rounds.map((r, i) => (
                <option key={r.id} value={i}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {game && (
          <div className={`setup-check ${errors.length ? 'has-errors' : warnings.length ? 'has-warnings' : 'ok'}`}>
            {issues.length === 0 ? (
              <span>✓ Проверка игры: всё в порядке</span>
            ) : (
              <>
                <span>
                  Проверка игры: {errors.length > 0 && `ошибок — ${errors.length}`}
                  {errors.length > 0 && warnings.length > 0 && ', '}
                  {warnings.length > 0 && `предупреждений — ${warnings.length}`}
                </span>
                <button className="btn small" onClick={() => setShowIssues((v) => !v)}>
                  {showIssues ? 'Скрыть' : 'Подробнее'}
                </button>
                <button className="btn small" onClick={() => navigate(`/edit/${game.id}`)}>
                  Открыть редактор
                </button>
              </>
            )}
          </div>
        )}
        {showIssues && <IssueList errors={errors} warnings={warnings} />}
      </section>

      <section className="setup-section">
        <div className="section-head">
          <h2>
            Игроки ({players.length} из {MAX_PLAYERS})
          </h2>
          <span className="spacer" />
          {rosters.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                const r = rosters.find((x) => x.id === e.target.value);
                if (r) setPlayers(r.players.slice(0, MAX_PLAYERS).map((p) => ({ ...p })));
              }}
            >
              <option value="" disabled>
                Загрузить сохранённый список…
              </option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn small" onClick={saveList} disabled={!named.length}>
            Сохранить список
          </button>
        </div>
        <div className="setup-players">
          {players.map((p, i) => (
            <div key={i} className="setup-player">
              <PlayerFields value={p} onChange={(v) => updatePlayer(i, v)} />
              <button
                className="icon-btn"
                disabled={players.length <= MIN_PLAYERS}
                onClick={() => setPlayers((list) => list.filter((_, j) => j !== i))}
                title="Убрать игрока"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {players.length < MAX_PLAYERS && (
          <button className="btn" onClick={addPlayer}>
            + Добавить игрока
          </button>
        )}
        {named.length !== players.length && <p className="warn-text">У каждого игрока должно быть имя.</p>}
        {rosters.length > 0 && (
          <details className="rosters">
            <summary className="muted small">Сохранённые списки ({rosters.length})</summary>
            <ul>
              {rosters.map((r) => (
                <li key={r.id}>
                  {r.name}: <span className="muted">{r.players.map((p) => p.name).join(', ')}</span>{' '}
                  <button className="btn small ghost" onClick={() => deleteRoster(r.id)}>
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="setup-section">
        <h2>Таймер и звук</h2>
        <div className="setup-row">
          <label className="check">
            <input type="checkbox" checked={settings.timerEnabled} onChange={(e) => setSettings({ ...settings, timerEnabled: e.target.checked })} /> Таймер на
            ответ
          </label>
          <label className="field inline">
            <span>секунд</span>
            <input
              type="number"
              min={3}
              max={300}
              disabled={!settings.timerEnabled}
              value={settings.timerSeconds}
              onChange={(e) => setSettings({ ...settings, timerSeconds: Math.max(3, Number(e.target.value) || 20) })}
            />
          </label>
          <label className="field inline">
            <span>в финале, секунд</span>
            <input
              type="number"
              min={5}
              max={600}
              disabled={!settings.timerEnabled}
              value={settings.finalTimerSeconds}
              onChange={(e) => setSettings({ ...settings, finalTimerSeconds: Math.max(5, Number(e.target.value) || 60) })}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.sound} onChange={(e) => setSettings({ ...settings, sound: e.target.checked })} /> Звуковые сигналы
          </label>
        </div>
      </section>

      <div className="setup-start">
        <button className="btn primary huge" disabled={!canStart} onClick={start}>
          ▶ Начать игру
        </button>
        <p className="muted small">
          Совет: нажмите F или кнопку ⛶ на табло, чтобы включить полноэкранный режим для проектора.
        </p>
      </div>
    </div>
  );
}
