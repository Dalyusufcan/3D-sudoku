import { DifficultyGenerationError, generateForDifficulty, type RatedPuzzle } from './difficulty-generator.ts';
import type { Difficulty } from './difficulty.ts';

export interface GenerationRequest { readonly seed: string; readonly difficulty: Difficulty }
export type GenerationResponse = { readonly ok: true; readonly puzzle: RatedPuzzle }
  | { readonly ok: false; readonly message: string };

self.onmessage = (event: MessageEvent<GenerationRequest>): void => {
  let response: GenerationResponse;
  try {
    response = { ok: true, puzzle: generateForDifficulty(event.data.seed, event.data.difficulty) };
  } catch (error: unknown) {
    response = {
      ok: false,
      message: error instanceof DifficultyGenerationError ? error.message : 'The puzzle could not be generated. Please try again.',
    };
  }
  self.postMessage(response);
};
