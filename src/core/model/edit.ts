import type { Flow, ProcessModel, Role, Step, StepType } from './types';

// Pure editing operations for the diagram editor. Each returns a new model; the input is unchanged.

function nextId(prefix: string, used: Set<string>): string {
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

function allIds(model: ProcessModel): Set<string> {
  return new Set([
    ...model.steps.map((s) => s.id),
    ...model.flows.map((f) => f.id),
    ...model.roles.map((r) => r.id),
  ]);
}

const DEFAULT_NAMES: Record<StepType, string> = {
  TASK: 'Nieuwe stap',
  DECISION: 'Beslissing?',
  START: 'Start',
  END: 'Einde',
};

/**
 * Adds a step. With `after`, the new step is inserted after that step: it takes over the outgoing
 * flows of `after` when there is exactly one, so a straight line stays straight.
 */
export function addStep(
  model: ProcessModel,
  type: StepType = 'TASK',
  after?: string,
): { model: ProcessModel; id: string } {
  const used = allIds(model);
  const id = nextId('stap', used);
  used.add(id);
  const anchor = after ? model.steps.find((s) => s.id === after) : undefined;
  const step: Step = {
    id,
    type,
    name: DEFAULT_NAMES[type],
    ...(anchor?.roleId ? { roleId: anchor.roleId } : {}),
  };
  let flows = model.flows;
  if (anchor) {
    const outgoing = flows.filter((f) => f.from === anchor.id);
    if (outgoing.length === 1 && type !== 'END') {
      flows = flows.map((f) => (f === outgoing[0] ? { ...f, from: id } : f));
    }
    flows = [...flows, { id: nextId('f', used), from: anchor.id, to: id }];
  }
  return { model: { ...model, steps: [...model.steps, step], flows }, id };
}

/** Removes a step and its flows; a step with exactly one predecessor and one successor is bridged. */
export function removeStep(model: ProcessModel, id: string): ProcessModel {
  const incoming = model.flows.filter((f) => f.to === id && f.from !== id);
  const outgoing = model.flows.filter((f) => f.from === id && f.to !== id);
  let flows = model.flows.filter((f) => f.from !== id && f.to !== id);
  if (incoming.length === 1 && outgoing.length === 1 && incoming[0]!.from !== outgoing[0]!.to) {
    const from = incoming[0]!.from;
    const to = outgoing[0]!.to;
    if (!flows.some((f) => f.from === from && f.to === to)) {
      flows = [...flows, { ...incoming[0]!, to }];
    }
  }
  return { ...model, steps: model.steps.filter((s) => s.id !== id), flows };
}

export function updateStep(model: ProcessModel, id: string, patch: Partial<Omit<Step, 'id'>>): ProcessModel {
  return {
    ...model,
    steps: model.steps.map((s) => {
      if (s.id !== id) return s;
      const next: Step = { ...s, ...patch };
      for (const key of Object.keys(next) as (keyof Step)[]) {
        if (next[key] === undefined || next[key] === '') delete next[key];
      }
      if (!next.name) next.name = '';
      return next;
    }),
  };
}

/** Adds a flow; refuses self-loops, duplicates and unknown steps (returns the model unchanged). */
export function addFlow(model: ProcessModel, from: string, to: string): ProcessModel {
  const known = new Set(model.steps.map((s) => s.id));
  if (from === to || !known.has(from) || !known.has(to)) return model;
  if (model.flows.some((f) => f.from === from && f.to === to)) return model;
  const flow: Flow = { id: nextId('f', allIds(model)), from, to };
  return { ...model, flows: [...model.flows, flow] };
}

export function removeFlow(model: ProcessModel, id: string): ProcessModel {
  return { ...model, flows: model.flows.filter((f) => f.id !== id) };
}

export function updateFlow(
  model: ProcessModel,
  id: string,
  patch: Partial<Pick<Flow, 'label' | 'probability'>>,
): ProcessModel {
  return {
    ...model,
    flows: model.flows.map((f) => {
      if (f.id !== id) return f;
      const next: Flow = { ...f, ...patch };
      if (!next.label) delete next.label;
      if (next.probability === undefined || Number.isNaN(next.probability)) delete next.probability;
      return next;
    }),
  };
}

export function addRole(model: ProcessModel, name: string): { model: ProcessModel; id: string } {
  const id = nextId('rol', allIds(model));
  const role: Role = { id, name: name.trim() || 'Nieuwe rol' };
  return { model: { ...model, roles: [...model.roles, role] }, id };
}

export function renameRole(model: ProcessModel, id: string, name: string): ProcessModel {
  return { ...model, roles: model.roles.map((r) => (r.id === id ? { ...r, name } : r)) };
}

/** Removes a role; steps that had it lose their role. */
export function removeRole(model: ProcessModel, id: string): ProcessModel {
  return {
    ...model,
    roles: model.roles.filter((r) => r.id !== id),
    steps: model.steps.map((s) => {
      if (s.roleId !== id) return s;
      const { roleId: _removed, ...rest } = s;
      return rest;
    }),
  };
}
