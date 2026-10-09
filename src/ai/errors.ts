import Anthropic from '@anthropic-ai/sdk';
import type { AiError, AiErrorCode } from './types';

const MESSAGES: Record<AiErrorCode, string> = {
  NO_API_KEY: 'Er is nog geen API-sleutel ingesteld. Ga naar Instellingen.',
  NO_CONSENT: 'AI-functies staan uit. Je kunt ze aanzetten in Instellingen.',
  OFFLINE: 'Geen verbinding met de Claude API. Controleer je internetverbinding; je werk is bewaard.',
  RATE_LIMIT: 'Limiet bereikt. Probeer het over een minuut opnieuw.',
  OVERLOADED: 'Claude is tijdelijk overbelast. Probeer het later opnieuw.',
  AUTH: 'De API-sleutel wordt niet geaccepteerd.',
  MODEL_NOT_FOUND:
    'Het gekozen model is niet beschikbaar voor deze API-sleutel. Kies een ander model in Instellingen.',
  SCHEMA: 'Het antwoord van Claude had niet de verwachte vorm en is niet gebruikt. Probeer het opnieuw.',
  REFUSAL: 'Claude heeft dit verzoek niet uitgevoerd.',
  TOO_LARGE: 'De invoer is te groot om in één keer te versturen.',
  UNKNOWN: 'Er ging iets mis bij het aanroepen van Claude.',
};

const RETRYABLE: ReadonlySet<AiErrorCode> = new Set(['OFFLINE', 'RATE_LIMIT', 'OVERLOADED', 'UNKNOWN']);

export function aiError(code: AiErrorCode, detail?: string): AiError {
  const base = MESSAGES[code];
  return { code, messageNl: detail ? `${base} (${detail})` : base, retryable: RETRYABLE.has(code) };
}

function retryAfterSeconds(error: InstanceType<typeof Anthropic.APIError>): number | undefined {
  const value = error.headers?.get?.('retry-after');
  const seconds = value ? Number(value) : Number.NaN;
  return Number.isFinite(seconds) ? seconds : undefined;
}

/** Maps SDK errors to AiError, most specific first. */
export function toAiError(error: unknown): AiError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return aiError('AUTH');
  }
  if (error instanceof Anthropic.NotFoundError) return aiError('MODEL_NOT_FOUND');
  if (error instanceof Anthropic.RateLimitError) {
    const seconds = retryAfterSeconds(error);
    return seconds !== undefined
      ? {
          ...aiError('RATE_LIMIT'),
          messageNl: `Limiet bereikt. Probeer het over ${Math.ceil(seconds)} seconden opnieuw.`,
        }
      : aiError('RATE_LIMIT');
  }
  if (error instanceof Anthropic.APIConnectionError) return aiError('OFFLINE');
  if (error instanceof Anthropic.InternalServerError) {
    return error.status === 529 ? aiError('OVERLOADED') : aiError('UNKNOWN', `HTTP ${error.status}`);
  }
  if (error instanceof Anthropic.APIError) {
    if (error.status === 413) return aiError('TOO_LARGE');
    return aiError('UNKNOWN', error.status ? `HTTP ${error.status}` : undefined);
  }
  return aiError('UNKNOWN');
}
