import type { Db } from '../types';
import { nowIso } from '../util';

export type ConsentSubject = 'PROCESS' | 'IMPROVEMENT';

/** Per-item acknowledgement that its data may be sent to the Claude API (SPEC §1). */
export async function hasConsent(db: Db, subject: ConsentSubject, id: string): Promise<boolean> {
  const rows = await db.select('SELECT 1 FROM ai_consent WHERE subject_type = ? AND subject_id = ?', [
    subject,
    id,
  ]);
  return rows.length > 0;
}

export async function giveConsent(db: Db, subject: ConsentSubject, id: string): Promise<void> {
  await db.execute(
    'INSERT INTO ai_consent (subject_type, subject_id, acknowledged_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    [subject, id, nowIso()],
  );
}
