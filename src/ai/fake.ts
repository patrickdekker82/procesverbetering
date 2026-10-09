import { aiError } from './errors';
import type { AiClient, AiErrorCode } from './types';

export interface FakeAiOptions {
  /** Simulates a failure on every call. */
  failWith?: AiErrorCode;
  model?: string;
}

/** Deterministic AI client for tests, `npm run eval` and the Playwright smoke test. No network. */
export function createFakeAiClient(options: FakeAiOptions = {}): AiClient {
  const model = options.model ?? 'fake-model';
  return {
    async testConnection() {
      if (options.failWith) return { ok: false, error: aiError(options.failWith) };
      return { ok: true, model, displayName: 'Nep-model (test)' };
    },
    async listModels() {
      if (options.failWith) return { ok: false, error: aiError(options.failWith) };
      return { ok: true, models: [{ id: model, displayName: 'Nep-model (test)' }] };
    },
  };
}
