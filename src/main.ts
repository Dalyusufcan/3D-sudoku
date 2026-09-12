import './style.css';
import { generateForDifficulty, type RatedPuzzle } from './core/difficulty-generator.ts';
import { DIFFICULTY_LABELS, type Difficulty } from './core/difficulty.ts';
import type { CellValue } from './core/cube.ts';
import { enterValue, selectCell, undoMove, type GameState } from './game/state.ts';
import { beginGeneration, beginPlay, chooseDifficulty, initialSession, updateSession } from './game/session.ts';
import { elapsedTime } from './game/timer.ts';
import { selectionForKey } from './game/input.ts';
import { createCubeRenderer } from './rendering/cube.ts';
import { createInterface } from './ui/interface.ts';
import { freshSeed, validSeed } from './ui/seed.ts';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('Application root is missing.');
let session = initialSession();
let activePuzzle: RatedPuzzle | null = null;
let renderer: ReturnType<typeof createCubeRenderer> | null = null;
let clockInterval: number | null = null;
let generationId = 0;
let failed = false;
const requestedSeed = new URL(location.href).searchParams.get('seed');
let firstSeed = validSeed(requestedSeed) ? requestedSeed : null;
let pendingSeed = freshSeed();

let showFatal = (message: string): void => {
  const panel = document.createElement('main');
  panel.setAttribute('role', 'alert');
  const text = document.createElement('p');
  text.textContent = message;
  const reload = document.createElement('button');
  reload.textContent = 'Reload puzzle';
  reload.addEventListener('click', () => location.reload());
  panel.append(text, reload);
  root.replaceChildren(panel);
};

function stopClock(): void {
  if (clockInterval !== null) window.clearInterval(clockInterval);
  clockInterval = null;
}
function refreshClock(): void { ui.setTime(elapsedTime(session.timer, performance.now())); }
function startClock(): void {
  stopClock();
  refreshClock();
  clockInterval = window.setInterval(refreshClock, 200);
}

function fatal(error: unknown, message = 'An unexpected error interrupted the puzzle. Reload to start a new session.'): void {
  console.error('[3d sudoku] Application stopped:', error);
  if (failed) return;
  failed = true;
  generationId += 1;
  stopClock();
  try { renderer?.dispose(); } finally { showFatal(message); }
}
window.addEventListener('error', event => fatal(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => fatal(event.reason));

function update(game: GameState): void {
  if (failed || session.phase !== 'playing') return;
  session = updateSession(session, game, performance.now());
  if (session.phase === 'complete') stopClock();
  ui.render(game);
  renderer?.update(game);
  ui.setBusy(session.phase !== 'playing');
  refreshClock();
  ui.setSession(session);
}
function select(index: number | null): void {
  if (session.game !== null) update(selectCell(session.game, index));
}
function enter(value: CellValue): void {
  if (session.game !== null) update(enterValue(session.game, value));
}
function undo(): void {
  if (session.game !== null) update(undoMove(session.game));
}

/** Leaving play discards the session and its clock; no background timer or renderer survives. */
function leavePlay(): void {
  generationId += 1;
  stopClock();
  renderer?.dispose();
  renderer = null;
  activePuzzle = null;
}
function home(): void {
  if (failed) return;
  leavePlay();
  session = initialSession();
  ui.setTime(0);
  ui.setSession(session);
}
function newGame(seed?: string): void {
  if (failed) return;
  pendingSeed = seed ?? firstSeed ?? freshSeed();
  firstSeed = null;
  leavePlay();
  session = chooseDifficulty();
  ui.setTime(0);
  ui.setSession(session);
}

const ui = createInterface(root, {
  select, enter, undo, home,
  newPuzzle: newGame,
  difficulty(value): void { void generate(value); },
  restart(): void {
    if (failed || session.phase !== 'playing' || activePuzzle === null) return;
    session = beginPlay(activePuzzle, performance.now());
    ui.resetLayer();
    renderer?.setLayer(null);
    update(session.game!);
    renderer?.resetView();
    startClock();
  },
  overview(): void {
    if (session.phase !== 'playing') return;
    renderer?.setLayer(null);
    select(null);
    renderer?.resetView();
  },
  layer(index): void {
    if (session.phase !== 'playing') return;
    renderer?.setLayer(index);
    select(null);
  },
});
showFatal = ui.fatal;

ui.viewport.addEventListener('sudoku-render-error', event => {
  fatal(event, 'The 3D view lost its graphics connection. Reload the puzzle to reconnect.');
});

async function generate(difficulty: Difficulty): Promise<void> {
  if (failed || session.phase !== 'choosing') return;
  const request = ++generationId;
  session = beginGeneration(difficulty);
  ui.setSession(session);
  ui.setBusy(true);
  // Paint first. Bounded generation is measured before considering a worker.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (failed || request !== generationId) return;
  const puzzle = generateForDifficulty(pendingSeed, difficulty);
  console.info('[3d sudoku] Generated unique rated cube', {
    difficulty, analysis: puzzle.analysis, attempts: puzzle.attempts,
    matched: puzzle.matched, totalGenerationMs: puzzle.totalGenerationMs, ...puzzle.stats,
  });
  // Show the viewport before WebGL initialization so its dimensions are correct.
  ui.setSession({ ...session, phase: 'playing' });
  try {
    renderer = createCubeRenderer(ui.viewport, select);
  } catch (error: unknown) {
    fatal(error, 'The 3D view needs WebGL 2. Try a current browser with graphics acceleration enabled, then reload.');
    return;
  }
  activePuzzle = puzzle;
  session = beginPlay(puzzle, performance.now());
  ui.resetLayer();
  ui.ratingNote(puzzle.matched ? null : `Closest unique puzzle available: estimated ${DIFFICULTY_LABELS[puzzle.analysis.category]}.`);
  update(session.game!);
  renderer.resetView();
  startClock();
  const url = new URL(location.href);
  url.searchParams.set('seed', puzzle.seed);
  history.replaceState(null, '', url);
}

window.addEventListener('keydown', event => {
  if (failed || session.phase !== 'playing' || ui.dialogOpen()) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); undo(); return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-4]$/.test(event.key)) {
    event.preventDefault(); enter(Number(event.key) as CellValue);
  } else if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault(); enter(0);
  } else {
    const selection = selectionForKey(session.game?.selected ?? null, event.key);
    if (selection !== undefined) { event.preventDefault(); select(selection); }
  }
});

if (requestedSeed !== null && !validSeed(requestedSeed)) ui.note('Invalid seed ignored. Use 1–48 letters, numbers, - or _.');
ui.setSession(session);
