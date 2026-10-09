import type { Db } from '../types';
import { newId, nowIso } from '../util';

/** Usage metadata only: never prompt content, answers or the API key (CLAUDE.md). */
export interface AiCallLog {
  kind: string;
  model: string;
  promptId: string;
  promptVersion: number;
  inputTokens: number;
  outputTokens: number;
  ok: boolean;
  errorCode?: string;
}

export async function logAiCall(db: Db, log: AiCallLog): Promise<string> {
  const id = newId();
  await db.execute(
    `INSERT INTO ai_calls (id, kind, model, prompt_id, prompt_version, input_tokens, output_tokens, ok, error_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      log.kind,
      log.model,
      log.promptId,
      log.promptVersion,
      log.inputTokens,
      log.outputTokens,
      log.ok,
      log.errorCode ?? null,
      nowIso(),
    ],
  );
  return id;
}
