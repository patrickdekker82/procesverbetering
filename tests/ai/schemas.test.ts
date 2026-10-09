import { describe, expect, it } from 'vitest';
import { fakeEstimationFor } from '../../src/ai/fake';
import { jsonSchemaFor } from '../../src/ai/outputFormat';
import { actionPlanSchema, ClarificationSchema, EstimationSchema } from '../../src/ai/schemas';

type Json = Record<string, unknown>;

/** Walks a JSON schema and collects features structured outputs do not support. */
function unsupported(node: unknown, path = '$'): string[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => unsupported(n, `${path}[${i}]`));
  if (typeof node !== 'object' || node === null) return [];
  const obj = node as Json;
  const problems: string[] = [];
  for (const key of [
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'maxLength',
    'propertyNames',
  ]) {
    if (key in obj) problems.push(`${path}.${key}`);
  }
  if (obj.type === 'object' && obj.additionalProperties !== false)
    problems.push(`${path}.additionalProperties`);
  return [...problems, ...Object.entries(obj).flatMap(([k, v]) => unsupported(v, `${path}.${k}`))];
}

describe('AI schemas', () => {
  it.each([
    ['Clarification', ClarificationSchema],
    ['Estimation', EstimationSchema],
    ['ActionPlan', actionPlanSchema(['Plan', 'Do', 'Check', 'Act'])],
  ])('%s produces a JSON schema without unsupported constraints', (_name, schema) => {
    expect(unsupported(jsonSchemaFor(schema))).toEqual([]);
  });

  it('keeps enums so the API enforces them', () => {
    const json = JSON.stringify(jsonSchemaFor(actionPlanSchema(['Plan', 'Do'])));
    expect(json).toContain('"enum":["Plan","Do"]');
    expect(JSON.stringify(jsonSchemaFor(EstimationSchema))).toContain(
      '"enum":["GEMETEN","GESCHAT","GEVOEL"]',
    );
  });

  it('accepts the fake estimates', () => {
    for (const title of ['Facturen', 'Klachten', 'Intake knelpunt', 'iets anders']) {
      expect(EstimationSchema.safeParse(fakeEstimationFor(title)).success).toBe(true);
    }
  });

  it('rejects scores outside −2..+2 and non-integers', () => {
    const e = fakeEstimationFor('Facturen');
    e.impact.time.score = 3;
    expect(EstimationSchema.safeParse(e).success).toBe(false);
    e.impact.time.score = 1.5;
    expect(EstimationSchema.safeParse(e).success).toBe(false);
  });

  it('only allows the template phases in a plan', () => {
    const schema = actionPlanSchema(['Plan', 'Do']);
    const plan = {
      metric: 'x',
      unit: 'dagen',
      baseline: null,
      target: 3,
      measureMoment: 'later',
      steps: [{ phase: 'Plan', what: 'a', owner: '', dueInDays: 0, deliverable: '' }],
      fiveWhys: null,
      fishbone: null,
    };
    expect(schema.safeParse(plan).success).toBe(true);
    expect(schema.safeParse({ ...plan, steps: [{ ...plan.steps[0], phase: 'Verzonnen' }] }).success).toBe(
      false,
    );
  });
});
