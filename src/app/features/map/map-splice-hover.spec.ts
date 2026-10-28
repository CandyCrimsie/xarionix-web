import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Map as LibreMap } from 'maplibre-gl';
import type { MapConnection } from './models/map.models';
import { MapSpliceHover, type SpliceHover } from './map-splice-hover';

describe('MapSpliceHover', () => {
    const line = (id: number, can_manage = true) => ({ id, can_manage, geometry_token: 'a'.repeat(64), geometry: { type: 'LineString', coordinates: [[0, 0], [100, 0]] } }) as MapConnection;
    let listeners: Map<string, (event?: unknown) => void>;
    let canvas: HTMLCanvasElement;
    let hits: number[];
    let lines: MapConnection[];
    let busy: boolean;
    let current: SpliceHover | null;
    let hover: MapSpliceHover;
    let moving: boolean;
    const move = (x: number, y: number, buttons = 0) => listeners.get('mousemove')?.({ point: { x, y }, originalEvent: { buttons } });

    beforeEach(() => {
        vi.useFakeTimers();
        listeners = new Map(); canvas = document.createElement('canvas');
        hits = [1]; lines = [line(1)]; busy = false; moving = false; current = null;
        const map = {
            on: (type: string, callback: () => void) => listeners.set(type, callback),
            off: (type: string) => listeners.delete(type),
            getCanvas: () => canvas,
            isMoving: () => moving,
            queryRenderedFeatures: () => hits.map(id => ({ properties: { id } })),
            project: ([lng, lat]: number[]) => ({ x: lng, y: lat }),
            unproject: ([x, y]: number[]) => ({ lng: x, lat: y }),
        } as unknown as LibreMap;
        hover = new MapSpliceHover(map, () => lines, () => busy, value => { current = value; });
    });
    afterEach(() => { hover.destroy(); vi.useRealTimers(); });

    it('places one overlay exactly on the route and follows the cursor along its geometry', () => {
        move(23, 4);
        expect(current?.x).toBe(23); expect(current?.y).toBe(0);
        expect(current?.targets[0].point.position).toEqual([23, 0]);
        move(71, -3);
        expect(current?.targets[0].point.position).toEqual([71, 0]);
    });
    it('does not flicker when transferring from the line to the button; freezes its clicked location', () => {
        move(23, 4);
        canvas.dispatchEvent(new Event('mouseleave'));
        vi.advanceTimersByTime(100);
        hover.hold(true);
        move(80, 0); vi.advanceTimersByTime(200);
        expect(current?.targets[0].point.position).toEqual([23, 0]);
        hover.hold(false); vi.advanceTimersByTime(141);
        expect(current).toBeNull();
    });
    it('keeps following the line while the overlay itself receives mousemove', () => {
        move(23, 4); hover.hold(true); hover.moveOverButton({ x: 29, y: 0 });
        expect(current?.targets[0].point.position[0]).toBeCloseTo(29);
        expect(current?.targets[0].point.position[1]).toBeCloseTo(0);
        vi.advanceTimersByTime(200); expect(current).not.toBeNull();
    });
    it('hides after leaving the route and never offers an unmanageable connection', () => {
        move(20, 0); hits = []; move(30, 20); vi.advanceTimersByTime(141);
        expect(current).toBeNull();
        hits = [1]; lines = [line(1, false)]; move(30, 0); vi.advanceTimersByTime(141);
        expect(current).toBeNull();
    });
    it('suppresses insertion during editing, dragging and camera movement', () => {
        move(20, 0); busy = true; move(21, 0); expect(current).toBeNull();
        busy = false; move(21, 0, 1); expect(current).toBeNull();
        moving = true; move(21, 0); expect(current).toBeNull();
        moving = false; move(21, 0); listeners.get('movestart')?.(); expect(current).toBeNull();
        move(21, 0); hover.hold(true); busy = true; hover.moveOverButton({ x: 22, y: 0 });
        expect(current).toBeNull();
        busy = false; move(24, 0); expect(current).not.toBeNull();
    });
    it('deduplicates rendered features and exposes overlapping targets for explicit choice', () => {
        hits = [2, 1, 1]; lines = [line(2), line(1)]; move(60, 2);
        expect(current?.targets.map(target => target.connection.id)).toEqual([1, 2]);
        const second = current!.targets[1];
        hover.chooseConnection(second);
        hover.moveOverButton({ x: 63, y: 0 });
        expect(current?.targets.map(target => target.connection.id)).toEqual([2]);
    });
    it('cleans up listeners and pending timers on map disposal', () => {
        move(20, 0); canvas.dispatchEvent(new Event('mouseleave')); hover.destroy();
        expect(listeners.size).toBe(0); vi.advanceTimersByTime(500);
        expect(current).toBeNull();
    });
});
