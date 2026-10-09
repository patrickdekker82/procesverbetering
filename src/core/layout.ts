import type { ProcessModel, StepType } from './model/types';

// Deterministic left-to-right layout with one horizontal lane per role (SPEC §2.2). Columns follow
// the longest path from the start in the graph without back edges; loops do not move steps right.

export const LAYOUT = { columnWidth: 210, rowHeight: 110, laneHeader: 150, padding: 20 } as const;

export const NODE_SIZE: Record<StepType, { width: number; height: number }> = {
  TASK: { width: 170, height: 64 },
  DECISION: { width: 96, height: 96 },
  START: { width: 52, height: 52 },
  END: { width: 52, height: 52 },
};

export const NO_ROLE_LANE = '__geen_rol__';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  laneId: string | null;
  column: number;
}

export interface LayoutLane {
  id: string;
  name: string;
  y: number;
  height: number;
}

export interface Layout {
  nodes: LayoutNode[];
  lanes: LayoutLane[];
  width: number;
  height: number;
}

/** Edges that close a cycle, found by depth-first search from the starts in model order. */
export function backEdges(model: ProcessModel): Set<string> {
  const out = new Map<string, Array<{ id: string; to: string }>>();
  for (const f of model.flows) out.set(f.from, [...(out.get(f.from) ?? []), { id: f.id, to: f.to }]);
  const state = new Map<string, 'active' | 'done'>();
  const back = new Set<string>();
  const roots = [
    ...model.steps.filter((s) => s.type === 'START'),
    ...model.steps.filter((s) => s.type !== 'START'),
  ];
  for (const root of roots) {
    if (state.has(root.id)) continue;
    const stack: Array<{ id: string; next: number }> = [{ id: root.id, next: 0 }];
    state.set(root.id, 'active');
    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const edges = out.get(top.id) ?? [];
      if (top.next >= edges.length) {
        state.set(top.id, 'done');
        stack.pop();
        continue;
      }
      const edge = edges[top.next++]!;
      const s = state.get(edge.to);
      if (s === 'active') back.add(edge.id);
      else if (!s) {
        state.set(edge.to, 'active');
        stack.push({ id: edge.to, next: 0 });
      }
    }
  }
  return back;
}

/** Longest-path column per step in the acyclic graph (Kahn's algorithm). */
function columns(model: ProcessModel, back: Set<string>): Map<string, number> {
  const ids = model.steps.map((s) => s.id);
  const known = new Set(ids);
  const flows = model.flows.filter(
    (f) => !back.has(f.id) && known.has(f.from) && known.has(f.to) && f.from !== f.to,
  );
  const indegree = new Map(ids.map((id) => [id, 0]));
  for (const f of flows) indegree.set(f.to, (indegree.get(f.to) ?? 0) + 1);
  const column = new Map(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => indegree.get(id) === 0);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const f of flows.filter((x) => x.from === id)) {
      column.set(f.to, Math.max(column.get(f.to)!, column.get(id)! + 1));
      indegree.set(f.to, indegree.get(f.to)! - 1);
      if (indegree.get(f.to) === 0) queue.push(f.to);
    }
  }
  return column;
}

/** Role used for placement: the step's own role, or that of a neighbour for start/end/decisions. */
function placementRoles(model: ProcessModel): Map<string, string | undefined> {
  const role = new Map(model.steps.map((s) => [s.id, s.roleId]));
  for (let pass = 0; pass < model.steps.length; pass++) {
    let changed = false;
    for (const s of model.steps) {
      if (role.get(s.id)) continue;
      const preds = model.flows.filter((f) => f.to === s.id).map((f) => role.get(f.from));
      const succs = model.flows.filter((f) => f.from === s.id).map((f) => role.get(f.to));
      const candidate =
        s.type === 'START'
          ? (succs.find(Boolean) ?? preds.find(Boolean))
          : (preds.find(Boolean) ?? succs.find(Boolean));
      if (candidate) {
        role.set(s.id, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return role;
}

export function layoutModel(model: ProcessModel): Layout {
  const { columnWidth, rowHeight, laneHeader, padding } = LAYOUT;
  const back = backEdges(model);
  const column = columns(model, back);
  const hasRoles = model.roles.length > 0;
  const role = hasRoles ? placementRoles(model) : new Map<string, string | undefined>();
  const knownRoles = new Set(model.roles.map((r) => r.id));
  const laneOf = (id: string): string | null => {
    if (!hasRoles) return null;
    const r = role.get(id);
    return r && knownRoles.has(r) ? r : NO_ROLE_LANE;
  };

  const laneDefs: Array<{ id: string | null; name: string }> = hasRoles
    ? [...model.roles.map((r) => ({ id: r.id as string | null, name: r.name }))]
    : [{ id: null, name: '' }];
  if (hasRoles && model.steps.some((s) => laneOf(s.id) === NO_ROLE_LANE))
    laneDefs.push({ id: NO_ROLE_LANE, name: 'Zonder rol' });

  // Row index within each (lane, column) cell, in model order.
  const cellCount = new Map<string, number>();
  const row = new Map<string, number>();
  for (const s of model.steps) {
    const key = `${laneOf(s.id)}|${column.get(s.id)}`;
    row.set(s.id, cellCount.get(key) ?? 0);
    cellCount.set(key, (cellCount.get(key) ?? 0) + 1);
  }

  const headerWidth = hasRoles ? laneHeader : 0;
  const lanes: LayoutLane[] = [];
  const laneY = new Map<string | null, number>();
  let y = 0;
  for (const lane of laneDefs) {
    const rows = Math.max(
      1,
      ...model.steps.filter((s) => laneOf(s.id) === lane.id).map((s) => row.get(s.id)! + 1),
    );
    const height = rows * rowHeight + 2 * padding;
    laneY.set(lane.id, y);
    if (lane.id !== null) lanes.push({ id: lane.id, name: lane.name, y, height });
    y += height;
  }

  const nodes: LayoutNode[] = model.steps.map((s) => {
    const size = NODE_SIZE[s.type];
    const c = column.get(s.id)!;
    const lane = laneOf(s.id);
    return {
      id: s.id,
      column: c,
      laneId: lane,
      width: size.width,
      height: size.height,
      x: headerWidth + padding + c * columnWidth + (columnWidth - size.width) / 2,
      y: laneY.get(lane)! + padding + row.get(s.id)! * rowHeight + (rowHeight - size.height) / 2,
    };
  });
  const maxColumn = Math.max(0, ...nodes.map((n) => n.column));
  return { nodes, lanes, width: headerWidth + 2 * padding + (maxColumn + 1) * columnWidth, height: y };
}
