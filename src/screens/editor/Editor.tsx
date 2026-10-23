import { useMemo, useState, type DragEvent } from 'react';
import { confirmDialog } from '../../components/Dialogs.tsx';
import {
  applyRoundValues,
  countQuestions,
  defaultValues,
  hasMedia,
  moveQuestion,
  newFinalQuestion,
  newQuestion,
  newRound,
  newTheme,
  nextValue,
  sortedQuestions,
} from '../../lib/model.ts';
import { navigate } from '../../lib/router.ts';
import { exportGame, toast, updateGame, useStore } from '../../lib/store.ts';
import type { Game, Question, Round, Theme } from '../../lib/types.ts';
import { plural } from '../../lib/utils.ts';
import { validateGame } from '../../lib/validate.ts';
import { AllQuestions, ImportTable, ValidationPanel } from './Panels.tsx';
import { FinalEditor, QuestionEditor } from './QuestionEditor.tsx';

type Tab = number | 'final' | 'settings';
type Panel = 'all' | 'check' | 'import' | null;

export function Editor({ id }: { id: string }) {
  const game = useStore((s) => s.games.find((g) => g.id === id));
  const session = useStore((s) => s.session);
  const media = useStore((s) => s.media);
  const warnMB = useStore((s) => s.settings.videoWarnMB);
  const [tab, setTab] = useState<Tab>(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingFinal, setEditingFinal] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  const issues = useMemo(
    () => (game ? validateGame(game, new Map(media.map((m) => [m.id, m])), warnMB * 1024 * 1024) : []),
    [game, media, warnMB],
  );

  if (!game) {
    return (
      <div className="center-note">
        <p>Игра не найдена.</p>
        <button className="btn primary" onClick={() => navigate('/')}>
          К списку игр
        </button>
      </div>
    );
  }

  const roundIndex = typeof tab === 'number' ? Math.min(tab, game.rounds.length - 1) : -1;
  const errors = issues.filter((i) => i.level === 'error').length;

  const addRound = () => {
    updateGame(game.id, (d) => {
      d.rounds.push(newRound(d.rounds.length));
    });
    setTab(game.rounds.length);
  };

  return (
    <div className="page editor">
      <header className="page-head">
        <button className="btn ghost" onClick={() => navigate('/')}>
          ← Игры
        </button>
        <input
          className="title-input"
          value={game.name}
          onChange={(e) => updateGame(game.id, (d) => void (d.name = e.target.value))}
          onBlur={(e) => !e.target.value.trim() && updateGame(game.id, (d) => void (d.name = 'Без названия'))}
          aria-label="Название игры"
        />
        <span className="spacer" />
        <button className="btn" onClick={() => setPanel('all')}>
          Все вопросы
        </button>
        <button className={`btn${errors ? ' warn' : ''}`} onClick={() => setPanel('check')}>
          Проверить{issues.length ? ` (${issues.length})` : ' ✓'}
        </button>
        <button className="btn" onClick={() => setPanel('import')}>
          Импорт таблицы
        </button>
        <button className="btn" onClick={() => exportGame(game.id).catch((e) => toast(String(e), 'error'))}>
          Экспорт
        </button>
        {session && !session.finished && session.gameId === game.id ? (
          <button className="btn primary" onClick={() => navigate('/play')}>
            ▶ Вернуться к игре
          </button>
        ) : (
          <button className="btn primary" onClick={() => navigate(`/setup/${game.id}`)}>
            ▶ Играть
          </button>
        )}
      </header>

      <nav className="tabs">
        {game.rounds.map((r, i) => (
          <button key={r.id} className={`tab${roundIndex === i ? ' active' : ''}`} onClick={() => setTab(i)}>
            {r.name || `Раунд ${i + 1}`}
          </button>
        ))}
        <button className={`tab${tab === 'final' ? ' active' : ''}`} onClick={() => setTab('final')}>
          Финал
        </button>
        <button className="tab add" onClick={addRound} title="Добавить раунд">
          + Раунд
        </button>
        <span className="spacer" />
        <button className={`tab${tab === 'settings' ? ' active' : ''}`} onClick={() => setTab('settings')}>
          ⚙ Настройки игры
        </button>
      </nav>

      <div className="editor-body">
        {roundIndex >= 0 && game.rounds[roundIndex] && (
          <RoundEditor game={game} roundIndex={roundIndex} onEdit={setEditing} onDeleted={() => setTab(Math.max(0, roundIndex - 1))} />
        )}
        {roundIndex >= 0 && !game.rounds.length && (
          <div className="center-note">
            <p>В игре нет раундов.</p>
            <button className="btn primary" onClick={addRound}>
              + Добавить раунд
            </button>
          </div>
        )}
        {tab === 'final' && <FinalTab game={game} onEdit={setEditingFinal} />}
        {tab === 'settings' && <GameSettingsTab game={game} />}
      </div>

      {editing && <QuestionEditor key={editing} game={game} questionId={editing} onClose={() => setEditing(null)} onOpen={setEditing} />}
      {editingFinal && <FinalEditor game={game} finalId={editingFinal} onClose={() => setEditingFinal(null)} />}
      {panel === 'all' && (
        <AllQuestions
          game={game}
          onClose={() => setPanel(null)}
          onOpen={(qid) => {
            setEditing(qid);
          }}
        />
      )}
      {panel === 'check' && (
        <ValidationPanel
          issues={issues}
          onClose={() => setPanel(null)}
          onGo={(issue) => {
            setPanel(null);
            if (issue.finalId) {
              setTab('final');
              setEditingFinal(issue.finalId);
            } else if (issue.roundIndex !== undefined) {
              setTab(issue.roundIndex);
              if (issue.questionId) setEditing(issue.questionId);
            }
          }}
        />
      )}
      {panel === 'import' && <ImportTable game={game} defaultRound={Math.max(0, roundIndex)} onClose={() => setPanel(null)} />}
    </div>
  );
}

const DRAG_THEME = 'application/x-svoya-theme';
const DRAG_QUESTION = 'application/x-svoya-question';

function RoundEditor({ game, roundIndex, onEdit, onDeleted }: { game: Game; roundIndex: number; onEdit: (id: string) => void; onDeleted: () => void }) {
  const round = game.rounds[roundIndex];
  const [dropAt, setDropAt] = useState<number | null>(null);
  const updateRound = (fn: (r: Round) => void) => updateGame(game.id, (d) => fn(d.rounds[roundIndex]));
  const total = round.themes.reduce((n, t) => n + t.questions.length, 0);

  const removeRound = async () => {
    const ok = await confirmDialog({
      title: `Удалить «${round.name}»?`,
      text: `В раунде ${round.themes.length} ${plural(round.themes.length, ['тема', 'темы', 'тем'])} и ${total} ${plural(total, ['вопрос', 'вопроса', 'вопросов'])}.`,
      ok: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    updateGame(game.id, (d) => {
      d.rounds.splice(roundIndex, 1);
    });
    onDeleted();
  };

  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    setDropAt(null);
    const from = e.dataTransfer.getData(DRAG_THEME);
    if (from !== '') {
      const f = Number(from);
      if (Number.isNaN(f) || f === to) return;
      updateRound((r) => {
        const [t] = r.themes.splice(f, 1);
        r.themes.splice(f < to ? to - 1 : to, 0, t);
      });
    }
  };

  return (
    <section className="round-editor">
      <div className="round-head">
        <label className="field inline">
          <span>Название раунда</span>
          <input value={round.name} onChange={(e) => updateRound((r) => void (r.name = e.target.value))} />
        </label>
        <div className="values-editor">
          <span>Номиналы:</span>
          {round.values.map((v, i) => (
            <input
              key={i}
              type="number"
              min={0}
              step={100}
              value={v}
              onChange={(e) => updateRound((r) => void (r.values[i] = Math.max(0, Number(e.target.value) || 0)))}
            />
          ))}
          <button className="btn small" onClick={() => updateRound((r) => void r.values.push((r.values.at(-1) ?? 0) + (r.values[0] || 100)))} title="Добавить номинал">
            +
          </button>
          <button className="btn small" disabled={round.values.length <= 1} onClick={() => updateRound((r) => void r.values.pop())} title="Убрать номинал">
            −
          </button>
          <button className="btn small" onClick={() => updateRound((r) => void (r.values = defaultValues(roundIndex, r.values.length)))} title={`По умолчанию: ×${roundIndex + 1}`}>
            ×{roundIndex + 1}
          </button>
          <button
            className="btn small primary"
            onClick={async () => {
              const ok = await confirmDialog({
                title: 'Применить номиналы ко всем темам?',
                text: 'Вопросы в каждой теме получат номиналы по порядку. Недостающие вопросы будут добавлены пустыми.',
                ok: 'Применить',
              });
              if (ok) updateRound(applyRoundValues);
            }}
          >
            Применить к темам
          </button>
        </div>
        <span className="spacer" />
        <button className="btn danger ghost small" onClick={removeRound}>
          Удалить раунд
        </button>
      </div>

      <div className="themes" onDragEnd={() => setDropAt(null)}>
        {round.themes.map((theme, ti) => (
          <ThemeRow
            key={theme.id}
            game={game}
            round={round}
            roundIndex={roundIndex}
            theme={theme}
            index={ti}
            onEdit={onEdit}
            dropBefore={dropAt === ti}
            onDragOverTheme={(e) => {
              if (!e.dataTransfer.types.includes(DRAG_THEME)) return;
              e.preventDefault();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setDropAt(e.clientY < rect.top + rect.height / 2 ? ti : ti + 1);
            }}
            onDropTheme={(e) => onDrop(e, dropAt ?? ti)}
          />
        ))}
        {dropAt === round.themes.length && <div className="drop-line" />}
      </div>
      <button
        className="btn"
        onClick={() => updateRound((r) => void r.themes.push(newTheme(`Тема ${r.themes.length + 1}`, r.values)))}
      >
        + Добавить тему
      </button>
    </section>
  );
}

function ThemeRow(props: {
  game: Game;
  round: Round;
  roundIndex: number;
  theme: Theme;
  index: number;
  onEdit: (id: string) => void;
  dropBefore: boolean;
  onDragOverTheme: (e: DragEvent) => void;
  onDropTheme: (e: DragEvent) => void;
}) {
  const { game, round, roundIndex, theme, index, onEdit } = props;
  const [qOver, setQOver] = useState(false);
  const updateTheme = (fn: (t: Theme) => void) =>
    updateGame(game.id, (d) => {
      const t = d.rounds[roundIndex].themes.find((x) => x.id === theme.id);
      if (t) fn(t);
    });

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Удалить тему «${theme.name || 'без названия'}»?`,
      text: `Вместе с ней удалятся ${theme.questions.length} ${plural(theme.questions.length, ['вопрос', 'вопроса', 'вопросов'])}.`,
      ok: 'Удалить',
      danger: true,
    });
    if (ok) updateGame(game.id, (d) => void (d.rounds[roundIndex].themes = d.rounds[roundIndex].themes.filter((t) => t.id !== theme.id)));
  };

  const addQuestion = () => {
    const q = newQuestion(nextValue(round, theme));
    updateTheme((t) => void t.questions.push(q));
    onEdit(q.id);
  };

  return (
    <>
      {props.dropBefore && <div className="drop-line" />}
      <div
        className={`theme-row${qOver ? ' q-over' : ''}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DRAG_QUESTION)) {
            e.preventDefault();
            setQOver(true);
          } else props.onDragOverTheme(e);
        }}
        onDragLeave={() => setQOver(false)}
        onDrop={(e) => {
          setQOver(false);
          const qid = e.dataTransfer.getData(DRAG_QUESTION);
          if (qid) {
            e.preventDefault();
            updateGame(game.id, (d) => moveQuestion(d, qid, theme.id));
          } else props.onDropTheme(e);
        }}
      >
        <span
          className="drag-handle"
          draggable
          title="Перетащите, чтобы поменять порядок тем"
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_THEME, String(index));
            e.dataTransfer.effectAllowed = 'move';
            const row = (e.currentTarget as HTMLElement).parentElement;
            if (row) e.dataTransfer.setDragImage(row, 20, 20);
          }}
        >
          ⠿
        </span>
        <input
          className="theme-name"
          value={theme.name}
          placeholder="Название темы"
          onChange={(e) => updateTheme((t) => void (t.name = e.target.value))}
        />
        <div className="chips">
          {sortedQuestions(theme).map((q) => (
            <QuestionChip key={q.id} q={q} onClick={() => onEdit(q.id)} />
          ))}
          <button className="chip add" onClick={addQuestion} title="Добавить вопрос">
            +
          </button>
        </div>
        <button className="icon-btn" onClick={remove} title="Удалить тему">
          🗑
        </button>
      </div>
    </>
  );
}

function QuestionChip({ q, onClick }: { q: Question; onClick: () => void }) {
  const empty = !q.text.trim() && !hasMedia(q);
  const icons = [q.image && '🖼', (q.video || q.videoUrl) && '🎬', q.audio && '♫', q.special === 'cat' && '🐱', q.special === 'stake' && '💰']
    .filter(Boolean)
    .join('');
  return (
    <button
      className={`chip${empty ? ' empty' : ''}${!q.answer.trim() && !empty ? ' no-answer' : ''}`}
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_QUESTION, q.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      title={empty ? 'Пустой вопрос' : q.text}
    >
      <b>{q.value}</b>
      <span className="chip-text">{empty ? 'пусто' : q.text || 'медиа'}</span>
      {icons && <span className="chip-icons">{icons}</span>}
    </button>
  );
}

function FinalTab({ game, onEdit }: { game: Game; onEdit: (id: string) => void }) {
  return (
    <section className="final-editor">
      <p className="muted">
        В финале игроки по очереди убирают темы, пока не останется одна, затем делают ставки и пишут ответ. Если тема одна — сразу ставки.
      </p>
      <div className="final-list">
        {game.final.map((f) => (
          <button key={f.id} className="final-card" onClick={() => onEdit(f.id)}>
            <b>{f.theme || 'Без названия'}</b>
            <span className={f.text ? '' : 'muted'}>{f.text || 'Вопрос не заполнен'}</span>
            {f.answer && <span className="muted small">Ответ: {f.answer}</span>}
          </button>
        ))}
      </div>
      <button
        className="btn"
        onClick={() => {
          const f = newFinalQuestion(`Тема ${game.final.length + 1}`);
          updateGame(game.id, (d) => void d.final.push(f));
          onEdit(f.id);
        }}
      >
        + Тема финала
      </button>
    </section>
  );
}

function GameSettingsTab({ game }: { game: Game }) {
  const s = game.settings;
  const set = (patch: Partial<Game['settings']>) => updateGame(game.id, (d) => Object.assign(d.settings, patch));
  return (
    <section className="settings-tab">
      <p className="muted">
        В игре {game.rounds.length} {plural(game.rounds.length, ['раунд', 'раунда', 'раундов'])}, {countQuestions(game)}{' '}
        {plural(countQuestions(game), ['вопрос', 'вопроса', 'вопросов'])}, в финале {game.final.length}{' '}
        {plural(game.final.length, ['тема', 'темы', 'тем'])}. Эти значения подставятся при запуске игры, их можно поменять перед стартом.
      </p>
      <label className="check">
        <input type="checkbox" checked={s.timerEnabled} onChange={(e) => set({ timerEnabled: e.target.checked })} /> Таймер на ответ
      </label>
      <label className="field inline">
        <span>Время на ответ, секунд</span>
        <input type="number" min={3} max={300} value={s.timerSeconds} onChange={(e) => set({ timerSeconds: Math.max(3, Number(e.target.value) || 20) })} />
      </label>
      <label className="field inline">
        <span>Время в финале, секунд</span>
        <input type="number" min={5} max={600} value={s.finalTimerSeconds} onChange={(e) => set({ finalTimerSeconds: Math.max(5, Number(e.target.value) || 60) })} />
      </label>
    </section>
  );
}
