// AI module contract (SPEC.md §7.1). Later phases add extract/suggest/lessons.
import type { ClarifyInput, EstimateInput, PlanInput } from './input';
import type { ActionPlanDraft, Clarification, Estimation } from './schemas';

export type AiErrorCode =
  | 'NO_API_KEY'
  | 'NO_CONSENT'
  | 'OFFLINE'
  | 'RATE_LIMIT'
  | 'OVERLOADED'
  | 'AUTH'
  | 'MODEL_NOT_FOUND'
  | 'SCHEMA'
  | 'REFUSAL'
  | 'TOO_LARGE'
  | 'UNKNOWN';

export interface AiError {
  code: AiErrorCode;
  messageNl: string;
  retryable: boolean;
}

export interface AiMeta {
  model: string;
  promptId: string;
  promptVersion: number;
  inputTokens: number;
  outputTokens: number;
}

/** On failure `meta` is present when the request reached the point of choosing a model/prompt (for logging). */
export type AiResult<T> = { ok: true; data: T; meta: AiMeta } | { ok: false; error: AiError; meta?: AiMeta };

export type ConnectionResult =
  { ok: true; model: string; displayName: string } | { ok: false; error: AiError };

export interface AiClient {
  /** Verifies the API key and that the configured model is available. Costs no tokens. */
  testConnection(): Promise<ConnectionResult>;
  /** Model ids available to this key, for the settings dropdown. */
  listModels(): Promise<
    { ok: true; models: { id: string; displayName: string }[] } | { ok: false; error: AiError }
  >;
  clarify(input: ClarifyInput): Promise<AiResult<Clarification>>;
  estimate(input: EstimateInput): Promise<AiResult<Estimation>>;
  plan(input: PlanInput): Promise<AiResult<ActionPlanDraft>>;
}
