import { describe, expect, it } from 'vitest';
import {
  alignmentGuides,
  connectionSides,
  laneAt,
  laneBands,
  nearestSide,
  snap,
} from '../../../src/core/diagram';

describe('geometry', () => {
  it('snaps to the 10 px grid', () => {
    expect([snap(14), snap(15), snap(-6), snap(0)]).toEqual([10, 20, -10, 0]);
  });

  it('stacks lanes and finds the lane of a position', () => {
    const lanes = [
      { roleId: 'a', height: 100 },
      { roleId: 'b', height: 150 },
    ];
    expect(laneBands(lanes).map((b) => b.y)).toEqual([0, 100]);
    expect(laneAt(lanes, 0)).toBe('a');
    expect(laneAt(lanes, 99.9)).toBe('a');
    expect(laneAt(lanes, 100)).toBe('b');
    expect(laneAt(lanes, 250)).toBeUndefined();
  });

  it('finds the nearest side and good connection sides', () => {
    const r = { x: 0, y: 0, width: 100, height: 50 };
    expect(nearestSide(r, { x: 50, y: 2 })).toBe('top');
    expect(nearestSide(r, { x: 98, y: 25 })).toBe('right');
    expect(connectionSides(r, { x: 300, y: 10, width: 100, height: 50 })).toEqual({
      sourceSide: 'right',
      targetSide: 'left',
    });
    expect(connectionSides(r, { x: 0, y: 200, width: 100, height: 50 })).toEqual({
      sourceSide: 'bottom',
      targetSide: 'top',
    });
  });

  it('snaps to alignment guides before the grid', () => {
    const other = { x: 200, y: 103, width: 100, height: 60 };
    const r = alignmentGuides({ x: 0, y: 100, width: 100, height: 60 }, [other], 5);
    expect(r.y).toBe(103);
    expect(r.guides).toEqual([{ orientation: 'horizontal', position: 103, from: 0, to: 300 }]);
    expect(r.x).toBe(0);
  });

  it('aligns centres and falls back to the grid outside the threshold', () => {
    const other = { x: 0, y: 300, width: 160, height: 70 };
    const centred = alignmentGuides({ x: 32, y: 0, width: 100, height: 60 }, [other], 5);
    expect(centred.x).toBe(30);
    expect(centred.guides[0]).toMatchObject({ orientation: 'vertical', position: 80 });
    const far = alignmentGuides({ x: 44, y: 7, width: 100, height: 60 }, [other], 5);
    expect(far).toEqual({ x: 40, y: 10, guides: [] });
  });
});
