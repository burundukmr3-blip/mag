import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal.tsx';
import { allQuestions, hasMedia } from '../../lib/model.ts';
import { toast, updateGame } from '../../lib/store.ts';
import { applyImport, parseCsv, rowsToQuestions, SAMPLE_CSV, type ImportRow } from '../../lib/tableImport.ts';
import type { Game } from '../../lib/types.ts';
import { downloadBlob, pickFiles, plural } from '../../lib/utils.ts';
import type { Issue } from '../../lib/validate.ts';
import { parseXlsx } from '../../lib/xlsx.ts';

/** Вся игра одним списком с поиском (Р11). */
export function AllQuestions({ game, onClose, onOpen }: { game: Game; onClose: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allQuestions(game).filter(
      (loc) =>
        !q ||
        [loc.question.text, loc.question.answer, loc.question.comment, loc.theme.name].some((s) => s.toLowerCase().includes(q)),
    );
  }, [game, query]);
  return (
    <Modal title="Все вопросы" onClose={onClose} full>
      <input className="search" placeholder="Поиск по тексту вопроса, ответу, комментарию или теме" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      <p className="muted small">
        Найдено: {list.length} {plural(list.length, ['вопрос', 'вопроса', 'вопросов'])}
      </p>
      <table className="all-table">
        <thead>
          <tr>
            <th>Раунд</th>
            <th>Тема</th>
            <th>Номинал</th>
            <th>Вопрос</th>
            <th>Ответ</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((loc) => {
            const q = loc.question;
            return (
              <tr key={q.id} onClick={() => onOpen(q.id)} className="clickable">
                <td>{loc.round.name}</td>
                <td>{loc.theme.name}</td>
                <td>{q.value}</td>
                <td className={q.text ? '' : 'muted'}>{q.text || (hasMedia(q) ? 'медиа' : 'пусто')}</td>
                <td className={q.answer ? '' : 'muted'}>{q.answer || '—'}</td>
                <td className="nowrap">
                  {[q.image && '🖼', (q.video || q.videoUrl) && '🎬', q.audio && '♫', q.special === 'cat' && '🐱', q.special === 'stake' && '💰'].filter(Boolean).join(' ')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Modal>
  );
}

/** Проверка игры перед запуском (Р15). */
export function ValidationPanel({ issues, onClose, onGo }: { issues: Issue[]; onClose: () => void; onGo: (i: Issue) => void }) {
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  return (
    <Modal title="Проверка игры" onClose={onClose} wide>
      {issues.length === 0 ? <p className="ok-text">✓ Всё в порядке, можно играть.</p> : <IssueList errors={errors} warnings={warnings} onGo={onGo} />}
    </Modal>
  );
}

export function IssueList({ errors, warnings, onGo }: { errors: Issue[]; warnings: Issue[]; onGo?: (i: Issue) => void }) {
  return (
    <div className="issues">
      {errors.length > 0 && <h3 className="err-text">Ошибки ({errors.length})</h3>}
      {errors.map((i, n) => (
        <IssueRow key={`e${n}`} issue={i} onGo={onGo} />
      ))}
      {warnings.length > 0 && <h3 className="warn-text">Предупреждения ({warnings.length})</h3>}
      {warnings.map((i, n) => (
        <IssueRow key={`w${n}`} issue={i} onGo={onGo} />
      ))}
    </div>
  );
}

function IssueRow({ issue, onGo }: { issue: Issue; onGo?: (i: Issue) => void }) {
  const canGo = onGo && (issue.questionId || issue.finalId || issue.roundIndex !== undefined);
  return (
    <div className={`issue ${issue.level}`}>
      <span>{issue.text}</span>
      {canGo && (
        <button className="btn small" onClick={() => onGo(issue)}>
          Исправить
        </button>
      )}
    </div>
  );
}

/** Импорт вопросов из CSV или Excel (Р14). */
export function ImportTable({ game, defaultRound, onClose }: { game: Game; defaultRound: number; onClose: () => void }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [round, setRound] = useState(defaultRound);

  const parsed = useMemo(() => {
    const data = rows ?? (text.trim() ? parseCsv(text) : null);
    return data ? rowsToQuestions(data) : null;
  }, [rows, text]);

  const load = async () => {
    const [file] = await pickFiles('.csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (!file) return;
    try {
      if (/\.xlsx$/i.test(file.name)) {
        setRows(parseXlsx(await file.arrayBuffer()));
        setText('');
      } else {
        const buf = await file.arrayBuffer();
        let decoded = new TextDecoder('utf-8').decode(buf);
        // Excel в Windows часто сохраняет CSV в кодировке Windows-1251.
        if (decoded.includes('�')) decoded = new TextDecoder('windows-1251').decode(buf);
        setText(decoded);
        setRows(null);
      }
      setFileName(file.name);
    } catch (err) {
      console.error(err);
      toast(`Не удалось прочитать файл: ${err instanceof Error ? err.message : err}`, 'error');
    }
  };

  const run = (items: ImportRow[]) => {
    updateGame(game.id, (d) => {
      const next = applyImport(d, items, round);
      d.rounds = next.rounds;
    });
    toast(`Импортировано: ${items.length} ${plural(items.length, ['вопрос', 'вопроса', 'вопросов'])}`);
    onClose();
  };

  return (
    <Modal
      title="Импорт вопросов из таблицы"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn ghost" onClick={() => downloadBlob(new Blob(['﻿' + SAMPLE_CSV], { type: 'text/csv' }), 'образец-вопросов.csv')}>
            Скачать образец CSV
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" disabled={!parsed?.items.length} onClick={() => parsed && run(parsed.items)}>
            Импортировать{parsed?.items.length ? ` ${parsed.items.length}` : ''}
          </button>
        </>
      }
    >
      <p className="muted">
        Колонки: <b>Раунд</b> (необязательно), <b>Тема</b>, <b>Номинал</b>, <b>Вопрос</b>, <b>Ответ</b>, <b>Комментарий</b> (необязательно). Первая строка —
        заголовки. Без заголовков порядок такой: тема, номинал, вопрос, ответ. Поддерживаются CSV (разделитель «;», «,» или табуляция) и Excel .xlsx —
        берётся первый лист.
      </p>
      <div className="row-actions">
        <button className="btn primary" onClick={load}>
          Выбрать файл CSV или Excel…
        </button>
        {fileName && <span className="muted">{fileName}</span>}
        <label className="field inline">
          <span>Раунд, если не указан</span>
          <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
            {game.rounds.map((r, i) => (
              <option key={r.id} value={i}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>…или вставьте строки из таблицы сюда (скопируйте ячейки в Excel или Google Таблицах)</span>
        <textarea
          rows={5}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setRows(null);
            setFileName('');
          }}
          placeholder={'Тема\tНоминал\tВопрос\tОтвет'}
        />
      </label>
      {parsed && (
        <>
          <p>
            Распознано вопросов: <b>{parsed.items.length}</b>
            {parsed.errors.length > 0 && <span className="warn-text"> · пропущено строк: {parsed.errors.length}</span>}
          </p>
          {parsed.errors.length > 0 && (
            <ul className="import-errors">
              {parsed.errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {parsed.errors.length > 10 && <li>…и ещё {parsed.errors.length - 10}</li>}
            </ul>
          )}
          {parsed.items.length > 0 && (
            <table className="all-table">
              <thead>
                <tr>
                  <th>Раунд</th>
                  <th>Тема</th>
                  <th>Номинал</th>
                  <th>Вопрос</th>
                  <th>Ответ</th>
                </tr>
              </thead>
              <tbody>
                {parsed.items.slice(0, 12).map((it) => (
                  <tr key={it.line}>
                    <td>{it.round ?? game.rounds[round]?.name}</td>
                    <td>{it.theme}</td>
                    <td>{it.value}</td>
                    <td>{it.text}</td>
                    <td>{it.answer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {parsed.items.length > 12 && <p className="muted small">…и ещё {parsed.items.length - 12}</p>}
        </>
      )}
    </Modal>
  );
}
