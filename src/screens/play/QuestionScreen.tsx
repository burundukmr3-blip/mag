import { useEffect, useState } from 'react';
import { isModalOpen } from '../../components/Modal.tsx';
import { PlayersBar } from '../../components/PlayersBar.tsx';
import { QuestionStage } from '../../components/QuestionStage.tsx';
import { Timer } from '../../components/Timer.tsx';
import { Avatar } from '../../components/MediaView.tsx';
import { findQuestion } from '../../lib/model.ts';
import {
  activePlayers,
  activeValue,
  closeQuestion,
  getPlayer,
  giveCat,
  markCorrect,
  markWrong,
  revealAnswer,
  selectAnswerer,
  setStake,
} from '../../lib/session.ts';
import { playSound } from '../../lib/sound.ts';
import { act } from '../../lib/store.ts';
import type { Game, Question, Session } from '../../lib/types.ts';
import { formatScore, isTypingTarget } from '../../lib/utils.ts';

interface Props {
  session: Session;
  game: Game;
}

export function QuestionScreen({ session, game }: Props) {
  const a = session.active!;
  const loc = findQuestion(game, a.questionId);
  const sound = session.settings.sound;
  const value = activeValue(session, game);
  const who = getPlayer(session, a.owner ?? a.selected);
  const players = activePlayers(session);

  const correct = () => {
    if (!who || a.finished) return;
    act((d) => markCorrect(d, game));
    playSound('correct', sound);
  };
  const wrong = () => {
    if (!who || a.finished) return;
    act((d) => markWrong(d, game));
    playSound('wrong', sound);
  };
  const reveal = () => act((d) => revealAnswer(d));
  const close = () => act((d) => closeQuestion(d, game));
  const select = (id: string) => act((d) => selectAnswerer(d, id));

  // Горячие клавиши (Н8): Пробел — ответ, Esc — к табло, 1–4 — игрок, Enter/+ — верно, −/Backspace — неверно, N — никто.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen() || isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey || a.stage !== 'play') return;
      const digit = /^Digit([1-9])$/.exec(e.code)?.[1];
      if (digit) {
        const p = players[Number(digit) - 1];
        if (p) select(p.id);
      } else if (e.code === 'Space') reveal();
      else if (e.code === 'Escape') close();
      else if (e.code === 'Enter' || e.code === 'NumpadAdd' || e.code === 'Equal') {
        if (a.finished) close();
        else correct();
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'Backspace') wrong();
      else if (e.code === 'KeyN' && !a.finished) close();
      else return;
      e.preventDefault();
    };
    // Пробел на кнопке в фокусе не должен нажимать её второй раз.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target instanceof HTMLButtonElement && !isModalOpen()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  if (!loc) {
    return (
      <div className="center-note">
        <p>Этот вопрос удалён из игры.</p>
        <button className="btn primary" onClick={close}>
          К табло
        </button>
      </div>
    );
  }
  const q = loc.question;
  const themeName = q.special === 'cat' && q.catTheme ? q.catTheme : loc.theme.name;

  if (a.stage === 'special') return <SpecialSplash session={session} game={game} question={q} themeName={themeName} />;

  const badge =
    q.special === 'cat' ? (
      <span className="special-badge">Кот в мешке</span>
    ) : q.special === 'stake' ? (
      <span className="special-badge">Со ставкой</span>
    ) : null;
  const answeredBy = getPlayer(session, a.answeredBy);
  const timerOn = session.settings.timerEnabled;

  return (
    <div className="question-screen">
      <QuestionStage content={q} theme={themeName} value={value} badge={badge} revealed={a.revealed} />
      <div className="host-panel">
        {timerOn && <Timer seconds={session.settings.timerSeconds} active={!a.finished && !a.revealed} resetKey={`${a.questionId}:${a.wrong.length}`} sound={sound} />}
        <div className="host-controls">
          {!a.finished ? (
            <>
              <div className="host-status">
                {who ? (
                  <>
                    Отвечает <b style={{ color: who.color }}>{who.name}</b>
                  </>
                ) : (
                  <span className="muted">Выберите отвечающего внизу или клавишами 1–{players.length}</span>
                )}
              </div>
              <button className="btn correct big" onClick={correct} disabled={!who} title="Верно (Enter)">
                ✓ Верно +{formatScore(value)}
              </button>
              <button className="btn wrong big" onClick={wrong} disabled={!who} title="Неверно (−)">
                ✗ Неверно −{formatScore(value)}
              </button>
              <button className="btn big" onClick={reveal} title="Пробел">
                {a.revealed ? 'Скрыть ответ' : 'Показать ответ'}
              </button>
              <button className="btn big ghost" onClick={close} title="N">
                Никто не ответил
              </button>
            </>
          ) : (
            <>
              <div className="host-status">
                {answeredBy ? (
                  <>
                    <b style={{ color: answeredBy.color }}>{answeredBy.name}</b>: верно, +{formatScore(value)}
                  </>
                ) : (
                  'Вопрос сыгран'
                )}
              </div>
              <button className="btn primary big" onClick={close} autoFocus title="Esc или Enter">
                К табло
              </button>
            </>
          )}
        </div>
      </div>
      <PlayersBar
        session={session}
        onPlayerClick={select}
        selected={a.owner ?? a.selected}
        wrong={a.wrong}
        only={a.owner}
        hint="Выбрать отвечающего"
      />
    </div>
  );
}

/** Заставка «Кот в мешке» / «Вопрос со ставкой» (И11). */
function SpecialSplash({ session, game, question, themeName }: { session: Session; game: Game; question: Question; themeName: string }) {
  const players = activePlayers(session);
  const isCat = question.special === 'cat';
  const [target, setTarget] = useState<string | undefined>();
  const [stake, setStakeValue] = useState(question.value);
  const targetPlayer = getPlayer(session, target);
  const catValue = question.catValue || question.value;

  const choose = (id: string) => {
    setTarget(id);
  };

  const go = () => {
    if (!target) return;
    if (isCat) act((d) => giveCat(d, game, target));
    else act((d) => setStake(d, target, stake));
  };

  return (
    <div className="special-screen">
      <div className="special-title">{isCat ? '🐱 Кот в мешке!' : '💰 Вопрос со ставкой'}</div>
      <div className="special-info">
        <div>
          Тема: <b>{themeName || '—'}</b>
        </div>
        <div>{isCat ? <>Стоимость: <b>{formatScore(catValue)}</b></> : <>Минимальная ставка: <b>{formatScore(question.value)}</b></>}</div>
      </div>
      <div className="special-ask">{isCat ? 'Кому отдаёте вопрос?' : 'Кто сделал самую высокую ставку?'}</div>
      <div className="special-players">
        {players.map((p) => {
          const self = isCat && session.chooser === p.id && players.length > 1;
          return (
            <button
              key={p.id}
              className={`special-player${target === p.id ? ' active' : ''}`}
              style={{ '--pc': p.color } as React.CSSProperties}
              onClick={() => choose(p.id)}
              disabled={self}
              title={self ? 'Кота в мешке отдают другому игроку' : undefined}
            >
              <Avatar id={p.avatar} name={p.name} color={p.color} />
              <span>{p.name}</span>
              <span className="muted">{formatScore(p.score)}</span>
            </button>
          );
        })}
      </div>
      {!isCat && (
        <div className="stake-row">
          <label>
            Ставка
            <input
              type="number"
              min={question.value}
              step={100}
              value={stake}
              onChange={(e) => setStakeValue(Number(e.target.value))}
            />
          </label>
          {targetPlayer && targetPlayer.score > question.value && (
            <button className="btn" onClick={() => setStakeValue(targetPlayer.score)}>
              Ва-банк ({formatScore(targetPlayer.score)})
            </button>
          )}
        </div>
      )}
      <div className="special-actions">
        <button className="btn primary big" disabled={!target || (!isCat && !(stake > 0))} onClick={go}>
          Показать вопрос
        </button>
        <button
          className="btn ghost"
          onClick={() =>
            act((d) => {
              if (d.active) d.active.stage = 'play';
            })
          }
        >
          Играть как обычный вопрос
        </button>
      </div>
    </div>
  );
}
