// Состояние приложения. Каждое изменение сразу записывается в IndexedDB (Н5).
import { useSyncExternalStore } from 'react';
import { db, requestPersistence } from './db.ts';
import { buildExportBlob, FILE_EXT, parseExportBlob } from './exchange.ts';
import { forgetMediaUrl, getMediaRecords, guessMime, kindOf, toMeta } from './media.ts';
import { allQuestions, copyGame, gameMediaIds, mediaIdsOf, newGame, normalizeGame, questionLabel } from './model.ts';
import type { AppSettings, Game, HistoryEntry, MediaMeta, MediaRecord, PlayerInput, Roster, Session } from './types.ts';
import { clone, downloadBlob, safeFileName, uid } from './utils.ts';

export interface Toast {
  id: string;
  text: string;
  kind: 'info' | 'error';
}

export interface State {
  ready: boolean;
  loadError?: string;
  games: Game[];
  media: MediaMeta[];
  session: Session | null;
  undo: Session[];
  settings: AppSettings;
  rosters: Roster[];
  history: HistoryEntry[];
  toasts: Toast[];
}

const DEFAULT_SETTINGS: AppSettings = {
  sound: true,
  timerEnabled: true,
  timerSeconds: 20,
  finalTimerSeconds: 60,
  videoWarnMB: 100,
};

const UNDO_LIMIT = 100;

let state: State = {
  ready: false,
  games: [],
  media: [],
  session: null,
  undo: [],
  settings: DEFAULT_SETTINGS,
  rosters: [],
  history: [],
  toasts: [],
};

const listeners = new Set<() => void>();

function set(patch: Partial<State>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): State {
  return state;
}

/** Селектор должен возвращать уже существующие объекты состояния, а не новые. */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

export function toast(text: string, kind: Toast['kind'] = 'info'): void {
  const t = { id: uid(), text, kind };
  set({ toasts: [...state.toasts, t] });
  setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), kind === 'error' ? 7000 : 3500);
}

function save(store: Parameters<typeof db.put>[0], value: unknown): void {
  db.put(store, value).catch((err: unknown) => {
    console.error(err);
    const quota = err instanceof DOMException && err.name === 'QuotaExceededError';
    toast(quota ? 'Не хватает места в хранилище браузера. Удалите ненужные файлы в медиатеке.' : 'Не удалось сохранить данные', 'error');
  });
}

export async function initStore(): Promise<void> {
  try {
    const [games, media, sessions, rosters, history, kv] = await Promise.all([
      db.getAll<Game>('games'),
      db.getAll<MediaRecord>('media'),
      db.getAll<{ id: string; session: Session; undo: Session[] }>('sessions'),
      db.getAll<Roster>('rosters'),
      db.getAll<HistoryEntry>('history'),
      db.getAll<{ id: string; value: unknown }>('kv'),
    ]);
    const current = sessions.find((s) => s.id === 'current');
    const settings = kv.find((x) => x.id === 'settings')?.value as Partial<AppSettings> | undefined;
    set({
      ready: true,
      games: games.map(normalizeGame).sort((a, b) => b.updatedAt - a.updatedAt),
      media: media.map(toMeta).sort((a, b) => b.createdAt - a.createdAt),
      session: current?.session ?? null,
      undo: current?.undo ?? [],
      settings: { ...DEFAULT_SETTINGS, ...settings },
      rosters: rosters.sort((a, b) => b.createdAt - a.createdAt),
      history: history.sort((a, b) => b.date - a.date),
    });
    requestPersistence();
  } catch (err) {
    console.error(err);
    set({ ready: true, loadError: err instanceof Error ? err.message : String(err) });
  }
}

// ——— Игры ———

export function getGame(id: string | undefined): Game | undefined {
  return id ? state.games.find((g) => g.id === id) : undefined;
}

export function saveGame(game: Game): void {
  const next = { ...game, updatedAt: Date.now() };
  const exists = state.games.some((g) => g.id === game.id);
  set({ games: exists ? state.games.map((g) => (g.id === game.id ? next : g)) : [next, ...state.games] });
  save('games', next);
}

export function updateGame(id: string, fn: (draft: Game) => void): void {
  const game = getGame(id);
  if (!game) return;
  const draft = clone(game);
  fn(draft);
  saveGame(draft);
}

export function createGame(name: string): Game {
  const game = newGame(name);
  saveGame(game);
  return game;
}

export function addGame(game: Game): Game {
  saveGame(game);
  return game;
}

export function duplicateGame(id: string): Game | undefined {
  const game = getGame(id);
  if (!game) return;
  const copy = copyGame(game, `${game.name} (копия)`);
  saveGame(copy);
  return copy;
}

export function deleteGame(id: string): void {
  set({ games: state.games.filter((g) => g.id !== id) });
  db.delete('games', id).catch(console.error);
}

export async function exportGame(id: string): Promise<void> {
  const game = getGame(id);
  if (!game) return;
  const media = await getMediaRecords(gameMediaIds(game));
  downloadBlob(buildExportBlob(game, media), safeFileName(game.name) + FILE_EXT);
}

export async function importGameFile(file: File): Promise<Game> {
  const parsed = await parseExportBlob(file);
  const known = new Set(state.media.map((m) => m.id));
  const added: MediaMeta[] = [];
  for (const rec of parsed.media) {
    if (known.has(rec.id)) continue;
    // Читаем содержимое целиком: срез исходного файла после закрытия диалога может стать недоступен.
    const blob = new Blob([await rec.blob.arrayBuffer()], { type: rec.mime });
    await db.put('media', { ...rec, blob });
    added.push(toMeta(rec));
  }
  let game = parsed.game;
  if (getGame(game.id)) game = copyGame(game, `${game.name} (импорт)`);
  else if (state.games.some((g) => g.name === game.name)) game = { ...game, name: `${game.name} (импорт)` };
  set({ media: [...added, ...state.media] });
  saveGame(game);
  return game;
}

// ——— Медиафайлы ———

export async function addMedia(file: File | Blob, name?: string): Promise<MediaMeta | null> {
  const fileName = name ?? (file instanceof File ? file.name : 'файл');
  const mime = guessMime(fileName, file.type);
  const kind = kindOf(mime);
  if (!kind) {
    toast(`Неподдерживаемый тип файла: ${fileName}`, 'error');
    return null;
  }
  const rec: MediaRecord = { id: uid(), name: fileName, mime, size: file.size, kind, createdAt: Date.now(), blob: file };
  try {
    await db.put('media', rec);
  } catch (err) {
    console.error(err);
    toast('Не удалось сохранить файл: возможно, не хватает места', 'error');
    return null;
  }
  const meta = toMeta(rec);
  set({ media: [meta, ...state.media] });
  return meta;
}

export function deleteMedia(id: string): void {
  forgetMediaUrl(id);
  set({ media: state.media.filter((m) => m.id !== id) });
  db.delete('media', id).catch(console.error);
}

/** Где используется каждый файл: игры, списки игроков, текущая игра. */
export function mediaUsage(s: Pick<State, 'games' | 'rosters' | 'session'>): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  const add = (id: string | undefined, label: string) => {
    if (!id) return;
    usage.set(id, [...(usage.get(id) ?? []), label]);
  };
  for (const game of s.games) {
    for (const loc of allQuestions(game)) {
      for (const id of mediaIdsOf(loc.question)) add(id, `«${game.name}» · ${loc.round.name} · ${questionLabel(loc)}`);
    }
    for (const f of game.final) for (const id of mediaIdsOf(f)) add(id, `«${game.name}» · Финал · ${f.theme}`);
  }
  for (const r of s.rosters) for (const p of r.players) add(p.avatar, `Список «${r.name}» · аватар ${p.name}`);
  for (const p of s.session?.players ?? []) add(p.avatar, `Текущая игра · аватар ${p.name}`);
  return usage;
}

// ——— Игровая сессия ———

function saveSession(): void {
  if (state.session) save('sessions', { id: 'current', session: state.session, undo: state.undo });
  else db.delete('sessions', 'current').catch(console.error);
}

export function startSession(session: Session): void {
  set({ session, undo: [] });
  saveSession();
}

/** Применяет действие к сессии; предыдущее состояние уходит в стек отмены. */
export function act(fn: (draft: Session) => void, undoable = true): void {
  const current = state.session;
  if (!current) return;
  const draft = clone(current);
  fn(draft);
  if (JSON.stringify(draft) === JSON.stringify(current)) return;
  draft.updatedAt = Date.now();
  set({ session: draft, undo: undoable ? [...state.undo, current].slice(-UNDO_LIMIT) : state.undo });
  saveSession();
}

export function undo(): boolean {
  const prev = state.undo[state.undo.length - 1];
  if (!prev) return false;
  set({ session: prev, undo: state.undo.slice(0, -1) });
  saveSession();
  return true;
}

export function endSession(): void {
  set({ session: null, undo: [] });
  saveSession();
}

// ——— Настройки, списки игроков, история ———

export function saveSettings(patch: Partial<AppSettings>): void {
  const settings = { ...state.settings, ...patch };
  set({ settings });
  save('kv', { id: 'settings', value: settings });
}

export function saveRoster(name: string, players: PlayerInput[]): void {
  const existing = state.rosters.find((r) => r.name === name);
  const roster: Roster = { id: existing?.id ?? uid(), name, players: clone(players), createdAt: Date.now() };
  set({ rosters: [roster, ...state.rosters.filter((r) => r.id !== roster.id)] });
  save('rosters', roster);
}

export function deleteRoster(id: string): void {
  set({ rosters: state.rosters.filter((r) => r.id !== id) });
  db.delete('rosters', id).catch(console.error);
}

export function addHistory(entry: HistoryEntry): void {
  set({ history: [entry, ...state.history.filter((h) => h.id !== entry.id)] });
  save('history', entry);
}

export function deleteHistory(id: string): void {
  set({ history: state.history.filter((h) => h.id !== id) });
  db.delete('history', id).catch(console.error);
}
