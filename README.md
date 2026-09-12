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

The repository's backtracking solver chooses the smallest candidate set (MRV), with four-bit line masks and immediate single-candidate propagation. Solution counting stops at a configurable limit; uniqueness checks stop upon finding a second solution.

Generation constructs a full cube by randomized solving, shuffles clue-removal order, then removes each clue only if exactly one solution remains. It never uses a preloaded solution database. A seeded FNV-1a/Mulberry32 generator and Fisher–Yates shuffle make results reproducible within this algorithm version.

Difficulty uses **both a clue profile and an arrangement-sensitive solving score**:

| Level | Target clue range | Required score |
| --- | --- | --- |
| Easy | 32–38 | Below 12 |
| Medium | 24–30 | 12 to below 24 |
| Hard | 16–22 | 24 or above |

The score combines initial average candidates, the number of simultaneous naked-single rounds, cells remaining when singles stall, and normalized solver search nodes. Clue count is checked separately and is not part of the score formula. Equal-clue puzzles can receive different categories; this is covered by a regression test.

`generateForDifficulty` analyzes each unique candidate and retries mismatches, with a deterministic budget of 12 attempts. Targets, thresholds and the budget are centralized in `src/core/difficulty*.ts`. If the budget is exhausted, it returns the closest unique candidate and the UI explicitly reports its estimated category. Correctness takes priority over difficulty calibration. These levels are a practical heuristic, not an academically validated human difficulty model or a guarantee that Hard requires guessing.

The original low-level `generatePuzzle(seed, targetClues)` remains available for core use and tests; normal gameplay uses rated generation. Its default of 32 is no longer the gameplay difficulty policy.

A seed plus the selected difficulty reproduces the same puzzle within this generator version. The seed field reopens difficulty selection. Seeds and URL inputs accept only 1–48 ASCII letters, digits, underscores and hyphens. Future algorithm changes may change seed results.

A local Node calibration of 150 rated puzzles (50 per level) matched every requested band, with a maximum around 4.8 ms. Tests print current multi-seed timings. These are measurements on the development machine, not performance guarantees. Main-thread generation and individual meshes remain simpler than workers or instancing at this measured scale.

## Architecture and error handling

| Location | Responsibility |
| --- | --- |
| `src/core/` | Coordinates, validation, custom solving/generation, uniqueness, difficulty analysis |
| `src/game/` | Immutable moves and selection, session transitions, pure timestamp-based timer |
| `src/rendering/` | Three.js cells, labels, raycasting, camera framing and orientation |
| `src/ui/` | DOM controls, start/difficulty/result screens, seed validation |
| `src/main.ts` | Composition, lifecycle, timer scheduling and browser error boundary |
| `tests/` | Core invariants, difficulty/retries, game/session/timer/navigation and rendering mathematics |

The core does not depend on DOM or Three.js. Rendering does not solve puzzles. No frontend framework or external puzzle/CSP library is used.

Invalid moves, contradictions and difficulty mismatches are ordinary domain results. Browser error/rejection listeners stop interaction and present a safe recovery message for unexpected failures. WebGL initialization has a local recovery boundary. Dynamic text uses safe DOM properties; no eval, dynamic user code, secrets or API keys are present.

## Tests

The suite preserves the original tests and adds rated generation across all three levels, equal-clue category differences, deterministic retries and unique fallback behavior. It verifies clue retention and all 48 line permutations over multiple seeds.

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
