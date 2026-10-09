import { aiError } from './errors';
import type { ClarifyInput, EstimateInput, PlanInput } from './input';
import { ACTIVE_VERSIONS, type PromptId } from './prompts';
import type { ActionPlanDraft, Clarification, Estimation } from './schemas';
import type { AiClient, AiErrorCode, AiMeta, AiResult } from './types';

export interface FakeAiOptions {
  /** Simulates a failure on every call (or only on the listed kinds). */
  failWith?: AiErrorCode;
  failOn?: PromptId[];
  model?: string;
  /** Number of questions the fake asks before giving a problem statement. */
  questions?: number;
}

const QUESTIONS = [
  {
    question: 'Hoe vaak gebeurt dit ongeveer per week?',
    whyAsked: 'Zo kan de omvang van het probleem geschat worden.',
  },
  {
    question: 'Wie merkt er last van, en wat kost het hen?',
    whyAsked: 'Dan is duidelijk voor wie het een probleem is.',
  },
  {
    question: 'Is bekend waardoor het gebeurt?',
    whyAsked: 'Dat bepaalt of eerst de oorzaak gezocht moet worden.',
  },
];

/**
 * Deterministic example scenarios, selected by a keyword in the title. They cover three routes and
 * three quadrants with the default settings:
 * - "factu…"  → SNELLE_WINST, DOEN
 * - "klacht…" → OORZAAK_ZOEKEN, PROJECT
 * - "knelpunt"/"intake" → KNELPUNT, MEENEMEN
 */
const SCENARIOS: Array<{ match: RegExp; estimation: Estimation }> = [
  {
    match: /factu/i,
    estimation: {
      routeInputs: {
        causeKnown: 'YES',
        scope: 'SMALL_REVERSIBLE',
        hasData: false,
        departments: 1,
        problemType: 'RECURRING',
        reasoning: 'De dubbele controle is bekend als oorzaak en is eenvoudig terug te draaien.',
      },
      impact: {
        time: { score: 2, reason: 'Eén controlestap vervalt.' },
        cost: { score: 1, reason: 'Minder uren per factuur.' },
        quality: { score: 0, reason: 'De eerste controle blijft bestaan.' },
        flexibility: { score: 0, reason: 'Geen effect.' },
      },
      annualBenefit: {
        frequencyPerYear: 2400,
        minutesSavedPerOccurrence: 10,
        avoidedErrorCostPerYear: null,
        reason: 'Ongeveer 200 facturen per maand, 10 minuten per tweede controle.',
      },
      effort: {
        hours: 6,
        costEur: 0,
        departments: 1,
        itDependency: 'NONE',
        behaviourChange: 'LOW',
        reversibility: 'EASY',
        reason: 'Werkinstructie aanpassen en team informeren.',
      },
      certainty: 'GESCHAT',
      certaintyReason: 'Aantallen zijn geschat door de gebruiker.',
      category: 'goedkeuring',
    },
  },
  {
    match: /klacht/i,
    estimation: {
      routeInputs: {
        causeKnown: 'NO',
        scope: 'MEDIUM',
        hasData: false,
        departments: 2,
        problemType: 'RECURRING',
        reasoning: 'Klachten keren terug en de oorzaak is niet bekend.',
      },
      impact: {
        time: { score: 1, reason: 'Minder tijd aan klachtafhandeling.' },
        cost: { score: 0, reason: 'Onzeker.' },
        quality: { score: 2, reason: 'Minder late leveringen.' },
        flexibility: { score: 0, reason: 'Geen effect.' },
      },
      annualBenefit: {
        frequencyPerYear: null,
        minutesSavedPerOccurrence: null,
        avoidedErrorCostPerYear: 8000,
        reason: 'Compensaties en herleveringen geschat op € 8.000 per jaar.',
      },
      effort: {
        hours: 200,
        costEur: 2000,
        departments: 2,
        itDependency: 'LIGHT',
        behaviourChange: 'MEDIUM',
        reversibility: 'EASY',
        reason: 'Oorzaakanalyse met twee afdelingen en daarna maatregelen.',
      },
      certainty: 'GEVOEL',
      certaintyReason: 'Nog geen metingen.',
      category: 'levering',
    },
  },
  {
    match: /knelpunt|intake/i,
    estimation: {
      routeInputs: {
        causeKnown: 'PARTLY',
        scope: 'MEDIUM',
        hasData: true,
        departments: 1,
        problemType: 'BOTTLENECK',
        reasoning: 'Het intake-team bepaalt de doorvoer van het hele proces.',
      },
      impact: {
        time: { score: 2, reason: 'Kortere doorlooptijd.' },
        cost: { score: 0, reason: 'Geen direct effect.' },
        quality: { score: 0, reason: 'Geen direct effect.' },
        flexibility: { score: 1, reason: 'Pieken beter op te vangen.' },
      },
      annualBenefit: {
        frequencyPerYear: null,
        minutesSavedPerOccurrence: null,
        avoidedErrorCostPerYear: null,
        reason: 'Onvoldoende gegevens voor een bedrag.',
      },
      effort: {
        hours: 30,
        costEur: 0,
        departments: 1,
        itDependency: 'NONE',
        behaviourChange: 'MEDIUM',
        reversibility: 'EASY',
        reason: 'Planning aanpassen en werk herverdelen.',
      },
      certainty: 'GEMETEN',
      certaintyReason: 'Wachtrijen worden al geteld.',
      category: 'capaciteit',
    },
  },
];

const DEFAULT_SCENARIO: Estimation = SCENARIOS[0]!.estimation;

export function fakeEstimationFor(title: string): Estimation {
  return structuredClone(SCENARIOS.find((s) => s.match.test(title))?.estimation ?? DEFAULT_SCENARIO);
}

/** Deterministic AI client for tests, `npm run eval` and the Playwright smoke test. No network. */
export function createFakeAiClient(options: FakeAiOptions = {}): AiClient {
  const model = options.model ?? 'fake-model';
  const questionCount = options.questions ?? 2;

  function fails(kind: PromptId | 'connection'): boolean {
    if (!options.failWith) return false;
    return !options.failOn || (kind !== 'connection' && options.failOn.includes(kind));
  }

  function meta(promptId: PromptId): AiMeta {
    return { model, promptId, promptVersion: ACTIVE_VERSIONS[promptId], inputTokens: 100, outputTokens: 50 };
  }

  function result<T>(promptId: PromptId, data: T): AiResult<T> {
    if (fails(promptId)) return { ok: false, error: aiError(options.failWith!), meta: meta(promptId) };
    return { ok: true, data, meta: meta(promptId) };
  }

  return {
    async testConnection() {
      if (fails('connection')) return { ok: false, error: aiError(options.failWith!) };
      return { ok: true, model, displayName: 'Nep-model (test)' };
    },

    async listModels() {
      if (fails('connection')) return { ok: false, error: aiError(options.failWith!) };
      return { ok: true, models: [{ id: model, displayName: 'Nep-model (test)' }] };
    },

    async clarify(input: ClarifyInput) {
      const asked = input.qa.length;
      const finish = asked >= questionCount || input.questionsLeft <= 0;
      const answers = input.qa.map((q) => q.answer).filter((a): a is string => !!a);
      const data: Clarification = finish
        ? {
            done: true,
            question: null,
            whyAsked: null,
            problemStatement: {
              whatGoesWrong: input.idea.description || input.idea.title,
              howOften: answers[0] ?? 'onbekend',
              cost: answers[1] ?? 'onbekend',
              forWhom: 'het team',
              isSolutionInDisguise: false,
            },
          }
        : { done: false, ...QUESTIONS[asked % QUESTIONS.length]!, problemStatement: null };
      return result('clarify', data);
    },

    async estimate(input: EstimateInput) {
      return result('estimate', fakeEstimationFor(input.idea.title));
    },

    async plan(input: PlanInput) {
      const rootCause = input.route === 'OORZAAK_ZOEKEN';
      const data: ActionPlanDraft = {
        metric: 'Doorlooptijd per zaak',
        unit: 'dagen',
        baseline: null,
        target: null,
        measureMoment: 'Vier weken na invoering',
        steps: input.phases.map((phase, i) => ({
          phase,
          what: `${phase}: ${input.idea.title}`,
          owner: 'Procesverantwoordelijke',
          dueInDays: (i + 1) * 7,
          deliverable: `Resultaat van ${phase.toLowerCase()}`,
        })),
        fiveWhys: rootCause ? [{ why: 'Waarom komt dit voor?', answer: 'nog uitzoeken' }] : null,
        fishbone: rootCause
          ? {
              MENS: ['Onvoldoende instructie'],
              METHODE: [],
              MIDDELEN: [],
              MATERIAAL: [],
              METING: [],
              OMGEVING: [],
            }
          : null,
      };
      return result('plan', data);
    },
  };
}
