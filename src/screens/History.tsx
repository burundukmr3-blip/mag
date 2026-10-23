import { confirmDialog } from '../components/Dialogs.tsx';
import { navigate } from '../lib/router.ts';
import { deleteHistory, useStore } from '../lib/store.ts';
import { formatDate, formatScore } from '../lib/utils.ts';

/** Результаты прошедших игр, хранятся на устройстве (С11). */
export function History() {
  const history = useStore((s) => s.history);
  return (
    <div className="page history">
      <header className="page-head">
        <button className="btn ghost" onClick={() => navigate('/')}>
          ← Игры
        </button>
        <h1>История игр</h1>
      </header>
      {history.length === 0 ? (
        <div className="empty-state muted">Здесь появятся результаты сыгранных игр.</div>
      ) : (
        <div className="history-list">
          {history.map((h) => (
            <article key={h.id} className="history-item">
              <div className="history-head">
                <b>{h.gameName}</b>
                <span className="muted small">{formatDate(h.date)}</span>
                <span className="spacer" />
                <button
                  className="btn small ghost danger"
                  onClick={async () => {
                    if (await confirmDialog({ title: 'Удалить запись из истории?', ok: 'Удалить', danger: true })) deleteHistory(h.id);
                  }}
                >
                  Удалить
                </button>
              </div>
              <ol className="history-players">
                {h.players.map((p, i) => (
                  <li key={i}>
                    <span className="history-place">{p.place}</span>
                    <span className="dot" style={{ background: p.color }} />
                    <span className="grow">{p.name}</span>
                    <b className={p.score < 0 ? 'negative' : ''}>{formatScore(p.score)}</b>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
