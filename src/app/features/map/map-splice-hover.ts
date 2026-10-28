import type { Map as LibreMap, MapMouseEvent } from 'maplibre-gl';
import type { MapConnection } from './models/map.models';
import { CONNECTION_HIT_LAYER } from './map-connection-layer';
import { nearestRoutePoint, type RouteSnap } from './map-connection-geometry';

export interface SpliceTarget { connection: MapConnection; point: RouteSnap }
export interface SpliceHover { targets: SpliceTarget[]; x: number; y: number }

/** One hover overlay for the entire graph; no DOM element per connection. */
export class MapSpliceHover {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private held = false;
    private disposed = false;
    private preferredId: number | null = null;
    private readonly leave = () => {
        this.cancelTimer();
        this.timer = setTimeout(() => { if (!this.held) this.clear(); }, 140);
    };
    private readonly move = (event: MapMouseEvent) => {
        if (this.disposed) return;
        if (this.busy() || event.originalEvent?.buttons || this.map.isMoving?.()) { this.clear(); return; }
        if (this.held) return;
        if(this.blocked(event.point)){this.leave();return;}
        const hits = this.map.queryRenderedFeatures(event.point, { layers: [CONNECTION_HIT_LAYER] });
        const ids = new Set(hits.map(feature => Number(feature.properties['id'])));
        if (this.preferredId !== null && !ids.has(this.preferredId)) this.preferredId = null;
        const candidates = this.lines().filter(line => line.can_manage && line.geometry && line.geometry_token && ids.has(line.id)
            && (this.preferredId === null || line.id === this.preferredId));
        const targets = candidates.flatMap(connection => {
            const point = nearestRoutePoint(connection.geometry!.coordinates, event.point, this.map);
            return point && point.distancePx <= 10 ? [{ connection, point }] : [];
        }).sort((a, b) => a.point.distancePx - b.point.distancePx || a.connection.id - b.connection.id);
        if (!targets.length) { this.leave(); return; }
        this.cancelTimer();
        const best = targets[0];
        this.changed({ targets: targets.filter(target => target.point.distancePx <= best.point.distancePx + 2), x: best.point.screen.x, y: best.point.screen.y });
    };
    private readonly cameraMove = () => this.clear();

    constructor(private readonly map: LibreMap, private readonly lines: () => MapConnection[],
        private readonly busy: () => boolean, private readonly changed: (hover: SpliceHover | null) => void,
        private readonly blocked:(point:{x:number;y:number})=>boolean=()=>false) {
        map.on('mousemove', this.move);
        map.on('movestart', this.cameraMove);
        map.getCanvas().addEventListener?.('mouseleave', this.leave);
    }

    hold(value: boolean) { this.held = value; this.cancelTimer(); if (!value) this.leave(); }
    chooseConnection(target: SpliceTarget) {
        this.cancelTimer();
        this.preferredId = target.connection.id;
        this.held = true;
        this.changed({ targets: [target], x: target.point.screen.x, y: target.point.screen.y });
    }
    moveOverButton(point: { x: number; y: number }) {
        // The overlay itself receives mousemove instead of the canvas. Continue
        // following the route, while retaining the grace period if the pointer
        // is at the outer edge of the button rather than the line's hit area.
        if (this.disposed || this.busy() || this.map.isMoving?.()) { this.clear(); return; }
        const held = this.held;
        this.held = false;
        this.move({ point, originalEvent: { buttons: 0 } } as MapMouseEvent);
        this.held = held;
    }
    clear() { this.cancelTimer(); this.held = false; this.preferredId = null; this.changed(null); }
    private cancelTimer() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
    destroy() {
        this.disposed = true;
        this.clear();
        this.map.off('mousemove', this.move);
        this.map.off('movestart', this.cameraMove);
        this.map.getCanvas().removeEventListener?.('mouseleave', this.leave);
    }
}
