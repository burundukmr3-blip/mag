import type { ReactNode } from 'react';
import type { QuestionContent } from '../lib/types.ts';
import { formatScore } from '../lib/utils.ts';
import { AudioPlayer, MediaImage, VideoPlayer } from './MediaView.tsx';

interface Props {
  content: QuestionContent;
  theme: string;
  value?: number;
  badge?: ReactNode;
  revealed: boolean;
  top?: ReactNode;
}

function textSize(text: string, withMedia: boolean): string {
  const n = text.length + (withMedia ? 120 : 0);
  if (n < 70) return 'xl';
  if (n < 150) return 'lg';
  if (n < 280) return 'md';
  return 'sm';
}

/** Экран вопроса — одинаковый в игре и в предпросмотре редактора (И5, И6, Р10). */
export function QuestionStage({ content, theme, value, badge, revealed, top }: Props) {
  const hasVideo = !!(content.video || content.videoUrl);
  const showQuestionImage = content.image && !(revealed && content.answerImage);
  const withMedia = !!(showQuestionImage || hasVideo || content.audio || (revealed && content.answerImage));
  return (
    <div className={`stage${revealed ? ' revealed' : ''}`}>
      <div className="stage-head">
        <span className="stage-theme">{theme || 'Без темы'}</span>
        {badge}
        {value !== undefined && <span className="stage-value">{formatScore(value)}</span>}
      </div>
      {top}
      <div className="stage-body">
        {content.text && <div className={`stage-text size-${textSize(content.text, withMedia || revealed)}`}>{content.text}</div>}
        {(showQuestionImage || hasVideo || content.audio) && (
          <div className="stage-media">
            {showQuestionImage && <MediaImage id={content.image!} className="stage-image" />}
            {hasVideo && <VideoPlayer id={content.video} url={content.videoUrl} playback={content.playback} />}
            {content.audio && <AudioPlayer id={content.audio} playback={content.playback} />}
          </div>
        )}
        {revealed && (
          <div className="answer-block">
            <div className="answer-label">Ответ</div>
            <div className="answer-text">{content.answer || '—'}</div>
            {content.answerImage && <MediaImage id={content.answerImage} className="stage-image answer-image" />}
            {content.comment && <div className="answer-comment">{content.comment}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
