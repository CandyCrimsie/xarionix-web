import type { Map as LibreMap } from 'maplibre-gl';
import type { InstallationMethod, MapConnection } from './models/map.models';
import { installationMethods } from './map-line-styles';
import type { RouteSnap } from './map-connection-geometry';

export interface InstallationBoundaryPoint {
  vertex: number;
  before: InstallationMethod;
  after: InstallationMethod;
  position: [number, number];
}
export interface InstallationBoundary extends InstallationBoundaryPoint { x: number; y: number }

export function installationBoundaryPoints(line: MapConnection): InstallationBoundaryPoint[] {
  if (!line.geometry) return [];
  const methods = installationMethods(line.vertices, line.installation_methods);
  return methods.flatMap((after, vertex) => {
    if (!vertex || methods[vertex - 1] === after) return [];
    const position = line.geometry!.coordinates[vertex] as [number, number];
    return [{ vertex, before: methods[vertex - 1], after, position }];
  });
}

export function installationBoundaries(line: MapConnection, map: Pick<LibreMap, 'project'>): InstallationBoundary[] {
  return installationBoundaryPoints(line).map(boundary => {
    const screen = map.project(boundary.position);
    return {...boundary, x:screen.x, y:screen.y};
  });
}

/** Retain every corner. The old boundary becomes an ordinary shape vertex. */
export function previewBoundaryMove(
  line: MapConnection,
  vertex: number,
  snap: RouteSnap,
): MapConnection | null {
  if (!line.geometry) return null;
  const methods = installationMethods(line.vertices, line.installation_methods);
  if (vertex < 1 || vertex >= methods.length || methods[vertex - 1] === methods[vertex])
    return null;
  const previous = methods.reduce(
    (last, value, i) => (i > 0 && i < vertex && methods[i - 1] !== value ? i : last),
    0,
  );
  const following = methods.findIndex((value, i) => i > vertex && methods[i - 1] !== value);
  let end = following < 0 ? methods.length : following;
  const progress = snap.segmentIndex + snap.fraction;
  if (progress <= previous || progress >= end) return null;
  const before = methods[vertex - 1],
    after = methods[vertex];
  const points = line.geometry.coordinates.map((point) => [...point]);
  let target = snap.segmentIndex;
  if (snap.fraction >= 1 - 1e-9) target++;
  else if (snap.fraction > 1e-9) {
    target++;
    points.splice(target, 0, snap.position);
    methods.splice(target, 0, methods[snap.segmentIndex]);
    end++;
  }
  if (points.length > 500) return null;
  const length = (path: number[][]) =>
    path.slice(1).reduce((total, b, i) => {
      const a = path[i],
        r = Math.PI / 180,
        dLat = (b[1] - a[1]) * r,
        dLng = (b[0] - a[0]) * r;
      const h =
        Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
      return total + 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
    }, 0);
  if (length(points.slice(previous, target + 1)) < 1 || length(points.slice(target, end + 1)) < 1)
    return null;
  for (let i = previous; i < target; i++) methods[i] = before;
  for (let i = target; i < end; i++) methods[i] = after;
  return {
    ...line,
    vertices: points.slice(1, -1) as [number, number][],
    geometry: { type: 'LineString', coordinates: points },
    installation_methods: methods,
  };
}
