// Zod schemas for every AI answer the app processes (SPEC §7.2). Structured outputs support no
// numeric/string constraints and no open maps; the SDK strips min/max from the JSON schema sent to
// the API and validates them client-side, and the app validates once more after parsing.
import { z } from 'zod';

const Score = z.number().int().min(-2).max(2);
const Reason = z.string().min(1).max(1200);

export const ClarificationSchema = z.object({
  done: z.boolean(),
  question: z.string().nullable(),
  whyAsked: z.string().nullable(),
  problemStatement: z
    .object({
      whatGoesWrong: z.string(),
      howOften: z.string(),
      cost: z.string(),
      forWhom: z.string(),
      isSolutionInDisguise: z.boolean(),
    })
    .nullable(),
});
export type Clarification = z.infer<typeof ClarificationSchema>;

const ScoredDimension = z.object({ score: Score, reason: Reason });

export const EstimationSchema = z.object({
  routeInputs: z.object({
    causeKnown: z.enum(['YES', 'PARTLY', 'NO']),
    scope: z.enum(['SMALL_REVERSIBLE', 'MEDIUM', 'LARGE_IRREVERSIBLE']),
    hasData: z.boolean(),
    departments: z.number().int().min(1).max(50),
    problemType: z.enum(['INCIDENT', 'RECURRING', 'VARIATION', 'BOTTLENECK', 'STRUCTURE']),
    reasoning: Reason,
  }),
  impact: z.object({
    time: ScoredDimension,
    cost: ScoredDimension,
    quality: ScoredDimension,
    flexibility: ScoredDimension,
  }),
  annualBenefit: z.object({
    frequencyPerYear: z.number().min(0).nullable(),
    minutesSavedPerOccurrence: z.number().min(0).nullable(),
    avoidedErrorCostPerYear: z.number().min(0).nullable(),
    reason: Reason,
  }),
  effort: z.object({
    hours: z.number().min(0),
    costEur: z.number().min(0),
    departments: z.number().int().min(1).max(50),
    itDependency: z.enum(['NONE', 'LIGHT', 'HEAVY']),
    behaviourChange: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    reversibility: z.enum(['EASY', 'HARD', 'IRREVERSIBLE']),
    reason: Reason,
  }),
  certainty: z.enum(['GEMETEN', 'GESCHAT', 'GEVOEL']),
  certaintyReason: Reason,
  category: z.string().min(1).max(60),
});
export type Estimation = z.infer<typeof EstimationSchema>;

const FishboneSchema = z.object({
  MENS: z.array(z.string()),
  METHODE: z.array(z.string()),
  MIDDELEN: z.array(z.string()),
  MATERIAAL: z.array(z.string()),
  METING: z.array(z.string()),
  OMGEVING: z.array(z.string()),
});

/** The plan schema is built per route so `phase` can only be one of that template's phases. */
export function actionPlanSchema(phases: [string, ...string[]]) {
  return z.object({
    metric: z.string(),
    unit: z.string(),
    baseline: z.number().nullable(),
    target: z.number().nullable(),
    measureMoment: z.string(),
    steps: z
      .array(
        z.object({
          phase: z.enum(phases),
          what: z.string().min(1),
          owner: z.string(),
          dueInDays: z.number().int().min(0).max(730),
          deliverable: z.string(),
        }),
      )
      .min(1)
      .max(30),
    fiveWhys: z
      .array(z.object({ why: z.string(), answer: z.string() }))
      .max(5)
      .nullable(),
    fishbone: FishboneSchema.nullable(),
  });
}
export type ActionPlanDraft = z.infer<ReturnType<typeof actionPlanSchema>>;

// Process read from text, a Word document, an image or a PDF (SPEC §7.6).
export const ProcessExtractionSchema = z.object({
  name: z.string(),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  steps: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['START', 'END', 'TASK', 'DECISION']),
        name: z.string(),
        roleId: z.string().nullable(),
        system: z.string().nullable(),
        processingTime: z.number().min(0).nullable(),
        waitingTime: z.number().min(0).nullable(),
      }),
    )
    .min(2),
  flows: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      label: z.string().nullable(),
      probability: z.number().min(0).max(1).nullable(),
    }),
  ),
  uncertainties: z.array(z.string()),
});
export type ProcessExtraction = z.infer<typeof ProcessExtractionSchema>;
