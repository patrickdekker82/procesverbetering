import type { AssessmentInput, AssessmentResult, LeafChange } from '../../core/assessment';
import type { Db } from '../types';
import { newId, nowIso } from '../util';

export interface AssessmentRecord<E = unknown> {
  id: string;
  improvementId: string;
  /** Claude's raw estimate, as received. */
  estimation: E;
  /** The values used for the calculation, after the user's overrides. */
  input: AssessmentInput;
  aiCallId: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  improvement_id: string;
  estimation_json: string;
  effective_json: string;
  ai_call_id: string | null;
  created_at: string;
}

export async function getAssessment<E>(db: Db, improvementId: string): Promise<AssessmentRecord<E> | null> {
  const rows = await db.select<Row>(
    'SELECT id, improvement_id, estimation_json, effective_json, ai_call_id, created_at FROM assessments WHERE improvement_id = ? ORDER BY created_at DESC LIMIT 1',
    [improvementId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    improvementId: r.improvement_id,
    estimation: JSON.parse(r.estimation_json) as E,
    input: JSON.parse(r.effective_json) as AssessmentInput,
    aiCallId: r.ai_call_id,
    createdAt: r.created_at,
  };
}

function scoreColumns(result: AssessmentResult): unknown[] {
  return [
    result.impact.value,
    result.effort.value,
    result.certainty,
    result.annualBenefit?.value ?? null,
    JSON.stringify({ impact: result.impact.raw, effort: result.effort.raw, corrected: result.corrected }),
  ];
}

/** Replaces the improvement's assessment (one current assessment per improvement). */
export async function replaceAssessment(
  db: Db,
  improvementId: string,
  estimation: unknown,
  input: AssessmentInput,
  result: AssessmentResult,
  aiCallId: string | null,
): Promise<string> {
  const id = newId();
  await db.execute('DELETE FROM assessments WHERE improvement_id = ?', [improvementId]);
  await db.execute(
    `INSERT INTO assessments (id, improvement_id, estimation_json, effective_json, impact_score, effort_score,
       certainty, annual_benefit, correction_json, ai_call_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      improvementId,
      JSON.stringify(estimation),
      JSON.stringify(input),
      ...scoreColumns(result),
      aiCallId,
      nowIso(),
    ],
  );
  return id;
}

export async function updateAssessmentInput(
  db: Db,
  assessmentId: string,
  input: AssessmentInput,
  result: AssessmentResult,
): Promise<void> {
  await db.execute(
    `UPDATE assessments SET effective_json = ?, impact_score = ?, effort_score = ?, certainty = ?,
       annual_benefit = ?, correction_json = ? WHERE id = ?`,
    [JSON.stringify(input), ...scoreColumns(result), assessmentId],
  );
}

// Overrides (learning signal, processed in phase 5) ---------------------------------------------

export interface OverrideRecord {
  id: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  createdAt: string;
}

export async function insertOverrides(
  db: Db,
  improvementId: string,
  changes: LeafChange[],
  reason: string | null,
): Promise<void> {
  const now = nowIso();
  for (const c of changes) {
    await db.execute(
      'INSERT INTO overrides (id, improvement_id, field, old_value, new_value, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newId(), improvementId, c.field, JSON.stringify(c.oldValue), JSON.stringify(c.newValue), reason, now],
    );
  }
}

export async function listOverrides(db: Db, improvementId: string): Promise<OverrideRecord[]> {
  const rows = await db.select<{
    id: string;
    field: string;
    old_value: string;
    new_value: string;
    reason: string | null;
    created_at: string;
  }>(
    'SELECT id, field, old_value, new_value, reason, created_at FROM overrides WHERE improvement_id = ? ORDER BY created_at, rowid',
    [improvementId],
  );
  return rows.map((r) => ({
    id: r.id,
    field: r.field,
    oldValue: JSON.parse(r.old_value) as unknown,
    newValue: JSON.parse(r.new_value) as unknown,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}
