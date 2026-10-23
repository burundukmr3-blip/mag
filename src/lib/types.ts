export type MediaKind = 'image' | 'video' | 'audio';

export interface MediaMeta {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: MediaKind;
  createdAt: number;
}

export interface MediaRecord extends MediaMeta {
  blob: Blob;
}

/** Настройки воспроизведения видео и аудио (Р8). Время в секундах. */
export interface Playback {
  start?: number;
  end?: number;
  autoplay: boolean;
  muted: boolean;
}

/** Всё, что показывается на экране вопроса: общая часть обычного вопроса и вопроса финала. */
export interface QuestionContent {
  text: string;
  answer: string;
  comment: string;
  image?: string;
  answerImage?: string;
  video?: string;
  videoUrl?: string;
  audio?: string;
  playback: Playback;
}

export type SpecialType = 'none' | 'cat' | 'stake';

export interface Question extends QuestionContent {
  id: string;
  value: number;
  special: SpecialType;
  /** Тема, которую объявляет ведущий для «Кота в мешке». Пусто — тема строки. */
  catTheme?: string;
  /** Стоимость «Кота в мешке». Пусто — номинал карточки. */
  catValue?: number;
}

export interface Theme {
  id: string;
  name: string;
  questions: Question[];
}

export interface Round {
  id: string;
  name: string;
  /** Номиналы раунда, по ним создаются новые вопросы. */
  values: number[];
  themes: Theme[];
}

export interface FinalQuestion extends QuestionContent {
  id: string;
  theme: string;
}

export interface GameSettings {
  timerEnabled: boolean;
  timerSeconds: number;
  finalTimerSeconds: number;
}

export interface Game {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  rounds: Round[];
  final: FinalQuestion[];
  settings: GameSettings;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  score: number;
  /** Игрок выбыл: 'keep' — очки остаются в итогах, 'zero' — обнулены и в итогах не показываются. */
  removed?: 'keep' | 'zero';
}

export type PlayerInput = Pick<Player, 'name' | 'color' | 'avatar'>;

export type LogKind = 'correct' | 'wrong' | 'skip' | 'manual' | 'final';

export interface LogEntry {
  id: string;
  time: number;
  kind: LogKind;
  label: string;
  playerId?: string;
  playerName?: string;
  questionId?: string;
  delta: number;
  cancelled?: boolean;
}

export interface ActiveQuestion {
  questionId: string;
  roundIndex: number;
  /** 'special' — заставка «Кот в мешке» или «Вопрос со ставкой», ведущий выбирает игрока. */
  stage: 'special' | 'play';
  revealed: boolean;
  /** Игроки, ответившие неверно. */
  wrong: string[];
  selected?: string;
  /** Единственный отвечающий (кот в мешке, вопрос со ставкой). */
  owner?: string;
  /** Стоимость вопроса, если она отличается от номинала. */
  stake?: number;
  finished: boolean;
  answeredBy?: string;
}

export interface FinalState {
  stage: 'themes' | 'bets' | 'question' | 'answer';
  participants: string[];
  removed: string[];
  questionId?: string;
  bets: Record<string, number>;
  results: Record<string, boolean>;
}

export interface SessionSettings {
  timerEnabled: boolean;
  timerSeconds: number;
  finalTimerSeconds: number;
  sound: boolean;
}

export interface Session {
  id: string;
  gameId: string;
  gameName: string;
  startedAt: number;
  updatedAt: number;
  players: Player[];
  phase: 'board' | 'question' | 'final' | 'results';
  roundIndex: number;
  played: string[];
  active?: ActiveQuestion;
  chooser?: string;
  final?: FinalState;
  log: LogEntry[];
  settings: SessionSettings;
  finished: boolean;
  historySaved?: boolean;
}

export interface Roster {
  id: string;
  name: string;
  players: PlayerInput[];
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  date: number;
  gameName: string;
  players: { name: string; color: string; score: number; place: number }[];
}

export interface AppSettings {
  sound: boolean;
  timerEnabled: boolean;
  timerSeconds: number;
  finalTimerSeconds: number;
  videoWarnMB: number;
}
