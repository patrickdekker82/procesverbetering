import { describe, expect, it } from 'vitest';
import {
  annualBenefit,
  assess,
  dimensionImpact,
  effortScore,
  moneyImpact,
  quadrant,
  type AssessmentInput,
  type AssessmentSettings,
  type EffortInput,
} from '../../src/core/assessment';
import { DEFAULT_SETTINGS } from '../../src/core/settings';

const settings: AssessmentSettings = DEFAULT_SETTINGS;
const W = settings.dimensionWeights;

const lowEffort: EffortInput = {
  hours: 0,
  costEur: 0,
  departments: 1,
  itDependency: 'NONE',
  behaviourChange: 'LOW',
  reversibility: 'EASY',
};

describe('annualBenefit', () => {
  it('computes and shows the formula from SPEC §6.2', () => {
    const r = annualBenefit(
      { frequencyPerYear: 1200, minutesSavedPerOccurrence: 15, avoidedErrorCostPerYear: 2000 },
      75,
    );
    expect(r?.value).toBe(24500);
    expect(r?.formulaNl).toBe('1.200 × 15 min ÷ 60 × € 75 + € 2.000 = € 24.500');
  });

  it('uses only the time part when there is no avoided cost', () => {
    const r = annualBenefit(
      { frequencyPerYear: 100, minutesSavedPerOccurrence: 6, avoidedErrorCostPerYear: null },
      50,
    );
    expect(r).toEqual({ value: 500, formulaNl: '100 × 6 min ÷ 60 × € 50 = € 500' });
  });

  it('uses only avoided cost when time data is incomplete', () => {
    const r = annualBenefit(
      { frequencyPerYear: 100, minutesSavedPerOccurrence: null, avoidedErrorCostPerYear: 300 },
      75,
    );
    expect(r).toEqual({ value: 300, formulaNl: '€ 300 = € 300' });
  });

  it('returns null without any data', () => {
    expect(
      annualBenefit(
        { frequencyPerYear: null, minutesSavedPerOccurrence: null, avoidedErrorCostPerYear: null },
        75,
      ),
    ).toBeNull();
  });
});

describe('dimensionImpact', () => {
  it.each([
    [{ time: 2, cost: 2, quality: 2, flexibility: 2 }, 10],
    [{ time: 2, cost: 2, quality: 0, flexibility: 0 }, 5],
    [{ time: 2, cost: 1, quality: 0, flexibility: 0 }, 3.75],
    [{ time: -2, cost: -2, quality: 1, flexibility: 0 }, 0],
    [{ time: 0, cost: 0, quality: 0, flexibility: 0 }, 0],
  ])('%o → %d', (scores, expected) => {
    expect(dimensionImpact(scores, W).value).toBe(expected);
  });

  it('respects weights', () => {
    const r = dimensionImpact(
      { time: 2, cost: 0, quality: 0, flexibility: 0 },
      { time: 3, cost: 1, quality: 0, flexibility: 0 },
    );
    expect(r.value).toBe(7.5);
  });
});

describe('moneyImpact bands (inclusive lower bounds)', () => {
  it.each([
    [0, 0],
    [999.99, 0],
    [1000, 2.5],
    [4999, 2.5],
    [5000, 5],
    [19999, 5],
    [20000, 7.5],
    [49999, 7.5],
    [50000, 10],
    [1e9, 10],
  ])('€ %d → %d', (amount, expected) => {
    expect(moneyImpact(amount, settings.benefitBands)).toBe(expected);
  });
});

describe('effortScore', () => {
  it.each<[Partial<EffortInput>, number]>([
    [{}, 0],
    [{ hours: 7.99 }, 0],
    [{ hours: 8 }, 1],
    [{ hours: 39 }, 1],
    [{ hours: 40 }, 2],
    [{ hours: 160 }, 3],
    [{ costEur: 999 }, 0],
    [{ costEur: 1000 }, 1],
    [{ costEur: 10000 }, 2],
    [{ costEur: 50000 }, 3],
    [{ departments: 2 }, 1],
    [{ departments: 3 }, 1],
    [{ departments: 4 }, 2],
    [{ itDependency: 'LIGHT' }, 1],
    [{ itDependency: 'HEAVY' }, 2],
    [{ behaviourChange: 'MEDIUM' }, 1],
    [{ behaviourChange: 'HIGH' }, 2],
    [{ reversibility: 'HARD' }, 1],
    [{ reversibility: 'IRREVERSIBLE' }, 2],
  ])('%o → %d points', (patch, points) => {
    expect(effortScore({ ...lowEffort, ...patch }).total).toBe(points);
  });

  it('maps 0 points to 1 and 14 points to 10', () => {
    expect(effortScore(lowEffort).value).toBe(1);
    const max: EffortInput = {
      hours: 500,
      costEur: 1e6,
      departments: 9,
      itDependency: 'HEAVY',
      behaviourChange: 'HIGH',
      reversibility: 'IRREVERSIBLE',
    };
    expect(effortScore(max)).toMatchObject({ total: 14, value: 10 });
  });
});

describe('quadrant', () => {
  it.each([
    [true, false, 'DOEN'],
    [true, true, 'PROJECT'],
    [false, false, 'MEENEMEN'],
    [false, true, 'NIET_DOEN'],
  ] as const)('impactHigh=%s effortHigh=%s → %s', (i, e, q) => {
    expect(quadrant(i, e)).toBe(q);
  });
});

function input(patch: Partial<AssessmentInput> = {}): AssessmentInput {
  return {
    routeInputs: {
      causeKnown: 'YES',
      scope: 'SMALL_REVERSIBLE',
      hasData: false,
      departments: 1,
      problemType: 'RECURRING',
    },
    routeOverride: null,
    impact: { time: 2, cost: 2, quality: 0, flexibility: 0 },
    annualBenefit: { frequencyPerYear: null, minutesSavedPerOccurrence: null, avoidedErrorCostPerYear: null },
    effort: lowEffort,
    certainty: 'GEMETEN',
    ...patch,
  };
}

describe('assess', () => {
  it('treats impact exactly at the threshold (5) as high', () => {
    const r = assess(input(), settings);
    expect(r.impact.value).toBe(5);
    expect(r.impactHigh).toBe(true);
    expect(r.quadrant).toBe('DOEN');
  });

  it('treats impact just below the threshold as low', () => {
    const r = assess(input({ impact: { time: 2, cost: 1, quality: 0, flexibility: 0 } }), settings);
    expect(r.impact.value).toBe(3.75);
    expect(r.impactHigh).toBe(false);
    expect(r.quadrant).toBe('MEENEMEN');
  });

  it('treats effort exactly at the threshold as high (custom threshold)', () => {
    // 7 points → E = 1 + 9 × 7 / 14 = 5.5
    const effort: EffortInput = {
      hours: 160,
      costEur: 50000,
      departments: 2,
      itDependency: 'NONE',
      behaviourChange: 'LOW',
      reversibility: 'EASY',
    };
    expect(assess(input({ effort }), { ...settings, effortThreshold: 5.5 }).effortHigh).toBe(true);
    expect(assess(input({ effort }), { ...settings, effortThreshold: 5.51 }).effortHigh).toBe(false);
  });

  it('uses the money band when it is higher than the dimensions', () => {
    const r = assess(
      input({
        impact: { time: 1, cost: 0, quality: 0, flexibility: 0 },
        annualBenefit: {
          frequencyPerYear: 1200,
          minutesSavedPerOccurrence: 15,
          avoidedErrorCostPerYear: 2000,
        },
      }),
      settings,
    );
    expect(r.impact.dimension.value).toBe(1.25);
    expect(r.impact.money).toBe(7.5);
    expect(r.impact.value).toBe(7.5);
    expect(r.impact.formulaNl).toContain('max(');
  });

  it('computes priority = impact × certainty ÷ effort', () => {
    const r = assess(input({ certainty: 'GEVOEL' }), settings);
    expect(r.certaintyFactor).toBe(0.5);
    expect(r.priority.value).toBe(2.5);
    expect(r.priority.formulaNl).toBe('5 × 0,5 ÷ 1 = 2,5');
  });

  it('applies correction factors and clamps to the scale', () => {
    const r = assess(input(), settings, { impact: 3, effort: 0.1 });
    expect(r.corrected).toBe(true);
    expect(r.impact.raw).toBe(5);
    expect(r.impact.value).toBe(10);
    expect(r.effort.raw).toBe(1);
    expect(r.effort.value).toBe(1);
    expect(r.impact.formulaNl).toContain('gecorrigeerd');
  });

  it('is deterministic: the same input gives the same output', () => {
    expect(assess(input(), settings)).toEqual(assess(input(), settings));
  });
});
