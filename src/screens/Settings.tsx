import { useEffect, useState } from 'react';
import { requestPersistence, storageEstimate } from '../lib/db.ts';
import { navigate } from '../lib/router.ts';
import { saveSettings, toast, useStore } from '../lib/store.ts';
import { formatBytes } from '../lib/utils.ts';

const HOTKEYS: [string, string][] = [
  ['Стрелки, Enter', 'выбор карточки на табло'],
  ['Пробел', 'показать или скрыть ответ'],
  ['1–4', 'выбрать отвечающего игрока'],
  ['Enter или +', 'верно'],
  ['− или Backspace', 'неверно'],
  ['N', 'никто не ответил'],
  ['Esc', 'назад к табло'],
  ['T', 'пауза таймера'],
  ['Ctrl+Z или U', 'отменить последнее действие'],
  ['F', 'полноэкранный режим'],
];

export function Settings() {
  const s = useStore((x) => x.settings);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
    storageEstimate().then(setStorage);
  }, []);

  return (
    <div className="page settings">
      <header className="page-head">
        <button className="btn ghost" onClick={() => navigate('/')}>
          ← Игры
        </button>
        <h1>Настройки</h1>
      </header>

      <section className="setup-section">
        <h2>По умолчанию для новых игр</h2>
        <label className="check">
          <input type="checkbox" checked={s.sound} onChange={(e) => saveSettings({ sound: e.target.checked })} /> Звуковые сигналы
        </label>
        <label className="check">
          <input type="checkbox" checked={s.timerEnabled} onChange={(e) => saveSettings({ timerEnabled: e.target.checked })} /> Таймер на ответ
        </label>
        <label className="field inline">
          <span>Время на ответ, секунд</span>
          <input type="number" min={3} max={300} value={s.timerSeconds} onChange={(e) => saveSettings({ timerSeconds: Math.max(3, Number(e.target.value) || 20) })} />
        </label>
        <label className="field inline">
          <span>Время в финале, секунд</span>
          <input
            type="number"
            min={5}
            max={600}
            value={s.finalTimerSeconds}
            onChange={(e) => saveSettings({ finalTimerSeconds: Math.max(5, Number(e.target.value) || 60) })}
          />
        </label>
      </section>

      <section className="setup-section">
        <h2>Файлы</h2>
        <label className="field inline">
          <span>Предупреждать о видео больше, МБ</span>
          <input type="number" min={1} max={4096} value={s.videoWarnMB} onChange={(e) => saveSettings({ videoWarnMB: Math.max(1, Number(e.target.value) || 100) })} />
        </label>
        {storage && storage.quota > 0 && (
          <p className="muted">
            Занято {formatBytes(storage.usage)} из доступных браузеру {formatBytes(storage.quota)}.
          </p>
        )}
        <p className="muted">
          Постоянное хранение:{' '}
          {persisted === null ? 'неизвестно' : persisted ? 'включено — браузер не удалит данные при нехватке места' : 'не включено'}
        </p>
        {persisted === false && (
          <button
            className="btn"
            onClick={async () => {
              const ok = await requestPersistence();
              setPersisted(ok);
              toast(ok ? 'Постоянное хранение включено' : 'Браузер отказал. Добавьте сайт в закладки или установите как приложение и попробуйте снова.', ok ? 'info' : 'error');
            }}
          >
            Включить постоянное хранение
          </button>
        )}
      </section>

      <section className="setup-section">
        <h2>Горячие клавиши</h2>
        <table className="hotkeys">
          <tbody>
            {HOTKEYS.map(([k, v]) => (
              <tr key={k}>
                <td>
                  <kbd>{k}</kbd>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
