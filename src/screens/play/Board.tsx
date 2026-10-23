import { useEffect, useRef, type KeyboardEvent } from 'react';
import { confirmDialog } from '../../components/Dialogs.tsx';
import { PlayersBar } from '../../components/PlayersBar.tsx';
import { sortedQuestions } from '../../lib/model.ts';
import { getPlayer, isRoundComplete, openQuestion, returnQuestion, setRound, startFinal, finishGame } from '../../lib/session.ts';
import { playSound } from '../../lib/sound.ts';
import { act } from '../../lib/store.ts';
import type { Game, Question, Session } from '../../lib/types.ts';
import { formatScore } from '../../lib/utils.ts';

interface Props {
  session: Session;
  game: Game;
  onPlayer: (id: string) => void;
}

/** Табло: темы — строки, номиналы — столбцы, сыгранные карточки затемнены (И1, И4). */
export function Board({ session, game, onPlayer }: Props) {
  const round = game.rounds[session.roundIndex];
  const gridRef = useRef<HTMLDivElement>(null);
  const complete = isRoundComplete(session, game);
  const isLast = session.roundIndex >= game.rounds.length - 1;
  const chooser = getPlayer(session, session.chooser);

  useEffect(() => {
    // Фокус на первую несыгранную карточку — сразу работают стрелки и Enter (Н8).
    if (gridRef.current?.contains(document.activeElement)) return;
    gridRef.current?.querySelector<HTMLButtonElement>('.card:not(.played)')?.focus({ preventScroll: true });
  }, [session.roundIndex]);

  if (!round) return <div className="center-note">В игре нет раундов. Добавьте их в редакторе.</div>;
  const cols = Math.max(1, ...round.themes.map((t) => t.questions.length));

  const open = (q: Question) => {
    act((d) => openQuestion(d, game, q.id));
    playSound(q.special === 'none' ? 'open' : 'special', session.settings.sound);
  };

  const onCard = async (q: Question, themeName: string) => {
    if (!session.played.includes(q.id)) return open(q);
    const ok = await confirmDialog({ title: 'Вернуть вопрос на табло?', text: `${themeName} · ${q.value}. Очки, полученные за него, не изменятся.`, ok: 'Вернуть' });
    if (ok) act((d) => returnQuestion(d, q.id));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const r = Number(target.dataset.row);
    const c = Number(target.dataset.col);
    if (Number.isNaN(r)) return;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const mv = moves[e.key];
    if (!mv) return;
    e.preventDefault();
    const next = gridRef.current?.querySelector<HTMLElement>(`[data-row="${r + mv[0]}"][data-col="${c + mv[1]}"]`);
    next?.focus();
  };

  return (
    <div className="board-screen">
      <div className="board-title">
        <h1>{round.name}</h1>
        {chooser && (
          <span className="board-chooser" style={{ color: chooser.color }}>
            Выбирает: {chooser.name}
          </span>
        )}
      </div>
      <div
        ref={gridRef}
        className="board"
        style={{ gridTemplateColumns: `minmax(8rem, 1.6fr) repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${round.themes.length}, 1fr)` }}
        onKeyDown={onKeyDown}
      >
        {round.themes.map((theme, r) => {
          const qs = sortedQuestions(theme);
          return [
            <div key={theme.id} className="board-theme">
              {theme.name || 'Без названия'}
            </div>,
            ...Array.from({ length: cols }, (_, c) => {
              const q = qs[c];
              if (!q) return <div key={`${theme.id}-${c}`} className="card empty" />;
              const played = session.played.includes(q.id);
              return (
                <button
                  key={q.id}
                  className={`card${played ? ' played' : ''}`}
                  data-row={r}
                  data-col={c}
                  onClick={() => onCard(q, theme.name)}
                  title={played ? 'Сыгран. Нажмите, чтобы вернуть на табло' : `${theme.name} · ${q.value}`}
                >
                  {played ? '' : formatScore(q.value)}
                </button>
              );
            }),
          ];
        })}
      </div>
      {complete && (
        <div className="round-done">
          <span>Раунд завершён</span>
          {!isLast ? (
            <button className="btn primary big" onClick={() => act((d) => setRound(d, game, d.roundIndex + 1))}>
              {game.rounds[session.roundIndex + 1].name} →
            </button>
          ) : game.final.length ? (
            <button
              className="btn primary big"
              onClick={() => {
                act((d) => startFinal(d, game));
                playSound('final', session.settings.sound);
              }}
            >
              Финал →
            </button>
          ) : (
            <button className="btn primary big" onClick={() => act((d) => finishGame(d))}>
              Итоги →
            </button>
          )}
        </div>
      )}
      <PlayersBar session={session} onPlayerClick={onPlayer} />
    </div>
  );
}
