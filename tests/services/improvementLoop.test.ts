import { describe, expect, it } from 'vitest';
import { createFakeAiClient, type FakeAiOptions } from '../../src/ai/fake';
import { phaseNames } from '../../src/core/templates';
import { DEFAULT_SETTINGS, type Settings } from '../../src/core/settings';
import { runMigrations } from '../../src/db/migrations';
import { openNodeDb } from '../../src/db/nodeDb';
import { createImprovementService, MAX_QUESTIONS } from '../../src/services/improvementService';

async function setup(ai: FakeAiOptions = {}, settings: Partial<Settings> = {}) {
  const db = openNodeDb();
  await runMigrations(db);
  const service = createImprovementService({
    db,
    ai: createFakeAiClient(ai),
    getSettings: async () => ({ ...DEFAULT_SETTINGS, aiConsent: true, ...settings }),
    today: () => '2026-10-09',
  });
  return { db, service };
}

async function createWithConsent(
  service: Awaited<ReturnType<typeof setup>>['service'],
  title: string,
  description = '',
) {
  const created = await service.create({ title, description, domain: 'KANTOOR' });
  if (!created.ok) throw new Error('create failed');
  await service.giveConsent(created.value);
  return created.value;
}

/** Answers every question until the problem statement exists; returns the number of questions. */
async function clarifyAll(
  service: Awaited<ReturnType<typeof setup>>['service'],
  id: string,
): Promise<number> {
  for (let i = 0; i < 10; i++) {
    const next = await service.nextQuestion(id);
    expect(next.ok).toBe(true);
    const d = (await service.detail(id))!;
    if (d.problemStatement) return d.clarifications.length;
    const open = d.clarifications.find((c) => c.answer === null)!;
    await service.answer(id, open.id, `antwoord ${open.seq}`);
  }
  throw new Error('clarification did not finish');
}

describe('the improvement loop with the fake AI (three example ideas)', () => {
  it.each([
    ['Facturen worden dubbel gecontroleerd', 'SNELLE_WINST', 'R4', 'DOEN'],
    ['Klachten over late levering keren terug', 'OORZAAK_ZOEKEN', 'R5', 'PROJECT'],
    ['Intake-team is het knelpunt', 'KNELPUNT', 'R1', 'MEENEMEN'],
  ])('%s → %s (%s), %s, through to a plan', async (title, route, rule, quadrant) => {
    const { db, service } = await setup();
    const id = await createWithConsent(service, title, 'Beschrijving van het probleem.');

    expect(await clarifyAll(service, id)).toBe(2);
    expect((await service.detail(id))!.problemStatement?.whatGoesWrong).toBe(
      'Beschrijving van het probleem.',
    );

    expect((await service.estimate(id)).ok).toBe(true);
    let d = (await service.detail(id))!;
    expect(d.improvement.status).toBe('BEOORDEELD');
    expect(d.improvement.route).toBe(route);
    expect(d.improvement.routeRule).toBe(rule);
    expect(d.improvement.quadrant).toBe(quadrant);
    expect(d.assessment!.result.quadrant).toBe(quadrant);
    expect(d.improvement.priority).toBeCloseTo(d.assessment!.result.priority.value);

    expect((await service.generatePlan(id)).ok).toBe(true);
    d = (await service.detail(id))!;
    expect(d.plan!.template).toBe(route);
    expect(d.plan!.steps.map((s) => s.phase)).toEqual(phaseNames(d.plan!.template));
    expect(d.plan!.steps[0]!.dueDate).toBe('2026-10-16');
    if (route === 'OORZAAK_ZOEKEN') {
      expect(d.plan!.fiveWhys).not.toBeNull();
      expect(d.plan!.fishbone?.MENS).toEqual(['Onvoldoende instructie']);
    }

    expect((await service.setStatus(id, 'LOOPT')).ok).toBe(true);
    const calls = await db.select<{ kind: string; ok: number }>(
      'SELECT kind, ok FROM ai_calls ORDER BY rowid',
    );
    expect(calls.map((c) => c.kind)).toEqual(['clarify', 'clarify', 'clarify', 'estimate', 'plan']);
    await db.close();
  });
});

describe('clarification rules', () => {
  it('stops after five questions even if Claude wants to keep asking', async () => {
    const { service } = await setup({ questions: 10 });
    const id = await createWithConsent(service, 'Iets');
    expect(await clarifyAll(service, id)).toBe(MAX_QUESTIONS);
    expect((await service.detail(id))!.problemStatement).not.toBeNull();
  });

  it('blocks a new question while one is open', async () => {
    const { service } = await setup();
    const id = await createWithConsent(service, 'Iets');
    await service.nextQuestion(id);
    expect(await service.nextQuestion(id)).toMatchObject({ ok: false, error: { code: 'INVALID' } });
  });

  it('passes a skipped answer as null', async () => {
    const { service } = await setup();
    const id = await createWithConsent(service, 'Iets');
    await service.nextQuestion(id);
    const q = (await service.detail(id))!.clarifications[0]!;
    await service.answer(id, q.id, '   ');
    expect((await service.detail(id))!.clarifications[0]!.answer).toBe('');
  });
});

describe('consent', () => {
  it('requires the global setting', async () => {
    const { service } = await setup({}, { aiConsent: false });
    const id = await createWithConsent(service, 'Iets');
    expect(await service.nextQuestion(id)).toMatchObject({ ok: false, error: { code: 'NO_CONSENT' } });
  });

  it('requires a per-improvement acknowledgement', async () => {
    const { service } = await setup();
    const created = await service.create({ title: 'Iets', description: '', domain: 'KANTOOR' });
    const id = created.ok ? created.value : '';
    expect(await service.estimate(id)).toMatchObject({ ok: false, error: { code: 'NO_CONSENT' } });
    await service.giveConsent(id);
    expect((await service.estimate(id)).ok).toBe(true);
  });
});

describe('overrides', () => {
  it('records every changed value and recalculates', async () => {
    const { service } = await setup();
    const id = await createWithConsent(service, 'Facturen');
    await service.estimate(id);
    const before = (await service.detail(id))!;
    expect(before.improvement.quadrant).toBe('DOEN');

    const next = structuredClone(before.assessment!.input);
    next.effort.hours = 500;
    next.effort.costEur = 60000;
    next.effort.itDependency = 'HEAVY';
    next.routeOverride = 'MEETPROJECT';
    const saved = await service.overrideAssessment(id, next, 'Leverancier nodig');
    expect(saved).toEqual({ ok: true, value: 4 });

    const after = (await service.detail(id))!;
    expect(after.overrides.map((o) => o.field).sort()).toEqual([
      'effort.costEur',
      'effort.hours',
      'effort.itDependency',
      'routeOverride',
    ]);
    expect(after.overrides.every((o) => o.reason === 'Leverancier nodig')).toBe(true);
    expect(after.improvement.route).toBe('MEETPROJECT');
    expect(after.improvement.routeRule).toBe('HANDMATIG');
    expect(after.assessment!.result.effort.total).toBe(8);
    // Claude's original estimate is kept unchanged.
    expect(after.assessment!.estimation.effort.hours).toBe(6);
  });

  it('records nothing when nothing changed', async () => {
    const { service } = await setup();
    const id = await createWithConsent(service, 'Facturen');
    await service.estimate(id);
    const d = (await service.detail(id))!;
    expect(await service.overrideAssessment(id, d.assessment!.input, null)).toEqual({ ok: true, value: 0 });
  });
});

describe('status and plan guards', () => {
  it('refuses invalid transitions with a Dutch message', async () => {
    const { service } = await setup();
    const id = await createWithConsent(service, 'Facturen');
    expect(await service.setStatus(id, 'LOOPT')).toMatchObject({ ok: false, error: { code: 'INVALID' } });
    expect(await service.setStatus(id, 'BEOORDEELD')).toMatchObject({
      ok: false,
      error: { messageNl: 'Beoordeel het idee eerst.' },
    });
    await service.estimate(id);
    expect(await service.setStatus(id, 'LOOPT')).toMatchObject({
      ok: false,
      error: { messageNl: 'Maak eerst een stappenplan.' },
    });
    expect((await service.setStatus(id, 'AFGEWEZEN')).ok).toBe(true);
    expect((await service.setStatus(id, 'IDEE')).ok).toBe(true);
  });

  it('rejects edited plans with unknown phases or empty steps', async () => {
    const { service } = await setup();
    const id = await createWithConsent(service, 'Facturen');
    await service.estimate(id);
    await service.generatePlan(id);
    const plan = (await service.detail(id))!.plan!;
    const base = { ...plan, steps: plan.steps.map(({ id: _id, ...s }) => s) };
    expect(
      await service.savePlan({ ...base, steps: [{ ...base.steps[0]!, phase: 'Verzonnen' }] }),
    ).toMatchObject({ ok: false });
    expect(await service.savePlan({ ...base, steps: [{ ...base.steps[0]!, what: ' ' }] })).toMatchObject({
      ok: false,
    });
    const reordered = { ...base, steps: [...base.steps].reverse() };
    expect((await service.savePlan(reordered)).ok).toBe(true);
    expect((await service.detail(id))!.plan!.steps[0]!.phase).toBe('Act');
  });

  it('does not store anything when the AI fails, and logs the failed call', async () => {
    const { db, service } = await setup({ failWith: 'SCHEMA', failOn: ['estimate'] });
    const id = await createWithConsent(service, 'Facturen');
    expect(await service.estimate(id)).toMatchObject({ ok: false, error: { code: 'SCHEMA' } });
    expect((await service.detail(id))!.assessment).toBeNull();
    expect(await db.select('SELECT kind, ok, error_code FROM ai_calls')).toEqual([
      { kind: 'estimate', ok: 0, error_code: 'SCHEMA' },
    ]);
  });

  it('requires a title', async () => {
    const { service } = await setup();
    expect(await service.create({ title: '  ', description: '', domain: 'KANTOOR' })).toMatchObject({
      ok: false,
    });
  });
});
