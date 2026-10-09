import { describe, expect, it } from 'vitest';
import { createClaudeClient } from '../../src/ai/claude';
import type { ClarifyInput } from '../../src/ai/input';

interface Captured {
  url: string;
  body: Record<string, unknown>;
  beta: string | null;
}

function message(payload: unknown, stopReason = 'end_turn') {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 120, output_tokens: 80 },
  };
}

function setup(responses: Array<{ status: number; body: unknown }>) {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({
      url,
      body: JSON.parse(String(init?.body)),
      beta: new Headers(init?.headers).get('anthropic-beta'),
    });
    const next = responses.shift() ?? { status: 500, body: {} };
    return new Response(JSON.stringify(next.body), {
      status: next.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const client = createClaudeClient({
    getApiKey: async () => 'sk-test',
    getModel: async () => 'claude-opus-5-5',
    fetch: fetchImpl,
    maxRetries: 0,
  });
  return { client, calls };
}

const input: ClarifyInput = {
  idea: {
    title: 'Facturen dubbel gecontroleerd',
    description: 'Elke factuur wordt twee keer gecontroleerd.',
    domain: 'KANTOOR',
  },
  qa: [],
  questionsLeft: 5,
};

const goodAnswer = { done: false, question: 'Hoe vaak?', whyAsked: 'Omvang.', problemStatement: null };

describe('Claude structured calls', () => {
  it('sends the versioned prompt, schema, effort and server-side fallback', async () => {
    const { client, calls } = setup([{ status: 200, body: message(goodAnswer) }]);
    const result = await client.clarify(input);
    expect(result).toEqual({
      ok: true,
      data: goodAnswer,
      meta: {
        model: 'claude-opus-5-5',
        promptId: 'clarify',
        promptVersion: 1,
        inputTokens: 120,
        outputTokens: 80,
      },
    });
    const req = calls[0]!;
    expect(req.url).toMatch(/\/v1\/messages/);
    expect(req.beta).toContain('server-side-fallback-2026-07-01');
    expect(req.body.fallbacks).toBe('default');
    expect(req.body.model).toBe('claude-opus-5-5');
    expect(String(req.body.system)).toContain('probleemstelling');
    const config = req.body.output_config as { effort: string; format: { type: string } };
    expect(config.effort).toBe('low');
    expect(config.format.type).toBe('json_schema');
    expect(JSON.stringify(req.body.messages)).toContain('<idee>');
  });

  it('retries without fallbacks when the model rejects them', async () => {
    const { client, calls } = setup([
      {
        status: 400,
        body: {
          type: 'error',
          error: { type: 'invalid_request_error', message: 'fallbacks is not supported for this model' },
        },
      },
      { status: 200, body: message(goodAnswer) },
      { status: 200, body: message(goodAnswer) },
    ]);
    expect((await client.clarify(input)).ok).toBe(true);
    expect(calls[1]!.body.fallbacks).toBeUndefined();
    expect(calls[1]!.beta ?? '').not.toContain('server-side-fallback');
    // Remembered for the next call.
    await client.clarify(input);
    expect(calls).toHaveLength(3);
    expect(calls[2]!.body.fallbacks).toBeUndefined();
  });

  it('maps a refusal to REFUSAL', async () => {
    const { client } = setup([{ status: 200, body: message('', 'refusal') }]);
    expect(await client.clarify(input)).toMatchObject({ ok: false, error: { code: 'REFUSAL' } });
  });

  it('rejects an answer that does not match the schema', async () => {
    const { client } = setup([{ status: 200, body: message({ done: 'yes' }) }]);
    expect(await client.clarify(input)).toMatchObject({
      ok: false,
      error: { code: 'SCHEMA' },
      meta: { promptId: 'clarify' },
    });
  });

  it('rejects invalid JSON', async () => {
    const { client } = setup([{ status: 200, body: message('{niet json') }]);
    expect(await client.clarify(input)).toMatchObject({ ok: false, error: { code: 'SCHEMA' } });
  });

  it('retries once with more tokens after max_tokens, then gives up', async () => {
    const { client, calls } = setup([
      { status: 200, body: message('{"done":', 'max_tokens') },
      { status: 200, body: message('{"done":', 'max_tokens') },
    ]);
    expect(await client.clarify(input)).toMatchObject({
      ok: false,
      error: { code: 'SCHEMA' },
      meta: { inputTokens: 240 },
    });
    expect(calls[1]!.body.max_tokens).toBe(2 * (calls[0]!.body.max_tokens as number));
  });

  it('builds the plan schema from the given phases', async () => {
    const plan = {
      metric: 'Doorlooptijd',
      unit: 'dagen',
      baseline: 10,
      target: 5,
      measureMoment: 'Na 4 weken',
      steps: [
        { phase: 'Plan', what: 'Nulmeting', owner: 'Teamleider', dueInDays: 7, deliverable: 'Nulmeting' },
      ],
      fiveWhys: null,
      fishbone: null,
    };
    const { client, calls } = setup([{ status: 200, body: message(plan) }]);
    const result = await client.plan({
      idea: input.idea,
      problemStatement: null,
      route: 'SNELLE_WINST',
      method: 'PDCA',
      phases: ['Plan', 'Do', 'Check', 'Act'],
      startDate: '2026-10-09',
      estimationSummary: '-',
      similarCases: [],
      lessons: [],
    });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(calls[0]!.body.output_config)).toContain('"Check"');
  });
});
