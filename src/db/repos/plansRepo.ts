import type { Route } from '../../core/assessment';
import type { Fishbone } from '../../core/templates';
import type { Db } from '../types';
import { newId } from '../util';

export interface PlanStep {
  id: string;
  phase: string;
  what: string;
  owner: string;
  dueDate: string | null;
  deliverable: string;
  done: boolean;
}

export interface ActionPlan {
  id: string;
  improvementId: string;
  template: Route;
  metric: string;
  unit: string;
  baseline: number | null;
  target: number | null;
  measureMoment: string;
  fiveWhys: { why: string; answer: string }[] | null;
  fishbone: Fishbone | null;
  steps: PlanStep[];
}

interface PlanRow {
  id: string;
  improvement_id: string;
  template: Route;
  metric: string;
  unit: string;
  baseline: number | null;
  target: number | null;
  measure_moment: string;
  five_whys_json: string | null;
  fishbone_json: string | null;
}

export async function getPlan(db: Db, improvementId: string): Promise<ActionPlan | null> {
  const rows = await db.select<PlanRow>('SELECT * FROM action_plans WHERE improvement_id = ?', [
    improvementId,
  ]);
  const p = rows[0];
  if (!p) return null;
  const steps = await db.select<{
    id: string;
    phase: string;
    what: string;
    owner: string;
    due_date: string | null;
    deliverable: string;
    done: number;
  }>(
    'SELECT id, phase, what, owner, due_date, deliverable, done FROM action_steps WHERE plan_id = ? ORDER BY seq',
    [p.id],
  );
  return {
    id: p.id,
    improvementId: p.improvement_id,
    template: p.template,
    metric: p.metric,
    unit: p.unit,
    baseline: p.baseline,
    target: p.target,
    measureMoment: p.measure_moment,
    fiveWhys: p.five_whys_json ? (JSON.parse(p.five_whys_json) as ActionPlan['fiveWhys']) : null,
    fishbone: p.fishbone_json ? (JSON.parse(p.fishbone_json) as Fishbone) : null,
    steps: steps.map((s) => ({
      id: s.id,
      phase: s.phase,
      what: s.what,
      owner: s.owner,
      dueDate: s.due_date,
      deliverable: s.deliverable,
      done: s.done === 1,
    })),
  };
}

export type PlanInput = Omit<ActionPlan, 'id' | 'steps'> & { steps: Omit<PlanStep, 'id'>[] };

/** Saves the whole plan: the plan row is upserted and its steps are replaced in the given order. */
export async function savePlan(db: Db, plan: PlanInput): Promise<string> {
  const existing = await db.select<{ id: string }>('SELECT id FROM action_plans WHERE improvement_id = ?', [
    plan.improvementId,
  ]);
  const planId = existing[0]?.id ?? newId();
  const values = [
    plan.template,
    plan.metric,
    plan.unit,
    plan.baseline,
    plan.target,
    plan.measureMoment,
    plan.fiveWhys ? JSON.stringify(plan.fiveWhys) : null,
    plan.fishbone ? JSON.stringify(plan.fishbone) : null,
  ];
  if (existing[0]) {
    await db.execute(
      `UPDATE action_plans SET template = ?, metric = ?, unit = ?, baseline = ?, target = ?, measure_moment = ?,
         five_whys_json = ?, fishbone_json = ? WHERE id = ?`,
      [...values, planId],
    );
    await db.execute('DELETE FROM action_steps WHERE plan_id = ?', [planId]);
  } else {
    await db.execute(
      `INSERT INTO action_plans (template, metric, unit, baseline, target, measure_moment, five_whys_json,
         fishbone_json, id, improvement_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...values, planId, plan.improvementId],
    );
  }
  let seq = 1;
  for (const s of plan.steps) {
    await db.execute(
      `INSERT INTO action_steps (id, plan_id, seq, phase, what, owner, due_date, deliverable, done)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId(), planId, seq++, s.phase, s.what, s.owner, s.dueDate, s.deliverable, s.done],
    );
  }
  return planId;
}
