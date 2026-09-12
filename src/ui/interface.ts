import { axisLinesForCell, toCoordinates, type Axis, type CellValue } from '../core/cube.ts';
import type { GameState } from '../game/state.ts';
import { validSeed } from './seed.ts';
import { DIFFICULTY_LABELS, isDifficulty, type Difficulty } from '../core/difficulty.ts';
import type { SessionState } from '../game/session.ts';
import { formatTime } from '../game/timer.ts';

export interface Actions {
  select(index: number | null): void;
  enter(value: CellValue): void;
  newPuzzle(seed?: string): void;
  undo(): void;
  restart(): void;
  overview(): void;
  layer(index: number | null): void;
  home(): void;
  difficulty(value: Difficulty): void;
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing interface element: ${selector}`);
  return element;
}

const axisNames: Record<Axis, string> = { x: 'Across', y: 'Up & down', z: 'Through depth' };

export function createInterface(root: HTMLElement, actions: Actions) {
  // This template is static. All variable text below uses textContent or value.
  root.innerHTML = `
    <header class="site-header">
      <a class="brand" href="./" aria-label="3d sudoku home">3d sudoku</a>
      <span class="header-caption">A PUZZLE IN THREE DIMENSIONS</span>
      <div class="header-actions"><button class="text-button" id="rules-button">How to play <span aria-hidden="true">↗</span></button><button class="primary-button" id="new-button"><span aria-hidden="true">＋</span> New puzzle</button></div>
    </header>
    <section id="welcome-screen" class="start-screen" aria-labelledby="welcome-title">
      <div class="welcome-cube" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span></div>
      <div class="eyebrow">64 CELLS. THREE DIRECTIONS. ONE SOLUTION.</div>
      <h1 id="welcome-title">A little space<br>to think.</h1>
      <p>A 4 × 4 × 4 puzzle. Place 1–4 in every line,<br>and find clarity from a different angle.</p>
      <button id="start-button" class="primary-button">New Game <span aria-hidden="true">→</span></button>
      <span class="welcome-footnote">Made one puzzle at a time. Always one solution.</span>
    </section>
    <section id="difficulty-screen" class="start-screen" hidden aria-labelledby="difficulty-title">
      <div class="eyebrow">FIND YOUR PACE</div><h1 id="difficulty-title">How deep will you go?</h1>
      <p>Three levels of challenge. The same simple rules.</p>
      <div class="difficulty-options" role="group" aria-label="Choose difficulty">
        <button data-difficulty="easy"><span class="difficulty-mark" aria-hidden="true">Ⅰ</span><strong>Easy</strong><span>Room to get your bearings.</span><small>More clues · clearer next steps</small></button>
        <button data-difficulty="medium"><span class="difficulty-mark" aria-hidden="true">Ⅱ</span><strong>Medium</strong><span>Connect a few more dots.</span><small>Fewer clues · deeper deductions</small></button>
        <button data-difficulty="hard"><span class="difficulty-mark" aria-hidden="true">Ⅲ</span><strong>Hard</strong><span>Make space for a challenge.</span><small>Sparse clues · greater ambiguity</small></button>
      </div><p class="difficulty-explainer">Rated by clue layout, candidate ambiguity and solving effort.</p><button id="back-button" class="text-button">← Back to start</button>
    </section>
    <section id="generating-screen" class="start-screen" hidden role="status"><div class="generation-spinner" aria-hidden="true"></div><h1>Finding your next perspective.</h1><p>Checking the challenge. Verifying one solution.</p></section>
    <main id="play-screen" hidden>
      <section class="intro"><div><div class="eyebrow"><span class="status-dot"></span>4 × 4 × 4 LATIN CUBE</div><h1>Find your perspective.</h1><p>Every line, in every direction. Just the numbers 1–4.</p></div><div class="intro-note"><span>64 cells</span><span>48 lines</span><span>One solution</span></div></section>
      <div class="workspace">
        <section class="cube-card" aria-label="Interactive 3D puzzle">
          <div class="scene-top"><span class="scene-title"><span class="status-dot"></span><span id="scene-mode">THE WHOLE PICTURE</span></span><button id="overview-button" class="small-button" title="Restore the original camera and leave focus">↺ Reset view</button></div>
          <div id="viewport"></div>
          <div class="scene-hint" id="scene-hint">Select a cell to see its three lines.</div>
          <div class="scene-bottom"><div class="axis-legend"><span class="x-axis">X <small>across</small></span><span class="y-axis">Y <small>vertical</small></span><span class="z-axis">Z <small>depth</small></span></div><span class="orbit-hint">Drag to rotate · Scroll to zoom</span></div>
          <div class="depth-toolbar"><span class="depth-label">DEPTH <strong>Z</strong></span><div id="depth-buttons" class="depth-buttons" role="group" aria-label="Isolate a depth layer"><button data-layer="all" aria-pressed="true">All</button><button data-layer="0" aria-pressed="false" aria-label="Show depth layer 1">1</button><button data-layer="1" aria-pressed="false" aria-label="Show depth layer 2">2</button><button data-layer="2" aria-pressed="false" aria-label="Show depth layer 3">3</button><button data-layer="3" aria-pressed="false" aria-label="Show depth layer 4">4</button></div><span class="depth-help">Isolate a layer to reach inside</span></div>
        </section>
        <aside class="play-panel" aria-label="Puzzle controls">
          <section class="progress-section"><div class="game-meta"><span id="difficulty-badge">Easy</span><time id="game-timer" aria-label="Elapsed time">00:00</time></div><p id="rating-note" class="muted" hidden></p><div class="section-label">YOUR PROGRESS <span id="progress-percent">50%</span></div><div class="progress-count"><strong id="filled-count">32</strong><span>/ 64 cells filled</span></div><progress id="progress" max="64" value="32" aria-label="Filled cells"></progress><p id="game-status" role="status" aria-live="polite">Preparing your cube…</p></section>
          <section class="focus-section"><div class="section-label">CELL FOCUS <button id="exit-button" class="text-button" disabled>Exit <kbd>Esc</kbd></button></div><div id="selection-heading" class="selection-heading">A little focus goes a long way.</div><p id="selection-detail" class="muted">Tap any cell. Its three intersecting lines will appear here.</p><div id="line-strips"></div><div id="focus-placeholder" class="focus-placeholder" aria-hidden="true"><div class="mini-cross"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span>One cell. Three connected lines.</span></div></section>
          <section class="entry-section"><div class="section-label">PLACE A NUMBER <span class="keyboard-note">KEYS 1–4</span></div><div class="number-pad" role="group" aria-label="Enter a value"><button data-value="1" disabled>1</button><button data-value="2" disabled>2</button><button data-value="3" disabled>3</button><button data-value="4" disabled>4</button></div><div class="edit-actions"><button id="erase-button" class="small-button" disabled>⌫ Erase</button><button id="undo-button" class="small-button" disabled>↶ Undo</button><button id="restart-button" class="small-button">Restart</button></div></section>
          <div class="cell-key"><span><i class="clue-key"></i>Given</span><span><i class="entry-key"></i>Your entry</span><span><i class="conflict-key"></i>Conflict</span></div>
        </aside>
      </div>
      <footer class="page-footer"><span class="footer-note">A moment of clarity, one line at a time.</span><form id="seed-form"><label for="seed-input">PUZZLE SEED</label><input id="seed-input" name="seed" maxlength="48" pattern="(?:[A-Za-z0-9_]|-){1,48}" required autocomplete="off" spellcheck="false" aria-describedby="seed-note"><button type="submit" class="text-button">Load <span aria-hidden="true">↗</span></button></form><span id="seed-note">Same seed, same puzzle.</span></footer>
      <p id="announcement" class="sr-only" role="status" aria-live="polite"></p>
    </main>
    <dialog id="rules-dialog"><div class="dialog-top"><span class="eyebrow">A NEW PERSPECTIVE</span><button id="close-rules" class="small-button" aria-label="Close instructions">✕</button></div><h2>Three directions.<br>One simple rule.</h2><p>Fill the 4 × 4 × 4 cube with <strong>1, 2, 3 and 4</strong>. Each straight four-cell line along X, Y and Z must contain each number exactly once.</p><div class="rule-directions"><span class="x-axis">X · across</span><span class="y-axis">Y · vertical</span><span class="z-axis">Z · depth</span></div><p>There are 48 lines. There are no blocks, regions or diagonal rules. This is an axis-constrained Latin cube, a 3D Sudoku-style puzzle.</p><p><strong>Select a cell to focus.</strong> The cube highlights its three lines; the line strips show all their values without overlap. Tap any strip cell to move your focus. Use the depth buttons to reach cells inside the cube.</p><dl class="shortcuts"><dt>1–4</dt><dd>Place a number</dd><dt>Delete / Backspace</dt><dd>Erase your entry</dd><dt>W A S D / arrows</dt><dd>Move along logical X and Y</dd><dt>Q E / [ and ]</dt><dd>Move through Z / depth</dd><dt>Escape</dt><dd>Leave cell focus</dd><dt>Ctrl / ⌘ + Z</dt><dd>Undo a move</dd></dl><p class="muted">Given numbers stay fixed. Red marks repeated values on an axis line. Your moves are checked against the rules. Every generated puzzle has one verified solution.</p><button id="play-button" class="primary-button">Find my perspective <span aria-hidden="true">→</span></button></dialog>
    <dialog id="restart-dialog"><h2>A fresh start?</h2><p>This clears your entries in the current puzzle and keeps its given numbers.</p><div class="dialog-actions"><button id="cancel-restart" class="small-button">Keep playing</button><button id="confirm-restart" class="primary-button">Restart puzzle</button></div></dialog>
    <dialog id="result-dialog" class="result-dialog" aria-labelledby="result-title"><div class="success-mark" aria-hidden="true">✓</div><div class="eyebrow">EVERY LINE IN HARMONY</div><h2 id="result-title">A new perspective. Found.</h2><p>All 64 cells. All 48 lines. Beautifully done.</p><div class="result-stats"><div><span>CHALLENGE</span><strong id="result-difficulty">Easy</strong></div><div><span>YOUR TIME</span><strong id="result-time">00:00</strong></div></div><button id="result-new-button" class="primary-button">New Game <span aria-hidden="true">→</span></button><button id="result-home-button" class="text-button">Back to start</button></dialog>
    <div id="fatal-overlay" class="fatal-overlay" hidden role="alert"><div><span class="eyebrow">LET’S RESET</span><h2>The cube couldn’t continue.</h2><p id="fatal-message">An unexpected error occurred. Reload to start a new session.</p><button id="reload-button" class="primary-button">Reload puzzle</button></div></div>
  `;

  const get = <T extends Element>(selector: string): T => required<T>(root, selector);
  // Keep elapsed time visible even when a small screen scrolls between cube and controls.
  get('.header-actions').before(get('.game-meta'));
  const rules = get<HTMLDialogElement>('#rules-dialog');
  const restart = get<HTMLDialogElement>('#restart-dialog');
  const result = get<HTMLDialogElement>('#result-dialog');
  // A completed session stays read-only; explicit actions leave the result screen.
  result.addEventListener('cancel', event => event.preventDefault());
  get<HTMLHeadingElement>('#rules-dialog h2').id = 'rules-heading';
  rules.setAttribute('aria-labelledby', 'rules-heading');
  get<HTMLHeadingElement>('#restart-dialog h2').id = 'restart-heading';
  restart.setAttribute('aria-labelledby', 'restart-heading');
  let busy = false;
  let lastState: GameState | null = null;
  let layer: number | null = null;
  let announcedSelection: number | null = null;
  const lineButtons = new Map<Axis, HTMLButtonElement[]>();
  for (const axis of ['x', 'y', 'z'] as const) {
    const row = document.createElement('div');
    row.className = `line-row ${axis}-axis`;
    const heading = document.createElement('div');
    heading.className = 'line-heading';
    const label = document.createElement('span');
    label.textContent = axis.toUpperCase();
    const description = document.createElement('span');
    description.textContent = axisNames[axis];
    heading.append(label, description);
    const cells = document.createElement('div');
    cells.className = 'line-cells';
    cells.setAttribute('role', 'group');
    cells.setAttribute('aria-label', `${axis.toUpperCase()} axis line, positions 1 through 4`);
    const buttons = Array.from({ length: 4 }, () => {
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        if (!busy && Number.isInteger(index)) actions.select(index);
      });
      cells.append(button);
      return button;
    });
    lineButtons.set(axis, buttons);
    row.append(heading, cells);
    get('#line-strips').append(row);
  }

  get('#rules-button').addEventListener('click', () => rules.showModal());
  for (const id of ['#close-rules', '#play-button']) get(id).addEventListener('click', () => rules.close());
  get('#restart-button').addEventListener('click', () => restart.showModal());
  get('#cancel-restart').addEventListener('click', () => restart.close());
  get('#confirm-restart').addEventListener('click', () => { restart.close(); actions.restart(); });
  get('#new-button').addEventListener('click', () => actions.newPuzzle());
  get('#new-button').textContent = 'New Game';
  get('#start-button').addEventListener('click', () => actions.newPuzzle());
  get('#result-new-button').addEventListener('click', () => actions.newPuzzle());
  get('#result-home-button').addEventListener('click', actions.home);
  get('#back-button').addEventListener('click', actions.home);
  get('.brand').addEventListener('click', event => { event.preventDefault(); actions.home(); });
  root.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach(button => {
    button.addEventListener('click', () => {
      const difficulty = button.dataset.difficulty;
      if (isDifficulty(difficulty)) actions.difficulty(difficulty);
    });
  });
  get('#overview-button').addEventListener('click', () => { layer = null; actions.overview(); });
  get('#exit-button').addEventListener('click', () => actions.select(null));
  get('#erase-button').addEventListener('click', () => actions.enter(0));
  get('#undo-button').addEventListener('click', actions.undo);
  get('#reload-button').addEventListener('click', () => location.reload());
  root.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(button => {
    button.addEventListener('click', () => actions.enter(Number(button.dataset.value) as CellValue));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(button => {
    button.addEventListener('click', () => {
      layer = button.dataset.layer === 'all' ? null : Number(button.dataset.layer);
      actions.layer(layer);
    });
  });
  get('#seed-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = get<HTMLInputElement>('#seed-input');
    if (validSeed(input.value)) actions.newPuzzle(input.value);
  });

  function render(state: GameState): void {
    lastState = state;
    const selected = state.selected;
    const filled = state.values.filter(value => value !== 0).length;
    const fixed = selected !== null && state.generated.fixed[selected] === true;
    const editable = !busy && selected !== null && !fixed;
    get('#filled-count').textContent = String(filled);
    get('#progress-percent').textContent = `${Math.round(filled / 64 * 100)}%`;
    get<HTMLProgressElement>('#progress').value = filled;
    root.classList.toggle('is-complete', state.complete);
    const status = get<HTMLElement>('#game-status');
    status.classList.toggle('has-conflicts', state.conflicts.length > 0);
    status.textContent = busy ? 'Generating a unique puzzle…' : state.complete ? 'Beautifully done. Every line is in place.' : state.conflicts.length > 0 ? `${state.conflicts.length} cells have a repeated value. Look for red.` : 'All lines are looking good.';
    get('#scene-mode').textContent = selected === null ? layer === null ? 'THE WHOLE PICTURE' : `DEPTH LAYER ${layer + 1} OF 4` : 'THREE LINES. ONE FOCUS.';
    get('#scene-hint').textContent = selected === null ? 'Select a cell to see its three lines.' : 'Follow the color. Every line contains 1–4.';
    get<HTMLButtonElement>('#exit-button').disabled = busy || selected === null;
    get<HTMLElement>('#line-strips').hidden = selected === null;
    get<HTMLElement>('#focus-placeholder').hidden = selected !== null;
    if (selected === null) {
      get('#announcement').textContent = '';
      get('#selection-heading').textContent = 'A little focus goes a long way.';
      get('#selection-detail').textContent = 'Tap any cell. Its three intersecting lines will appear here.';
    } else {
      const coordinates = toCoordinates(selected);
      get('#selection-heading').textContent = `X ${coordinates.x + 1}  /  Y ${coordinates.y + 1}  /  Z ${coordinates.z + 1}`;
      get('#selection-detail').textContent = fixed ? 'Given number · fixed, but always worth a look.' : 'Your cell · choose a number below or type 1–4.';
      const lines = axisLinesForCell(selected);
      for (const axis of ['x', 'y', 'z'] as const) {
        lineButtons.get(axis)?.forEach((button, position) => {
          const index = lines[axis][position];
          if (index === undefined) return;
          const value = state.values[index];
          const isFixed = state.generated.fixed[index];
          const conflict = state.conflicts.includes(index);
          button.dataset.index = String(index);
          button.textContent = value === 0 ? '·' : String(value);
          button.classList.toggle('selected', index === selected);
          button.classList.toggle('given', isFixed);
          button.classList.toggle('conflict', conflict);
          button.disabled = busy;
          button.setAttribute('aria-pressed', String(index === selected));
          const c = toCoordinates(index);
          button.setAttribute('aria-label', `X ${c.x + 1}, Y ${c.y + 1}, Z ${c.z + 1}: ${value === 0 ? 'empty' : value}, ${isFixed ? 'given' : 'editable'}${conflict ? ', conflict' : ''}`);
        });
      }
      if (announcedSelection !== selected) {
        get('#announcement').textContent = `Selected X ${coordinates.x + 1}, Y ${coordinates.y + 1}, Z ${coordinates.z + 1}. ${fixed ? 'Given number.' : 'Editable cell.'}`;
      }
    }
    announcedSelection = selected;
    root.querySelectorAll<HTMLButtonElement>('[data-value]').forEach(button => {
      button.disabled = !editable;
      button.setAttribute('aria-pressed', String(selected !== null && state.values[selected] === Number(button.dataset.value)));
    });
    get<HTMLButtonElement>('#erase-button').disabled = !editable || (selected !== null && state.values[selected] === 0);
    get<HTMLButtonElement>('#undo-button').disabled = busy || state.history.length === 0;
    root.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(button => {
      button.disabled = busy;
      button.setAttribute('aria-pressed', String(button.dataset.layer === (layer === null ? 'all' : String(layer))));
    });
    for (const id of ['#new-button', '#restart-button', '#overview-button']) get<HTMLButtonElement>(id).disabled = busy;
    get<HTMLInputElement>('#seed-input').value = state.generated.seed;
    get<HTMLInputElement>('#seed-input').disabled = busy;
    get<HTMLButtonElement>('#seed-form button').disabled = busy;
  }

  return {
    viewport: get<HTMLElement>('#viewport'),
    render,
    resetLayer(): void { layer = null; },
    dialogOpen(): boolean { return rules.open || restart.open || result.open; },
    setSession(session: SessionState): void {
      const phase = session.phase;
      const inGame = phase === 'playing' || phase === 'complete';
      root.classList.toggle('is-playing', inGame);
      get<HTMLElement>('.game-meta').hidden = !inGame;
      get<HTMLElement>('#welcome-screen').hidden = phase !== 'start';
      get<HTMLElement>('#difficulty-screen').hidden = phase !== 'choosing';
      get<HTMLElement>('#generating-screen').hidden = phase !== 'generating';
      get<HTMLElement>('#play-screen').hidden = phase !== 'playing' && phase !== 'complete';
      get<HTMLButtonElement>('#new-button').hidden = phase !== 'playing';
      get<HTMLButtonElement>('#rules-button').disabled = phase === 'generating';
      root.setAttribute('aria-busy', String(phase === 'generating'));
      if (session.difficulty !== null) get('#difficulty-badge').textContent = DIFFICULTY_LABELS[session.difficulty];
      if (session.result !== null) {
        get('#result-difficulty').textContent = DIFFICULTY_LABELS[session.result.difficulty];
        get('#result-time').textContent = formatTime(session.result.elapsedMs);
        if (!result.open) result.showModal();
      } else result.close();
      if (phase === 'start') get<HTMLButtonElement>('#start-button').focus({ preventScroll: true });
      if (phase === 'choosing') get<HTMLButtonElement>('[data-difficulty="easy"]').focus({ preventScroll: true });
    },
    setTime(elapsedMs: number): void { get('#game-timer').textContent = formatTime(elapsedMs); },
    ratingNote(message: string | null): void {
      const note = get<HTMLElement>('#rating-note');
      note.hidden = message === null;
      note.textContent = message;
    },
    setBusy(value: boolean): void {
      busy = value;
      root.setAttribute('aria-busy', String(value));
      if (lastState !== null) render(lastState);
    },
    note(message: string): void { get('#seed-note').textContent = message; },
    fatal(message: string): void {
      busy = true;
      root.setAttribute('aria-busy', 'false');
      rules.close();
      restart.close();
      result.close();
      root.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
      get('#fatal-message').textContent = message;
      get<HTMLElement>('#fatal-overlay').hidden = false;
      get<HTMLButtonElement>('#reload-button').disabled = false;
      get<HTMLButtonElement>('#reload-button').focus();
    },
  };
}
