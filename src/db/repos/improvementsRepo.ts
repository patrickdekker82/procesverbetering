import type { ImprovementStatus, Quadrant, Route } from '../../core/assessment';
import type { Db } from '../types';
import { newId, nowIso } from '../util';

export interface ImprovementRecord {
  id: string;
  title: string;
  description: string;
  domain: string;
  status: ImprovementStatus;
  route: Route | null;
  routeRule: string | null;
  quadrant: Quadrant | null;
  priority: number | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ImprovementRow {
  id: string;
  title: string;
  description: string;
  domain: string;
  status: ImprovementStatus;
  route: Route | null;
  route_rule: string | null;
  quadrant: Quadrant | null;
  priority: number | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

function toRecord(r: ImprovementRow): ImprovementRecord {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    domain: r.domain,
    status: r.status,
    route: r.route,
    routeRule: r.route_rule,
    quadrant: r.quadrant,
    priority: r.priority,
    category: r.category,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function insertImprovement(
  db: Db,
  input: { title: string; description: string; domain: string },
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.execute(
    'INSERT INTO improvements (id, title, description, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.title, input.description, input.domain, now, now],
  );
  return id;
}

export async function getImprovement(db: Db, id: string): Promise<ImprovementRecord | null> {
  const rows = await db.select<ImprovementRow>('SELECT * FROM improvements WHERE id = ?', [id]);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function listImprovements(db: Db): Promise<ImprovementRecord[]> {
  const rows = await db.select<ImprovementRow>('SELECT * FROM improvements ORDER BY updated_at DESC');
  return rows.map(toRecord);
}

export type ImprovementPatch = Partial<
  Pick<
    ImprovementRecord,
    | 'title'
    | 'description'
    | 'domain'
    | 'status'
    | 'route'
    | 'routeRule'
    | 'quadrant'
    | 'priority'
    | 'category'
  >
>;

const COLUMNS: Record<keyof ImprovementPatch, string> = {
  title: 'title',
  description: 'description',
  domain: 'domain',
  status: 'status',
  route: 'route',
  routeRule: 'route_rule',
  quadrant: 'quadrant',
  priority: 'priority',
  category: 'category',
};

export async function updateImprovement(db: Db, id: string, patch: ImprovementPatch): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [
    keyof ImprovementPatch,
    unknown,
  ][];
  if (entries.length === 0) return;
  const sets = entries.map(([k]) => `${COLUMNS[k]} = ?`).join(', ');
  await db.execute(`UPDATE improvements SET ${sets}, updated_at = ? WHERE id = ?`, [
    ...entries.map(([, v]) => v),
    nowIso(),
    id,
  ]);
}

export async function deleteImprovement(db: Db, id: string): Promise<void> {
  await db.execute('DELETE FROM improvements WHERE id = ?', [id]);
}

// Clarifications ---------------------------------------------------------------------------------

export interface ClarificationRecord {
  id: string;
  seq: number;
  question: string;
  whyAsked: string | null;
  /** null = not answered yet, '' = skipped. */
  answer: string | null;
}

export async function listClarifications(db: Db, improvementId: string): Promise<ClarificationRecord[]> {
  const rows = await db.select<{
    id: string;
    seq: number;
    question: string;
    why_asked: string | null;
    answer: string | null;
  }>(
    'SELECT id, seq, question, why_asked, answer FROM clarifications WHERE improvement_id = ? ORDER BY seq',
    [improvementId],
  );
  return rows.map((r) => ({
    id: r.id,
    seq: r.seq,
    question: r.question,
    whyAsked: r.why_asked,
    answer: r.answer,
  }));
}

export async function insertClarification(
  db: Db,
  improvementId: string,
  seq: number,
  question: string,
  whyAsked: string | null,
): Promise<string> {
  const id = newId();
  await db.execute(
    'INSERT INTO clarifications (id, improvement_id, seq, question, why_asked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, improvementId, seq, question, whyAsked, nowIso()],
  );
  return id;
}

export async function answerClarification(db: Db, id: string, answer: string): Promise<void> {
  await db.execute('UPDATE clarifications SET answer = ? WHERE id = ?', [answer, id]);
}

// Problem statements -----------------------------------------------------------------------------

export interface ProblemStatementRecord {
  whatGoesWrong: string;
  howOften: string;
  cost: string;
  forWhom: string;
  edited: boolean;
}

export async function getProblemStatement(
  db: Db,
  improvementId: string,
): Promise<ProblemStatementRecord | null> {
  const rows = await db.select<{
    what_goes_wrong: string;
    how_often: string;
    cost: string;
    for_whom: string;
    edited: number;
  }>(
    'SELECT what_goes_wrong, how_often, cost, for_whom, edited FROM problem_statements WHERE improvement_id = ?',
    [improvementId],
  );
  const r = rows[0];
  return r
    ? {
        whatGoesWrong: r.what_goes_wrong,
        howOften: r.how_often,
        cost: r.cost,
        forWhom: r.for_whom,
        edited: r.edited === 1,
      }
    : null;
}

export async function upsertProblemStatement(
  db: Db,
  improvementId: string,
  ps: ProblemStatementRecord,
): Promise<void> {
  await db.execute(
    `INSERT INTO problem_statements (improvement_id, what_goes_wrong, how_often, cost, for_whom, edited)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(improvement_id) DO UPDATE SET what_goes_wrong = excluded.what_goes_wrong,
       how_often = excluded.how_often, cost = excluded.cost, for_whom = excluded.for_whom, edited = excluded.edited`,
    [improvementId, ps.whatGoesWrong, ps.howOften, ps.cost, ps.forWhom, ps.edited],
  );
}
