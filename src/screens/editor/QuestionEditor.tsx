import { useState } from 'react';
import { confirmDialog } from '../../components/Dialogs.tsx';
import { MediaField } from '../../components/MediaField.tsx';
import { Modal } from '../../components/Modal.tsx';
import { QuestionStage } from '../../components/QuestionStage.tsx';
import { deleteQuestion, duplicateQuestion, findQuestion, moveQuestion, sortedQuestions } from '../../lib/model.ts';
import { updateGame } from '../../lib/store.ts';
import type { Game, Playback, QuestionContent, SpecialType } from '../../lib/types.ts';
import { youtubeId } from '../../components/MediaView.tsx';

function numOrUndef(v: string): number | undefined {
  const n = Number(v.replace(',', '.'));
  return v.trim() === '' || !Number.isFinite(n) ? undefined : n;
}

/** Текст, ответ, комментарий, картинки, видео и аудио — общие поля вопроса и финала (Р3, Р6–Р9). */
export function ContentFields({ content, onPatch }: { content: QuestionContent; onPatch: (patch: Partial<QuestionContent>) => void }) {
  const pb = content.playback;
  const setPb = (patch: Partial<Playback>) => onPatch({ playback: { ...pb, ...patch } });
  const hasPlayable = !!(content.video || content.videoUrl || content.audio);
  const badUrl = content.videoUrl && !youtubeId(content.videoUrl) && !/^https?:\/\/.+/i.test(content.videoUrl);
  return (
    <div className="content-fields">
      <div className="cf-text">
        <label className="field">
          <span>Текст вопроса</span>
          <textarea rows={4} value={content.text} onChange={(e) => onPatch({ text: e.target.value })} placeholder="Что увидят игроки" />
        </label>
        <label className="field">
          <span>Ответ</span>
          <textarea rows={2} value={content.answer} onChange={(e) => onPatch({ answer: e.target.value })} placeholder="Покажется после кнопки «Показать ответ»" />
        </label>
        <label className="field">
          <span>Комментарий для ведущего</span>
          <textarea
            rows={2}
            value={content.comment}
            onChange={(e) => onPatch({ comment: e.target.value })}
            placeholder="Что ещё принимается как ответ, интересный факт. Показывается вместе с ответом"
          />
        </label>
      </div>
      <div className="cf-media">
        <MediaField kind="image" label="Картинка к вопросу" value={content.image} onChange={(image) => onPatch({ image })} />
        <MediaField kind="image" label="Картинка к ответу" value={content.answerImage} onChange={(answerImage) => onPatch({ answerImage })} />
        <MediaField kind="video" label="Видео" value={content.video} onChange={(video) => onPatch({ video })} />
        {!content.video && (
          <label className="field">
            <span>…или ссылка на видео (YouTube или прямая ссылка на MP4)</span>
            <input
              type="url"
              value={content.videoUrl ?? ''}
              onChange={(e) => onPatch({ videoUrl: e.target.value.trim() || undefined })}
              placeholder="https://"
            />
            {content.videoUrl && <small className="warn-text">Для видео по ссылке нужен интернет во время игры.</small>}
            {badUrl && <small className="warn-text">Ссылка должна начинаться с https://</small>}
          </label>
        )}
        <MediaField kind="audio" label="Аудио (например, «угадай мелодию»)" value={content.audio} onChange={(audio) => onPatch({ audio })} />
        {hasPlayable && (
          <fieldset className="playback">
            <legend>Воспроизведение видео и аудио</legend>
            <label className="field inline">
              <span>Начало, сек</span>
              <input type="number" min={0} step={0.5} value={pb.start ?? ''} onChange={(e) => setPb({ start: numOrUndef(e.target.value) })} placeholder="0" />
            </label>
            <label className="field inline">
              <span>Конец, сек</span>
              <input type="number" min={0} step={0.5} value={pb.end ?? ''} onChange={(e) => setPb({ end: numOrUndef(e.target.value) })} placeholder="до конца" />
            </label>
            <label className="check">
              <input type="checkbox" checked={pb.autoplay} onChange={(e) => setPb({ autoplay: e.target.checked })} /> Запускать сразу (иначе — по кнопке)
            </label>
            <label className="check">
              <input type="checkbox" checked={pb.muted} onChange={(e) => setPb({ muted: e.target.checked })} /> Видео без звука
            </label>
          </fieldset>
        )}
      </div>
    </div>
  );
}

export function PreviewModal({ content, theme, value, onClose, badge }: { content: QuestionContent; theme: string; value?: number; badge?: string; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Modal onClose={onClose} full className="preview">
      <div className="play preview-play">
        <QuestionStage content={content} theme={theme} value={value} revealed={revealed} badge={badge ? <span className="special-badge">{badge}</span> : null} />
        <div className="host-panel">
          <div className="host-controls">
            <span className="host-status muted">Предпросмотр — так вопрос увидят игроки</span>
            <button className="btn big" onClick={() => setRevealed((r) => !r)}>
              {revealed ? 'Скрыть ответ' : 'Показать ответ'}
            </button>
            <button className="btn primary big" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Редактор вопроса (Р3–Р5, Р10). Изменения сохраняются сразу. */
export function QuestionEditor({ game, questionId, onClose, onOpen }: { game: Game; questionId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const [preview, setPreview] = useState(false);
  const loc = findQuestion(game, questionId);
  if (!loc) return null;
  const q = loc.question;
  const patch = (p: Partial<typeof q>) =>
    updateGame(game.id, (d) => {
      const x = findQuestion(d, questionId);
      if (x) Object.assign(x.question, p);
    });

  // Соседние вопросы в порядке табло для быстрого перехода.
  const order = game.rounds.flatMap((r) => r.themes.flatMap((t) => sortedQuestions(t).map((x) => x.id)));
  const pos = order.indexOf(questionId);
  const prev = order[pos - 1];
  const next = order[pos + 1];

  const remove = async () => {
    const ok = await confirmDialog({ title: 'Удалить вопрос?', text: `${loc.theme.name} · ${q.value}`, ok: 'Удалить', danger: true });
    if (!ok) return;
    updateGame(game.id, (d) => deleteQuestion(d, questionId));
    onClose();
  };

  const duplicate = () => {
    let id: string | undefined;
    updateGame(game.id, (d) => {
      id = duplicateQuestion(d, questionId);
    });
    if (id) onOpen(id);
  };

  const specialLabel = q.special === 'cat' ? 'Кот в мешке' : q.special === 'stake' ? 'Со ставкой' : undefined;

  return (
    <Modal
      title={`${loc.round.name} · ${loc.theme.name || 'Без темы'} · ${q.value}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" disabled={!prev} onClick={() => prev && onOpen(prev)} title="Предыдущий вопрос">
            ←
          </button>
          <button className="btn" disabled={!next} onClick={() => next && onOpen(next)} title="Следующий вопрос">
            →
          </button>
          <span className="spacer" />
          <button className="btn danger ghost" onClick={remove}>
            Удалить
          </button>
          <button className="btn" onClick={duplicate}>
            Дублировать
          </button>
          <button className="btn" onClick={() => setPreview(true)}>
            Предпросмотр
          </button>
          <button className="btn primary" onClick={onClose}>
            Готово
          </button>
        </>
      }
    >
      <div className="q-meta">
        <label className="field">
          <span>Раунд и тема</span>
          <select value={loc.theme.id} onChange={(e) => updateGame(game.id, (d) => moveQuestion(d, questionId, e.target.value))}>
            {game.rounds.map((r) => (
              <optgroup key={r.id} label={r.name}>
                {r.themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || 'Без названия'}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Номинал</span>
          <input type="number" min={0} step={100} value={q.value} onChange={(e) => patch({ value: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="field">
          <span>Тип карточки</span>
          <select value={q.special} onChange={(e) => patch({ special: e.target.value as SpecialType })}>
            <option value="none">Обычный вопрос</option>
            <option value="cat">Кот в мешке</option>
            <option value="stake">Вопрос со ставкой</option>
          </select>
        </label>
        {q.special === 'cat' && (
          <>
            <label className="field">
              <span>Тема кота (необязательно)</span>
              <input value={q.catTheme ?? ''} onChange={(e) => patch({ catTheme: e.target.value || undefined })} placeholder={loc.theme.name} />
            </label>
            <label className="field">
              <span>Стоимость кота</span>
              <input type="number" min={0} step={100} value={q.catValue ?? ''} onChange={(e) => patch({ catValue: numOrUndef(e.target.value) })} placeholder={String(q.value)} />
            </label>
          </>
        )}
      </div>
      {q.special === 'cat' && <p className="muted small">Ведущий объявляет тему и стоимость и передаёт вопрос другому игроку. Отвечает только он.</p>}
      {q.special === 'stake' && <p className="muted small">Игроки торгуются, ведущий вводит лучшую ставку (не меньше номинала). Отвечает только сделавший её.</p>}
      <ContentFields content={q} onPatch={patch} />
      {preview && (
        <PreviewModal
          content={q}
          theme={q.special === 'cat' && q.catTheme ? q.catTheme : loc.theme.name}
          value={q.special === 'cat' ? q.catValue || q.value : q.value}
          badge={specialLabel}
          onClose={() => setPreview(false)}
        />
      )}
    </Modal>
  );
}

export function FinalEditor({ game, finalId, onClose }: { game: Game; finalId: string; onClose: () => void }) {
  const [preview, setPreview] = useState(false);
  const f = game.final.find((x) => x.id === finalId);
  if (!f) return null;
  const patch = (p: Partial<typeof f>) =>
    updateGame(game.id, (d) => {
      const x = d.final.find((y) => y.id === finalId);
      if (x) Object.assign(x, p);
    });
  const remove = async () => {
    const ok = await confirmDialog({ title: 'Удалить тему финала?', text: f.theme, ok: 'Удалить', danger: true });
    if (!ok) return;
    updateGame(game.id, (d) => {
      d.final = d.final.filter((x) => x.id !== finalId);
    });
    onClose();
  };
  return (
    <Modal
      title={`Финал · ${f.theme || 'Без названия'}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn danger ghost" onClick={remove}>
            Удалить
          </button>
          <span className="spacer" />
          <button className="btn" onClick={() => setPreview(true)}>
            Предпросмотр
          </button>
          <button className="btn primary" onClick={onClose}>
            Готово
          </button>
        </>
      }
    >
      <label className="field">
        <span>Тема финала</span>
        <input value={f.theme} onChange={(e) => patch({ theme: e.target.value })} autoFocus />
      </label>
      <ContentFields content={f} onPatch={patch} />
      {preview && <PreviewModal content={f} theme={`Финал · ${f.theme}`} onClose={() => setPreview(false)} />}
    </Modal>
  );
}
