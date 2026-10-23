import { useState } from 'react';
import { PlayersBar } from '../../components/PlayersBar.tsx';
import { QuestionStage } from '../../components/QuestionStage.tsx';
import { Timer } from '../../components/Timer.tsx';
import {
  applyFinal,
  betsComplete,
  finishGame,
  getPlayer,
  remainingFinalThemes,
  removeFinalTheme,
  setBet,
  setFinalResult,
  showFinalAnswer,
  showFinalQuestion,
} from '../../lib/session.ts';
import { playSound } from '../../lib/sound.ts';
import { act } from '../../lib/store.ts';
import type { Game, Session } from '../../lib/types.ts';
import { formatScore } from '../../lib/utils.ts';

interface Props {
  session: Session;
  game: Game;
  onPlayer: (id: string) => void;
}

/** Финальный раунд: выбор темы, ставки, вопрос, оценка ответов (И12). */
export function FinalScreen({ session, game, onPlayer }: Props) {
  const f = session.final!;
  const participants = f.participants.map((id) => getPlayer(session, id)!).filter(Boolean);
  const question = game.final.find((x) => x.id === f.questionId);

  if (!participants.length) {
    return (
      <div className="final-screen">
        <h1 className="final-title">Финал</h1>
        <p className="center-note">Нет игроков с положительным счётом — финал не играется.</p>
        <div className="final-actions">
          <button className="btn primary big" onClick={() => act((d) => finishGame(d))}>
            К итогам
          </button>
        </div>
        <PlayersBar session={session} onPlayerClick={onPlayer} />
      </div>
    );
  }

  if (f.stage === 'themes') {
    const remaining = remainingFinalThemes(session, game);
    // Темы убирают по очереди, начиная с игрока с наименьшим счётом.
    const order = [...participants].sort((a, b) => a.score - b.score);
    const turn = order[f.removed.length % order.length];
    return (
      <div className="final-screen">
        <h1 className="final-title">Финал</h1>
        <p className="final-hint">
          Убирает тему: <b style={{ color: turn.color }}>{turn.name}</b>. Останется одна.
        </p>
        <div className="final-themes">
          {game.final.map((t) => {
            const removed = f.removed.includes(t.id);
            return (
              <button
                key={t.id}
                className={`final-theme${removed ? ' removed' : ''}`}
                disabled={removed || remaining.length <= 1}
                onClick={() => act((d) => removeFinalTheme(d, game, t.id))}
              >
                {t.theme || 'Без названия'}
              </button>
            );
          })}
        </div>
        <PlayersBar session={session} onPlayerClick={onPlayer} />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="center-note">
        Вопрос финала не найден.
        <button className="btn primary" onClick={() => act((d) => finishGame(d))}>
          К итогам
        </button>
      </div>
    );
  }

  if (f.stage === 'bets') return <Bets session={session} game={game} theme={question.theme} onPlayer={onPlayer} />;

  const answer = f.stage === 'answer';
  const allMarked = participants.every((p) => f.results[p.id] !== undefined);
  return (
    <div className="question-screen final">
      <QuestionStage content={question} theme={`Финал · ${question.theme}`} revealed={answer} />
      <div className="host-panel">
        {!answer && session.settings.timerEnabled && (
          <Timer seconds={session.settings.finalTimerSeconds} active resetKey={`final:${question.id}`} sound={session.settings.sound} />
        )}
        {!answer ? (
          <div className="host-controls">
            <div className="host-status">Игроки пишут ответы</div>
            <button className="btn primary big" onClick={() => act((d) => showFinalAnswer(d))}>
              Показать ответ
            </button>
          </div>
        ) : (
          <div className="final-results">
            {participants.map((p) => (
              <div key={p.id} className="final-result-row" style={{ '--pc': p.color } as React.CSSProperties}>
                <span className="final-result-name">{p.name}</span>
                <span className="muted">ставка {formatScore(f.bets[p.id] ?? 0)}</span>
                <button className={`btn correct${f.results[p.id] === true ? ' on' : ''}`} onClick={() => act((d) => setFinalResult(d, p.id, true))}>
                  ✓ Верно
                </button>
                <button className={`btn wrong${f.results[p.id] === false ? ' on' : ''}`} onClick={() => act((d) => setFinalResult(d, p.id, false))}>
                  ✗ Неверно
                </button>
              </div>
            ))}
            <button
              className="btn primary big"
              disabled={!allMarked}
              onClick={() => {
                act((d) => applyFinal(d, game));
                playSound('final', session.settings.sound);
              }}
            >
              Подвести итоги
            </button>
          </div>
        )}
      </div>
      <PlayersBar session={session} onPlayerClick={onPlayer} />
    </div>
  );
}

function Bets({ session, theme, onPlayer }: { session: Session; game: Game; theme: string; onPlayer: (id: string) => void }) {
  const f = session.final!;
  const [hidden, setHidden] = useState(true);
  const others = session.players.filter((p) => !p.removed && !f.participants.includes(p.id));
  return (
    <div className="final-screen">
      <h1 className="final-title">Финал</h1>
      <div className="final-chosen">
        Тема: <b>{theme || 'Без названия'}</b>
      </div>
      <p className="final-hint">Игроки записывают ставки, ведущий вводит их. Ставка — от 1 до текущего счёта.</p>
      <div className="bets">
        {f.participants.map((id) => {
          const p = getPlayer(session, id)!;
          return (
            <label key={id} className="bet-row" style={{ '--pc': p.color } as React.CSSProperties}>
              <span className="bet-name">{p.name}</span>
              <span className="muted">из {formatScore(p.score)}</span>
              <input
                type={hidden ? 'password' : 'number'}
                inputMode="numeric"
                min={1}
                max={p.score}
                value={f.bets[id] ?? ''}
                placeholder="ставка"
                onChange={(e) => act((d) => setBet(d, id, Number(e.target.value.replace(/\D/g, ''))), false)}
              />
              <button type="button" className="btn small" onClick={() => act((d) => setBet(d, id, p.score), false)}>
                Ва-банк
              </button>
            </label>
          );
        })}
      </div>
      <label className="check">
        <input type="checkbox" checked={!hidden} onChange={(e) => setHidden(!e.target.checked)} /> Показывать ставки
      </label>
      {others.length > 0 && <p className="muted">Не участвуют (счёт не больше нуля): {others.map((p) => p.name).join(', ')}</p>}
      <div className="final-actions">
        <button className="btn primary big" disabled={!betsComplete(session)} onClick={() => act((d) => showFinalQuestion(d))}>
          Показать вопрос
        </button>
      </div>
      <PlayersBar session={session} onPlayerClick={onPlayer} />
    </div>
  );
}
