import { describe, expect, it } from 'vitest';
import type { Map as LibreMap } from 'maplibre-gl';
import type { MapConnection } from './models/map.models';
import { installationBoundaries, previewBoundaryMove } from './map-installation-boundaries';

const map = { project: ([x, y]: number[]) => ({ x, y }) } as unknown as LibreMap;
const line = {
  vertices: [
    [10, 0],
    [20, 0],
  ],
  geometry: {
    type: 'LineString',
    coordinates: [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ],
  },
  installation_methods: ['aerial', 'duct', 'facade'],
} as MapConnection;
describe('installation boundary geometry', () => {
  it('derives handles only where neighboring methods differ', () => {
    expect(
      installationBoundaries(line, map).map((h) => [h.vertex, h.before, h.after, h.x]),
    ).toEqual([
      [1, 'aerial', 'duct', 10],
      [2, 'duct', 'facade', 20],
    ]);
    expect(installationBoundaries({ ...line, installation_methods: [] }, map)).toEqual([]);
  });
  it.each([
    ['before', 0, 0.5, [5, 0], ['aerial', 'duct', 'duct', 'facade']],
    ['after', 1, 0.5, [15, 0], ['aerial', 'aerial', 'duct', 'facade']],
  ])('moves %s while keeping all original corners', (_, segment, fraction, position, methods) => {
    const snapshot = structuredClone(line);
    const preview = previewBoundaryMove(line, 1, {
      segmentIndex: segment as number,
      fraction: fraction as number,
      position: position as [number, number],
      screen: { x: 0, y: 0 },
      distancePx: 0,
    })!;
    expect(preview.installation_methods).toEqual(methods);
    expect(preview.geometry!.coordinates).toHaveLength(5);
    for (const p of line.geometry!.coordinates)
      expect(preview.geometry!.coordinates).toContainEqual(p);
    expect(line).toEqual(snapshot);
  });
  it('refuses crossing neighboring boundaries and reuses existing vertices', () => {
    const snap = {
      segmentIndex: 2,
      fraction: 0.3,
      position: [23, 0] as [number, number],
      screen: { x: 0, y: 0 },
      distancePx: 0,
    };
    expect(previewBoundaryMove(line, 1, snap)).toBeNull();
    const result = previewBoundaryMove(line, 1, {
      ...snap,
      segmentIndex: 0,
      fraction: 1,
      position: [10, 0],
    })!;
    expect(result.geometry).toEqual(line.geometry);
    expect(result.installation_methods).toEqual(line.installation_methods);
  });
});
