import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { aiError, toAiError } from './errors';
import { renderClarify, renderEstimate, renderExtract, renderPlan } from './input';
import { outputFormat } from './outputFormat';
import { getPrompt, type PromptId } from './prompts';
import { actionPlanSchema, ClarificationSchema, EstimationSchema, ProcessExtractionSchema } from './schemas';
import type { AiClient, AiMeta, AiResult, ConnectionResult } from './types';

export interface ClaudeClientOptions {
  /** Fetches the key at call time; the key is never kept in module or React state. */
  getApiKey: () => Promise<string | null>;
  getModel: () => Promise<string>;
  /** Tauri's plugin-http fetch inside the app; global fetch elsewhere. */
  fetch?: typeof globalThis.fetch;
  maxRetries?: number;
}

type Effort = 'low' | 'medium' | 'high';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const DEFAULT_MAX_TOKENS = 16000;
const REQUEST_TIMEOUT_MS = 15 * 60 * 1000;

interface StructuredCall<S extends z.ZodType> {
  promptId: PromptId;
  schema: S;
  content: string | ReturnType<typeof renderExtract>;
  effort: Effort;
}

function isFallbackRejection(error: unknown): boolean {
  return error instanceof Anthropic.BadRequestError && /fallback|beta/i.test(error.message);
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
      // Explicit timeout: allows the larger max_tokens retry without streaming.
      timeout: REQUEST_TIMEOUT_MS,
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  }

  // Models that reject server-side fallbacks are remembered for the session.
  const noFallbackModels = new Set<string>();

  async function structured<S extends z.ZodType>(call: StructuredCall<S>): Promise<AiResult<z.infer<S>>> {
    const client = await sdk();
    if (!client) return { ok: false, error: aiError('NO_API_KEY') };
    const model = await options.getModel();
    const prompt = getPrompt(call.promptId);
    const meta: AiMeta = {
      model,
      promptId: prompt.id,
      promptVersion: prompt.version,
      inputTokens: 0,
      outputTokens: 0,
    };

    const format = outputFormat(call.schema);

    async function request(maxTokens: number) {
      const base = {
        model,
        max_tokens: maxTokens,
        system: prompt.text,
        messages: [{ role: 'user' as const, content: call.content }],
        output_config: { effort: call.effort, format },
      };
      if (!noFallbackModels.has(model)) {
        try {
          return await client!.beta.messages.create({
            ...base,
            betas: [FALLBACK_BETA],
            fallbacks: 'default',
          });
        } catch (error) {
          if (!isFallbackRejection(error)) throw error;
          noFallbackModels.add(model);
        }
      }
      return client!.messages.create(base);
    }

    try {
      let response = await request(DEFAULT_MAX_TOKENS);
      meta.inputTokens += response.usage.input_tokens;
      meta.outputTokens += response.usage.output_tokens;
      if (response.stop_reason === 'max_tokens') {
        response = await request(DEFAULT_MAX_TOKENS * 2);
        meta.inputTokens += response.usage.input_tokens;
        meta.outputTokens += response.usage.output_tokens;
      }
      meta.model = response.model;
      if (response.stop_reason === 'refusal') return { ok: false, error: aiError('REFUSAL'), meta };
      if (response.stop_reason === 'max_tokens') return { ok: false, error: aiError('SCHEMA'), meta };
      // Parse and validate with the app's own schema; nothing is used unless it passes.
      const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return { ok: false, error: aiError('SCHEMA'), meta };
      }
      const checked = call.schema.safeParse(json);
      if (!checked.success) return { ok: false, error: aiError('SCHEMA'), meta };
      return { ok: true, data: checked.data, meta };
    } catch (error) {
      return { ok: false, error: toAiError(error), meta };
    }
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

    clarify: (input) =>
      structured({
        promptId: 'clarify',
        schema: ClarificationSchema,
        content: renderClarify(input),
        effort: 'low',
      }),

    estimate: (input) =>
      structured({
        promptId: 'estimate',
        schema: EstimationSchema,
        content: renderEstimate(input),
        effort: 'medium',
      }),

    plan: (input) =>
      structured({
        promptId: 'plan',
        schema: actionPlanSchema(input.phases),
        content: renderPlan(input),
        effort: 'medium',
      }),

    extractProcess: (input) =>
      structured({
        promptId: 'extract',
        schema: ProcessExtractionSchema,
        content: renderExtract(input),
        effort: 'medium',
      }),
  };
}
