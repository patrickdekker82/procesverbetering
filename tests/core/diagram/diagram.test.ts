import { describe, expect, it } from 'vitest';
import {
  applyDiagramEdit,
  copySelection,
  drawingIssues,
  ensureLayout,
  emptyLayout,
  kindOf,
  laneBands,
  tidyLayout,
  type DiagramEdit,
  type DiagramState,
} from '../../../src/core/diagram';
import { validateModel, type ProcessModel } from '../../../src/core/model';
import { validModel } from '../fixtures';

function empty(): DiagramState {
  return {
    model: { id: 'p', name: 'Tekening', domain: 'KANTOOR', roles: [], steps: [], flows: [] },
    layout: emptyLayout(),
  };
}

function run(state: DiagramState, ...edits: DiagramEdit[]): { state: DiagramState; created: string[][] } {
  const created: string[][] = [];
  for (const e of edits) {
    const r = applyDiagramEdit(state, e);
    state = r.state;
    created.push(r.created);
  }
  return { state, created };
}

describe('drawing a process from scratch', () => {
  it('builds start → task → decision → two paths → end with quick-add, valid and labelled', () => {
    const first = run(empty(), { type: 'add', kind: 'start', x: 100, y: 100 });
    let state = first.state;
    const created = first.created;
    const start = created[0]![0]!;
    const quick = (from: string, direction: 'right' | 'bottom', kind: 'task' | 'decision' | 'end') => {
      const r = applyDiagramEdit(state, { type: 'quickAdd', from, direction, kind });
      state = r.state;
      return r.created[0]!;
    };
    const t1 = quick(start, 'right', 'task');
    const d = quick(t1, 'right', 'decision');
    const yes = quick(d, 'right', 'task');
    const no = quick(d, 'bottom', 'task');
    const end = quick(yes, 'right', 'end');
    ({ state } = run(state, { type: 'connect', from: no, to: end }));
    const exits = state.model.flows.filter((f) => f.from === d);
    ({ state } = run(
      state,
      { type: 'updateFlow', id: exits[0]!.id, patch: { label: 'Ja' } },
      { type: 'updateFlow', id: exits[1]!.id, patch: { label: 'Nee' } },
    ));

    expect(validateModel(state.model).valid).toBe(true);
    expect(drawingIssues(state).filter((i) => i.severity === 'ERROR')).toEqual([]);
    expect(state.model.steps.map((s) => s.type)).toEqual([
      'START',
      'TASK',
      'DECISION',
      'TASK',
      'TASK',
      'END',
    ]);
    // Quick-add places shapes to the right on the same centre line and glues the sides.
    const s1 = state.layout.shapes[t1]!;
    const s2 = state.layout.shapes[d]!;
    expect(s2.x).toBeGreaterThan(s1.x + s1.width);
    expect(s1.y + s1.height / 2).toBe(s2.y + s2.height / 2);
    expect(state.layout.flows[state.model.flows.find((f) => f.from === t1)!.id]).toEqual({
      sourceSide: 'right',
      targetSide: 'left',
    });
  });

  it('refuses flows into a start or out of an end, self-loops and duplicates', () => {
    const first = run(
      empty(),
      { type: 'add', kind: 'start', x: 0, y: 0 },
      { type: 'add', kind: 'end', x: 300, y: 0 },
      { type: 'add', kind: 'task', x: 150, y: 0 },
    );
    let state = first.state;
    const created = first.created;
    const [[s], [e], [t]] = created as [[string], [string], [string]];
    ({ state } = run(
      state,
      { type: 'connect', from: t, to: s },
      { type: 'connect', from: e, to: t },
      { type: 'connect', from: t, to: t },
    ));
    expect(state.model.flows).toEqual([]);
    ({ state } = run(state, { type: 'connect', from: s, to: t }, { type: 'connect', from: s, to: t }));
    expect(state.model.flows).toHaveLength(1);
  });

  it('maps palette shapes to model types and markers', () => {
    let state = empty();
    const kinds = ['task', 'subprocess', 'document', 'manual', 'wait', 'decision', 'start', 'end'] as const;
    for (const kind of kinds) state = applyDiagramEdit(state, { type: 'add', kind, x: 0, y: 0 }).state;
    expect(state.model.steps.map(kindOf)).toEqual([...kinds]);
    expect(state.model.steps.find((s) => s.marker === 'WAIT')?.type).toBe('TASK');
  });
});

describe('notes and data shapes', () => {
  it('keeps notes out of the model entirely', () => {
    const { state, created } = run(empty(), {
      type: 'add',
      kind: 'note',
      x: 0,
      y: 0,
      text: 'Let op: piek in december',
    });
    expect(state.model.steps).toEqual([]);
    expect(JSON.stringify(state.model)).not.toContain('piek');
    expect(state.layout.annotations[0]).toMatchObject({
      id: created[0]![0],
      text: 'Let op: piek in december',
    });
  });

  it('writes the data shape label to the system of the attached task', () => {
    const first = run(
      empty(),
      { type: 'add', kind: 'task', x: 0, y: 0 },
      { type: 'add', kind: 'data', x: 0, y: 200, text: 'CRM' },
    );
    let state = first.state;
    const created = first.created;
    const [[task], [data]] = created as [[string], [string]];
    ({ state } = run(state, { type: 'updateData', id: data, patch: { attachedTo: task } }));
    expect(state.model.steps[0]!.system).toBe('CRM');
    ({ state } = run(state, { type: 'setText', id: data, text: 'ERP' }));
    expect(state.model.steps[0]!.system).toBe('ERP');
    ({ state } = run(state, { type: 'delete', ids: [data] }));
    expect(state.model.steps[0]!.system).toBeUndefined();
  });
});

describe('lanes', () => {
  function withLanes() {
    const first = run(
      empty(),
      { type: 'addLane', name: 'Klantenservice' },
      { type: 'addLane', name: 'Backoffice' },
    );
    let state = first.state;
    const created = first.created;
    const [[ks], [bo]] = created as [[string], [string]];
    const r = run(
      state,
      { type: 'add', kind: 'task', x: 300, y: 80 },
      { type: 'add', kind: 'task', x: 300, y: 240 },
    );
    state = r.state;
    return { state, ks, bo, a: r.created[0]![0]!, b: r.created[1]![0]! };
  }

  it('assigns the role of the lane a shape is dropped in, and changes it when moved', () => {
    const { state, ks, bo, a, b } = withLanes();
    expect(state.model.steps.find((s) => s.id === a)!.roleId).toBe(ks);
    expect(state.model.steps.find((s) => s.id === b)!.roleId).toBe(bo);
    const moved = applyDiagramEdit(state, { type: 'move', ids: [a], dx: 0, dy: 160 }).state;
    expect(moved.model.steps.find((s) => s.id === a)!.roleId).toBe(bo);
    const outside = applyDiagramEdit(state, { type: 'move', ids: [a], dx: 0, dy: 600 }).state;
    expect(outside.model.steps.find((s) => s.id === a)!.roleId).toBeUndefined();
    expect(drawingIssues(outside).some((i) => i.code === 'OUTSIDE_LANE')).toBe(true);
  });

  it('moves shapes along when lanes are swapped, keeping their roles', () => {
    const { state, ks, a, b } = withLanes();
    const yA = state.layout.shapes[a]!.y;
    const yB = state.layout.shapes[b]!.y;
    const swapped = applyDiagramEdit(state, { type: 'moveLane', roleId: ks, delta: 1 }).state;
    expect(swapped.layout.lanes.map((l) => l.roleId)[1]).toBe(ks);
    expect(swapped.layout.shapes[a]!.y).toBe(yA + 160);
    expect(swapped.layout.shapes[b]!.y).toBe(yB - 160);
    expect(swapped.model.steps.find((s) => s.id === a)!.roleId).toBe(ks);
  });

  it('pushes lower lanes down when a lane grows, and removes a lane with its role', () => {
    const { state, ks, bo, b } = withLanes();
    const grown = applyDiagramEdit(state, { type: 'resizeLane', roleId: ks, height: 243 }).state;
    expect(grown.layout.lanes[0]!.height).toBe(240);
    expect(laneBands(grown.layout.lanes)[1]!.y).toBe(240);
    expect(grown.layout.shapes[b]!.y).toBe(state.layout.shapes[b]!.y + 80);
    expect(grown.model.steps.find((s) => s.id === b)!.roleId).toBe(bo);
    const removed = applyDiagramEdit(state, { type: 'removeLane', roleId: ks }).state;
    expect(removed.model.roles.map((r) => r.id)).toEqual([bo]);
    expect(removed.model.steps.find((s) => s.id === b)!.roleId).toBe(bo);
    expect(removed.layout.shapes[b]!.y).toBe(state.layout.shapes[b]!.y - 160);
  });
});

describe('selection operations', () => {
  it('deletes shapes with their lines without bridging', () => {
    const state = { model: validModel(), layout: ensureLayout(validModel()) };
    const r = applyDiagramEdit(state, { type: 'delete', ids: ['t2'] }).state;
    expect(r.model.steps.some((s) => s.id === 't2')).toBe(false);
    expect(r.model.flows.some((f) => f.from === 't2' || f.to === 't2')).toBe(false);
    expect(r.model.flows.some((f) => f.from === 't1' && f.to === 'd')).toBe(false);
    expect(Object.keys(r.layout.flows).sort()).toEqual(r.model.flows.map((f) => f.id).sort());
  });

  it('copies and pastes with new ids, internal flows only, offset', () => {
    const state = { model: validModel(), layout: ensureLayout(validModel()) };
    const clip = copySelection(state, ['t1', 't2']);
    expect(clip.flows.map((f) => f.id)).toEqual(['f2']);
    const { state: pasted, created } = applyDiagramEdit(state, { type: 'paste', clip, dx: 20, dy: 20 });
    expect(created).toHaveLength(2);
    expect(pasted.model.steps).toHaveLength(8);
    const copy = pasted.model.steps.find((s) => s.id === created[0])!;
    expect(copy.name).toBe('Intake');
    expect(pasted.layout.shapes[copy.id]!.x).toBe(state.layout.shapes.t1!.x + 20);
    expect(new Set(pasted.model.flows.map((f) => f.id)).size).toBe(pasted.model.flows.length);
  });

  it('aligns and distributes', () => {
    let state = empty();
    for (const [x, y] of [
      [0, 0],
      [300, 37],
      [800, 12],
    ] as const)
      state = applyDiagramEdit(state, { type: 'add', kind: 'task', x, y }).state;
    const ids = state.model.steps.map((s) => s.id);
    const aligned = applyDiagramEdit(state, { type: 'align', ids, mode: 'top' }).state;
    expect(new Set(ids.map((id) => aligned.layout.shapes[id]!.y)).size).toBe(1);
    const spread = applyDiagramEdit(aligned, { type: 'distribute', ids, axis: 'horizontal' }).state;
    const xs = ids.map((id) => spread.layout.shapes[id]!.x);
    expect(xs[1]! - xs[0]!).toBe(xs[2]! - xs[1]!);
  });
});

describe('layout for existing models', () => {
  it('tidies an imported model into lanes with glued flows', () => {
    const layout = tidyLayout(validModel());
    expect(Object.keys(layout.shapes).sort()).toEqual(
      validModel()
        .steps.map((s) => s.id)
        .sort(),
    );
    expect(layout.lanes.map((l) => l.roleId)).toEqual(['r1', 'r2']);
    expect(Object.keys(layout.flows).sort()).toEqual(
      validModel()
        .flows.map((f) => f.id)
        .sort(),
    );
    for (const r of Object.values(layout.shapes)) expect((r.x + r.width / 2) % 10).toBe(0);
  });

  it('completes a stored layout after the model changed and drops stale entries', () => {
    const model = validModel();
    const stored = tidyLayout(model);
    stored.shapes.t1 = { x: 999, y: 10, width: 160, height: 70 };
    const changed: ProcessModel = {
      ...model,
      steps: [
        ...model.steps.filter((s) => s.id !== 't3'),
        { id: 'n', type: 'TASK', name: 'Nieuw', roleId: 'r1' },
      ],
    };
    changed.flows = changed.flows
      .filter((f) => f.from !== 't3' && f.to !== 't3')
      .concat({ id: 'fn', from: 'd', to: 'n' }, { id: 'fe', from: 'n', to: 'e' });
    const layout = ensureLayout(changed, stored);
    expect(layout.shapes.t1).toEqual({ x: 999, y: 10, width: 160, height: 70 });
    expect(layout.shapes.n).toBeDefined();
    expect(layout.shapes.t3).toBeUndefined();
    expect(layout.flows.fn).toBeDefined();
    expect(layout.flows.f4).toBeUndefined();
  });

  it('keeps step ids, times and roles through a drawing round trip', () => {
    const model = validModel();
    let state: DiagramState = { model, layout: ensureLayout(model) };
    state = applyDiagramEdit(state, { type: 'move', ids: ['t3'], dx: 40, dy: 0 }).state;
    state = applyDiagramEdit(state, { type: 'setText', id: 't3', text: 'Toekennen en informeren' }).state;
    expect(state.model.steps.map((s) => s.id)).toEqual(model.steps.map((s) => s.id));
    expect(state.model.steps.find((s) => s.id === 't1')).toEqual(model.steps.find((s) => s.id === 't1'));
    expect(state.model.steps.find((s) => s.id === 't3')).toMatchObject({
      processingTime: 15,
      roleId: 'r1',
      name: 'Toekennen en informeren',
    });
  });
});
