import { useEffect, useRef, useState } from 'react';
import { playSound } from '../lib/sound.ts';
import { isTypingTarget } from '../lib/utils.ts';
import { isModalOpen } from './Modal.tsx';

interface Props {
  seconds: number;
  active: boolean;
  resetKey: string;
  sound: boolean;
}

/** Таймер на ответ (И10). Клавиша T — пауза и продолжение. */
export function Timer({ seconds, active, resetKey, sound }: Props) {
  const total = Math.max(1, seconds) * 1000;
  const [left, setLeft] = useState(total);
  const [paused, setPaused] = useState(false);
  const leftRef = useRef(total);

  useEffect(() => {
    leftRef.current = total;
    setLeft(total);
    setPaused(false);
  }, [resetKey, total]);

  useEffect(() => {
    if (!active || paused || leftRef.current <= 0) return;
    const end = Date.now() + leftRef.current;
    const t = setInterval(() => {
      const l = Math.max(0, end - Date.now());
      leftRef.current = l;
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        playSound('timeUp', sound);
      }
    }, 100);
    return () => clearInterval(t);
  }, [active, paused, resetKey, total, sound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen() || isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyT') setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const restart = () => {
    leftRef.current = total;
    setLeft(total);
    setPaused(false);
  };

  const sec = Math.ceil(left / 1000);
  const ratio = left / total;
  return (
    <div className={`timer${left <= 0 ? ' expired' : ''}${ratio < 0.25 && left > 0 ? ' low' : ''}${!active ? ' idle' : ''}`}>
      <div className="timer-bar">
        <div className="timer-fill" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      <span className="timer-sec">{left <= 0 ? 'Время!' : `${sec} с`}</span>
      <button className="icon-btn" onClick={() => setPaused((p) => !p)} title="Пауза / продолжить (T)" disabled={!active || left <= 0}>
        {paused ? '▶' : '❚❚'}
      </button>
      <button className="icon-btn" onClick={restart} title="Заново">
        ↻
      </button>
    </div>
  );
}
