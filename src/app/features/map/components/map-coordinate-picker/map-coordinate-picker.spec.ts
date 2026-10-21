import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MapDataService } from '../../services/map-data.service';
import {
    MapLibreLoaderService,
    type MapLibreModule,
} from '../../services/maplibre-loader.service';
import { MapCoordinatePicker } from './map-coordinate-picker';


class FakePickerMap {
    readonly listeners = new Map<string, (event: never) => void>();
    readonly remove = vi.fn();

    addControl(): void {
        // No-op.
    }

    on(type: string, callback: (event: never) => void): void {
        this.listeners.set(type, callback);
    }

    emit(type: string, event = {}): void {
        this.listeners.get(type)?.(event as never);
    }

    getCenter(): { lng: number; lat: number } {
        return { lng: 37.6173, lat: 55.7558 };
    }

    getZoom(): number {
        return 10;
    }

    getSource(): { setTiles: ReturnType<typeof vi.fn> } {
        return { setTiles: vi.fn() };
    }
}


class FakeMarker {
    private position = { lng: 0, lat: 0 };
    private dragEnd: (() => void) | null = null;

    setLngLat(coordinates: [number, number]): this {
        this.position = { lng: coordinates[0], lat: coordinates[1] };
        return this;
    }

    addTo(): this {
        return this;
    }

    on(type: string, callback: () => void): void {
        if (type === 'dragend') {
            this.dragEnd = callback;
        }
    }

    getLngLat(): { lng: number; lat: number } {
        return this.position;
    }

    remove(): void {
        // No-op.
    }
}


describe('MapCoordinatePicker', () => {
    let fixture: ComponentFixture<MapCoordinatePicker>;
    let map: FakePickerMap;
    const loader = { load: vi.fn() };
    const mapData = { createTileSession: vi.fn() };

    beforeEach(async () => {
        map = new FakePickerMap();
        vi.clearAllMocks();
        const expiresAt = Math.floor(Date.now() / 1000) + 600;
        mapData.createTileSession.mockReturnValue(of({
            tile_url_template: `/map/tiles/{z}/{x}/{y}.png?expires=${expiresAt}&signature=test`,
            expires_at: expiresAt,
            min_zoom: 0,
            max_zoom: 20,
            tile_size: 256,
        }));
        loader.load.mockResolvedValue({
            Map: class {
                constructor() {
                    return map;
                }
            },
            NavigationControl: class {},
            Marker: FakeMarker,
        } as unknown as MapLibreModule);

        await TestBed.configureTestingModule({
            imports: [MapCoordinatePicker],
            providers: [
                { provide: MapDataService, useValue: mapData },
                { provide: MapLibreLoaderService, useValue: loader },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(MapCoordinatePicker);
    });

    afterEach(() => {
        fixture.destroy();
        vi.restoreAllMocks();
    });

    it('does not mutate the form until a point has been selected and confirmed by its parent', async () => {
        fixture.detectChanges();
        await Promise.resolve();
        await Promise.resolve();
        map.emit('load');
        expect(fixture.componentInstance.selectedCoordinates()).toBeNull();

        map.emit('click', { lngLat: { lng: 38.245099, lat: 55.577276 } });
        expect(fixture.componentInstance.selectedCoordinates()).toEqual({
            latitude: '55.577276',
            longitude: '38.245099',
        });
    });
});
