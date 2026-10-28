import { describe, expect, it } from 'vitest';
import type { Map as LibreMap } from 'maplibre-gl';
import {
  clipRoute,
  FootprintIndex,
  type MarkerFootprint,
  occludedInterval,
} from './map-line-clipping';

const map = {
  project: ([x, y]: number[]) => ({ x, y }),
  unproject: ([lng, lat]: number[]) => ({ lng, lat }),
} as unknown as Pick<LibreMap, 'project' | 'unproject'>;
describe('render-only cable clipping', () => {
  it.each([
    { width: 32, height: 32, radius: 16 },
    { width: 32, height: 32, radius: 7 },
    { width: 48, height: 32, radius: 16 },
    { width: 18, height: 22, radius: 1.5 },
  ])('removes cable inside a footprint %o without changing canonical geometry', (shape) => {
    const points = [
        [0, 50],
        [50, 50],
        [100, 50],
      ],
      original = structuredClone(points);
    const index = new FootprintIndex([{ center: { x: 50, y: 50 }, ...shape }], 200, 200, 0);
    const pieces = clipRoute(points, map, index);
    expect(pieces).toHaveLength(2);
    expect(pieces[0].at(-1)![0]).toBeCloseTo(50 - shape.width / 2);
    expect(pieces[1][0][0]).toBeCloseTo(50 + shape.width / 2);
    expect(points).toEqual(original);
  });
  it('clips every approaching cable at a shared node and preserves ordinary bends', () => {
    const index = new FootprintIndex(
      [{ center: { x: 50, y: 50 }, width: 32, height: 32, radius: 16 }],
      200,
      200,
      0,
    );
    for (const start of [
      [0, 50],
      [50, 0],
      [0, 0],
      [100, 100],
    ]) {
      const piece = clipRoute([start, [50, 50]], map, index)[0];
      expect(Math.hypot(piece.at(-1)![0] - 50, piece.at(-1)![1] - 50)).toBeGreaterThanOrEqual(15.8);
    }
    expect(
      clipRoute(
        [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
        map,
        index,
      ),
    ).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
    ]);
  });
  it('merges overlapping occluders, skips zero segments and bounds world-spanning grid work', () => {
    const footprints: MarkerFootprint[] = [40, 50].map((x) => ({
      center: { x, y: 50 },
      width: 32,
      height: 32,
      radius: 16,
    }));
    const index = new FootprintIndex(footprints, 200, 200, 0);
    const pieces = clipRoute(
      [
        [-1e9, 50],
        [1e9, 50],
      ],
      map,
      index,
    );
    expect(pieces).toHaveLength(2);
    expect(pieces[0].at(-1)![0]).toBeCloseTo(24, 3);
    expect(pieces[1][0][0]).toBeCloseTo(66, 3);
    expect(
      clipRoute(
        [
          [0, 0],
          [0, 0],
          [10, 0],
        ],
        map,
        index,
      ),
    ).toEqual([
      [
        [0, 0],
        [10, 0],
      ],
    ]);
    expect(occludedInterval({ x: 50, y: 50 }, { x: 50, y: 50 }, index.polygons[0])).not.toBeNull();
  });
});
