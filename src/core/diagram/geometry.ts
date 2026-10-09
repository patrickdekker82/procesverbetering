import { GRID, type LaneLayout, type Rect, type Side } from './types';

export function snap(value: number, grid = GRID): number {
  return Math.round(value / grid) * grid;
}

/** Snaps the centre of a rectangle to the grid, so shapes of different sizes line up on their centres. */
export function snapCentre(r: Rect, grid = GRID): { x: number; y: number } {
  return { x: snap(r.x + r.width / 2, grid) - r.width / 2, y: snap(r.y + r.height / 2, grid) - r.height / 2 };
}

export function centre(r: Rect): { x: number; y: number } {
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Vertical bands of the lanes, stacked from y = 0. */
export function laneBands(lanes: LaneLayout[]): Array<LaneLayout & { y: number }> {
  let y = 0;
  return lanes.map((lane) => {
    const band = { ...lane, y };
    y += lane.height;
    return band;
  });
}

/** Role of the lane that contains the vertical position, or undefined outside all lanes. */
export function laneAt(lanes: LaneLayout[], y: number): string | undefined {
  return laneBands(lanes).find((b) => y >= b.y && y < b.y + b.height)?.roleId;
}

/** The side of a rectangle closest to a point (for gluing a connector dropped on a shape). */
export function nearestSide(r: Rect, p: { x: number; y: number }): Side {
  const d: Array<[Side, number]> = [
    ['top', Math.abs(p.y - r.y)],
    ['bottom', Math.abs(p.y - (r.y + r.height))],
    ['left', Math.abs(p.x - r.x)],
    ['right', Math.abs(p.x - (r.x + r.width))],
  ];
  return d.sort((a, b) => a[1] - b[1])[0]![0];
}

/** Best pair of sides to connect two shapes with an orthogonal line. */
export function connectionSides(from: Rect, to: Rect): { sourceSide: Side; targetSide: Side } {
  const a = centre(from);
  const b = centre(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceSide: 'right', targetSide: 'left' }
      : { sourceSide: 'left', targetSide: 'right' };
  }
  return dy >= 0 ? { sourceSide: 'bottom', targetSide: 'top' } : { sourceSide: 'top', targetSide: 'bottom' };
}

export interface Guide {
  orientation: 'vertical' | 'horizontal';
  /** x for vertical guides, y for horizontal ones. */
  position: number;
  from: number;
  to: number;
}

/**
 * Alignment guides while dragging: compares left/centre/right and top/middle/bottom of the moving
 * rectangle with the other rectangles. Returns the corrected position (guides win over the grid)
 * and the guide lines to draw. `threshold` is in flow units (screen px divided by zoom).
 */
export function alignmentGuides(
  moving: Rect,
  others: Rect[],
  threshold: number,
): { x: number; y: number; guides: Guide[] } {
  const xs = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width];
  const ys = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height];
  let best: { dx: number; target: number; other: Rect } | null = null;
  let bestY: { dy: number; target: number; other: Rect } | null = null;
  for (const o of others) {
    for (const mx of xs(moving)) {
      for (const ox of xs(o)) {
        const dx = ox - mx;
        if (Math.abs(dx) <= threshold && (!best || Math.abs(dx) < Math.abs(best.dx)))
          best = { dx, target: ox, other: o };
      }
    }
    for (const my of ys(moving)) {
      for (const oy of ys(o)) {
        const dy = oy - my;
        if (Math.abs(dy) <= threshold && (!bestY || Math.abs(dy) < Math.abs(bestY.dy)))
          bestY = { dy, target: oy, other: o };
      }
    }
  }
  const gridded = snapCentre(moving);
  const x = best ? moving.x + best.dx : gridded.x;
  const y = bestY ? moving.y + bestY.dy : gridded.y;
  const guides: Guide[] = [];
  if (best) {
    const top = Math.min(y, best.other.y);
    const bottom = Math.max(y + moving.height, best.other.y + best.other.height);
    guides.push({ orientation: 'vertical', position: best.target, from: top, to: bottom });
  }
  if (bestY) {
    const left = Math.min(x, bestY.other.x);
    const right = Math.max(x + moving.width, bestY.other.x + bestY.other.width);
    guides.push({ orientation: 'horizontal', position: bestY.target, from: left, to: right });
  }
  return { x, y, guides };
}

/** Rectangles that intersect a selection box (lasso). */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}
