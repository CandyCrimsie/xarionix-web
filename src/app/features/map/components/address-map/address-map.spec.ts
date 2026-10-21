import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyContextService } from '../../../../core/company/company-context.service';
import type { AddressObject, Building } from '../../../../core/addresses/address.models';
import type { MapBuildingFeatureCollection, MapMarker } from '../../models/map.models';
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
    readonly layerDefinitions = new Map<string, Record<string, unknown>>();
    readonly images = new Set<string>();
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

    off(type: string, listener: (event: never) => void): void {
        this.listeners.set(
            type,
            (this.listeners.get(type) ?? []).filter(item => item !== listener),
        );
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

    addLayer(layer: { id: string } & Record<string, unknown>): void {
        this.layers.add(layer.id);
        this.layerDefinitions.set(layer.id, layer);
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

    getMaxZoom(): number {
        return 20;
    }

    getCanvas(): object {
        return { style: { cursor: '' } };
    }

    hasImage(id: string): boolean {
        return this.images.has(id);
    }

    addImage(id: string): void {
        this.images.add(id);
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


class FakeMarker {
    static latest: FakeMarker | null = null;
    readonly remove = vi.fn();
    private coordinates = { lng: 0, lat: 0 };

    constructor() {
        FakeMarker.latest = this;
    }

    setLngLat(coordinates: [number, number]): this {
        this.coordinates = { lng: coordinates[0], lat: coordinates[1] };
        return this;
    }

    getLngLat(): { lng: number; lat: number } {
        return this.coordinates;
    }

    addTo(): this { return this; }
    on(): this { return this; }
}


let latestPopupContent: HTMLElement | null = null;
let latestMapOptions: Record<string, unknown> | null = null;


describe('AddressMap', () => {
    let fixture: ComponentFixture<AddressMap>;
    let fakeMap: FakeMap;
    let companyChanged: Subject<number | null>;
    let firstViewport: Subject<MapBuildingFeatureCollection>;
    let secondViewport: Subject<MapBuildingFeatureCollection>;

    const marker: MapMarker = {
        id: 7,
        company_id: 1,
        building_id: null,
        name: 'Узел связи №1',
        description: 'Магистральный узел',
        latitude: 55.577276,
        longitude: 38.245099,
        icon_name: 'network',
        label_text: 'Узел №1',
        icon_color: '#FFFFFF',
        icon_opacity: 1,
        text_color: '#FFFFFF',
        text_opacity: 1,
        background_enabled: true,
        background_color: '#2563EB',
        background_opacity: 0.9,
        border_enabled: true,
        border_color: '#FFFFFF',
        border_width: 2,
        border_opacity: 1,
        marker_opacity: 1,
        marker_size: 'normal',
        marker_shape: 'rounded',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };

    const mapData = {
        createTileSession: vi.fn(),
        getBuildings: vi.fn(),
        getMarkers: vi.fn(),
        createMarker: vi.fn(),
        updateMarker: vi.fn(),
        deleteMarker: vi.fn(),
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
        mapData.getMarkers.mockReset();
        mapData.createMarker.mockReset();
        mapData.updateMarker.mockReset();
        mapData.deleteMarker.mockReset();
        mapData.getAddressObjectBounds.mockReset();
        loader.load.mockReset();
        latestPopupContent = null;
        latestMapOptions = null;
        FakeMarker.latest = null;
        mapData.createTileSession.mockReturnValue(of({
            tile_url_template: '/map/tiles/{z}/{x}/{y}.png?expires=1&signature=test',
            expires_at: Math.floor(Date.now() / 1000) + 600,
            min_zoom: 0,
            max_zoom: 20,
            tile_size: 256,
            default_latitude: 55.7558,
            default_longitude: 37.6176,
            default_zoom: 10,
        }));
        mapData.getBuildings
            .mockReturnValueOnce(firstViewport)
            .mockReturnValueOnce(secondViewport)
            .mockReturnValue(of(EMPTY_FEATURES));
        mapData.getAddressObjectBounds.mockReturnValue(of({
            bounds: null,
            building_count: 0,
        }));
        mapData.getMarkers.mockReturnValue(of([]));
        loader.load.mockResolvedValue({
            Map: class {
                constructor(options: Record<string, unknown>) {
                    latestMapOptions = options;
                    return fakeMap;
                }
            },
            NavigationControl: class {},
            Popup: FakePopup,
            Marker: FakeMarker,
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
            roundRect: vi.fn(),
            drawImage: vi.fn(),
            globalAlpha: 1,
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

    it('keeps the MapLibre container at the full height of the map panel', () => {
        fixture.detectChanges();

        const container = fixture.nativeElement.querySelector(
            '[aria-label="Карта адресов"]',
        ) as HTMLElement;
        expect(container.classList.contains('h-full')).toBe(true);
        expect(container.classList.contains('w-full')).toBe(true);
        expect(container.classList.contains('absolute')).toBe(false);
    });

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
        expect(latestMapOptions).toMatchObject({
            center: [37.6176, 55.7558],
            zoom: 10,
        });
    });

    it('focuses a selected building at a useful street-level zoom', async () => {
        const selected: Building = {
            id: 42,
            address_object_id: 12,
            number: '53',
            corpus: null,
            structure: null,
            latitude: 55.577276,
            longitude: 38.245099,
            full_address: 'Раменское, ул. Гагарина, д. 53',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
        };
        fixture.componentRef.setInput('selectedBuilding', selected);
        await initialize();

        expect(fakeMap.easeTo).toHaveBeenCalledWith({
            center: [38.245099, 55.577276],
            zoom: 17,
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
        const markerSource = fakeMap.sources.get('xarionix-custom-markers');
        const tileSource = fakeMap.sources.get('yandex-map');
        expect(buildingSource?.setData).toHaveBeenCalledWith(EMPTY_FEATURES);
        expect(markerSource?.setData).toHaveBeenCalledWith({
            type: 'FeatureCollection',
            features: [],
        });
        expect(mapData.createTileSession).toHaveBeenCalledTimes(2);
        expect(tileSource?.setTiles).toHaveBeenCalled();
    });


    it('deduplicates concurrent map-session refresh requests', async () => {
        const session = {
            tile_url_template: '/map/tiles/{z}/{x}/{y}.png?expires=1&signature=test',
            expires_at: Math.floor(Date.now() / 1000) + 600,
            min_zoom: 0,
            max_zoom: 20,
            tile_size: 256,
            default_latitude: 55.7558,
            default_longitude: 37.6176,
            default_zoom: 10,
        };
        const pendingRefresh = new Subject<typeof session>();
        mapData.createTileSession
            .mockReturnValueOnce(of(session))
            .mockReturnValue(pendingRefresh);
        await initialize();

        companyChanged.next(2);
        companyChanged.next(3);
        expect(mapData.createTileSession).toHaveBeenCalledTimes(2);
        pendingRefresh.next(session);
        pendingRefresh.complete();
        await Promise.resolve();
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

    it('loads custom markers into an independent GeoJSON source', async () => {
        mapData.getMarkers.mockReturnValue(of([marker]));
        await initialize();

        const source = fakeMap.sources.get('xarionix-custom-markers');
        expect(source).toBeDefined();
        expect(source?.setData).toHaveBeenCalledWith(expect.objectContaining({
            type: 'FeatureCollection',
            features: [expect.objectContaining({
                id: marker.id,
                geometry: {
                    type: 'Point',
                    coordinates: [marker.longitude, marker.latitude],
                },
            })],
        }));
        expect(fakeMap.layers.has('custom-marker-points')).toBe(true);
        expect(fakeMap.layers.has('custom-marker-labels')).toBe(true);
        expect(fakeMap.layerDefinitions.get('custom-marker-labels')).toMatchObject({
            layout: {
                'text-anchor': 'top',
                'text-offset': [0, 2.2],
            },
        });
    });

    it('creates a marker and hides management controls from readers', async () => {
        mapData.createMarker.mockReturnValue(of(marker));
        await initialize();
        expect(
            fixture.nativeElement.querySelector('[data-testid="add-map-marker"]'),
        ).toBeNull();

        fixture.componentRef.setInput('canManage', true);
        fixture.detectChanges();
        fixture.componentInstance.markerDraft.set({
            ...fixture.componentInstance.markerDraft(),
            name: marker.name,
            latitude: marker.latitude,
            longitude: marker.longitude,
        });
        fixture.componentInstance.saveMarker();

        expect(mapData.createMarker).toHaveBeenCalledOnce();
        expect(fixture.componentInstance.markers()).toEqual([marker]);
        expect(
            fixture.nativeElement.querySelector('[data-testid="add-map-marker"]'),
        ).not.toBeNull();
    });

    it('lets a manager choose and confirm a draggable preview point', async () => {
        fixture.componentRef.setInput('canManage', true);
        await initialize();
        fixture.componentInstance.startCreateMarker();
        fixture.componentInstance.startPointSelection();
        fakeMap.emit('click', {
            lngLat: { lng: 38.245099, lat: 55.577276 },
        });

        expect(fixture.componentInstance.placingMarker()).toBe(true);
        expect(fixture.componentInstance.markerDraft().longitude).toBe(38.245099);
        expect(fixture.componentInstance.markerDraft().latitude).toBe(55.577276);
        fixture.componentInstance.confirmPointSelection();
        expect(FakeMarker.latest?.remove).toHaveBeenCalledOnce();
        expect(fixture.componentInstance.placingMarker()).toBe(false);
    });
});
