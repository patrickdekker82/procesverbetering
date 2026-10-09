import Anthropic from '@anthropic-ai/sdk';
import { aiError, toAiError } from './errors';
import type { AiClient, ConnectionResult } from './types';

export interface ClaudeClientOptions {
  /** Fetches the key at call time; the key is never kept in module or React state. */
  getApiKey: () => Promise<string | null>;
  getModel: () => Promise<string>;
  /** Tauri's plugin-http fetch inside the app; global fetch elsewhere. */
  fetch?: typeof globalThis.fetch;
  maxRetries?: number;
}

export function createClaudeClient(options: ClaudeClientOptions): AiClient {
  async function sdk(): Promise<Anthropic | null> {
    const apiKey = await options.getApiKey();
    if (!apiKey) return null;
    return new Anthropic({
      apiKey,
      // Single-user desktop app: the key comes from the OS keychain per call (SPEC §10).
      dangerouslyAllowBrowser: true,
      maxRetries: options.maxRetries ?? 2,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }

  return {
    async testConnection(): Promise<ConnectionResult> {
      try {
        const client = await sdk();
        if (!client) return { ok: false, error: aiError('NO_API_KEY') };
        const model = await options.getModel();
        const info = await client.models.retrieve(model);
        return { ok: true, model: info.id, displayName: info.display_name };
      } catch (error) {
        return { ok: false, error: toAiError(error) };
      }
    },

    async listModels() {
      try {
        const client = await sdk();
        if (!client) return { ok: false, error: aiError('NO_API_KEY') };
        const models: { id: string; displayName: string }[] = [];
        for await (const m of client.models.list()) models.push({ id: m.id, displayName: m.display_name });
        return { ok: true, models };
      } catch (error) {
        return { ok: false, error: toAiError(error) };
      }
    },
  };
}
