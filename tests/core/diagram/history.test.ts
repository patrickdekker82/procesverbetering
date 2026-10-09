import { describe, expect, it } from 'vitest';
import {
  applyDiagramEdit,
  commit,
  createHistory,
  emptyLayout,
  HISTORY_LIMIT,
  redo,
  undo,
  type DiagramEdit,
  type DiagramState,
} from '../../../src/core/diagram';

describe('undo/redo over every kind of edit', () => {
  it('restores add, move, text, label, lane and property changes in order', () => {
    const start: DiagramState = {
      model: { id: 'p', name: 'x', domain: 'KANTOOR', roles: [], steps: [], flows: [] },
      layout: emptyLayout(),
    };
    let h = createHistory(start);
    const apply = (e: DiagramEdit) => {
      const r = applyDiagramEdit(h.present, e);
      h = commit(h, r.state);
      return r.created;
    };
    apply({ type: 'addLane', name: 'Team' });
    const [a] = apply({ type: 'add', kind: 'start', x: 100, y: 80 });
    const [b] = apply({ type: 'quickAdd', from: a!, direction: 'right', kind: 'task' });
    apply({ type: 'move', ids: [b!], dx: 20, dy: 0 });
    apply({ type: 'setText', id: b!, text: 'Intake' });
    apply({ type: 'updateFlow', id: h.present.model.flows[0]!.id, patch: { label: 'nieuw' } });
    apply({ type: 'updateStep', id: b!, patch: { processingTime: 12 } });
    apply({ type: 'renameLane', roleId: h.present.model.roles[0]!.id, name: 'Intake-team' });
    const snapshots = [...h.past, h.present];
    expect(snapshots).toHaveLength(9);
    for (let i = snapshots.length - 2; i >= 0; i--) {
      h = undo(h);
      expect(h.present).toBe(snapshots[i]);
    }
    expect(undo(h)).toBe(h);
    for (let i = 1; i < snapshots.length; i++) {
      h = redo(h);
      expect(h.present).toBe(snapshots[i]);
    }
    expect(redo(h)).toBe(h);
  });

  it('drops the redo branch on a new edit and caps the history', () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = commit(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    h = undo(undo(h));
    h = commit(h, -1);
    expect(h.future).toEqual([]);
    expect(commit(h, h.present)).toBe(h);
  });
});
