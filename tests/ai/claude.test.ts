import { describe, expect, it } from 'vitest';
import { createClaudeClient } from '../../src/ai/claude';
import { createFakeAiClient } from '../../src/ai/fake';

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      init,
    )) as typeof fetch;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function client(handler: Handler, apiKey: string | null = 'sk-test') {
  return createClaudeClient({
    getApiKey: async () => apiKey,
    getModel: async () => 'claude-opus-5-5',
    fetch: fakeFetch(handler),
    maxRetries: 0,
  });
}

describe('createClaudeClient.testConnection', () => {
  it('retrieves the configured model with the key in the header', async () => {
    const seen: { url?: string; key?: string | null } = {};
    const result = await client((url, init) => {
      seen.url = url;
      seen.key = new Headers(init?.headers).get('x-api-key');
      return json(200, {
        id: 'claude-opus-5-5',
        display_name: 'Claude Opus 5.5',
        type: 'model',
        created_at: '2026-01-01T00:00:00Z',
      });
    }).testConnection();
    expect(result).toEqual({ ok: true, model: 'claude-opus-5-5', displayName: 'Claude Opus 5.5' });
    expect(seen.url).toMatch(/\/v1\/models\/claude-opus-5-5$/);
    expect(seen.key).toBe('sk-test');
  });

  it('does not call the network without a key', async () => {
    let called = false;
    const result = await client(() => {
      called = true;
      return json(200, {});
    }, null).testConnection();
    expect(called).toBe(false);
    expect(result).toMatchObject({ ok: false, error: { code: 'NO_API_KEY' } });
  });

  it.each([
    [401, 'AUTH', false],
    [403, 'AUTH', false],
    [404, 'MODEL_NOT_FOUND', false],
    [429, 'RATE_LIMIT', true],
    [500, 'UNKNOWN', true],
    [529, 'OVERLOADED', true],
  ])('maps HTTP %i to %s', async (status, code, retryable) => {
    const result = await client(() =>
      json(status, { type: 'error', error: { type: 'x', message: 'x' } }),
    ).testConnection();
    expect(result).toMatchObject({ ok: false, error: { code, retryable } });
  });

  it('includes retry-after in the rate-limit message', async () => {
    const result = await client(() =>
      json(
        429,
        { type: 'error', error: { type: 'rate_limit_error', message: 'x' } },
        { 'retry-after': '30' },
      ),
    ).testConnection();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.messageNl).toContain('30 seconden');
  });

  it('maps network failures to OFFLINE', async () => {
    const result = await client(() => {
      throw new TypeError('fetch failed');
    }).testConnection();
    expect(result).toMatchObject({ ok: false, error: { code: 'OFFLINE', retryable: true } });
  });
});

describe('createFakeAiClient', () => {
  it('succeeds by default and can simulate failures', async () => {
    expect(await createFakeAiClient().testConnection()).toMatchObject({ ok: true });
    expect(await createFakeAiClient({ failWith: 'OFFLINE' }).testConnection()).toMatchObject({
      ok: false,
      error: { code: 'OFFLINE' },
    });
  });
});
