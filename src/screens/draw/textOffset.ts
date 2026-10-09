import type { ShapeKind } from '../../core/diagram';

/** Vertical offset of the text area within shapes whose usable area is not centred. */
export function textOffset(kind: ShapeKind, height: number): number {
  if (kind === 'manual' || kind === 'data') return height * 0.1;
  if (kind === 'document') return -height * 0.07;
  return 0;
}
