// Логика игры. Все функции меняют переданный черновик сессии (store передаёт копию),
// поэтому любое действие можно отменить, вернув предыдущий снимок (И14).
import { findQuestion, questionLabel } from './model.ts';
import type { Game, LogEntry, Player, PlayerInput, Session, SessionSettings } from './types.ts';
import { uid } from './utils.ts';

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

export function createSession(game: Game, players: PlayerInput[], settings: SessionSettings, roundIndex = 0): Session {
  const now = Date.now();
  return {
    id: uid(),
    gameId: game.id,
    gameName: game.name,
    startedAt: now,
    updatedAt: now,
    players: players.map((p) => ({ id: uid(), name: p.name, color: p.color, avatar: p.avatar, score: 0 })),
    phase: 'board',
    roundIndex: Math.min(roundIndex, Math.max(0, game.rounds.length - 1)),
    played: [],
    log: [],
    settings,
    finished: false,
  };
}

export function activePlayers(s: Session): Player[] {
  return s.players.filter((p) => !p.removed);
}

export function getPlayer(s: Session, id: string | undefined): Player | undefined {
  return id ? s.players.find((p) => p.id === id) : undefined;
}

function addLog(s: Session, entry: Omit<LogEntry, 'id' | 'time'>): void {
  s.log.push({ id: uid(), time: Date.now(), ...entry });
}

function markPlayed(s: Session, questionId: string): void {
  if (!s.played.includes(questionId)) s.played.push(questionId);
}

/** Текущая стоимость открытого вопроса: ставка или номинал. */
export function activeValue(s: Session, game: Game): number {
  const a = s.active;
  if (!a) return 0;
  if (a.stake !== undefined) return a.stake;
  return findQuestion(game, a.questionId)?.question.value ?? 0;
}

export function openQuestion(s: Session, game: Game, questionId: string): void {
  const loc = findQuestion(game, questionId);
  if (!loc) return;
  s.phase = 'question';
  s.active = {
    questionId,
    roundIndex: loc.roundIndex,
    stage: loc.question.special === 'none' ? 'play' : 'special',
    revealed: false,
    wrong: [],
    finished: false,
  };
}

/** Кот в мешке: вопрос получает выбранный игрок (И11). */
export function giveCat(s: Session, game: Game, playerId: string): void {
  const a = s.active;
  const loc = a && findQuestion(game, a.questionId);
  if (!a || !loc || !getPlayer(s, playerId)) return;
  a.owner = playerId;
  a.selected = playerId;
  a.stake = loc.question.catValue || loc.question.value;
  a.stage = 'play';
}

/** Вопрос со ставкой: отвечает игрок, предложивший наибольшую ставку (И11). */
export function setStake(s: Session, playerId: string, amount: number): void {
  const a = s.active;
  if (!a || !getPlayer(s, playerId)) return;
  a.owner = playerId;
  a.selected = playerId;
  a.stake = Math.max(0, Math.round(amount));
  a.stage = 'play';
}

export function selectAnswerer(s: Session, playerId: string): void {
  const a = s.active;
  if (!a || a.finished || a.stage !== 'play') return;
  if (a.owner && a.owner !== playerId) return;
  if (a.wrong.includes(playerId)) return;
  a.selected = a.selected === playerId && !a.owner ? undefined : playerId;
}

export function markCorrect(s: Session, game: Game): void {
  const a = s.active;
  if (!a || a.finished || a.stage !== 'play') return;
  const player = getPlayer(s, a.owner ?? a.selected);
  const loc = findQuestion(game, a.questionId);
  if (!player || !loc) return;
  const value = activeValue(s, game);
  player.score += value;
  addLog(s, {
    kind: 'correct',
    label: questionLabel(loc),
    playerId: player.id,
    playerName: player.name,
    questionId: a.questionId,
    delta: value,
  });
  a.finished = true;
  a.answeredBy = player.id;
  a.revealed = true;
  a.selected = undefined;
  s.chooser = player.id; // С9: право хода у ответившего верно
  markPlayed(s, a.questionId);
}

export function markWrong(s: Session, game: Game): void {
  const a = s.active;
  if (!a || a.finished || a.stage !== 'play') return;
  const player = getPlayer(s, a.owner ?? a.selected);
  const loc = findQuestion(game, a.questionId);
  if (!player || !loc || a.wrong.includes(player.id)) return;
  const value = activeValue(s, game);
  player.score -= value;
  addLog(s, {
    kind: 'wrong',
    label: questionLabel(loc),
    playerId: player.id,
    playerName: player.name,
    questionId: a.questionId,
    delta: -value,
  });
  a.wrong.push(player.id);
  a.selected = undefined;
  // И8: обычный вопрос остаётся открытым для других игроков.
  // У кота в мешке и вопроса со ставкой отвечает только один игрок.
  if (a.owner) {
    a.finished = true;
    a.revealed = true;
    markPlayed(s, a.questionId);
  }
}

export function revealAnswer(s: Session): void {
  if (s.active) s.active.revealed = !s.active.revealed || s.active.finished;
}

/** «Никто не ответил» и «К табло»: вопрос закрывается без изменения очков (И9). */
export function closeQuestion(s: Session, game: Game): void {
  const a = s.active;
  if (!a) return;
  if (!a.finished) {
    const loc = findQuestion(game, a.questionId);
    addLog(s, {
      kind: 'skip',
      label: loc ? questionLabel(loc) : 'Вопрос',
      questionId: a.questionId,
      delta: 0,
    });
  }
  markPlayed(s, a.questionId);
  s.active = undefined;
  s.phase = 'board';
}

export function returnQuestion(s: Session, questionId: string): void {
  s.played = s.played.filter((id) => id !== questionId);
}

export function setRound(s: Session, game: Game, index: number): void {
  if (index < 0 || index >= game.rounds.length) return;
  s.roundIndex = index;
  s.phase = 'board';
  s.active = undefined;
  s.final = undefined;
}

export function isRoundComplete(s: Session, game: Game, index = s.roundIndex): boolean {
  const round = game.rounds[index];
  if (!round) return false;
  const ids = round.themes.flatMap((t) => t.questions.map((q) => q.id));
  return ids.length > 0 && ids.every((id) => s.played.includes(id));
}

export function setChooser(s: Session, playerId: string | undefined): void {
  s.chooser = playerId;
}

/** С7: ручная корректировка счёта, может быть отрицательным. */
export function setScore(s: Session, playerId: string, score: number): void {
  const player = getPlayer(s, playerId);
  if (!player || !Number.isFinite(score)) return;
  const delta = Math.round(score) - player.score;
  if (delta === 0) return;
  player.score += delta;
  addLog(s, { kind: 'manual', label: 'Ручная корректировка', playerId, playerName: player.name, delta });
}

/** С8: отмена любого действия из журнала — очки возвращаются. */
export function cancelLogEntry(s: Session, entryId: string): void {
  const entry = s.log.find((e) => e.id === entryId);
  if (!entry || entry.cancelled) return;
  const player = getPlayer(s, entry.playerId);
  if (player) player.score -= entry.delta;
  entry.cancelled = true;
}

export function addPlayer(s: Session, input: PlayerInput): void {
  if (activePlayers(s).length >= MAX_PLAYERS) return;
  s.players.push({ id: uid(), name: input.name, color: input.color, avatar: input.avatar, score: 0 });
}

export function updatePlayer(s: Session, playerId: string, patch: Partial<PlayerInput>): void {
  const player = getPlayer(s, playerId);
  if (player) Object.assign(player, patch);
}

/** С3: замена игрока — за стол садится другой человек, очки сохраняются или обнуляются. */
export function replacePlayer(s: Session, playerId: string, input: PlayerInput, resetScore: boolean): void {
  const player = getPlayer(s, playerId);
  if (!player) return;
  if (resetScore && player.score !== 0) {
    addLog(s, { kind: 'manual', label: 'Замена игрока, очки обнулены', playerId, playerName: player.name, delta: -player.score });
    player.score = 0;
  }
  player.name = input.name;
  player.color = input.color;
  player.avatar = input.avatar;
}

export function removePlayer(s: Session, playerId: string, keepScore: boolean): void {
  const player = getPlayer(s, playerId);
  if (!player) return;
  if (!keepScore && player.score !== 0) {
    addLog(s, { kind: 'manual', label: 'Игрок удалён, очки обнулены', playerId, playerName: player.name, delta: -player.score });
    player.score = 0;
  }
  player.removed = keepScore ? 'keep' : 'zero';
  if (s.chooser === playerId) s.chooser = undefined;
  if (s.active?.selected === playerId) s.active.selected = undefined;
}

// ——— Финал (И12) ———

export function finalParticipants(s: Session): Player[] {
  return activePlayers(s).filter((p) => p.score > 0);
}

export function startFinal(s: Session, game: Game): void {
  if (!game.final.length) {
    finishGame(s);
    return;
  }
  s.phase = 'final';
  s.active = undefined;
  s.final = {
    stage: game.final.length > 1 ? 'themes' : 'bets',
    participants: finalParticipants(s).map((p) => p.id),
    removed: [],
    questionId: game.final.length === 1 ? game.final[0].id : undefined,
    bets: {},
    results: {},
  };
}

export function remainingFinalThemes(s: Session, game: Game) {
  return game.final.filter((f) => !s.final?.removed.includes(f.id));
}

export function removeFinalTheme(s: Session, game: Game, finalId: string): void {
  const f = s.final;
  if (!f || f.stage !== 'themes' || f.removed.includes(finalId)) return;
  const remaining = remainingFinalThemes(s, game);
  if (remaining.length <= 1) return;
  f.removed.push(finalId);
  const left = remainingFinalThemes(s, game);
  if (left.length === 1) {
    f.questionId = left[0].id;
    f.stage = 'bets';
  }
}

export function setBet(s: Session, playerId: string, amount: number): void {
  const f = s.final;
  const player = getPlayer(s, playerId);
  if (!f || !player || !f.participants.includes(playerId)) return;
  f.bets[playerId] = Math.max(0, Math.min(player.score, Math.round(amount)));
}

export function betsComplete(s: Session): boolean {
  const f = s.final;
  return !!f && f.participants.every((id) => (f.bets[id] ?? 0) > 0);
}

export function showFinalQuestion(s: Session): void {
  if (s.final && s.final.stage === 'bets') s.final.stage = 'question';
}

export function showFinalAnswer(s: Session): void {
  if (s.final && s.final.stage === 'question') s.final.stage = 'answer';
}

export function setFinalResult(s: Session, playerId: string, correct: boolean): void {
  if (s.final) s.final.results[playerId] = correct;
}

export function applyFinal(s: Session, game: Game): void {
  const f = s.final;
  if (!f) return;
  const q = game.final.find((x) => x.id === f.questionId);
  for (const id of f.participants) {
    const player = getPlayer(s, id);
    if (!player) continue;
    const bet = f.bets[id] ?? 0;
    const delta = f.results[id] ? bet : -bet;
    player.score += delta;
    addLog(s, {
      kind: 'final',
      label: `Финал${q?.theme ? ` · ${q.theme}` : ''}`,
      playerId: id,
      playerName: player.name,
      delta,
    });
  }
  finishGame(s);
}

export function finishGame(s: Session): void {
  s.phase = 'results';
  s.active = undefined;
  s.finished = true;
}

/** Места с учётом ничьих: 1, 1, 3. */
export function standings(s: Session): { player: Player; place: number }[] {
  const list = s.players.filter((p) => p.removed !== 'zero').sort((a, b) => b.score - a.score);
  return list.map((player) => ({ player, place: list.findIndex((p) => p.score === player.score) + 1 }));
}

export function leaders(s: Session): string[] {
  const list = activePlayers(s);
  const max = Math.max(...list.map((p) => p.score));
  if (!(max > 0)) return [];
  return list.filter((p) => p.score === max).map((p) => p.id);
}
