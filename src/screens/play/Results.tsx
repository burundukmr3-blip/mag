import { useEffect } from 'react';
import { Avatar } from '../../components/MediaView.tsx';
import { navigate } from '../../lib/router.ts';
import { createSession, standings } from '../../lib/session.ts';
import { act, addHistory, getGame, startSession, undo } from '../../lib/store.ts';
import type { Game, Session } from '../../lib/types.ts';
import { formatScore } from '../../lib/utils.ts';
import { confirmDialog } from '../../components/Dialogs.tsx';

/** Итоговый экран: места, очки, победитель (С10). Результат сохраняется в историю (С11). */
export function Results({ session, game }: { session: Session; game: Game }) {
  const table = standings(session);
  const winners = table.filter((x) => x.place === 1 && x.player.score > 0);

  useEffect(() => {
    if (session.historySaved) return;
    addHistory({
      id: session.id,
      date: Date.now(),
      gameName: session.gameName,
      players: table.map(({ player, place }) => ({ name: player.name, color: player.color, score: player.score, place })),
    });
    act((d) => {
      d.historySaved = true;
    }, false);
  }, [session.historySaved, session.id, session.gameName, table]);

  const again = async () => {
    const g = getGame(game.id);
    if (!g) return;
    const ok = await confirmDialog({ title: 'Новая игра с теми же игроками?', text: 'Счёт обнулится, табло начнётся с первого раунда.', ok: 'Начать' });
    if (!ok) return;
    startSession(createSession(g, session.players.filter((p) => !p.removed), session.settings));
  };

  return (
    <div className="results-screen">
      <h1 className="results-title">Итоги игры</h1>
      {winners.length > 0 && (
        <div className="winner">
          <div className="trophy">🏆</div>
          <div className="winner-name">
            {winners.map((w) => w.player.name).join(' и ')}
          </div>
          <div className="winner-label">{winners.length > 1 ? 'Победители' : 'Победитель'}</div>
        </div>
      )}
      <ol className="standings">
        {table.map(({ player, place }) => (
          <li key={player.id} className={`standing place-${place}`} style={{ '--pc': player.color } as React.CSSProperties}>
            <span className="standing-place">{place}</span>
            <Avatar id={player.avatar} name={player.name} color={player.color} />
            <span className="standing-name">
              {player.name}
              {player.removed && <span className="muted small"> (выбыл из игры)</span>}
            </span>
            <span className={`standing-score${player.score < 0 ? ' negative' : ''}`}>{formatScore(player.score)}</span>
          </li>
        ))}
      </ol>
      <div className="results-actions">
        <button className="btn primary big" onClick={() => navigate('/')}>
          В главное меню
        </button>
        <button className="btn big" onClick={again}>
          Сыграть ещё раз
        </button>
        <button className="btn ghost" onClick={() => undo()} title="Вернуться на шаг назад">
          ↶ Отменить последнее действие
        </button>
      </div>
    </div>
  );
}
