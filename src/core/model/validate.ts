import type { Flow, IssueCode, ProcessModel, Step, ValidationIssue, ValidationResult } from './types';

const PROBABILITY_TOLERANCE = 0.01;

function issue(
  code: IssueCode,
  severity: ValidationIssue['severity'],
  message: string,
  stepIds: string[] = [],
  flowIds: string[] = [],
): ValidationIssue {
  return { code, severity, message, stepIds, flowIds };
}

function label(step: Step): string {
  return step.name.trim() ? `„${step.name}”` : `(${step.id})`;
}

/** Breadth-first reachability over an adjacency map. */
function reachable(startIds: string[], adjacency: Map<string, string[]>): Set<string> {
  const seen = new Set<string>(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adjacency.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

function isValidNonNegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function isValidFraction(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0 && value <= 1);
}

/**
 * Validates a process model (SPEC.md §3.1). ERROR issues block confirmation; WARNING issues are
 * shown but do not block.
 */
export function validateModel(model: ProcessModel): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Unique ids.
  const seenIds = new Map<string, number>();
  for (const id of [
    ...model.steps.map((s) => `step:${s.id}`),
    ...model.flows.map((f) => `flow:${f.id}`),
    ...model.roles.map((r) => `role:${r.id}`),
  ]) {
    seenIds.set(id, (seenIds.get(id) ?? 0) + 1);
  }
  for (const [key, count] of seenIds) {
    if (count > 1) {
      const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      const kindNl = kind === 'step' ? 'stap' : kind === 'flow' ? 'verbinding' : 'rol';
      issues.push(
        issue(
          'DUPLICATE_ID',
          'ERROR',
          `De id „${id}” komt ${count} keer voor als ${kindNl}.`,
          kind === 'step' ? [id] : [],
          kind === 'flow' ? [id] : [],
        ),
      );
    }
  }

  const stepsById = new Map(model.steps.map((s) => [s.id, s]));
  const roleIds = new Set(model.roles.map((r) => r.id));

  // Flows must reference existing steps; only valid flows are used for graph checks.
  const validFlows: Flow[] = [];
  for (const flow of model.flows) {
    const missing = [flow.from, flow.to].filter((id) => !stepsById.has(id));
    if (missing.length > 0) {
      issues.push(
        issue(
          'DANGLING_FLOW',
          'ERROR',
          `Verbinding ${flow.id} verwijst naar een stap die niet bestaat (${missing.join(', ')}).`,
          [],
          [flow.id],
        ),
      );
    } else {
      validFlows.push(flow);
    }
  }

  const outgoing = new Map<string, Flow[]>();
  const incoming = new Map<string, Flow[]>();
  for (const flow of validFlows) {
    outgoing.set(flow.from, [...(outgoing.get(flow.from) ?? []), flow]);
    incoming.set(flow.to, [...(incoming.get(flow.to) ?? []), flow]);
  }

  const starts = model.steps.filter((s) => s.type === 'START');
  const ends = model.steps.filter((s) => s.type === 'END');

  if (starts.length === 0) {
    issues.push(issue('NO_START', 'ERROR', 'Het proces heeft geen startpunt.'));
  } else if (starts.length > 1) {
    issues.push(
      issue(
        'MULTIPLE_START',
        'ERROR',
        `Het proces heeft ${starts.length} startpunten; er mag er precies één zijn.`,
        starts.map((s) => s.id),
      ),
    );
  }
  if (ends.length === 0) {
    issues.push(issue('NO_END', 'ERROR', 'Het proces heeft geen eindpunt.'));
  }

  for (const start of starts) {
    const inc = incoming.get(start.id) ?? [];
    if (inc.length > 0) {
      issues.push(
        issue(
          'START_HAS_INCOMING',
          'ERROR',
          `Startpunt ${label(start)} heeft een inkomende verbinding.`,
          [start.id],
          inc.map((f) => f.id),
        ),
      );
    }
  }
  for (const end of ends) {
    const out = outgoing.get(end.id) ?? [];
    if (out.length > 0) {
      issues.push(
        issue(
          'END_HAS_OUTGOING',
          'ERROR',
          `Eindpunt ${label(end)} heeft een uitgaande verbinding.`,
          [end.id],
          out.map((f) => f.id),
        ),
      );
    }
  }

  // Reachability from the (single) start.
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const flow of validFlows) {
    forward.set(flow.from, [...(forward.get(flow.from) ?? []), flow.to]);
    backward.set(flow.to, [...(backward.get(flow.to) ?? []), flow.from]);
  }
  if (starts.length === 1) {
    const fromStart = reachable([starts[0]!.id], forward);
    for (const step of model.steps) {
      if (fromStart.has(step.id)) continue;
      if (step.type === 'END') {
        issues.push(
          issue('END_UNREACHABLE', 'ERROR', `Eindpunt ${label(step)} is niet bereikbaar vanaf de start.`, [
            step.id,
          ]),
        );
      } else if (step.type !== 'START') {
        issues.push(
          issue('UNREACHABLE_STEP', 'ERROR', `Stap ${label(step)} is niet bereikbaar vanaf de start.`, [
            step.id,
          ]),
        );
      }
    }
  }

  // Dead ends and steps that cannot reach an end.
  const toEnd = reachable(
    ends.map((e) => e.id),
    backward,
  );
  for (const step of model.steps) {
    if (step.type === 'END') continue;
    if ((outgoing.get(step.id) ?? []).length === 0) {
      issues.push(issue('DEAD_END', 'ERROR', `Stap ${label(step)} heeft geen volgende stap.`, [step.id]));
    } else if (ends.length > 0 && !toEnd.has(step.id)) {
      issues.push(
        issue('NO_PATH_TO_END', 'WARNING', `Vanaf stap ${label(step)} is geen eindpunt bereikbaar.`, [
          step.id,
        ]),
      );
    }
  }

  // Step attributes.
  for (const step of model.steps) {
    if (step.roleId !== undefined && !roleIds.has(step.roleId)) {
      issues.push(
        issue(
          'UNKNOWN_ROLE',
          'ERROR',
          `Stap ${label(step)} verwijst naar een onbekende rol (${step.roleId}).`,
          [step.id],
        ),
      );
    }
    const badNumbers =
      !isValidNonNegative(step.processingTime) ||
      !isValidNonNegative(step.waitingTime) ||
      !isValidNonNegative(step.frequency) ||
      !isValidFraction(step.errorRate);
    if (badNumbers) {
      issues.push(
        issue(
          'INVALID_NUMBER',
          'ERROR',
          `Stap ${label(step)} heeft een ongeldige tijd, frequentie of foutpercentage.`,
          [step.id],
        ),
      );
    }
    if (!step.name.trim()) {
      issues.push(issue('EMPTY_NAME', 'WARNING', `Stap ${step.id} heeft geen naam.`, [step.id]));
    }
  }
  for (const flow of validFlows) {
    if (!isValidFraction(flow.probability)) {
      issues.push(
        issue('INVALID_NUMBER', 'ERROR', `Verbinding ${flow.id} heeft een kans buiten 0..1.`, [], [flow.id]),
      );
    }
  }

  // Decisions.
  for (const step of model.steps.filter((s) => s.type === 'DECISION')) {
    const out = outgoing.get(step.id) ?? [];
    if (out.length === 1) {
      issues.push(
        issue('DECISION_SINGLE_EXIT', 'WARNING', `Beslissing ${label(step)} heeft maar één uitgang.`, [
          step.id,
        ]),
      );
    }
    const withProbability = out.filter((f) => f.probability !== undefined);
    if (withProbability.length > 0) {
      const sum = withProbability.reduce((acc, f) => acc + (f.probability ?? 0), 0);
      if (withProbability.length < out.length || Math.abs(sum - 1) > PROBABILITY_TOLERANCE) {
        issues.push(
          issue(
            'PROBABILITY_SUM',
            'WARNING',
            `De kansen na beslissing ${label(step)} tellen niet op tot 100%.`,
            [step.id],
            out.map((f) => f.id),
          ),
        );
      }
    }
  }

  // Missing times (one aggregated warning).
  const missingTimes = model.steps.filter(
    (s) => s.type === 'TASK' && (s.processingTime === undefined || s.waitingTime === undefined),
  );
  if (missingTimes.length > 0) {
    issues.push(
      issue(
        'MISSING_TIMES',
        'WARNING',
        `Voor ${missingTimes.length} stap(pen) ontbreekt de bewerk- of wachttijd.`,
        missingTimes.map((s) => s.id),
      ),
    );
  }

  return { valid: !issues.some((i) => i.severity === 'ERROR'), issues };
}
