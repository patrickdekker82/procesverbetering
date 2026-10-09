import { describe, expect, it } from 'vitest';
import {
  addFlow,
  addRole,
  addStep,
  removeFlow,
  removeRole,
  removeStep,
  renameRole,
  updateFlow,
  updateStep,
  validateModel,
} from '../../src/core/model';
import { validModel } from './fixtures';

describe('model editing', () => {
  it('inserts a step after another on a straight line and keeps the model valid', () => {
    const m = validModel();
    const { model, id } = addStep(m, 'TASK', 't1');
    expect(model.flows.find((f) => f.from === 't1')?.to).toBe(id);
    expect(model.flows.find((f) => f.from === id)?.to).toBe('t2');
    expect(model.steps.find((s) => s.id === id)?.roleId).toBe('r1');
    expect(validateModel(model).valid).toBe(true);
    expect(m.steps).toHaveLength(6);
  });

  it('adds an unconnected step without an anchor', () => {
    const { model, id } = addStep(validModel(), 'DECISION');
    expect(model.flows.some((f) => f.from === id || f.to === id)).toBe(false);
    expect(model.steps.at(-1)).toMatchObject({ id, type: 'DECISION', name: 'Beslissing?' });
  });

  it('removes a step and bridges a single predecessor to a single successor', () => {
    const model = removeStep(validModel(), 't2');
    expect(model.steps.some((s) => s.id === 't2')).toBe(false);
    expect(model.flows.some((f) => f.from === 't1' && f.to === 'd')).toBe(true);
    expect(validateModel(model).valid).toBe(true);
  });

  it('does not bridge a step with several successors', () => {
    const model = removeStep(validModel(), 'd');
    expect(model.flows.some((f) => f.from === 'd' || f.to === 'd')).toBe(false);
    expect(model.flows.some((f) => f.from === 't2')).toBe(false);
  });

  it('updates steps and drops cleared optional fields', () => {
    const model = updateStep(validModel(), 't1', {
      name: 'Intake nieuw',
      system: '',
      processingTime: undefined,
    });
    const s = model.steps.find((x) => x.id === 't1')!;
    expect(s.name).toBe('Intake nieuw');
    expect('system' in s).toBe(false);
    expect('processingTime' in s).toBe(false);
  });

  it('adds flows but refuses self-loops, duplicates and unknown steps', () => {
    const m = validModel();
    expect(addFlow(m, 't1', 't1')).toBe(m);
    expect(addFlow(m, 's', 't1')).toBe(m);
    expect(addFlow(m, 't1', 'ghost')).toBe(m);
    const added = addFlow(m, 't3', 't1');
    expect(added.flows).toHaveLength(m.flows.length + 1);
    expect(new Set(added.flows.map((f) => f.id)).size).toBe(added.flows.length);
  });

  it('edits and removes flows', () => {
    let m = updateFlow(validModel(), 'f4', { label: 'akkoord', probability: 0.9 });
    expect(m.flows.find((f) => f.id === 'f4')).toMatchObject({ label: 'akkoord', probability: 0.9 });
    m = updateFlow(m, 'f4', { label: '', probability: undefined });
    expect(m.flows.find((f) => f.id === 'f4')).toEqual({ id: 'f4', from: 'd', to: 't3' });
    expect(removeFlow(m, 'f4').flows.some((f) => f.id === 'f4')).toBe(false);
  });

  it('manages roles; removing a role clears it from steps', () => {
    const { model, id } = addRole(validModel(), 'Controller');
    expect(model.roles.at(-1)).toEqual({ id, name: 'Controller' });
    expect(renameRole(model, id, 'Financiën').roles.at(-1)!.name).toBe('Financiën');
    const removed = removeRole(model, 'r2');
    expect(removed.roles.some((r) => r.id === 'r2')).toBe(false);
    expect(removed.steps.find((s) => s.id === 't2')!.roleId).toBeUndefined();
    expect(validateModel(removed).valid).toBe(true);
  });
});
