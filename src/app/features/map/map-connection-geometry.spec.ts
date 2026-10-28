import { describe, expect, it } from 'vitest';
import type { Map as LibreMap } from 'maplibre-gl';
import { nearestRoutePoint, routePosition } from './map-connection-geometry';

const projection = {
    project: ([lng, lat]: [number, number]) => ({ x: lng * 100, y: -Math.asinh(Math.tan(lat * Math.PI / 180)) * 180 / Math.PI * 100 }),
    unproject: ([x, y]: [number, number]) => ({ lng: x / 100, lat: Math.atan(Math.sinh(-y / 100 * Math.PI / 180)) * 180 / Math.PI }),
} as unknown as Pick<LibreMap, 'project' | 'unproject'>;

describe('nearestRoutePoint', () => {
    it('snaps perpendicular to the exact cursor position, never the midpoint or nearest vertex', () => {
        const point = nearestRoutePoint([[0, 0], [1, 0]], { x: 23, y: 7 }, projection)!;
        expect(point.position[0]).toBeCloseTo(.23);
        expect(point.position[1]).toBeCloseTo(0);
        expect(point.fraction).toBeCloseTo(.23);
        expect(point.screen).toEqual({ x: 23, y: 0 });
        expect(point.distancePx).toBe(7);
    });
    it('finds the correct segment of a bent line and deterministically handles a bend', () => {
        const points = [[0, 0], [1, 0], [1, 1]];
        const point = nearestRoutePoint(points, { x: 103, y: -60 }, projection)!;
        expect(point.segmentIndex).toBe(1);
        expect(point.position[0]).toBeCloseTo(1);
        expect(point.fraction).toBeCloseTo(.6, 3);
        expect(nearestRoutePoint(points, { x: 100, y: 0 }, projection)?.segmentIndex).toBe(0);
    });
    it('skips zero-length segments and returns null for a completely degenerate line', () => {
        expect(nearestRoutePoint([[1, 1], [1, 1]], { x: 100, y: 0 }, projection)).toBeNull();
        expect(nearestRoutePoint([[0, 0], [0, 0], [1, 0]], { x: 25, y: 0 }, projection)?.segmentIndex).toBe(1);
        expect(nearestRoutePoint([], { x: 0, y: 0 }, projection)).toBeNull();
    });
    it('clamps to endpoints and interpolates latitude in Mercator rather than linearly', () => {
        expect(nearestRoutePoint([[0, 0], [1, 0]], { x: -10, y: 0 }, projection)?.fraction).toBe(0);
        const position = routePosition([30, 50], [40, 70], .5);
        expect(position[0]).toBe(35);
        expect(position[1]).not.toBeCloseTo(60);
        const screen = projection.project(position);
        const snap = nearestRoutePoint([[30, 50], [40, 70]], screen, projection)!;
        expect(snap.fraction).toBeCloseTo(.5, 8);
        expect(snap.position[1]).toBeCloseTo(position[1]);
    });
    it('reports a Mercator fraction rather than screen t under a pitched perspective projection', () => {
        const perspective = {
            project: ([lng, lat]: number[]) => {
                const y = Math.asinh(Math.tan(lat * Math.PI / 180));
                return { x: lng * 10 / (1 + y), y: y * 100 / (1 + y) };
            },
            unproject: ([x, y]: number[]) => {
                const mercatorY = y / (100 - y);
                return { lng: x * (1 + mercatorY) / 10, lat: Math.atan(Math.sinh(mercatorY)) * 180 / Math.PI };
            },
        } as unknown as Pick<LibreMap, 'project' | 'unproject'>;
        const a = [30, 40], b = [40, 70], position = routePosition(a, b, .37);
        const snap = nearestRoutePoint([a, b], perspective.project(position), perspective)!;
        expect(snap.fraction).toBeCloseTo(.37, 8);
        expect(snap.position[0]).toBeCloseTo(position[0], 8);
        expect(snap.position[1]).toBeCloseTo(position[1], 8);
    });
});
