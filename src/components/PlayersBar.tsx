import { leaders } from '../lib/session.ts';
import type { Session } from '../lib/types.ts';
import { formatScore } from '../lib/utils.ts';
import { Avatar } from './MediaView.tsx';

interface Props {
  session: Session;
  onPlayerClick?: (playerId: string) => void;
  selected?: string;
  wrong?: string[];
  only?: string;
  hint?: string;
}

/** Счёт игроков внизу экрана, лидер выделен, отмечен выбирающий вопрос (С5, С9). */
export function PlayersBar({ session, onPlayerClick, selected, wrong = [], only, hint }: Props) {
  const lead = leaders(session);
  const players = session.players.filter((p) => !p.removed);
  return (
    <div className="players-bar">
      {players.map((p, i) => {
        const isWrong = wrong.includes(p.id);
        const disabled = isWrong || (only !== undefined && only !== p.id);
        const cls = [
          'player-card',
          lead.includes(p.id) && 'leader',
          session.chooser === p.id && 'chooser',
          selected === p.id && 'selected',
          isWrong && 'wrong',
          disabled && 'disabled',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={p.id}
            className={cls}
            style={{ '--pc': p.color } as React.CSSProperties}
            onClick={() => onPlayerClick?.(p.id)}
            title={hint ? `${hint} (${i + 1})` : undefined}
          >
            <Avatar id={p.avatar} name={p.name} color={p.color} />
            <span className="player-info">
              <span className="player-name">
                {lead.includes(p.id) && <span className="crown">♛</span>}
                {p.name}
              </span>
              <span className={`player-score${p.score < 0 ? ' negative' : ''}`}>{formatScore(p.score)}</span>
            </span>
            {session.chooser === p.id && <span className="chooser-badge">ход</span>}
            {isWrong && <span className="wrong-badge">✗</span>}
            <kbd className="player-key">{i + 1}</kbd>
          </button>
        );
      })}
    </div>
  );
}
