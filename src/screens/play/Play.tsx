import { useEffect, useState } from 'react';
import { isModalOpen } from '../../components/Modal.tsx';
import { navigate } from '../../lib/router.ts';
import { act, endSession, toast, undo, useStore } from '../../lib/store.ts';
import { isTypingTarget, toggleFullscreen } from '../../lib/utils.ts';
import { Board } from './Board.tsx';
import { FinalScreen } from './FinalScreen.tsx';
import { LogDialog, PlayerDialog, PlayersDialog, PlayMenu, PlaySettingsDialog } from './PlayDialogs.tsx';
import { QuestionScreen } from './QuestionScreen.tsx';
import { Results } from './Results.tsx';

type Dialog = { type: 'player'; id: string } | { type: 'players' } | { type: 'log' } | { type: 'menu' } | { type: 'settings' } | null;

export function Play() {
  const session = useStore((s) => s.session);
  const games = useStore((s) => s.games);
  const undoCount = useStore((s) => s.undo.length);
  const [dialog, setDialog] = useState<Dialog>(null);
  const game = games.find((g) => g.id === session?.gameId);

  // Ctrl+Z / U — отмена последнего действия (И14), F — полноэкранный режим (Н2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen() || isTypingTarget(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (undo()) toast('Последнее действие отменено');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyU') {
        if (undo()) toast('Последнее действие отменено');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyF') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!session) {
    return (
      <div className="center-note">
        <p>Нет начатой игры.</p>
        <button className="btn primary" onClick={() => navigate('/')}>
          В главное меню
        </button>
      </div>
    );
  }
  if (!game) {
    return (
      <div className="center-note">
        <p>Игра «{session.gameName}» удалена из списка игр.</p>
        <button
          className="btn primary"
          onClick={() => {
            endSession();
            navigate('/');
          }}
        >
          Закончить и выйти
        </button>
      </div>
    );
  }

  const openPlayer = (id: string) => setDialog({ type: 'player', id });
  const roundName = session.phase === 'final' ? 'Финал' : session.phase === 'results' ? 'Итоги' : game.rounds[session.roundIndex]?.name;

  return (
    <div className={`play phase-${session.phase}`}>
      <header className="play-top">
        <span className="play-game" title={game.name}>
          {game.name}
          <span className="muted"> · {roundName}</span>
        </span>
        <span className="spacer" />
        <button className="btn small" onClick={() => undo() && toast('Последнее действие отменено')} disabled={!undoCount} title="Отменить последнее действие (Ctrl+Z)">
          ↶ Отменить
        </button>
        <button className="btn small" onClick={() => setDialog({ type: 'log' })} title="Журнал игры">
          Журнал
        </button>
        <button className="btn small" onClick={() => setDialog({ type: 'players' })}>
          Игроки
        </button>
        <button
          className="btn small"
          onClick={() => act((d) => void (d.settings.sound = !d.settings.sound), false)}
          title={session.settings.sound ? 'Выключить звук' : 'Включить звук'}
        >
          {session.settings.sound ? '🔊' : '🔇'}
        </button>
        <button className="btn small" onClick={toggleFullscreen} title="Полный экран (F)">
          ⛶
        </button>
        <button className="btn small" onClick={() => setDialog({ type: 'menu' })}>
          ☰ Меню
        </button>
      </header>
      <main className="play-main">
        {session.phase === 'board' && <Board session={session} game={game} onPlayer={openPlayer} />}
        {session.phase === 'question' && session.active && <QuestionScreen session={session} game={game} />}
        {session.phase === 'final' && session.final && <FinalScreen session={session} game={game} onPlayer={openPlayer} />}
        {session.phase === 'results' && <Results session={session} game={game} />}
      </main>
      {dialog?.type === 'player' && <PlayerDialog key={dialog.id} session={session} game={game} playerId={dialog.id} onClose={() => setDialog(null)} />}
      {dialog?.type === 'players' && <PlayersDialog session={session} onEdit={openPlayer} onClose={() => setDialog(null)} />}
      {dialog?.type === 'log' && <LogDialog session={session} onClose={() => setDialog(null)} />}
      {dialog?.type === 'menu' && (
        <PlayMenu session={session} game={game} onClose={() => setDialog(null)} onSettings={() => setDialog({ type: 'settings' })} />
      )}
      {dialog?.type === 'settings' && <PlaySettingsDialog session={session} onClose={() => setDialog(null)} />}
    </div>
  );
}
