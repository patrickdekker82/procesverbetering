// Diagram layout on top of the process model (SPEC §3.0). The model stays the single source of
// truth; the layout only stores geometry and visual-only items, keyed by step and flow ids.

export type Side = 'top' | 'right' | 'bottom' | 'left';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ShapeLayout = Rect;

export interface FlowLayout {
  sourceSide: Side;
  targetSide: Side;
}

/** Lanes are horizontal bands stacked from y = 0 in array order. */
export interface LaneLayout {
  roleId: string;
  height: number;
}

/** Visual only: never part of the model, the analysis or AI input. */
export interface Annotation extends Rect {
  id: string;
  text: string;
}

/** Data/system shape: its label is written to `system` of the attached task. */
export interface DataShape extends Rect {
  id: string;
  label: string;
  attachedTo: string | null;
}

export interface DiagramLayout {
  version: 1;
  shapes: Record<string, ShapeLayout>;
  flows: Record<string, FlowLayout>;
  lanes: LaneLayout[];
  annotations: Annotation[];
  dataShapes: DataShape[];
}

export const GRID = 10;
export const LANE_HEADER = 150;
export const FONT_SIZE = 13;
export const MIN_FONT_SIZE = 10;
export const LINE_HEIGHT = 1.3;
export const TEXT_PADDING = 8;
export const MAX_LINES = 4;

/** Palette items (SPEC §2.2a). */
export type ShapeKind =
  'start' | 'end' | 'task' | 'decision' | 'subprocess' | 'document' | 'manual' | 'wait' | 'data' | 'note';

export const DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  start: { width: 110, height: 50 },
  end: { width: 110, height: 50 },
  task: { width: 160, height: 70 },
  decision: { width: 160, height: 110 },
  subprocess: { width: 160, height: 70 },
  document: { width: 160, height: 80 },
  manual: { width: 160, height: 70 },
  wait: { width: 110, height: 60 },
  data: { width: 120, height: 70 },
  note: { width: 160, height: 60 },
};

export function emptyLayout(): DiagramLayout {
  return { version: 1, shapes: {}, flows: {}, lanes: [], annotations: [], dataShapes: [] };
}
