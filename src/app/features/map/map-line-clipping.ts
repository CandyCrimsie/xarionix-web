import type { Map as LibreMap } from 'maplibre-gl';

export interface ScreenPoint {
  x: number;
  y: number;
}
export interface MarkerFootprint {
  center: ScreenPoint;
  width: number;
  height: number;
  radius: number;
}
const CELL = 64;
const cross = (a: ScreenPoint, b: ScreenPoint) => a.x * b.y - a.y * b.x;

function contour(footprint: MarkerFootprint, padding: number): ScreenPoint[] {
  const w = footprint.width / 2 + padding,
    h = footprint.height / 2 + padding;
  const r = Math.min(w, h, footprint.radius + padding);
  const points: ScreenPoint[] = [];
  for (const [x, y, start] of [
    [w - r, -h + r, -90],
    [w - r, h - r, 0],
    [-w + r, h - r, 90],
    [-w + r, -h + r, 180],
  ]) {
    for (let step = 0; step <= 8; step++) {
      const angle = ((start + (step * 90) / 8) * Math.PI) / 180;
      points.push({
        x: footprint.center.x + x + r * Math.cos(angle),
        y: footprint.center.y + y + r * Math.sin(angle),
      });
    }
  }
  return points;
}

/** Parametric interval inside a convex clockwise-in-screen polygon. */
export function occludedInterval(
  a: ScreenPoint,
  b: ScreenPoint,
  polygon: ScreenPoint[],
): [number, number] | null {
  let enter = 0,
    exit = 1;
  const delta = { x: b.x - a.x, y: b.y - a.y };
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i],
      q = polygon[(i + 1) % polygon.length],
      edge = { x: q.x - p.x, y: q.y - p.y };
    const atStart = cross(edge, { x: a.x - p.x, y: a.y - p.y }),
      slope = cross(edge, delta);
    if (Math.abs(slope) < 1e-12) {
      if (atStart < -1e-8) return null;
      continue;
    }
    const t = -atStart / slope;
    if (slope > 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit) return null;
  }
  return exit - enter > 1e-9 ? [Math.max(0, enter), Math.min(1, exit)] : null;
}

/** Sparse grid; visits only viewport-clipped cells along each segment. */
export class FootprintIndex {
  private readonly cells = new Map<string, number[]>();
  readonly polygons: ScreenPoint[][];
  constructor(
    footprints: MarkerFootprint[],
    private readonly width: number,
    private readonly height: number,
    padding = 2.2,
  ) {
    this.polygons = footprints.map((footprint) => contour(footprint, padding));
    footprints.forEach((f, index) => {
      const left = Math.max(-1, Math.floor((f.center.x - f.width / 2 - padding) / CELL)),
        right = Math.min(
          Math.ceil(width / CELL),
          Math.floor((f.center.x + f.width / 2 + padding) / CELL),
        );
      const top = Math.max(-1, Math.floor((f.center.y - f.height / 2 - padding) / CELL)),
        bottom = Math.min(
          Math.ceil(height / CELL),
          Math.floor((f.center.y + f.height / 2 + padding) / CELL),
        );
      for (let x = left; x <= right; x++)
        for (let y = top; y <= bottom; y++) {
          const key = `${x}:${y}`;
          this.cells.set(key, [...(this.cells.get(key) ?? []), index]);
        }
    });
  }
  candidates(a: ScreenPoint, b: ScreenPoint): number[] {
    const viewport = [
      { x: -CELL, y: -CELL },
      { x: this.width + CELL, y: -CELL },
      { x: this.width + CELL, y: this.height + CELL },
      { x: -CELL, y: this.height + CELL },
    ];
    const range = occludedInterval(a, b, viewport);
    if (!range) return [];
    const dx = b.x - a.x,
      dy = b.y - a.y,
      distance = Math.hypot(dx, dy) * (range[1] - range[0]);
    const steps = Math.max(1, Math.ceil(distance / (CELL / 2))),
      result = new Set<number>();
    for (let step = 0; step <= steps; step++) {
      const t = range[0] + ((range[1] - range[0]) * step) / steps;
      const x = Math.floor((a.x + dx * t) / CELL),
        y = Math.floor((a.y + dy * t) / CELL);
      for (let xx = x - 1; xx <= x + 1; xx++)
        for (let yy = y - 1; yy <= y + 1; yy++)
          for (const index of this.cells.get(`${xx}:${yy}`) ?? []) result.add(index);
    }
    return [...result];
  }
}

/** Render-only subtraction. Stored geometry and full hit source are untouched. */
export function clipRoute(
  points: number[][],
  map: Pick<LibreMap, 'project' | 'unproject'>,
  index: FootprintIndex,
): number[][][] {
  const pieces: number[][][] = [],
    projected = points.map((point) => map.project(point as [number, number]));
  let previous: ScreenPoint | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = projected[i],
      b = projected[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) continue;
    const holes = index
      .candidates(a, b)
      .flatMap((id) => {
        const interval = occludedInterval(a, b, index.polygons[id]);
        return interval ? [interval] : [];
      })
      .sort((a, b) => a[0] - b[0]);
    const visible: [number, number][] = [];
    let cursor = 0;
    for (const [start, end] of holes) {
      if (start > cursor + 1e-9) visible.push([cursor, start]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < 1 - 1e-9) visible.push([cursor, 1]);
    for (const [start, end] of visible) {
      const from = { x: a.x + (b.x - a.x) * start, y: a.y + (b.y - a.y) * start },
        to = { x: a.x + (b.x - a.x) * end, y: a.y + (b.y - a.y) * end };
      const geographic = (screen: ScreenPoint) => {
        const p = map.unproject([screen.x, screen.y]);
        return [p.lng, p.lat];
      };
      const first = start === 0 ? points[i] : geographic(from),
        last = end === 1 ? points[i + 1] : geographic(to);
      if (previous && Math.hypot(previous.x - from.x, previous.y - from.y) < 1e-6)
        pieces[pieces.length - 1].push(last);
      else pieces.push([first, last]);
      previous = to;
    }
    if (!visible.length || visible[visible.length - 1][1] < 1 - 1e-9) previous = null;
  }
  return pieces;
}
