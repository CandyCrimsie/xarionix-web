import type { Map as LibreMap } from 'maplibre-gl';

export interface RouteSnap {
    segmentIndex: number;
    /** Fraction in Web Mercator, also valid when the camera has pitch/bearing. */
    fraction: number;
    position: [number, number];
    screen: { x: number; y: number };
    distancePx: number;
}
type Projection = Pick<LibreMap, 'project' | 'unproject'>;
const mercatorY = (latitude: number) => Math.asinh(Math.tan(latitude * Math.PI / 180));

export function routePosition(a: number[], b: number[], fraction: number): [number, number] {
    return [a[0] + fraction * (b[0] - a[0]), Math.atan(Math.sinh(mercatorY(a[1]) + fraction * (mercatorY(b[1]) - mercatorY(a[1])))) * 180 / Math.PI];
}

/** Snap against complete stored geometry, not clipped/simplified tile features. */
export function nearestRoutePoint(points: number[][], cursor: { x: number; y: number }, map: Projection): RouteSnap | null {
    let closest: RouteSnap | null = null;
    for (let index = 0; index < points.length - 1; index++) {
        const a = map.project(points[index] as [number, number]);
        const b = map.project(points[index + 1] as [number, number]);
        const dx = b.x - a.x, dy = b.y - a.y;
        const squared = dx * dx + dy * dy;
        if (!Number.isFinite(squared) || squared < 1e-12) continue;
        const t = Math.max(0, Math.min(1, ((cursor.x - a.x) * dx + (cursor.y - a.y) * dy) / squared));
        const screen = { x: a.x + t * dx, y: a.y + t * dy };
        const distancePx = Math.hypot(cursor.x - screen.x, cursor.y - screen.y);
        if (closest && distancePx >= closest.distancePx) continue;
        const coordinate = map.unproject([screen.x, screen.y]);
        const [ax, ay] = [points[index][0] * Math.PI / 180, mercatorY(points[index][1])];
        const [mx, my] = [points[index + 1][0] * Math.PI / 180 - ax, mercatorY(points[index + 1][1]) - ay];
        const fraction = Math.max(0, Math.min(1, ((coordinate.lng * Math.PI / 180 - ax) * mx + (mercatorY(coordinate.lat) - ay) * my) / (mx * mx + my * my)));
        closest = { segmentIndex: index, fraction, position: [coordinate.lng, coordinate.lat], screen, distancePx };
    }
    return closest;
}
