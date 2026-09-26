# Repository guidance for coding agents

- Inspect the current architecture and relevant code before editing. Keep changes within the task, avoid unnecessary refactors, and follow existing naming and style conventions.
- Keep Sudoku validation based on visible rules. Never leak the stored solution or compare player entries with it to label moves right or wrong.
- Preserve existing tests and add focused tests when behavior changes. Run `npm run typecheck`, `npm test`, and `npm run build` before finishing.
- Make small, logical commits with descriptive messages. Keep unrelated changes out of the same commit or feature.
- Prefer a branch for large or core changes. Small, low-risk UI or documentation changes may go directly to `main`.
