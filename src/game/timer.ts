export interface TimerState {
  readonly startedAt: number | null;
  readonly elapsedMs: number;
}

export function resetTimer(): TimerState { return { startedAt: null, elapsedMs: 0 }; }
export function startTimer(now: number): TimerState { return { startedAt: now, elapsedMs: 0 }; }
export function elapsedTime(timer: TimerState, now: number): number {
  return timer.elapsedMs + (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt));
}
export function stopTimer(timer: TimerState, now: number): TimerState {
  return { startedAt: null, elapsedMs: elapsedTime(timer, now) };
}
export function formatTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
