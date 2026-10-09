import { describe, expect, it } from 'vitest';
import { validateModel, type IssueCode, type ProcessModel } from '../../src/core/model';
import { validModel } from './fixtures';

function codes(model: ProcessModel): IssueCode[] {
  return validateModel(model).issues.map((i) => i.code);
}

function mutate(fn: (m: ProcessModel) => void): ProcessModel {
  const m = validModel();
  fn(m);
  return m;
}

describe('validateModel', () => {
  it('accepts a valid model without issues', () => {
    const result = validateModel(validModel());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  const errorCases: Array<[IssueCode, (m: ProcessModel) => void]> = [
    [
      'NO_START',
      (m) => {
        m.steps = m.steps.filter((s) => s.id !== 's');
        m.flows = m.flows.filter((f) => f.from !== 's');
      },
    ],
    [
      'MULTIPLE_START',
      (m) => {
        m.steps.push({ id: 's2', type: 'START', name: 'Tweede start' });
        m.flows.push({ id: 'fx', from: 's2', to: 't1' });
      },
    ],
    [
      'NO_END',
      (m) => {
        m.steps = m.steps.filter((s) => s.id !== 'e');
        m.flows = m.flows.filter((f) => f.to !== 'e');
      },
    ],
    ['DANGLING_FLOW', (m) => m.flows.push({ id: 'fx', from: 't3', to: 'ghost' })],
    ['DUPLICATE_ID', (m) => m.flows.push({ id: 'f1', from: 't3', to: 'e' })],
    [
      'UNREACHABLE_STEP',
      (m) => {
        m.steps.push({ id: 'lost', type: 'TASK', name: 'Los' });
        m.flows.push({ id: 'fx', from: 'lost', to: 'e' });
      },
    ],
    ['END_UNREACHABLE', (m) => m.steps.push({ id: 'e2', type: 'END', name: 'Nergens' })],
    [
      'DEAD_END',
      (m) => {
        m.steps.push({ id: 'dead', type: 'TASK', name: 'Doodlopend' });
        m.flows.push({ id: 'fx', from: 't1', to: 'dead' });
      },
    ],
    ['START_HAS_INCOMING', (m) => m.flows.push({ id: 'fx', from: 't3', to: 's' })],
    ['END_HAS_OUTGOING', (m) => m.flows.push({ id: 'fx', from: 'e', to: 't1' })],
    [
      'UNKNOWN_ROLE',
      (m) => {
        m.steps[1]!.roleId = 'nope';
      },
    ],
    [
      'INVALID_NUMBER',
      (m) => {
        m.steps[1]!.processingTime = -1;
      },
    ],
    [
      'INVALID_NUMBER',
      (m) => {
        m.steps[1]!.errorRate = 1.5;
      },
    ],
    [
      'INVALID_NUMBER',
      (m) => {
        m.flows[3]!.probability = 2;
      },
    ],
    [
      'INVALID_NUMBER',
      (m) => {
        m.steps[1]!.waitingTime = Number.NaN;
      },
    ],
  ];

  it.each(errorCases)('reports %s as an error', (code, fn) => {
    const model = mutate(fn);
    const result = validateModel(model);
    expect(result.valid).toBe(false);
    const found = result.issues.find((i) => i.code === code);
    expect(found?.severity).toBe('ERROR');
    expect(found?.message).toMatch(/\S/);
  });

  const warningCases: Array<[IssueCode, (m: ProcessModel) => void]> = [
    [
      'DECISION_SINGLE_EXIT',
      (m) => {
        m.flows = m.flows.filter((f) => f.id !== 'f5');
        m.flows[3]!.probability = undefined;
      },
    ],
    [
      'PROBABILITY_SUM',
      (m) => {
        m.flows[3]!.probability = 0.5;
      },
    ],
    [
      'PROBABILITY_SUM',
      (m) => {
        m.flows[4]!.probability = undefined;
      },
    ],
    [
      'MISSING_TIMES',
      (m) => {
        m.steps[1]!.processingTime = undefined;
      },
    ],
    [
      'EMPTY_NAME',
      (m) => {
        m.steps[1]!.name = '  ';
      },
    ],
  ];

  it.each(warningCases)('reports %s as a warning that does not block', (code, fn) => {
    const result = validateModel(mutate(fn));
    expect(result.valid).toBe(true);
    expect(result.issues.find((i) => i.code === code)?.severity).toBe('WARNING');
  });

  it('warns when a step cannot reach an end (closed loop)', () => {
    const model = mutate((m) => {
      m.steps.push({ id: 'a', type: 'TASK', name: 'A' }, { id: 'b', type: 'TASK', name: 'B' });
      m.flows.push(
        { id: 'fa', from: 't1', to: 'a' },
        { id: 'fb', from: 'a', to: 'b' },
        { id: 'fc', from: 'b', to: 'a' },
      );
    });
    const issues = validateModel(model).issues.filter((i) => i.code === 'NO_PATH_TO_END');
    expect(issues.flatMap((i) => i.stepIds).sort()).toEqual(['a', 'b']);
  });

  it('accepts probabilities that sum to 1 within tolerance', () => {
    const model = mutate((m) => {
      m.flows[3]!.probability = 0.795;
      m.flows[4]!.probability = 0.2;
    });
    expect(codes(model)).not.toContain('PROBABILITY_SUM');
  });

  it('points issues at the offending steps and flows', () => {
    const result = validateModel(mutate((m) => m.flows.push({ id: 'fx', from: 'e', to: 't1' })));
    const found = result.issues.find((i) => i.code === 'END_HAS_OUTGOING');
    expect(found?.stepIds).toEqual(['e']);
    expect(found?.flowIds).toEqual(['fx']);
  });

  it('reports duplicate step ids', () => {
    const model = mutate((m) => m.steps.push({ id: 't1', type: 'TASK', name: 'Dubbel' }));
    const found = validateModel(model).issues.find((i) => i.code === 'DUPLICATE_ID');
    expect(found?.stepIds).toEqual(['t1']);
  });
});
