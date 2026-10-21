import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyContextService } from '../../../../core/company/company-context.service';
import type { AddressObject } from '../../../../core/addresses/address.models';
import type { MapBuildingFeatureCollection } from '../../models/map.models';
import { MapDataService } from '../../services/map-data.service';
import {
    MapLibreLoaderService,
    type MapLibreModule,
} from '../../services/maplibre-loader.service';
import { AddressMap } from './address-map';


const EMPTY_FEATURES: MapBuildingFeatureCollection = {
    type: 'FeatureCollection',
    features: [],
};


class FakeMap {
    readonly listeners = new Map<string, Array<(event: never) => void>>();
    readonly sources = new Map<string, {
        setData?: ReturnType<typeof vi.fn>;
        setTiles?: ReturnType<typeof vi.fn>;
        getClusterExpansionZoom?: (id: number) => Promise<number>;
    }>();
    readonly layers = new Set<string>();
    readonly setFilter = vi.fn();
    readonly easeTo = vi.fn();
    readonly fitBounds = vi.fn();
    readonly remove = vi.fn();
    private loaded = false;

    addControl(): void {
        // Controls are irrelevant to the unit test.
    }

    on(type: string, layerOrListener: string | ((event: never) => void), listener?: (event: never) => void): void {
        const key = typeof layerOrListener === 'string'
            ? `${type}:${layerOrListener}`
            : type;
        const callback = typeof layerOrListener === 'function'
            ? layerOrListener
            : listener!;
        this.listeners.set(key, [...(this.listeners.get(key) ?? []), callback]);
    }

    emit(type: string, event = {}): void {
        if (type === 'load') {
            this.loaded = true;
        }
        for (const callback of this.listeners.get(type) ?? []) {
            callback(event as never);
        }
    }

    emitLayer(type: string, layer: string, event = {}): void {
        for (const callback of this.listeners.get(`${type}:${layer}`) ?? []) {
            callback(event as never);
        }
    }

    addSource(id: string): void {
        this.sources.set(id, {
            setData: vi.fn(),
            setTiles: vi.fn(),
            getClusterExpansionZoom: () => Promise.resolve(16),
        });
    }

    getSource(id: string): object | undefined {
        return this.sources.get(id);
    }

    addLayer(layer: { id: string }): void {
        this.layers.add(layer.id);
    }

    getLayer(id: string): object | undefined {
        return this.layers.has(id) ? {} : undefined;
    }

    isStyleLoaded(): boolean {
        return this.loaded;
    }

    getBounds(): object {
        return {
            getWest: () => 37,
            getSouth: () => 55,
            getEast: () => 38,
            getNorth: () => 56,
        };
    }

    getCenter(): object {
        return { lng: 37.5, lat: 55.5 };
    }

    getZoom(): number {
        return 10;
    }

    getCanvas(): object {
        return { style: { cursor: '' } };
    }

    hasImage(): boolean {
        return false;
    }

    addImage(): void {
        // Marker pixels are tested by browser rendering, not jsdom.
    }
}


class FakePopup {
    setLngLat(): this { return this; }
    setDOMContent(content: HTMLElement): this {
        latestPopupContent = content;
        return this;
    }
    addTo(): this { return this; }
    remove(): void {
        // No-op.
    }
}


let latestPopupContent: HTMLElement | null = null;


describe('AddressMap', () => {
    let fixture: ComponentFixture<AddressMap>;
    let fakeMap: FakeMap;
    let companyChanged: Subject<number | null>;
    let firstViewport: Subject<MapBuildingFeatureCollection>;
    let secondViewport: Subject<MapBuildingFeatureCollection>;

    const mapData = {
        createTileSession: vi.fn(),
        getBuildings: vi.fn(),
        getAddressObjectBounds: vi.fn(),
    };
    const loader = { load: vi.fn() };

    beforeEach(async () => {
        vi.useFakeTimers();
        fakeMap = new FakeMap();
        fakeMap.sources.set('yandex-map', { setTiles: vi.fn() });
        companyChanged = new Subject<number | null>();
        firstViewport = new Subject<MapBuildingFeatureCollection>();
        secondViewport = new Subject<MapBuildingFeatureCollection>();
        vi.clearAllMocks();
        mapData.createTileSession.mockReset();
        mapData.getBuildings.mockReset();
        mapData.getAddressObjectBounds.mockReset();
        loader.load.mockReset();
        latestPopupContent = null;
        mapData.createTileSession.mockReturnValue(of({
            tile_url_template: '/map/tiles/{z}/{x}/{y}.png?expires=1&signature=test',
            expires_at: Math.floor(Date.now() / 1000) + 600,
            min_zoom: 0,
            max_zoom: 20,
            tile_size: 256,
        }));
        mapData.getBuildings
            .mockReturnValueOnce(firstViewport)
            .mockReturnValueOnce(secondViewport)
            .mockReturnValue(of(EMPTY_FEATURES));
        mapData.getAddressObjectBounds.mockReturnValue(of({
            bounds: null,
            building_count: 0,
        }));
        loader.load.mockResolvedValue({
            Map: class {
                constructor() {
                    return fakeMap;
                }
            },
            NavigationControl: class {},
            Popup: FakePopup,
        } as unknown as MapLibreModule);

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            lineJoin: 'round',
            lineCap: 'round',
            lineWidth: 0,
            strokeStyle: '',
            fillStyle: '',
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            rect: vi.fn(),
            getImageData: vi.fn(() => ({
                data: new Uint8ClampedArray(32 * 32 * 4),
                width: 32,
                height: 32,
                colorSpace: 'srgb',
            } as ImageData)),
        } as unknown as CanvasRenderingContext2D);

        await TestBed.configureTestingModule({
            imports: [AddressMap],
            providers: [
                { provide: MapDataService, useValue: mapData },
                { provide: MapLibreLoaderService, useValue: loader },
                {
                    provide: CompanyContextService,
                    useValue: { companyChanged$: companyChanged.asObservable() },
                },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(AddressMap);
    });

    afterEach(() => {
        fixture.destroy();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    async function initialize(): Promise<void> {
        fixture.detectChanges();
        await Promise.resolve();
        await Promise.resolve();
        fakeMap.emit('load');
        fixture.detectChanges();
    }

    it('loads MapLibre only when the map component is actually created', async () => {
        expect(loader.load).not.toHaveBeenCalled();
        await initialize();
        expect(loader.load).toHaveBeenCalledOnce();
        expect(mapData.createTileSession).toHaveBeenCalledOnce();
        expect(mapData.getBuildings).toHaveBeenCalledWith({
            west: 37,
            south: 55,
            east: 38,
            north: 56,
        });
    });

    it('cancels a stale viewport response and keeps the newest marker data', async () => {
        await initialize();
        fakeMap.emit('moveend');
        await vi.advanceTimersByTimeAsync(300);

        expect(mapData.getBuildings).toHaveBeenCalledTimes(2);
        expect(firstViewport.observed).toBe(false);
        const source = fakeMap.sources.get('xarionix-buildings');
        firstViewport.next(EMPTY_FEATURES);
        expect(source?.setData).not.toHaveBeenCalled();

        const latest: MapBuildingFeatureCollection = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: 42,
                geometry: { type: 'Point', coordinates: [37.5, 55.5] },
                properties: {
                    id: 42,
                    address_object_id: 12,
                    number: '15',
                    corpus: null,
                    structure: null,
                    full_address: 'Москва, ул. Ленина, д. 15',
                },
            }],
        };
        secondViewport.next(latest);
        expect(source?.setData).toHaveBeenCalledWith(latest);
    });

    it('invalidates marker data and refreshes the tile permission on company change', async () => {
        await initialize();
        companyChanged.next(2);
        await Promise.resolve();

        const buildingSource = fakeMap.sources.get('xarionix-buildings');
        const tileSource = fakeMap.sources.get('yandex-map');
        expect(buildingSource?.setData).toHaveBeenCalledWith(EMPTY_FEATURES);
        expect(mapData.createTileSession).toHaveBeenCalledTimes(2);
        expect(tileSource?.setTiles).toHaveBeenCalled();
    });

    it('zooms into a cluster and emits the selected building from its popup', async () => {
        await initialize();
        fakeMap.emitLayer('click', 'building-clusters', {
            features: [{
                geometry: { type: 'Point', coordinates: [37.5, 55.5] },
                properties: { cluster_id: 7 },
            }],
        });
        await Promise.resolve();
        expect(fakeMap.easeTo).toHaveBeenCalledWith({
            center: [37.5, 55.5],
            zoom: 16,
        });

        const selected = vi.fn();
        fixture.componentInstance.buildingSelected.subscribe(selected);
        fakeMap.emitLayer('click', 'building-points', {
            features: [{
                geometry: { type: 'Point', coordinates: [37.5, 55.5] },
                properties: { id: 42, full_address: 'Москва, ул. Ленина, д. 15' },
            }],
        });
        latestPopupContent?.querySelector('button')?.click();
        expect(selected).toHaveBeenCalledWith(42);
    });

    it('shows the empty-coordinate state and an official clickable Yandex logo', async () => {
        const selectedObject: AddressObject = {
            id: 12,
            parent_id: null,
            type_id: 3,
            type_code: 'street',
            type_category: 'thoroughfare',
            type_name: 'Улица',
            type_short_name: 'ул.',
            name: 'Ленина',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        };
        fixture.componentRef.setInput('selectedObject', selectedObject);
        await initialize();

        expect(fixture.nativeElement.textContent).toContain(
            'Для выбранного объекта координаты ещё не заданы.',
        );
        const logo = fixture.nativeElement.querySelector(
            'img[src="/yandex-logo-ru.svg"]',
        ) as HTMLImageElement | null;
        expect(logo).not.toBeNull();
        expect(logo?.closest('a')?.href).toContain('https://yandex.ru/maps/');
    });

    it('destroys the MapLibre instance when the panel closes', async () => {
        await initialize();
        fixture.destroy();
        expect(fakeMap.remove).toHaveBeenCalledOnce();
    });
});
