import { describe, expect, it } from 'vitest';
import { backEdges, layoutModel, NO_ROLE_LANE } from '../../src/core/layout';
import type { ProcessModel } from '../../src/core/model';
import { validModel } from './fixtures';

describe('layoutModel', () => {
  it('places a straight process left to right in one row without lanes', () => {
    const m: ProcessModel = {
      ...validModel(),
      roles: [],
      steps: validModel().steps.map(({ roleId: _r, ...s }) => s),
    };
    const l = layoutModel(m);
    expect(l.lanes).toEqual([]);
    const col = Object.fromEntries(l.nodes.map((n) => [n.id, n.column]));
    expect(col).toEqual({ s: 0, t1: 1, t2: 2, d: 3, t3: 4, e: 5 });
    const xs = ['s', 't1', 't2', 'd', 't3', 'e'].map((id) => l.nodes.find((n) => n.id === id)!);
    for (let i = 1; i < xs.length; i++)
      expect(xs[i]!.x + xs[i]!.width / 2).toBeGreaterThan(xs[i - 1]!.x + xs[i - 1]!.width / 2);
  });

  it('ignores the loop back edge for columns', () => {
    const m = validModel();
    expect([...backEdges(m)]).toEqual(['f5']);
    const l = layoutModel(m);
    expect(l.nodes.find((n) => n.id === 't1')!.column).toBe(1);
  });

  it('puts steps in the lane of their role; start/decision/end follow a neighbour', () => {
    const l = layoutModel(validModel());
    expect(l.lanes.map((x) => x.id)).toEqual(['r1', 'r2']);
    const lane = Object.fromEntries(l.nodes.map((n) => [n.id, n.laneId]));
    expect(lane).toEqual({ s: 'r1', t1: 'r1', t2: 'r2', d: 'r2', t3: 'r1', e: 'r1' });
    const r2 = l.lanes.find((x) => x.id === 'r2')!;
    const t2 = l.nodes.find((n) => n.id === 't2')!;
    expect(t2.y).toBeGreaterThanOrEqual(r2.y);
    expect(t2.y + t2.height).toBeLessThanOrEqual(r2.y + r2.height);
  });

  it('adds a "Zonder rol" lane only when needed and stacks parallel steps', () => {
    const m = validModel();
    m.steps.push(
      { id: 'x', type: 'TASK', name: 'Los' },
      { id: 'y', type: 'TASK', name: 'Parallel', roleId: 'r2' },
    );
    m.flows.push({ id: 'fx', from: 'x', to: 'x2' }, { id: 'fy', from: 't1', to: 'y' });
    const l = layoutModel(m);
    expect(l.lanes.map((x) => x.id)).toContain(NO_ROLE_LANE);
    const t2 = l.nodes.find((n) => n.id === 't2')!;
    const y = l.nodes.find((n) => n.id === 'y')!;
    expect(y.column).toBe(t2.column);
    expect(y.y).toBeGreaterThan(t2.y);
  });

  it('is deterministic', () => {
    expect(layoutModel(validModel())).toEqual(layoutModel(validModel()));
  });
});
