// Orchestrates the improvement loop (SPEC §2.1, §6): AI estimates, core calculates, db stores.
import { aiError } from '../ai/errors';
import type { QuestionAnswer } from '../ai/input';
import type { ActionPlanDraft, Estimation } from '../ai/schemas';
import type { AiClient, AiError, AiResult } from '../ai/types';
import {
  assess,
  canTransition,
  diffLeaves,
  fmtScore,
  ROUTE_NL,
  STATUS_NL,
  type AssessmentInput,
  type AssessmentResult,
  type ImprovementStatus,
} from '../core/assessment';
import type { Settings } from '../core/settings';
import { addDays, phaseNames, templateFor } from '../core/templates';
import type { Db } from '../db/types';
import { logAiCall } from '../db/repos/aiCallsRepo';
import {
  getAssessment,
  insertOverrides,
  listOverrides,
  replaceAssessment,
  updateAssessmentInput,
  type OverrideRecord,
} from '../db/repos/assessmentsRepo';
import { giveConsent, hasConsent } from '../db/repos/consentRepo';
import {
  answerClarification,
  getImprovement,
  getProblemStatement,
  insertClarification,
  insertImprovement,
  listClarifications,
  listImprovements,
  updateImprovement,
  upsertProblemStatement,
  type ClarificationRecord,
  type ImprovementRecord,
  type ProblemStatementRecord,
} from '../db/repos/improvementsRepo';
import { getPlan, savePlan, type ActionPlan, type PlanInput } from '../db/repos/plansRepo';

export const MAX_QUESTIONS = 5;

export interface ServiceDeps {
  db: Db;
  ai: AiClient;
  getSettings: () => Promise<Settings>;
  /** Today's date as YYYY-MM-DD; injectable for tests. */
  today?: () => string;
}

export type Outcome<T = void> =
  { ok: true; value: T } | { ok: false; error: AiError | { code: 'INVALID'; messageNl: string } };

export interface ImprovementDetail {
  improvement: ImprovementRecord;
  clarifications: ClarificationRecord[];
  problemStatement: ProblemStatementRecord | null;
  assessment: {
    id: string;
    estimation: Estimation;
    input: AssessmentInput;
    result: AssessmentResult;
  } | null;
  overrides: OverrideRecord[];
  plan: ActionPlan | null;
  consentGiven: boolean;
}

function invalid(messageNl: string): Outcome<never> {
  return { ok: false, error: { code: 'INVALID', messageNl } };
}

/** Claude's estimate without the reasons: the values the calculation needs. */
export function toAssessmentInput(e: Estimation): AssessmentInput {
  const { reasoning, ...routeInputs } = e.routeInputs;
  const { reason: benefitReason, ...annualBenefit } = e.annualBenefit;
  const { reason: effortReason, ...effort } = e.effort;
  return {
    routeInputs,
    routeOverride: null,
    impact: {
      time: e.impact.time.score,
      cost: e.impact.cost.score,
      quality: e.impact.quality.score,
      flexibility: e.impact.flexibility.score,
    },
    annualBenefit,
    effort,
    certainty: e.certainty,
  };
}

function toQa(clarifications: ClarificationRecord[]): QuestionAnswer[] {
  return clarifications.map((c) => ({ question: c.question, answer: c.answer ? c.answer : null }));
}

export function createImprovementService(deps: ServiceDeps) {
  const { db, ai } = deps;
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));

  async function logged<T>(
    kind: string,
    result: AiResult<T>,
  ): Promise<{ result: AiResult<T>; callId: string | null }> {
    if (!result.meta) return { result, callId: null };
    const callId = await logAiCall(db, {
      kind,
      model: result.meta.model,
      promptId: result.meta.promptId,
      promptVersion: result.meta.promptVersion,
      inputTokens: result.meta.inputTokens,
      outputTokens: result.meta.outputTokens,
      ok: result.ok,
      errorCode: result.ok ? undefined : result.error.code,
    });
    return { result, callId };
  }

  /** AI calls need the global setting and a one-time acknowledgement per improvement. */
  async function consentError(id: string): Promise<AiError | null> {
    const settings = await deps.getSettings();
    if (!settings.aiConsent) return aiError('NO_CONSENT');
    if (!(await hasConsent(db, 'IMPROVEMENT', id))) {
      return {
        code: 'NO_CONSENT',
        messageNl: 'Bevestig eerst dat dit idee naar Claude gestuurd mag worden.',
        retryable: false,
      };
    }
    return null;
  }

  function recalculate(input: AssessmentInput, settings: Settings): AssessmentResult {
    // Correction factors from the learning loop are added in phase 5.
    return assess(input, settings);
  }

  async function applyResult(id: string, result: AssessmentResult, category?: string) {
    const current = await getImprovement(db, id);
    await updateImprovement(db, id, {
      route: result.route.route,
      routeRule: result.route.rule,
      quadrant: result.quadrant,
      priority: result.priority.value,
      ...(category ? { category } : {}),
      ...(current?.status === 'IDEE' ? { status: 'BEOORDEELD' as const } : {}),
    });
  }

  return {
    async create(input: { title: string; description: string; domain: string }): Promise<Outcome<string>> {
      const title = input.title.trim();
      if (!title) return invalid('Geef het idee een titel.');
      return {
        ok: true,
        value: await insertImprovement(db, { ...input, title, description: input.description.trim() }),
      };
    },

    list: () => listImprovements(db),

    async detail(id: string): Promise<ImprovementDetail | null> {
      const improvement = await getImprovement(db, id);
      if (!improvement) return null;
      const settings = await deps.getSettings();
      const stored = await getAssessment<Estimation>(db, id);
      return {
        improvement,
        clarifications: await listClarifications(db, id),
        problemStatement: await getProblemStatement(db, id),
        assessment: stored
          ? {
              id: stored.id,
              estimation: stored.estimation,
              input: stored.input,
              result: recalculate(stored.input, settings),
            }
          : null,
        overrides: await listOverrides(db, id),
        plan: await getPlan(db, id),
        consentGiven: await hasConsent(db, 'IMPROVEMENT', id),
      };
    },

    giveConsent: (id: string) => giveConsent(db, 'IMPROVEMENT', id),

    /**
     * Asks Claude for the next question, or for the problem statement when Claude is done or the
     * maximum of five questions is reached. Does nothing while a question is still unanswered.
     */
    async nextQuestion(id: string): Promise<Outcome> {
      const improvement = await getImprovement(db, id);
      if (!improvement) return invalid('Verbetering niet gevonden.');
      if (await getProblemStatement(db, id)) return { ok: true, value: undefined };
      const clarifications = await listClarifications(db, id);
      if (clarifications.some((c) => c.answer === null))
        return invalid('Beantwoord eerst de openstaande vraag.');
      const consent = await consentError(id);
      if (consent) return { ok: false, error: consent };

      const questionsLeft = Math.max(0, MAX_QUESTIONS - clarifications.length);
      const { result } = await logged(
        'clarify',
        await ai.clarify({
          idea: {
            title: improvement.title,
            description: improvement.description,
            domain: improvement.domain,
          },
          qa: toQa(clarifications),
          questionsLeft,
        }),
      );
      if (!result.ok) return { ok: false, error: result.error };

      const c = result.data;
      if (!c.done && c.question && questionsLeft > 0) {
        await insertClarification(db, id, clarifications.length + 1, c.question, c.whyAsked);
        return { ok: true, value: undefined };
      }
      // Done, or the question limit is reached: the loop always stops after five questions.
      const ps = c.problemStatement;
      await upsertProblemStatement(db, id, {
        whatGoesWrong: ps?.whatGoesWrong ?? 'onbekend',
        howOften: ps?.howOften ?? 'onbekend',
        cost: ps?.cost ?? 'onbekend',
        forWhom: ps?.forWhom ?? 'onbekend',
        edited: false,
      });
      return { ok: true, value: undefined };
    },

    /** Stores an answer; an empty answer means the question was skipped. */
    async answer(id: string, clarificationId: string, answer: string): Promise<Outcome> {
      const clarifications = await listClarifications(db, id);
      if (!clarifications.some((c) => c.id === clarificationId)) return invalid('Vraag niet gevonden.');
      await answerClarification(db, clarificationId, answer.trim());
      return { ok: true, value: undefined };
    },

    async saveProblemStatement(id: string, ps: Omit<ProblemStatementRecord, 'edited'>): Promise<Outcome> {
      await upsertProblemStatement(db, id, { ...ps, edited: true });
      return { ok: true, value: undefined };
    },

    /** Claude estimates; code chooses the route and computes scores, priority and quadrant. */
    async estimate(id: string): Promise<Outcome> {
      const improvement = await getImprovement(db, id);
      if (!improvement) return invalid('Verbetering niet gevonden.');
      const consent = await consentError(id);
      if (consent) return { ok: false, error: consent };
      const ps = await getProblemStatement(db, id);
      const { result, callId } = await logged(
        'estimate',
        await ai.estimate({
          idea: {
            title: improvement.title,
            description: improvement.description,
            domain: improvement.domain,
          },
          qa: toQa(await listClarifications(db, id)),
          problemStatement: ps,
          similarCases: [],
          lessons: [],
        }),
      );
      if (!result.ok) return { ok: false, error: result.error };
      const settings = await deps.getSettings();
      const input = toAssessmentInput(result.data);
      const calculated = recalculate(input, settings);
      await replaceAssessment(db, id, result.data, input, calculated, callId);
      await applyResult(id, calculated, result.data.category);
      return { ok: true, value: undefined };
    },

    /** Saves user overrides; every changed value is stored as a learning signal. */
    async overrideAssessment(
      id: string,
      next: AssessmentInput,
      reason: string | null,
    ): Promise<Outcome<number>> {
      const stored = await getAssessment(db, id);
      if (!stored) return invalid('Er is nog geen beoordeling om aan te passen.');
      const changes = diffLeaves(stored.input, next);
      if (changes.length === 0) return { ok: true, value: 0 };
      const settings = await deps.getSettings();
      const calculated = recalculate(next, settings);
      await insertOverrides(db, id, changes, reason?.trim() || null);
      await updateAssessmentInput(db, stored.id, next, calculated);
      await applyResult(id, calculated);
      return { ok: true, value: changes.length };
    },

    /** Claude drafts a plan from the route's template; code converts day offsets to dates. */
    async generatePlan(id: string): Promise<Outcome> {
      const improvement = await getImprovement(db, id);
      if (!improvement) return invalid('Verbetering niet gevonden.');
      const stored = await getAssessment<Estimation>(db, id);
      if (!stored) return invalid('Beoordeel het idee eerst.');
      const consent = await consentError(id);
      if (consent) return { ok: false, error: consent };
      const settings = await deps.getSettings();
      const calculated = recalculate(stored.input, settings);
      const route = calculated.route.route;
      const template = templateFor(route);
      const phases = phaseNames(route) as [string, ...string[]];
      const start = today();

      const { result } = await logged(
        'plan',
        await ai.plan({
          idea: {
            title: improvement.title,
            description: improvement.description,
            domain: improvement.domain,
          },
          problemStatement: await getProblemStatement(db, id),
          route,
          method: template.methodNl,
          phases,
          startDate: start,
          estimationSummary: [
            `Route: ${ROUTE_NL[route]}`,
            `Impact ${fmtScore(calculated.impact.value)} / 10, inspanning ${fmtScore(calculated.effort.value)} / 10`,
            calculated.annualBenefit
              ? `Jaaropbrengst: ${calculated.annualBenefit.formulaNl}`
              : 'Jaaropbrengst onbekend',
            `Effort: ${stored.estimation.effort.reason}`,
          ].join('\n'),
          similarCases: [],
          lessons: [],
        }),
      );
      if (!result.ok) return { ok: false, error: result.error };
      await savePlan(db, draftToPlan(id, route, result.data, start));
      return { ok: true, value: undefined };
    },

    async savePlan(plan: PlanInput): Promise<Outcome> {
      const allowed = new Set(phaseNames(plan.template));
      const unknown = plan.steps.find((s) => !allowed.has(s.phase));
      if (unknown) return invalid(`Onbekende fase „${unknown.phase}” voor deze route.`);
      if (plan.steps.some((s) => !s.what.trim()))
        return invalid('Elke stap moet beschrijven wat er gebeurt.');
      await savePlan(db, plan);
      return { ok: true, value: undefined };
    },

    async setStatus(id: string, to: ImprovementStatus): Promise<Outcome> {
      const improvement = await getImprovement(db, id);
      if (!improvement) return invalid('Verbetering niet gevonden.');
      if (!canTransition(improvement.status, to)) {
        return invalid(`Van „${STATUS_NL[improvement.status]}” naar „${STATUS_NL[to]}” kan niet.`);
      }
      if (to === 'BEOORDEELD' && !(await getAssessment(db, id))) return invalid('Beoordeel het idee eerst.');
      if (to === 'LOOPT' && !(await getPlan(db, id))) return invalid('Maak eerst een stappenplan.');
      await updateImprovement(db, id, { status: to });
      return { ok: true, value: undefined };
    },
  };
}

export type ImprovementService = ReturnType<typeof createImprovementService>;

export function draftToPlan(
  improvementId: string,
  route: PlanInput['template'],
  draft: ActionPlanDraft,
  startDate: string,
): PlanInput {
  return {
    improvementId,
    template: route,
    metric: draft.metric,
    unit: draft.unit,
    baseline: draft.baseline,
    target: draft.target,
    measureMoment: draft.measureMoment,
    fiveWhys: draft.fiveWhys,
    fishbone: draft.fishbone,
    steps: draft.steps.map((s) => ({
      phase: s.phase,
      what: s.what,
      owner: s.owner,
      dueDate: addDays(startDate, s.dueInDays),
      deliverable: s.deliverable,
      done: false,
    })),
  };
}
