// Versioned prompts (SPEC §8.5). Change a prompt by adding a new file `<id>.v<N+1>.md` and bumping
// the active version here only when its live eval score is not lower (CLAUDE.md).
import clarifyV1 from './clarify.v1.md?raw';
import estimateV1 from './estimate.v1.md?raw';
import planV1 from './plan.v1.md?raw';

export type PromptId = 'clarify' | 'estimate' | 'plan';

const PROMPTS: Record<PromptId, Record<number, string>> = {
  clarify: { 1: clarifyV1 },
  estimate: { 1: estimateV1 },
  plan: { 1: planV1 },
};

export const ACTIVE_VERSIONS: Record<PromptId, number> = {
  clarify: 1,
  estimate: 1,
  plan: 1,
};

export function getPrompt(
  id: PromptId,
  version = ACTIVE_VERSIONS[id],
): { id: PromptId; version: number; text: string } {
  const text = PROMPTS[id][version];
  if (!text) throw new Error(`Prompt ${id}.v${version} bestaat niet.`);
  return { id, version, text };
}
