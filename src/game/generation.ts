import type { Difficulty } from '../core/difficulty.ts';
import type { RatedPuzzle } from '../core/difficulty-generator.ts';
import type { GenerationRequest, GenerationResponse } from '../core/generation-worker.ts';

export interface GenerationWorker {
  onmessage: ((event: MessageEvent<GenerationResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: GenerationRequest): void;
  terminate(): void;
}
export interface GenerationTask {
  readonly promise: Promise<RatedPuzzle>;
  cancel(): void;
}

/** One disposable worker per request; every exit settles the promise and releases resources. */
export function startGeneration(
  seed: string,
  difficulty: Difficulty,
  createWorker: () => GenerationWorker = () => new Worker(new URL('../core/generation-worker.ts', import.meta.url), { type: 'module' }),
  timeoutMs = 15_000,
): GenerationTask {
  let cancel = (): void => {};
  const promise = new Promise<RatedPuzzle>((resolve, reject) => {
    let worker: GenerationWorker | null = null;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function finish(error: Error | null, puzzle?: RatedPuzzle): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker?.terminate();
      if (error !== null) reject(error);
      else resolve(puzzle!);
    }
    cancel = () => finish(new DOMException('Generation cancelled.', 'AbortError'));
    timeout = setTimeout(() => finish(new Error('Generation took too long. Please try another seed or level.')), timeoutMs);
    try {
      worker = createWorker();
      worker.onmessage = event => {
        const response = event.data;
        if (response.ok) finish(null, response.puzzle);
        else finish(new Error(response.message));
      };
      worker.onerror = event => {
        event.preventDefault();
        finish(new Error('The puzzle generator could not start. Please try again.'));
      };
      worker.onmessageerror = () => finish(new Error('The puzzle could not be loaded. Please try again.'));
      worker.postMessage({ seed, difficulty });
    } catch {
      finish(new Error('The puzzle generator could not start. Please try again.'));
    }
  });
  return { promise, cancel: () => cancel() };
}
