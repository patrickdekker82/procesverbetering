import { isTauri } from '@tauri-apps/api/core';
import { getDb } from '../db';
import { loadSettings } from '../db/repos/settingsRepo';
import { getApiKey } from './apiKey';
import { createClaudeClient } from './claude';
import { createFakeAiClient } from './fake';
import type { AiClient } from './types';

export type * from './types';

/** `?fakeAi=1` in the URL (Playwright, demos) selects the fake client. */
function fakeRequested(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('fakeAi');
}

let client: AiClient | undefined;

export function getAiClient(): AiClient {
  if (client) return client;
  if (fakeRequested()) {
    client = createFakeAiClient();
    return client;
  }
  client = createClaudeClient({
    getApiKey,
    getModel: async () => (await loadSettings(await getDb())).model,
    fetch: isTauri()
      ? async (input, init) => {
          const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
          return tauriFetch(input, init);
        }
      : undefined,
  });
  return client;
}
