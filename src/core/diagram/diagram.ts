import { layoutModel } from '../layout';
import { addFlow } from '../model/edit';
import type { Flow, ProcessModel, Role, Step, StepMarker, StepType } from '../model/types';
import { centre, connectionSides, laneAt, laneBands, snap } from './geometry';

function centred(cx: number, cy: number, size: { width: number; height: number }) {
  return { x: snap(cx) - size.width / 2, y: snap(cy) - size.height / 2, ...size };
}
import {
  DEFAULT_SIZE,
  emptyLayout,
  GRID,
  LANE_HEADER,
  type Annotation,
  type DataShape,
  type DiagramLayout,
  type FlowLayout,
  type Rect,
  type ShapeKind,
  type Side,
} from './types';

// Editing operations of the drawing editor (SPEC §2.2a, §3.0). Every operation takes the model and
// its layout together and returns both, so the drawing can never drift from the model.

export interface DiagramState {
  model: ProcessModel;
  layout: DiagramLayout;
}

export interface EditResult {
  state: DiagramState;
  /** Ids of items created by the edit (to select them). */
  created: string[];
}

export const DEFAULT_LANE_HEIGHT = 160;
const QUICK_GAP = 60;

const KIND_TO_STEP: Record<
  Exclude<ShapeKind, 'data' | 'note'>,
  { type: StepType; marker?: StepMarker; name: string }
> = {
  start: { type: 'START', name: 'Start' },
  end: { type: 'END', name: 'Einde' },
  task: { type: 'TASK', name: 'Nieuwe taak' },
  decision: { type: 'DECISION', name: 'Beslissing?' },
  subprocess: { type: 'TASK', marker: 'SUBPROCESS', name: 'Subproces' },
  document: { type: 'TASK', marker: 'DOCUMENT', name: 'Document' },
  manual: { type: 'TASK', marker: 'MANUAL_INPUT', name: 'Handmatige invoer' },
  wait: { type: 'TASK', marker: 'WAIT', name: 'Wachten' },
};

export function isStepKind(kind: ShapeKind): kind is Exclude<ShapeKind, 'data' | 'note'> {
  return kind !== 'data' && kind !== 'note';
}

export function kindOf(step: Step): ShapeKind {
  if (step.type === 'START') return 'start';
  if (step.type === 'END') return 'end';
  if (step.type === 'DECISION') return 'decision';
  switch (step.marker) {
    case 'SUBPROCESS':
      return 'subprocess';
    case 'DOCUMENT':
      return 'document';
    case 'MANUAL_INPUT':
      return 'manual';
    case 'WAIT':
      return 'wait';
    default:
      return 'task';
  }
}

function usedIds(state: DiagramState): Set<string> {
  const { model, layout } = state;
  return new Set([
    ...model.steps.map((s) => s.id),
    ...model.flows.map((f) => f.id),
    ...model.roles.map((r) => r.id),
    ...layout.annotations.map((a) => a.id),
    ...layout.dataShapes.map((d) => d.id),
  ]);
}

function nextId(prefix: string, used: Set<string>): string {
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  used.add(`${prefix}${n}`);
  return `${prefix}${n}`;
}

/** Fresh layout from the automatic layout (also the "Netjes zetten" action). */
export function tidyLayout(model: ProcessModel, previous?: DiagramLayout): DiagramLayout {
  const auto = layoutModel(model);
  const layout = emptyLayout();
  for (const n of auto.nodes) {
    const step = model.steps.find((s) => s.id === n.id)!;
    const size = DEFAULT_SIZE[kindOf(step)];
    layout.shapes[n.id] = centred(n.x + n.width / 2, n.y + n.height / 2, size);
  }
  layout.lanes = auto.lanes
    .filter((l) => model.roles.some((r) => r.id === l.id))
    .map((l) => ({ roleId: l.id, height: snap(l.height) }));
  // Steps in the automatic "no role" lane end up below the role lanes: keep them visible there.
  for (const f of model.flows)
    layout.flows[f.id] = connectionSides(layout.shapes[f.from]!, layout.shapes[f.to]!);
  if (previous) {
    layout.annotations = previous.annotations;
    layout.dataShapes = previous.dataShapes;
  }
  return layout;
}

/**
 * Completes a stored layout for the current model: positions for new steps (from the automatic
 * layout), sides for new flows, a lane for every role; entries for deleted items are dropped.
 */
export function ensureLayout(model: ProcessModel, stored?: DiagramLayout | null): DiagramLayout {
  if (!stored) return tidyLayout(model);
  const auto = tidyLayout(model);
  const layout: DiagramLayout = {
    ...emptyLayout(),
    annotations: [...stored.annotations],
    dataShapes: [...stored.dataShapes],
  };
  for (const s of model.steps) layout.shapes[s.id] = stored.shapes[s.id] ?? auto.shapes[s.id]!;
  for (const f of model.flows) {
    layout.flows[f.id] = stored.flows[f.id] ?? connectionSides(layout.shapes[f.from]!, layout.shapes[f.to]!);
  }
  const roleIds = new Set(model.roles.map((r) => r.id));
  layout.lanes = stored.lanes.filter((l) => roleIds.has(l.roleId));
  for (const r of model.roles) {
    if (!layout.lanes.some((l) => l.roleId === r.id))
      layout.lanes.push({ roleId: r.id, height: DEFAULT_LANE_HEIGHT });
  }
  const stepIds = new Set(model.steps.map((s) => s.id));
  layout.dataShapes = layout.dataShapes.map((d) =>
    d.attachedTo && !stepIds.has(d.attachedTo) ? { ...d, attachedTo: null } : d,
  );
  return layout;
}

/** Width of the drawing (lanes stretch to it). */
export function drawingWidth(layout: DiagramLayout): number {
  const rights = [
    ...Object.values(layout.shapes).map((r) => r.x + r.width),
    ...layout.annotations.map((a) => a.x + a.width),
    ...layout.dataShapes.map((d) => d.x + d.width),
  ];
  return Math.max(1200, snap(Math.max(0, ...rights) + 240));
}

/** Re-derives the role of the given steps from the lane their centre is in. */
function assignRoles(model: ProcessModel, layout: DiagramLayout, ids?: Iterable<string>): ProcessModel {
  if (layout.lanes.length === 0) return model;
  const only = ids ? new Set(ids) : null;
  return {
    ...model,
    steps: model.steps.map((s) => {
      if (only && !only.has(s.id)) return s;
      const rect = layout.shapes[s.id];
      if (!rect) return s;
      const roleId = laneAt(layout.lanes, centre(rect).y);
      if (roleId === s.roleId) return s;
      const { roleId: _old, ...rest } = s;
      return roleId ? { ...rest, roleId } : rest;
    }),
  };
}

/** Writes data-shape labels to `system` of the attached task. */
function applyDataShapes(model: ProcessModel, layout: DiagramLayout): ProcessModel {
  const bySystem = new Map(
    layout.dataShapes.filter((d) => d.attachedTo).map((d) => [d.attachedTo!, d.label.trim()]),
  );
  if (bySystem.size === 0) return model;
  return {
    ...model,
    steps: model.steps.map((s) =>
      bySystem.has(s.id) && bySystem.get(s.id) ? { ...s, system: bySystem.get(s.id)! } : s,
    ),
  };
}

function itemRect(layout: DiagramLayout, id: string): Rect | undefined {
  return (
    layout.shapes[id] ??
    layout.annotations.find((a) => a.id === id) ??
    layout.dataShapes.find((d) => d.id === id)
  );
}

function setItemRect(layout: DiagramLayout, id: string, rect: Rect): DiagramLayout {
  if (layout.shapes[id]) return { ...layout, shapes: { ...layout.shapes, [id]: rect } };
  return {
    ...layout,
    annotations: layout.annotations.map((a) => (a.id === id ? { ...a, ...rect } : a)),
    dataShapes: layout.dataShapes.map((d) => (d.id === id ? { ...d, ...rect } : d)),
  };
}

/** Clipboard content: steps, the flows between them, their geometry and visual items. */
export interface Clip {
  steps: Step[];
  flows: Flow[];
  shapes: Record<string, Rect>;
  annotations: Annotation[];
  dataShapes: DataShape[];
}

export function copySelection(state: DiagramState, ids: string[]): Clip {
  const set = new Set(ids);
  const steps = state.model.steps.filter((s) => set.has(s.id));
  const stepIds = new Set(steps.map((s) => s.id));
  return {
    steps: structuredClone(steps),
    flows: structuredClone(state.model.flows.filter((f) => stepIds.has(f.from) && stepIds.has(f.to))),
    shapes: Object.fromEntries(steps.map((s) => [s.id, { ...state.layout.shapes[s.id]! }])),
    annotations: structuredClone(state.layout.annotations.filter((a) => set.has(a.id))),
    dataShapes: structuredClone(state.layout.dataShapes.filter((d) => set.has(d.id))).map((d) => ({
      ...d,
      attachedTo: d.attachedTo && stepIds.has(d.attachedTo) ? d.attachedTo : null,
    })),
  };
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'middle' | 'bottom';

export type DiagramEdit =
  | { type: 'add'; kind: ShapeKind; x: number; y: number; text?: string }
  | { type: 'move'; ids: string[]; dx: number; dy: number }
  | { type: 'setRect'; id: string; rect: Rect }
  | { type: 'setText'; id: string; text: string }
  | { type: 'delete'; ids: string[] }
  | { type: 'connect'; from: string; to: string; sourceSide?: Side; targetSide?: Side }
  | { type: 'updateStep'; id: string; patch: Partial<Omit<Step, 'id'>> }
  | { type: 'updateFlow'; id: string; patch: Partial<Pick<Flow, 'label' | 'probability'>> }
  | { type: 'setFlowSides'; id: string; sides: FlowLayout }
  | { type: 'updateData'; id: string; patch: Partial<Pick<DataShape, 'label' | 'attachedTo'>> }
  | { type: 'quickAdd'; from: string; direction: Side; kind: ShapeKind }
  | { type: 'addLane'; name: string }
  | { type: 'renameLane'; roleId: string; name: string }
  | { type: 'removeLane'; roleId: string }
  | { type: 'moveLane'; roleId: string; delta: -1 | 1 }
  | { type: 'resizeLane'; roleId: string; height: number }
  | { type: 'paste'; clip: Clip; dx: number; dy: number }
  | { type: 'align'; ids: string[]; mode: AlignMode }
  | { type: 'distribute'; ids: string[]; axis: 'horizontal' | 'vertical' }
  | { type: 'tidy' };

/**
 * Moves every item along with its lane when lanes are reordered, resized or removed: an item keeps
 * its offset inside its own band. Items below all lanes follow the bottom edge.
 */
function rebandItems(layout: DiagramLayout, nextLanes: DiagramLayout['lanes']): DiagramLayout {
  const before = laneBands(layout.lanes);
  const after = new Map(laneBands(nextLanes).map((b) => [b.roleId, b.y]));
  const oldBottom = before.reduce((acc, b) => acc + b.height, 0);
  const newBottom = nextLanes.reduce((acc, l) => acc + l.height, 0);
  const shift = <T extends Rect>(r: T): T => {
    const c = centre(r).y;
    const band = before.find((b) => c >= b.y && c < b.y + b.height);
    if (band) {
      const target = after.get(band.roleId);
      return target === undefined ? r : { ...r, y: r.y + (target - band.y) };
    }
    return c >= oldBottom ? { ...r, y: r.y + (newBottom - oldBottom) } : r;
  };
  return {
    ...layout,
    lanes: nextLanes,
    shapes: Object.fromEntries(Object.entries(layout.shapes).map(([id, r]) => [id, shift(r)])),
    annotations: layout.annotations.map(shift),
    dataShapes: layout.dataShapes.map(shift),
  };
}

export function applyDiagramEdit(state: DiagramState, edit: DiagramEdit): EditResult {
  const { model, layout } = state;
  const done = (m: ProcessModel, l: DiagramLayout, created: string[] = []): EditResult => ({
    state: { model: m, layout: l },
    created,
  });

  switch (edit.type) {
    case 'add': {
      const used = usedIds(state);
      const size = DEFAULT_SIZE[edit.kind];
      const rect = centred(edit.x, edit.y, size);
      if (edit.kind === 'note') {
        const id = nextId('notitie', used);
        return done(
          model,
          { ...layout, annotations: [...layout.annotations, { id, text: edit.text ?? 'Notitie', ...rect }] },
          [id],
        );
      }
      if (edit.kind === 'data') {
        const id = nextId('gegevens', used);
        return done(
          model,
          {
            ...layout,
            dataShapes: [
              ...layout.dataShapes,
              { id, label: edit.text ?? 'Systeem', attachedTo: null, ...rect },
            ],
          },
          [id],
        );
      }
      const spec = KIND_TO_STEP[edit.kind];
      const id = nextId('stap', used);
      const step: Step = {
        id,
        type: spec.type,
        name: edit.text ?? spec.name,
        ...(spec.marker ? { marker: spec.marker } : {}),
      };
      const nextLayout = { ...layout, shapes: { ...layout.shapes, [id]: rect } };
      return done(assignRoles({ ...model, steps: [...model.steps, step] }, nextLayout, [id]), nextLayout, [
        id,
      ]);
    }

    case 'move': {
      let next = layout;
      for (const id of edit.ids) {
        const r = itemRect(next, id);
        if (r)
          next = setItemRect(next, id, {
            x: r.x + edit.dx,
            y: r.y + edit.dy,
            width: r.width,
            height: r.height,
          });
      }
      return done(assignRoles(model, next, edit.ids), next);
    }

    case 'setRect': {
      const rect = {
        x: edit.rect.x,
        y: edit.rect.y,
        width: Math.max(GRID * 4, edit.rect.width),
        height: Math.max(GRID * 3, edit.rect.height),
      };
      const next = setItemRect(layout, edit.id, rect);
      return done(assignRoles(model, next, [edit.id]), next);
    }

    case 'setText': {
      if (model.steps.some((s) => s.id === edit.id)) {
        return done(
          { ...model, steps: model.steps.map((s) => (s.id === edit.id ? { ...s, name: edit.text } : s)) },
          layout,
        );
      }
      const nextLayout = {
        ...layout,
        annotations: layout.annotations.map((a) => (a.id === edit.id ? { ...a, text: edit.text } : a)),
        dataShapes: layout.dataShapes.map((d) => (d.id === edit.id ? { ...d, label: edit.text } : d)),
      };
      return done(applyDataShapes(model, nextLayout), nextLayout);
    }

    case 'delete': {
      const ids = new Set(edit.ids);
      // In a drawing, deleting a shape removes its lines; nothing is bridged.
      let m: ProcessModel = {
        ...model,
        steps: model.steps.filter((s) => !ids.has(s.id)),
        flows: model.flows.filter((f) => !ids.has(f.id) && !ids.has(f.from) && !ids.has(f.to)),
      };
      const keptFlows = new Set(m.flows.map((f) => f.id));
      const shapes = Object.fromEntries(Object.entries(layout.shapes).filter(([id]) => !ids.has(id)));
      const flows = Object.fromEntries(Object.entries(layout.flows).filter(([id]) => keptFlows.has(id)));
      for (const f of m.flows) flows[f.id] ??= connectionSides(shapes[f.from]!, shapes[f.to]!);
      const removedData = layout.dataShapes.filter((d) => ids.has(d.id));
      m = {
        ...m,
        steps: m.steps.map((s) => {
          const gone = removedData.find((d) => d.attachedTo === s.id && d.label.trim() === s.system);
          if (!gone) return s;
          const { system: _system, ...rest } = s;
          return rest;
        }),
      };
      return done(m, {
        ...layout,
        shapes,
        flows,
        annotations: layout.annotations.filter((a) => !ids.has(a.id)),
        dataShapes: layout.dataShapes
          .filter((d) => !ids.has(d.id))
          .map((d) => (d.attachedTo && ids.has(d.attachedTo) ? { ...d, attachedTo: null } : d)),
      });
    }

    case 'connect': {
      const from = model.steps.find((s) => s.id === edit.from);
      const to = model.steps.find((s) => s.id === edit.to);
      if (!from || !to || from.type === 'END' || to.type === 'START') return done(model, layout);
      const m = addFlow(model, edit.from, edit.to);
      if (m === model) return done(model, layout);
      const flow = m.flows[m.flows.length - 1]!;
      const auto = connectionSides(layout.shapes[edit.from]!, layout.shapes[edit.to]!);
      const sides = {
        sourceSide: edit.sourceSide ?? auto.sourceSide,
        targetSide: edit.targetSide ?? auto.targetSide,
      };
      return done(m, { ...layout, flows: { ...layout.flows, [flow.id]: sides } }, [flow.id]);
    }

    case 'updateStep': {
      const m: ProcessModel = {
        ...model,
        steps: model.steps.map((s) => {
          if (s.id !== edit.id) return s;
          const next = { ...s, ...edit.patch } as Step;
          for (const key of Object.keys(next) as (keyof Step)[]) {
            if (key !== 'name' && (next[key] === undefined || next[key] === '')) delete next[key];
          }
          return next;
        }),
      };
      return done(m, layout);
    }

    case 'updateFlow': {
      const m: ProcessModel = {
        ...model,
        flows: model.flows.map((f) => {
          if (f.id !== edit.id) return f;
          const next: Flow = { ...f, ...edit.patch };
          if (!next.label) delete next.label;
          if (next.probability === undefined || Number.isNaN(next.probability)) delete next.probability;
          return next;
        }),
      };
      return done(m, layout);
    }

    case 'setFlowSides':
      return done(model, { ...layout, flows: { ...layout.flows, [edit.id]: edit.sides } });

    case 'updateData': {
      const nextLayout = {
        ...layout,
        dataShapes: layout.dataShapes.map((d) => (d.id === edit.id ? { ...d, ...edit.patch } : d)),
      };
      return done(applyDataShapes(model, nextLayout), nextLayout);
    }

    case 'quickAdd': {
      const source = layout.shapes[edit.from];
      const fromStep = model.steps.find((s) => s.id === edit.from);
      if (!source || !fromStep || fromStep.type === 'END' || !isStepKind(edit.kind))
        return done(model, layout);
      const size = DEFAULT_SIZE[edit.kind];
      const c = centre(source);
      const offset = {
        right: { x: source.x + source.width + QUICK_GAP + size.width / 2, y: c.y },
        left: { x: source.x - QUICK_GAP - size.width / 2, y: c.y },
        bottom: { x: c.x, y: source.y + source.height + QUICK_GAP + size.height / 2 },
        top: { x: c.x, y: source.y - QUICK_GAP - size.height / 2 },
      }[edit.direction];
      const added = applyDiagramEdit(state, { type: 'add', kind: edit.kind, x: offset.x, y: offset.y });
      const newId = added.created[0]!;
      const opposite: Record<Side, Side> = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' };
      const connected = applyDiagramEdit(added.state, {
        type: 'connect',
        from: edit.from,
        to: newId,
        sourceSide: edit.direction,
        targetSide: opposite[edit.direction],
      });
      return { state: connected.state, created: [newId] };
    }

    case 'addLane': {
      const used = usedIds(state);
      const id = nextId('rol', used);
      const role: Role = { id, name: edit.name.trim() || 'Nieuwe baan' };
      const nextLayout = { ...layout, lanes: [...layout.lanes, { roleId: id, height: DEFAULT_LANE_HEIGHT }] };
      // The first lane claims the steps that are in its band.
      return done(assignRoles({ ...model, roles: [...model.roles, role] }, nextLayout), nextLayout, [id]);
    }

    case 'renameLane':
      return done(
        { ...model, roles: model.roles.map((r) => (r.id === edit.roleId ? { ...r, name: edit.name } : r)) },
        layout,
      );

    case 'removeLane': {
      if (!layout.lanes.some((l) => l.roleId === edit.roleId)) return done(model, layout);
      const next = rebandItems(
        layout,
        layout.lanes.filter((l) => l.roleId !== edit.roleId),
      );
      const m: ProcessModel = {
        ...model,
        roles: model.roles.filter((r) => r.id !== edit.roleId),
        steps: model.steps.map((s) => {
          if (s.roleId !== edit.roleId) return s;
          const { roleId: _r, ...rest } = s;
          return rest;
        }),
      };
      return done(assignRoles(m, next), next);
    }

    case 'moveLane': {
      const i = layout.lanes.findIndex((l) => l.roleId === edit.roleId);
      const j = i + edit.delta;
      if (i < 0 || j < 0 || j >= layout.lanes.length) return done(model, layout);
      const lanes = [...layout.lanes];
      [lanes[i], lanes[j]] = [lanes[j]!, lanes[i]!];
      const next = rebandItems(layout, lanes);
      return done(assignRoles(model, next), next);
    }

    case 'resizeLane': {
      if (!layout.lanes.some((l) => l.roleId === edit.roleId)) return done(model, layout);
      const height = Math.max(GRID * 8, snap(edit.height));
      const next = rebandItems(
        layout,
        layout.lanes.map((l) => (l.roleId === edit.roleId ? { ...l, height } : l)),
      );
      return done(assignRoles(model, next), next);
    }

    case 'paste': {
      const used = usedIds(state);
      const idMap = new Map<string, string>();
      const steps: Step[] = edit.clip.steps.map((s) => {
        const id = nextId('stap', used);
        idMap.set(s.id, id);
        return { ...structuredClone(s), id };
      });
      const flows: Flow[] = edit.clip.flows.map((f) => ({
        ...f,
        id: nextId('f', used),
        from: idMap.get(f.from)!,
        to: idMap.get(f.to)!,
      }));
      const shapes = { ...layout.shapes };
      for (const [old, rect] of Object.entries(edit.clip.shapes))
        shapes[idMap.get(old)!] = { ...rect, x: rect.x + edit.dx, y: rect.y + edit.dy };
      const flowLayouts = { ...layout.flows };
      for (const f of flows) flowLayouts[f.id] = connectionSides(shapes[f.from]!, shapes[f.to]!);
      const annotations = edit.clip.annotations.map((a) => ({
        ...a,
        id: nextId('notitie', used),
        x: a.x + edit.dx,
        y: a.y + edit.dy,
      }));
      const dataShapes = edit.clip.dataShapes.map((d) => ({
        ...d,
        id: nextId('gegevens', used),
        x: d.x + edit.dx,
        y: d.y + edit.dy,
        attachedTo: d.attachedTo ? (idMap.get(d.attachedTo) ?? null) : null,
      }));
      const nextLayout: DiagramLayout = {
        ...layout,
        shapes,
        flows: flowLayouts,
        annotations: [...layout.annotations, ...annotations],
        dataShapes: [...layout.dataShapes, ...dataShapes],
      };
      const created = [
        ...steps.map((s) => s.id),
        ...annotations.map((a) => a.id),
        ...dataShapes.map((d) => d.id),
      ];
      const m = assignRoles(
        { ...model, steps: [...model.steps, ...steps], flows: [...model.flows, ...flows] },
        nextLayout,
        created,
      );
      return done(m, nextLayout, created);
    }

    case 'align': {
      const rects = edit.ids
        .map((id) => [id, itemRect(layout, id)] as const)
        .filter((x): x is readonly [string, Rect] => !!x[1]);
      if (rects.length < 2) return done(model, layout);
      const all = rects.map(([, r]) => r);
      const target = {
        left: Math.min(...all.map((r) => r.x)),
        right: Math.max(...all.map((r) => r.x + r.width)),
        centerX: (Math.min(...all.map((r) => r.x)) + Math.max(...all.map((r) => r.x + r.width))) / 2,
        top: Math.min(...all.map((r) => r.y)),
        bottom: Math.max(...all.map((r) => r.y + r.height)),
        middle: (Math.min(...all.map((r) => r.y)) + Math.max(...all.map((r) => r.y + r.height))) / 2,
      }[edit.mode];
      let next = layout;
      for (const [id, r] of rects) {
        const moved = { ...r };
        if (edit.mode === 'left') moved.x = target;
        if (edit.mode === 'right') moved.x = target - r.width;
        if (edit.mode === 'centerX') moved.x = snap(target - r.width / 2, 1);
        if (edit.mode === 'top') moved.y = target;
        if (edit.mode === 'bottom') moved.y = target - r.height;
        if (edit.mode === 'middle') moved.y = snap(target - r.height / 2, 1);
        next = setItemRect(next, id, { x: moved.x, y: moved.y, width: r.width, height: r.height });
      }
      return done(assignRoles(model, next, edit.ids), next);
    }

    case 'distribute': {
      const horizontal = edit.axis === 'horizontal';
      const rects = edit.ids
        .map((id) => [id, itemRect(layout, id)] as const)
        .filter((x): x is readonly [string, Rect] => !!x[1])
        .sort((a, b) => (horizontal ? a[1].x - b[1].x : a[1].y - b[1].y));
      if (rects.length < 3) return done(model, layout);
      const first = rects[0]![1];
      const last = rects[rects.length - 1]![1];
      const total = rects.reduce((acc, [, r]) => acc + (horizontal ? r.width : r.height), 0);
      const span = horizontal ? last.x + last.width - first.x : last.y + last.height - first.y;
      const gap = (span - total) / (rects.length - 1);
      let pos = horizontal ? first.x : first.y;
      let next = layout;
      for (const [id, r] of rects) {
        next = setItemRect(
          next,
          id,
          horizontal ? { ...r, x: Math.round(pos) } : { ...r, y: Math.round(pos) },
        );
        pos += (horizontal ? r.width : r.height) + gap;
      }
      return done(assignRoles(model, next, edit.ids), next);
    }

    case 'tidy':
      return done(model, tidyLayout(model, layout));
  }
}

/** Shape rectangles of the lanes (for drawing and hit tests). */
export function laneRects(layout: DiagramLayout): Array<{ roleId: string } & Rect> {
  const width = drawingWidth(layout);
  return laneBands(layout.lanes).map((b) => ({ roleId: b.roleId, x: 0, y: b.y, width, height: b.height }));
}

export { LANE_HEADER };
