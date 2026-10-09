// Assessment domain types (SPEC.md §6). Claude estimates these inputs; code computes the rest.

export type Route = 'SNELLE_WINST' | 'OORZAAK_ZOEKEN' | 'MEETPROJECT' | 'KNELPUNT' | 'HERONTWERP';
export type Quadrant = 'DOEN' | 'PROJECT' | 'MEENEMEN' | 'NIET_DOEN';
export type Certainty = 'GEMETEN' | 'GESCHAT' | 'GEVOEL';
export type ImprovementStatus = 'IDEE' | 'BEOORDEELD' | 'LOOPT' | 'METEN' | 'GEBORGD' | 'AFGEWEZEN';
export type DimensionKey = 'time' | 'cost' | 'quality' | 'flexibility';

export const ROUTES: Route[] = ['SNELLE_WINST', 'OORZAAK_ZOEKEN', 'MEETPROJECT', 'KNELPUNT', 'HERONTWERP'];
export const STATUSES: ImprovementStatus[] = ['IDEE', 'BEOORDEELD', 'LOOPT', 'METEN', 'GEBORGD', 'AFGEWEZEN'];
export const DIMENSIONS: DimensionKey[] = ['time', 'cost', 'quality', 'flexibility'];

export interface RouteInputs {
  causeKnown: 'YES' | 'PARTLY' | 'NO';
  scope: 'SMALL_REVERSIBLE' | 'MEDIUM' | 'LARGE_IRREVERSIBLE';
  hasData: boolean;
  departments: number;
  problemType: 'INCIDENT' | 'RECURRING' | 'VARIATION' | 'BOTTLENECK' | 'STRUCTURE';
}

/** Integer scores −2..+2 per dimension. */
export type ImpactScores = Record<DimensionKey, number>;

export interface AnnualBenefitInput {
  frequencyPerYear: number | null;
  minutesSavedPerOccurrence: number | null;
  avoidedErrorCostPerYear: number | null;
}

export interface EffortInput {
  hours: number;
  costEur: number;
  departments: number;
  itDependency: 'NONE' | 'LIGHT' | 'HEAVY';
  behaviourChange: 'LOW' | 'MEDIUM' | 'HIGH';
  reversibility: 'EASY' | 'HARD' | 'IRREVERSIBLE';
}

/** The values the calculation uses: Claude's estimate with the user's overrides applied. */
export interface AssessmentInput {
  routeInputs: RouteInputs;
  /** Set when the user picked a route by hand; wins over the decision table. */
  routeOverride: Route | null;
  impact: ImpactScores;
  annualBenefit: AnnualBenefitInput;
  effort: EffortInput;
  certainty: Certainty;
}

export interface AssessmentSettings {
  hourlyRate: number;
  impactThreshold: number;
  effortThreshold: number;
  certaintyFactors: Record<Certainty, number>;
  dimensionWeights: Record<DimensionKey, number>;
  benefitBands: [number, number, number, number];
}

/** Correction factors from the learning loop (SPEC §8.1); 1 = no correction. */
export interface CorrectionFactors {
  impact: number;
  effort: number;
}
