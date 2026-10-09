import { fmtEuro, fmtNumber, fmtScore } from './format';
import { chooseRoute, type RouteChoice } from './route';
import {
  DIMENSIONS,
  type AnnualBenefitInput,
  type AssessmentInput,
  type AssessmentSettings,
  type Certainty,
  type CorrectionFactors,
  type EffortInput,
  type ImpactScores,
  type Quadrant,
} from './types';

export interface Calculated {
  value: number;
  formulaNl: string;
}

const DIMENSION_NL = {
  time: 'tijd',
  cost: 'kosten',
  quality: 'kwaliteit',
  flexibility: 'flexibiliteit',
} as const;

/** J = frequency × minutes saved ÷ 60 × hourly rate + avoided error cost (SPEC §6.2). */
export function annualBenefit(input: AnnualBenefitInput, hourlyRate: number): Calculated | null {
  const { frequencyPerYear: f, minutesSavedPerOccurrence: m, avoidedErrorCostPerYear: avoided } = input;
  const hasTime = f !== null && m !== null;
  if (!hasTime && avoided === null) return null;
  const timePart = hasTime ? (f * m * hourlyRate) / 60 : 0;
  const avoidedPart = avoided ?? 0;
  const value = timePart + avoidedPart;
  const parts: string[] = [];
  if (hasTime) parts.push(`${fmtNumber(f)} × ${fmtNumber(m)} min ÷ 60 × ${fmtEuro(hourlyRate)}`);
  if (avoided !== null) parts.push(fmtEuro(avoided));
  return { value, formulaNl: `${parts.join(' + ')} = ${fmtEuro(value)}` };
}

/** I_dim = 10 × max(0, Σ w·s) / (2 × Σ w), range 0..10. */
export function dimensionImpact(
  scores: ImpactScores,
  weights: AssessmentSettings['dimensionWeights'],
): Calculated {
  const weightSum = DIMENSIONS.reduce((acc, d) => acc + weights[d], 0);
  const weighted = DIMENSIONS.reduce((acc, d) => acc + weights[d] * scores[d], 0);
  const value = weightSum > 0 ? (10 * Math.max(0, weighted)) / (2 * weightSum) : 0;
  const terms = DIMENSIONS.map((d) => `${DIMENSION_NL[d]} ${scores[d] >= 0 ? '+' : ''}${scores[d]}`).join(
    ', ',
  );
  return {
    value,
    formulaNl: `10 × max(0; ${fmtNumber(weighted)}) ÷ (2 × ${fmtNumber(weightSum)}) = ${fmtScore(value)} (${terms})`,
  };
}

/** Money band: below the first bound 0, then 2.5, 5, 7.5, 10. */
export function moneyImpact(amount: number, bands: AssessmentSettings['benefitBands']): number {
  let score = 0;
  for (const bound of bands) if (amount >= bound) score += 2.5;
  return score;
}

export interface EffortPoints {
  hours: number;
  cost: number;
  departments: number;
  it: number;
  behaviour: number;
  reversibility: number;
}

function band(value: number, bounds: number[]): number {
  return bounds.filter((b) => value >= b).length;
}

export function effortPoints(effort: EffortInput): EffortPoints {
  return {
    hours: band(effort.hours, [8, 40, 160]),
    cost: band(effort.costEur, [1000, 10000, 50000]),
    departments: effort.departments >= 4 ? 2 : effort.departments >= 2 ? 1 : 0,
    it: { NONE: 0, LIGHT: 1, HEAVY: 2 }[effort.itDependency],
    behaviour: { LOW: 0, MEDIUM: 1, HIGH: 2 }[effort.behaviourChange],
    reversibility: { EASY: 0, HARD: 1, IRREVERSIBLE: 2 }[effort.reversibility],
  };
}

export const MAX_EFFORT_POINTS = 14;

/** E = 1 + 9 × P / 14, range 1..10 (SPEC §6.3). */
export function effortScore(effort: EffortInput): Calculated & { points: EffortPoints; total: number } {
  const points = effortPoints(effort);
  const total = Object.values(points).reduce((a, b) => a + b, 0);
  const value = 1 + (9 * total) / MAX_EFFORT_POINTS;
  return {
    value,
    points,
    total,
    formulaNl: `1 + 9 × ${total} ÷ ${MAX_EFFORT_POINTS} = ${fmtScore(value)} (uren ${points.hours}, kosten ${points.cost}, afdelingen ${points.departments}, IT ${points.it}, gedrag ${points.behaviour}, omkeerbaarheid ${points.reversibility})`,
  };
}

export function quadrant(impactHigh: boolean, effortHigh: boolean): Quadrant {
  if (impactHigh) return effortHigh ? 'PROJECT' : 'DOEN';
  return effortHigh ? 'NIET_DOEN' : 'MEENEMEN';
}

export interface AssessmentResult {
  route: RouteChoice;
  annualBenefit: Calculated | null;
  impact: {
    dimension: Calculated;
    money: number | null;
    raw: number;
    /** After correction; equals raw when no correction applies. */
    value: number;
    formulaNl: string;
  };
  effort: ReturnType<typeof effortScore> & { raw: number };
  certainty: Certainty;
  certaintyFactor: number;
  corrected: boolean;
  priority: Calculated;
  impactHigh: boolean;
  effortHigh: boolean;
  quadrant: Quadrant;
}

const NO_CORRECTION: CorrectionFactors = { impact: 1, effort: 1 };

/** Full calculation from estimates to route, scores, priority and quadrant (SPEC §6). */
export function assess(
  input: AssessmentInput,
  settings: AssessmentSettings,
  correction: CorrectionFactors = NO_CORRECTION,
): AssessmentResult {
  const route = chooseRoute(input.routeInputs, input.routeOverride);
  const benefit = annualBenefit(input.annualBenefit, settings.hourlyRate);
  const dim = dimensionImpact(input.impact, settings.dimensionWeights);
  const money = benefit ? moneyImpact(benefit.value, settings.benefitBands) : null;
  const rawImpact = money === null ? dim.value : Math.max(dim.value, money);
  const impactValue = Math.min(10, rawImpact * correction.impact);
  const effort = effortScore(input.effort);
  const effortValue = Math.min(10, Math.max(1, effort.value * correction.effort));
  const corrected = correction.impact !== 1 || correction.effort !== 1;

  const certaintyFactor = settings.certaintyFactors[input.certainty];
  const priority = (impactValue * certaintyFactor) / effortValue;
  const impactHigh = impactValue >= settings.impactThreshold;
  const effortHigh = effortValue >= settings.effortThreshold;

  const impactFormula =
    money === null
      ? `impact = ${fmtScore(dim.value)} (alleen dimensies; geen jaaropbrengst)`
      : `impact = max(dimensies ${fmtScore(dim.value)}; geld ${fmtScore(money)}) = ${fmtScore(rawImpact)}`;

  return {
    route,
    annualBenefit: benefit,
    impact: {
      dimension: dim,
      money,
      raw: rawImpact,
      value: impactValue,
      formulaNl:
        correction.impact === 1
          ? impactFormula
          : `${impactFormula}; gecorrigeerd × ${fmtScore(correction.impact)} = ${fmtScore(impactValue)}`,
    },
    effort: {
      ...effort,
      raw: effort.value,
      value: effortValue,
      formulaNl:
        correction.effort === 1
          ? effort.formulaNl
          : `${effort.formulaNl}; gecorrigeerd × ${fmtScore(correction.effort)} = ${fmtScore(effortValue)}`,
    },
    certainty: input.certainty,
    certaintyFactor,
    corrected,
    priority: {
      value: priority,
      formulaNl: `${fmtScore(impactValue)} × ${fmtScore(certaintyFactor)} ÷ ${fmtScore(effortValue)} = ${fmtScore(priority)}`,
    },
    impactHigh,
    effortHigh,
    quadrant: quadrant(impactHigh, effortHigh),
  };
}
