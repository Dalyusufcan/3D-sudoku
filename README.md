https://dalyusufcan.github.io/3D-sudoku/

# 3d sudoku — 4 × 4 × 4 Latin cube

A fully client-side 3D Sudoku-style puzzle built with strict TypeScript, HTML, CSS and Three.js. The solver, generator, validator, difficulty analyzer and uniqueness checks are implemented in this repository. Three.js is the only runtime dependency; Vite and TypeScript are development tools.

This is an **axis-constrained Latin cube**, not a claim of mathematical novelty.

## Rules

Fill 64 cells with 1, 2, 3 and 4. Each four-cell line along X, Y and Z must contain each value exactly once. There are 16 lines per axis, 48 constraints total, and exactly three lines through any selected cell.

There are no blocks, regions, subcube rules, diagonals or additional modes. Given clues are immutable. Player conflicts and completion are checked against these rules, never by continuously comparing moves to the hidden solution.

## Run and verify

Use Node.js 24 or later with npm:

```sh
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite development server |
| `npm run typecheck` | Strict TypeScript checks, including tests |
| `npm test` | Node's built-in automated test runner |
| `npm run calibrate -- 1000 verification-v2` | Verify 1,000 seeded puzzles per tier and report generation timings |
| `npm run build` | Type-check and produce static `dist/` |
| `npm run preview` | Inspect the production build locally |

Serve over HTTP/HTTPS, rather than opening the source HTML directly. Node is development tooling; deployment has no application server, API, database or authentication.

## Game flow

The app opens to a centered **New Game** action. It opens the difficulty selection screen; generation begins only after choosing **Easy**, **Medium** or **Hard**.

The elapsed timer starts after generation and graphics initialization, when the puzzle becomes playable. It stays in the sticky header on desktop and mobile. It uses monotonic timestamps, not interval tick counts, so background throttling does not lose elapsed time. Time continues while viewing instructions or switching browser tabs. Restart resets the clock and entries. Returning home or opening a new game clears the previous session and its interval.

The completing move immediately freezes elapsed time. A short CSS success animation and result dialog show the selected difficulty, final MM:SS time and New Game action. Completed sessions are read-only. Reduced-motion preferences disable the success motion.

## Focus and controls

The full cube provides context. Selecting a cell emphasizes its three intersecting lines and ghosts unrelated cells. The camera moves smoothly, with bounds calculated to retain all ten related cells. Clickable X/Y/Z line strips show all values without overlap. Depth buttons isolate one of the four Z layers for interior selection.

All three orientation rulers originate at the same marked front-left-bottom point. Z grows into the cube from that common point, rather than starting at X's far end. Their colors and labels remain visible through ghosted cells. Number labels face the camera using native canvas textures and Three.js sprites.

| Input | Action |
| --- | --- |
| Click/tap a cell or line-strip cell | Select and focus |
| Drag; scroll/pinch | Rotate; zoom |
| A / D, or left/right arrows | Decrease/increase X |
| W / S, or up/down arrows | Increase/decrease Y |
| Q / E, or [ / ] | Decrease/increase Z |
| 1–4 or number buttons | Enter a value |
| Delete / Backspace / Erase | Clear an editable cell |
| Ctrl+Z / Cmd+Z / Undo | Undo an edit |
| Escape / Exit | Leave focus |
| Reset view | Restore the overview |
| Restart | Reset this puzzle and its timer |
| 3d sudoku logo | Return to the start screen |

Navigation uses puzzle coordinates, independent of camera rotation. Edges clamp without wrapping; the first navigation key with no selection selects X1/Y1/Z1. Keyboard input is ignored while editing the seed field or using a dialog.

## Generation, uniqueness and difficulty

The core represents the cube as a flat 64-element array with X varying fastest; conversion and the 48-line topology are centralized. Validation reports invalid, partial and completed boards explicitly.

The repository's backtracking solver chooses the smallest candidate set (MRV), with four-bit line masks and immediate single-candidate propagation. Solution counting stops upon finding a second solution or reaching an explicit node budget. A partial count of one is **not** a uniqueness proof: `budgetExceeded` must also be false.

Generation constructs a full cube by randomized solving, shuffles clue-removal order, then removes each clue only if exactly one solution remains. It never uses a preloaded solution database. A seeded FNV-1a/Mulberry32 generator and Fisher–Yates shuffle make results reproducible within this algorithm version.

Difficulty is determined by **the deductions needed to make progress**, using a separate logical solver that reads only the puzzle's visible clues:

| Level | Acceptance rule | Typical reasoning |
| --- | --- | --- |
| Easy | Naked singles solve the whole cube | Eliminate values already present in the three intersecting lines; fill a cell with one candidate |
| Medium | Naked singles stall; hidden singles and naked pairs finish the cube | Find a digit's only possible place in a line, or reserve two digits for two cells, then propagate deductions |
| Hard | All implemented logical techniques stall; exploring alternatives completes the cube | Make an assumption, propagate its consequences, and backtrack when a contradiction is found |

The logical solver prefers naked singles, then hidden singles, then naked pairs, repeating to a fixed point. Its candidate eliminations use only the same 48 axis lines as gameplay. Analysis records simultaneous singles rounds, stalled cells, hidden-single placements, pair eliminations, alternative branches, contradictions, and maximum assumption depth. These explain the classification and help calibration; neither raw search nodes nor search depth sets the category. The old weighted score and clue-count acceptance bands have been removed. Tests include Easy and Hard puzzles with the same seven clues, and verify that category survives digit relabeling and cube coordinate/axis permutations.

Sampling aims for 24 clues for Easy to keep the board approachable. For Medium and Hard it tries removing every clue once, retaining each removal only after an exhaustive uniqueness proof. These two tiers have overlapping clue counts (about seven on average in calibration), but require different reasoning. A removal rejected for ambiguity cannot become unique after further removals, so an additional removal pass is unnecessary. A search-budget interruption can leave extra clues; the independent rating still decides acceptance.

`generateForDifficulty` uses deterministic rejection sampling with at most 96 attempts. Each attempt has a total generation budget of 20,000 search nodes; rating has a separate 20,000-node uniqueness budget and at most 512 speculative branches. Invalid, ambiguous, unsatisfiable, or incompletely analyzed candidates are rejected. The limits are centralized in the core modules and do not depend on wall-clock speed. Exhaustion throws `DifficultyGenerationError`; **a differently rated puzzle is never substituted**.

Browser generation runs in a disposable module worker. Cancellation, returning home, worker failures, and a 15-second watchdog terminate it; stale responses cannot start a discarded session. A generation failure returns to difficulty selection with an explanation, and the next choice uses a fresh seed. The timer starts only after a successful result and graphics initialization. The worker adds no runtime dependency and is bundled by Vite for static hosting.

These tiers are a transparent computational estimate, not a validated human difficulty scale. Hard means the implemented logical repertoire stalled; a human may spot another deduction and avoid guessing. Search metrics depend on branching order, and a long chain of singles can still challenge a beginner. No claim is made that a deeper machine search is proportionally harder for a person. Human playtesting remains the next step for perceptual calibration.

The original low-level `generatePuzzle(seed, targetClues)` remains available for core use and tests; normal gameplay uses rated generation. Its default of 32 is no longer the gameplay difficulty policy.

A seed plus the selected difficulty reproduces the same puzzle within this generator version. The seed field reopens difficulty selection. Seeds and URL inputs accept only 1–48 ASCII letters, digits, underscores and hyphens. Future algorithm changes may change seed results.

A fresh Node 24 verification run (`npm run calibrate -- 1000 verification-v2`) checked 3,000 puzzles, independently recounting solutions and checking technique-tier boundaries, fixed clues and all line constraints. All 3,000 matched and were unique:

| Level | Mean generation | 95th percentile | Maximum | Maximum attempts |
| --- | --- | --- | --- | --- |
| Easy | 0.57 ms | 0.72 ms | 4.75 ms | 1 |
| Medium | 5.10 ms | 13.90 ms | 57.90 ms | 25 |
| Hard | 21.24 ms | 56.66 ms | 141.02 ms | 57 |

An earlier 3,000-puzzle run exposed two Hard seeds that exhausted a 64-attempt budget; they matched on attempts 73 and 72, motivating the current 96-attempt limit. Finite sampling cannot guarantee every seed will match, so the recoverable failure path is part of the design. Timings exclude worker startup, rendering, and the calibration script's independent checks, and are measurements on this development machine, not browser or mobile performance guarantees. The calibration command reports failures and exits nonzero if any occur.

## Architecture and error handling

| Location | Responsibility |
| --- | --- |
| `src/core/` | Coordinates, validation, bounded solving/generation, uniqueness, logical technique analysis, worker entry point |
| `src/game/` | Immutable moves and selection, session transitions, timer, cancellable worker lifecycle |
| `src/rendering/` | Three.js cells, labels, raycasting, camera framing and orientation |
| `src/ui/` | DOM controls, start/difficulty/result screens, seed validation |
| `src/main.ts` | Composition, lifecycle, timer scheduling and browser error boundary |
| `tests/` | Core invariants, difficulty/retries, game/session/timer/navigation and rendering mathematics |
| `scripts/calibrate-difficulty.ts` | Repeatable sample verification and performance reporting |

The core does not depend on DOM or Three.js. Rendering does not solve puzzles. No frontend framework or external puzzle/CSP library is used.

Invalid moves, contradictions and unsuccessful generation are ordinary domain outcomes. Generation errors allow retry without reloading; other unexpected browser errors/rejections stop interaction and present a recovery message. WebGL initialization has a local recovery boundary. Dynamic text uses safe DOM properties; no eval, dynamic user code, secrets or API keys are present.

## Tests

The suite preserves the original rule, game, session and rendering checks, and updates difficulty tests for technique tiers and explicit exhaustion. It checks 150 rated puzzles (50 per level), equal-clue category differences, symmetry invariance, deterministic retries, partial uniqueness searches, safe clue restoration, and malformed/ambiguous boards. Frozen logical fixtures verify deduction soundness against the independent counting solver, including exclusions made by pairs and contradictions found during alternative exploration. Worker lifecycle tests cover success, cancellation, stale responses, startup/transport errors, and timeout cleanup.

Timer/session tests check no time before play, reset/abandon behavior, immediate completion freeze and preserved final time. Navigation tests cover every cell and all WASD/QE directions, bounds and related lines. Rendering tests verify positions, shared-origin math, and projected focus bounds across 1,920 selection/view combinations. No pixel-perfect renderer tests or test framework dependency is used.

## GitHub Pages

`npm run build` creates a static `dist/`. Vite uses `base: './'`, so assets work under a repository subpath without embedding the repository name. There are no server routes.

Push to a GitHub repository and select **Settings → Pages → GitHub Actions**. `.github/workflows/pages.yml` installs with the committed lockfile (including platform-specific optional build dependencies), checks types, runs tests and builds on branch pushes and pull requests. Only the repository's default branch can publish, including manual runs. Deployment checks Pages configuration and queues behind any active deployment. The `github-pages` environment must allow the default branch. No separate Static HTML workflow is needed: this workflow publishes the built `dist/`, not the TypeScript source. Hosting setup and publishing are separate from local implementation.

See the [Vite static deployment guide](https://vite.dev/guide/static-deploy#github-pages) and [Three.js OrbitControls documentation](https://threejs.org/docs/pages/OrbitControls.html).

## Limitations

- Requires a modern WebGL2-capable browser; there is no separate 2D mode.
- Progress and time are in memory and lost on reload. A seed restores the starting puzzle, not progress.
- Difficulty is heuristic and sampling is not uniform over all Latin cubes.
- Global-view occlusion remains possible; focus, line strips, rotation and layers resolve it.
- Automated checks cover logic and rendering mathematics; physical touch devices and graphics performance still warrant device-specific testing.
