import { useEffect, useRef, useState } from 'react';
import { useMediaUrl } from '../lib/media.ts';
import type { Playback } from '../lib/types.ts';

export function MediaImage({ id, alt = '', className }: { id: string; alt?: string; className?: string }) {
  const url = useMediaUrl(id);
  if (url === undefined) return <div className={`media-placeholder ${className ?? ''}`}>Загрузка…</div>;
  if (url === null) return <div className={`media-placeholder missing ${className ?? ''}`}>Файл не найден</div>;
  return <img src={url} alt={alt} className={className} draggable={false} />;
}

export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : null;
}

/** Начало и конец фрагмента, автозапуск, звук (Р8). */
function usePlayback(ref: React.RefObject<HTMLMediaElement | null>, playback: Playback, src: string | null | undefined) {
  const [started, setStarted] = useState(playback.autoplay);
  useEffect(() => setStarted(playback.autoplay), [src, playback.autoplay]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    const start = playback.start ?? 0;
    const end = playback.end;
    const onMeta = () => {
      if (start > 0) el.currentTime = start;
    };
    const onTime = () => {
      if (end !== undefined && end > start && el.currentTime >= end) el.pause();
    };
    const onPlay = () => {
      if (end !== undefined && end > start && el.currentTime >= end - 0.05) el.currentTime = start;
    };
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    if (el.readyState >= 1) onMeta();
    return () => {
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
    };
  }, [ref, src, playback.start, playback.end]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src || !started) return;
    el.play().catch(() => {
      // Браузер запретил автозапуск со звуком — показываем кнопку.
      setStarted(false);
    });
  }, [ref, src, started]);

  return { started, start: () => setStarted(true) };
}

export function VideoPlayer({ id, url, playback }: { id?: string; url?: string; playback: Playback }) {
  const mediaUrl = useMediaUrl(id);
  const ref = useRef<HTMLVideoElement>(null);
  const src = id ? mediaUrl : url;
  const yt = !id && url ? youtubeId(url) : null;
  const { started, start } = usePlayback(ref, playback, yt ? null : src);

  if (yt) {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
    if (playback.start) params.set('start', String(Math.floor(playback.start)));
    if (playback.end) params.set('end', String(Math.ceil(playback.end)));
    if (playback.muted) params.set('mute', '1');
    return <YoutubeFrame id={yt} params={params} autoplay={playback.autoplay} />;
  }
  if (src === undefined) return <div className="media-placeholder video">Загрузка видео…</div>;
  if (src === null) return <div className="media-placeholder missing video">Видео не найдено</div>;
  return (
    <div className="video-wrap">
      <video ref={ref} src={src} muted={playback.muted} controls={started} playsInline preload="auto" className="stage-video" />
      {!started && (
        <button className="play-overlay" onClick={start}>
          ▶ Смотреть видео
        </button>
      )}
    </div>
  );
}

function YoutubeFrame({ id, params, autoplay }: { id: string; params: URLSearchParams; autoplay: boolean }) {
  const [started, setStarted] = useState(autoplay);
  if (!started)
    return (
      <div className="video-wrap">
        <div className="media-placeholder video">Видео YouTube (нужен интернет)</div>
        <button className="play-overlay" onClick={() => setStarted(true)}>
          ▶ Смотреть видео
        </button>
      </div>
    );
  params.set('autoplay', '1');
  return (
    <div className="video-wrap">
      <iframe
        className="stage-video"
        src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
        title="Видео"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

export function AudioPlayer({ id, playback }: { id: string; playback: Playback }) {
  const url = useMediaUrl(id);
  const ref = useRef<HTMLAudioElement>(null);
  const { started, start } = usePlayback(ref, playback, url);
  const [playing, setPlaying] = useState(false);
  if (url === undefined) return <div className="media-placeholder audio">Загрузка аудио…</div>;
  if (url === null) return <div className="media-placeholder missing audio">Аудио не найдено</div>;
  return (
    <div className={`audio-wrap${playing ? ' playing' : ''}`}>
      <div className="audio-icon" aria-hidden>
        ♫
      </div>
      <audio
        ref={ref}
        src={url}
        controls={started}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {!started && (
        <button className="btn primary big" onClick={start}>
          ▶ Слушать
        </button>
      )}
    </div>
  );
}

export function Avatar({ id, name, color, size = 'md' }: { id?: string; name: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`avatar ${size}`} style={{ background: color }}>
      {id ? <MediaImage id={id} alt={name} /> : <span>{(name.trim()[0] ?? '?').toUpperCase()}</span>}
    </span>
  );
}
