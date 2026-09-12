import type { Difficulty } from '../core/difficulty.ts';
import type { RatedPuzzle } from '../core/difficulty-generator.ts';
import { createGame, type GameState } from './state.ts';
import { resetTimer, startTimer, stopTimer, type TimerState } from './timer.ts';

export type Phase = 'start' | 'choosing' | 'generating' | 'playing' | 'complete';
export interface CompletionResult { readonly difficulty: Difficulty; readonly elapsedMs: number }
export interface SessionState {
  readonly phase: Phase;
  readonly game: GameState | null;
  readonly difficulty: Difficulty | null;
  readonly timer: TimerState;
  readonly result: CompletionResult | null;
}

export function initialSession(): SessionState {
  return { phase: 'start', game: null, difficulty: null, timer: resetTimer(), result: null };
}
export function chooseDifficulty(): SessionState { return { ...initialSession(), phase: 'choosing' }; }
export function beginGeneration(difficulty: Difficulty): SessionState {
  return { ...initialSession(), phase: 'generating', difficulty };
}
export function beginPlay(puzzle: RatedPuzzle, now: number): SessionState {
  return { phase: 'playing', game: createGame(puzzle), difficulty: puzzle.difficulty, timer: startTimer(now), result: null };
}
export function updateSession(session: SessionState, game: GameState, now: number): SessionState {
  if (session.phase !== 'playing') return session;
  if (!game.complete) return { ...session, game };
  const timer = stopTimer(session.timer, now);
  return {
    ...session, game, phase: 'complete', timer,
    result: { difficulty: session.difficulty!, elapsedMs: timer.elapsedMs },
  };
}
