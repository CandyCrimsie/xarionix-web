import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompanyContextService } from '../../../../core/company/company-context.service';
import { AddressApiService } from '../../../../core/addresses/address-api.service';
import type { AddressObject, Building } from '../../../../core/addresses/address.models';
import { createConnectionDraft, type MapBuildingFeatureCollection, type MapMarker, type MapConnectionDraft, type MapConnection } from '../../models/map.models';
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
    readonly setLayoutProperty = vi.fn();
    readonly easeTo = vi.fn();
    readonly fitBounds = vi.fn();
    readonly remove = vi.fn();
    readonly dragPan = { enable: vi.fn(), disable: vi.fn() };
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

    off(type: string, layerOrListener: string | ((event: never) => void), callback?: (event: never) => void): void {
        const key = typeof layerOrListener === 'string' ? `${type}:${layerOrListener}` : type;
        const listener = typeof layerOrListener === 'function' ? layerOrListener : callback;
        this.listeners.set(
            key,
            (this.listeners.get(key) ?? []).filter(item => item !== listener),
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
    updateImage(): void {}
    removeImage(id: string): void { this.images.delete(id); }
}


class FakePopup {
    private readonly closeListeners: Array<() => void> = [];
    private removed = false;

    constructor(readonly options: Record<string, unknown> = {}) {
        latestPopup = this;
    }

    setLngLat(): this { return this; }
    setDOMContent(content: HTMLElement): this {
        latestPopupContent = content;
        return this;
    }
    addTo(): this { return this; }
    on(type: string, listener: () => void): this {
        if (type === 'close') {
            this.closeListeners.push(listener);
        }
        return this;
    }
    remove(): void {
        if (!this.removed) {
            this.removed = true;
            this.closeListeners.forEach(listener => listener());
        }
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
let latestPopup: FakePopup | null = null;
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
        visibility: 'company', owner_user_id: null, point_type: 'network_node',
        building_link_role: 'none', building_full_address: null, version: 1, can_manage: true,
        building_id: null,
        sync_building_coordinates: false,
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
    const house: Building = {
        id: 42, address_object_id: 12, number: '53', corpus: null, structure: null,
        latitude: marker.latitude, longitude: marker.longitude,
        full_address: 'Раменское, ул. Гагарина, д. 53',
        created_at: marker.created_at, updated_at: marker.updated_at,
    };
    const linkedMarker: MapMarker = {
        ...marker, building_id: house.id, point_type: 'building', building_link_role: 'represents',
        building_full_address: house.full_address,
    };
    const houseFeatures: MapBuildingFeatureCollection = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature', id: house.id,
            geometry: { type: 'Point', coordinates: [marker.longitude!, marker.latitude!] },
            properties: {
                id: house.id, address_object_id: house.address_object_id, number: house.number,
                corpus: null, structure: null, full_address: house.full_address,
            },
        }],
    };

    const mapData = {
        createTileSession: vi.fn(),
        getBuildings: vi.fn(),
        getMarkers: vi.fn(),
        createMarker: vi.fn(),
        updateMarker: vi.fn(),
        deleteMarker: vi.fn(),
        getAddressObjectBounds: vi.fn(),
        getConnections: vi.fn(), getStyles: vi.fn(), getBuildingMarker: vi.fn(),
        createConnection: vi.fn(), updateConnection: vi.fn(), deleteConnection: vi.fn(),
        splitConnection: vi.fn(),
        createStyle: vi.fn(), updateStyle: vi.fn(), deleteStyle: vi.fn(),
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
        latestPopup = null;
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
        mapData.getConnections.mockReturnValue(of([]));
        mapData.getStyles.mockReturnValue(of([]));
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
                { provide: AddressApiService, useValue: { search: vi.fn(), getBuilding: vi.fn() } },
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

    function clickCustomMarker(id = marker.id): HTMLElement {
        fakeMap.emitLayer('click', 'custom-marker-points', {
            features: [{
                geometry: { type: 'Point', coordinates: [marker.longitude, marker.latitude] },
                properties: { id },
            }],
        });
        fixture.detectChanges();
        const content = latestPopupContent?.querySelector<HTMLElement>(
            '[data-testid="map-marker-popup"]',
        );
        expect(content).not.toBeNull();
        return content!;
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

    it('groups the map toolbar actions with Spartan button group', () => {
        fixture.componentRef.setInput('canManage', true);
        fixture.detectChanges();

        const group = fixture.nativeElement.querySelector(
            '[data-testid="map-toolbar-button-group"]',
        ) as HTMLElement | null;

        expect(group).not.toBeNull();
        expect(group?.getAttribute('role')).toBe('group');
        expect(group?.getAttribute('aria-label')).toBe('Управление картой');
        expect(group?.classList.contains('bg-background')).toBe(true);
        expect(group?.classList.contains('shadow-md')).toBe(true);
        expect(group?.parentElement?.classList.contains('isolate')).toBe(true);

        const directButtons = Array.from(group?.children ?? [])
            .filter(element => element.tagName === 'BUTTON') as HTMLButtonElement[];

        expect(directButtons.map(button => button.dataset['testid'])).toEqual([
            'close-address-map',
            'add-map-marker',
            'add-map-connection',
            undefined,
        ]);
        expect(directButtons[0]?.getAttribute('aria-label')).toBe('Закрыть карту');
        expect(directButtons.every(button => button.classList.contains('border-border'))).toBe(true);
        expect(directButtons.some(button => button.classList.contains('border-transparent'))).toBe(false);
        expect(directButtons.every(button => button.classList.contains('bg-background'))).toBe(true);
        expect(directButtons.every(button => button.classList.contains('dark:bg-background'))).toBe(true);
    });

    it('opens the marker editor in the overlay, switches settings and cancels without saving', async () => {
        vi.useRealTimers();
        fixture.componentRef.setInput('canManage', true);
        await initialize();

        (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
            '[data-testid="add-map-marker"]',
        )!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const dialog = document.body.querySelector<HTMLElement>(
            '[data-testid="map-marker-dialog"]',
        )!;
        expect(dialog).not.toBeNull();
        expect(dialog.closest('[role="dialog"]')).not.toBeNull();
        expect(dialog.textContent).toContain('Новый маркер');
        expect(dialog.querySelector('[data-testid="marker-live-preview"]')).not.toBeNull();

        const panels = Array.from(dialog.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
        expect(panels.filter(panel => !panel.hidden)).toHaveLength(1);
        expect(panels.find(panel => !panel.hidden)?.querySelector('#marker-name')).not.toBeNull();

        const tabs = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
        tabs.find(tab => tab.textContent?.trim() === 'Иконка')!.click();
        fixture.detectChanges();
        expect(panels.filter(panel => !panel.hidden)).toHaveLength(1);
        expect(panels.find(panel => !panel.hidden)?.querySelector(
            '[data-testid="marker-icon-search"]',
        )).not.toBeNull();

        tabs.find(tab => tab.textContent?.trim() === 'Оформление')!.click();
        fixture.detectChanges();
        expect(panels.filter(panel => !panel.hidden)).toHaveLength(1);
        const appearance = panels.find(panel => !panel.hidden)!;
        expect(appearance.querySelector('#marker-icon-color')).not.toBeNull();
        expect(appearance.querySelector('label[for="marker-background"]')?.getAttribute('for'))
            .toBe(appearance.querySelector('[role="switch"]')?.id);

        const cancel = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
            .find(button => button.textContent?.trim() === 'Отмена')!;
        cancel.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(document.body.querySelector('[data-testid="map-marker-dialog"]')).toBeNull();
        expect(mapData.createMarker).not.toHaveBeenCalled();
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

    it.each([8, 18])('opens directly at the selected house at zoom 13, regardless of previous zoom %s', async previousZoom => {
        vi.spyOn(fakeMap, 'getZoom').mockReturnValue(previousZoom);
        const addSource = vi.spyOn(fakeMap, 'addSource');
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
            zoom: 13,
        });
        expect(latestMapOptions).toMatchObject({ center: [38.245099, 55.577276], zoom: 13 });
        // This source is deliberately not clustered, so the selected house is
        // visible at zoom 13 without waiting for the viewport HTTP response.
        expect(addSource).toHaveBeenCalledWith('xarionix-selected-building', {
            type: 'geojson', data: EMPTY_FEATURES,
        });
        expect(fakeMap.layerDefinitions.get('selected-building-marker')).toMatchObject({
            source: 'xarionix-selected-building', type: 'symbol',
        });
        const source = fakeMap.sources.get('xarionix-selected-building');
        expect(source?.setData).toHaveBeenLastCalledWith(expect.objectContaining({
            features: [expect.objectContaining({
                id: selected.id,
                geometry: { type: 'Point', coordinates: [38.245099, 55.577276] },
            })],
        }));

        fixture.componentRef.setInput('selectedBuilding', { ...selected, id: 43, longitude: 38.3 });
        fixture.detectChanges();
        expect(fakeMap.easeTo).toHaveBeenLastCalledWith({ center: [38.3, 55.577276], zoom: 13 });
        expect(source?.setData).toHaveBeenLastCalledWith(expect.objectContaining({
            features: [expect.objectContaining({ id: 43 })],
        }));
        fixture.componentRef.setInput('selectedBuilding', null);
        fixture.detectChanges();
        expect(source?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
    });

    it('does not interpret missing building coordinates as a point at zero latitude and longitude', async () => {
        fixture.componentRef.setInput('selectedBuilding', {
            id: 42, latitude: null, longitude: null,
        } as Building);
        await initialize();
        expect(latestMapOptions).toMatchObject({ center: [37.6176, 55.7558], zoom: 10 });
        expect(fakeMap.easeTo).not.toHaveBeenCalled();
        expect(fixture.componentInstance.coordinateNotice()).toBe('Для выбранного здания координаты ещё не заданы.');
        expect(fakeMap.sources.get('xarionix-selected-building')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
    });

    it('cancels a stale viewport response and keeps the newest marker data', async () => {
        await initialize();
        fakeMap.emit('moveend');
        await vi.advanceTimersByTimeAsync(300);

        expect(mapData.getBuildings).toHaveBeenCalledTimes(2);
        expect(firstViewport.observed).toBe(false);
        const source = fakeMap.sources.get('xarionix-buildings');
        source?.setData?.mockClear();
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

    it.each(['buildings first', 'markers first'])('replaces the standard house pin with its custom marker: %s', async order => {
        const markers = new Subject<MapMarker[]>();
        mapData.getMarkers.mockReturnValue(markers);
        await initialize();
        if (order === 'buildings first') {
            firstViewport.next(houseFeatures);
            markers.next([linkedMarker]);
        } else {
            markers.next([linkedMarker]);
            firstViewport.next(houseFeatures);
        }
        expect(fakeMap.sources.get('xarionix-buildings')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
        expect(fakeMap.sources.get('xarionix-custom-markers')?.setData).toHaveBeenLastCalledWith(
            expect.objectContaining({ features: [expect.objectContaining({ id: marker.id })] }),
        );
        expect(fakeMap.sources.get('xarionix-selected-building')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
    });

    it('keeps the selected custom house marker visible at zoom 13 without a second standard pin or cluster entry', async () => {
        fixture.componentRef.setInput('selectedBuilding', house);
        mapData.getMarkers.mockReturnValue(of([linkedMarker]));
        await initialize();
        firstViewport.next(houseFeatures);
        expect(latestMapOptions).toMatchObject({ zoom: 13 });
        expect(fakeMap.sources.get('xarionix-buildings')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
        expect(fakeMap.sources.get('xarionix-custom-markers')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
        expect(fakeMap.sources.get('xarionix-selected-building')?.setData).toHaveBeenLastCalledWith(
            expect.objectContaining({ features: [expect.objectContaining({
                id: marker.id,
                properties: expect.objectContaining({
                    marker_id: marker.id, image_key: expect.stringContaining('map-marker:'),
                    label_text: marker.label_text, marker_opacity: marker.marker_opacity,
                }),
            })] }),
        );
        // A primary marker always opens the building, not an independent note.
        fakeMap.emitLayer('click', 'selected-building-marker', {
            features: [{
                geometry: houseFeatures.features[0].geometry,
                properties: { id: marker.id, marker_id: marker.id, full_address: house.full_address },
            }],
        });
        fixture.detectChanges();
        expect(latestPopupContent?.textContent).toContain(house.full_address);
        expect(latestPopupContent?.querySelector('[data-testid="map-marker-popup"]')).toBeNull();
    });

    it('restores the standard house pin after unlinking or deleting its custom marker', async () => {
        mapData.getMarkers.mockReturnValue(of([linkedMarker]));
        mapData.updateMarker.mockReturnValue(of({ ...marker, building_id: null }));
        mapData.deleteMarker.mockReturnValue(of(null));
        await initialize();
        firstViewport.next(houseFeatures);
        expect(fakeMap.sources.get('xarionix-buildings')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
        mapData.getMarkers.mockReturnValue(of([marker]));
        mapData.getBuildings.mockReturnValue(of(houseFeatures));
        fixture.componentInstance.editingMarker.set(linkedMarker);
        fixture.componentInstance.markerDraft.set({ ...marker, building_id: null });
        fixture.componentInstance.saveMarker();
        expect(fakeMap.sources.get('xarionix-buildings')?.setData).toHaveBeenLastCalledWith(houseFeatures);
        expect(fakeMap.sources.get('xarionix-custom-markers')?.setData).toHaveBeenLastCalledWith(
            expect.objectContaining({ features: [expect.objectContaining({ id: marker.id })] }),
        );
        fixture.componentInstance.markerToDelete.set(marker);
        fixture.componentInstance.deleteMarker();
        expect(fakeMap.sources.get('xarionix-buildings')?.setData).toHaveBeenLastCalledWith(houseFeatures);
        expect(fakeMap.sources.get('xarionix-custom-markers')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
    });

    it('does not hide a physical house for an informational marker at another point or an unlinked marker', async () => {
        mapData.getMarkers.mockReturnValue(of([
            { ...linkedMarker, building_link_role: 'reference', latitude: 56 },
            { ...marker, id: 8 },
        ]));
        await initialize();
        firstViewport.next(houseFeatures);
        expect(fakeMap.sources.get('xarionix-buildings')?.setData).toHaveBeenLastCalledWith(houseFeatures);
    });

    it('removes old company marker overrides when switching companies', async () => {
        fixture.componentRef.setInput('selectedBuilding', house);
        mapData.getMarkers.mockReturnValue(of([linkedMarker]));
        await initialize();
        firstViewport.next(houseFeatures);
        companyChanged.next(2);
        expect(fixture.componentInstance.markers()).toEqual([]);
        expect(fakeMap.sources.get('xarionix-custom-markers')?.setData).toHaveBeenLastCalledWith(EMPTY_FEATURES);
        expect(fakeMap.sources.get('xarionix-selected-building')?.setData).toHaveBeenLastCalledWith(
            expect.objectContaining({ features: [expect.objectContaining({
                id: house.id, properties: expect.not.objectContaining({ marker_id: marker.id }),
            })] }),
        );
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


    it('invalidates pending tile sessions between different company contexts', async () => {
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
        expect(mapData.createTileSession).toHaveBeenCalledTimes(3);
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
        fixture.detectChanges();
        latestPopupContent?.querySelector<HTMLButtonElement>('[data-testid="open-building-popup"]')?.click();
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
                'text-offset': [0, 1.65],
            },
        });
    });

    it('renders marker details below an icon-only Spartan button group', async () => {
        fixture.componentRef.setInput('canManage', true);
        mapData.getMarkers.mockReturnValue(of([marker]));
        await initialize();

        const content = clickCustomMarker();
        const header = content.querySelector('header')!;
        const group = header.querySelector('[data-testid="marker-popup-actions"]')!;
        const buttons = Array.from(group.querySelectorAll('button'));
        expect(group.getAttribute('role')).toBe('group');
        expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
            'Редактировать маркер',
            'Удалить маркер',
            'Закрыть карточку метки',
        ]);
        expect(buttons.every(button => button.getAttribute('data-slot') === 'button')).toBe(true);
        expect(buttons.every(button => button.querySelector('ng-icon') !== null)).toBe(true);
        expect(buttons.every(button => button.textContent?.trim() === '')).toBe(true);
        expect(header.nextElementSibling?.textContent).toContain(marker.name);
        expect(content.textContent).toContain(marker.description);
        expect(content.textContent).toContain(marker.label_text);
        expect(content.textContent).toContain('55.577276, 38.245099');
        expect(latestPopup?.options['closeButton']).toBe(false);
    });

    it('opens the existing editor from the marker popup edit icon', async () => {
        vi.useRealTimers();
        fixture.componentRef.setInput('canManage', true);
        mapData.getMarkers.mockReturnValue(of([marker]));
        await initialize();
        const content = clickCustomMarker();
        content.querySelector<HTMLButtonElement>('[data-testid="edit-marker-popup"]')!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fixture.componentInstance.editingMarker()).toEqual(marker);
        const dialog = document.body.querySelector('[data-testid="map-marker-dialog"]')!;
        expect(dialog.textContent).toContain('Редактирование маркера');
        expect((dialog.querySelector('#marker-name') as HTMLInputElement).value).toBe(marker.name);
        expect(latestPopupContent?.querySelector('[data-testid="map-marker-popup"]')).toBeNull();
    });

    it('requires confirmation when the marker popup delete icon is clicked', async () => {
        vi.useRealTimers();
        fixture.componentRef.setInput('canManage', true);
        mapData.getMarkers.mockReturnValue(of([marker]));
        await initialize();
        const content = clickCustomMarker();
        content.querySelector<HTMLButtonElement>('[data-testid="delete-marker-popup"]')!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(fixture.componentInstance.markerToDelete()).toEqual(marker);
        const dialog = document.body.querySelector('[role="alertdialog"]');
        expect(dialog?.textContent).toContain('Удалить маркер?');
        expect(dialog?.textContent).toContain(marker.name);
        expect(mapData.deleteMarker).not.toHaveBeenCalled();
        expect(fixture.componentInstance.markers()).toEqual([marker]);
    });

    it('hides marker mutation icons from readers and closes only the popup', async () => {
        mapData.getMarkers.mockReturnValue(of([{ ...marker, can_manage: false }]));
        await initialize();
        const closeMap = vi.fn();
        fixture.componentInstance.closeRequested.subscribe(closeMap);
        const content = clickCustomMarker();
        expect(content.querySelector('[data-testid="edit-marker-popup"]')).toBeNull();
        expect(content.querySelector('[data-testid="delete-marker-popup"]')).toBeNull();
        expect(content.textContent).toContain(marker.name);

        content.querySelector<HTMLButtonElement>('[data-testid="close-marker-popup"]')!.click();
        fixture.detectChanges();
        expect(latestPopupContent?.querySelector('[data-testid="map-marker-popup"]')).toBeNull();
        expect(closeMap).not.toHaveBeenCalled();
        expect(fakeMap.remove).not.toHaveBeenCalled();
    });

    it('releases marker popup content on replacement, company change and map teardown', async () => {
        mapData.getMarkers.mockReturnValue(of([marker]));
        await initialize();
        clickCustomMarker();
        const first = latestPopupContent!;
        clickCustomMarker();
        expect(first.querySelector('[data-testid="map-marker-popup"]')).toBeNull();
        const second = latestPopupContent!;

        mapData.getMarkers.mockReturnValue(of([{ ...marker, company_id: 2 }]));
        companyChanged.next(2);
        fixture.detectChanges();
        expect(second.querySelector('[data-testid="map-marker-popup"]')).toBeNull();

        await vi.advanceTimersByTimeAsync(0);
        clickCustomMarker();
        const last = latestPopupContent!;
        fixture.destroy();
        expect(last.querySelector('[data-testid="map-marker-popup"]')).toBeNull();
    });

    it('lets readers create personal notes without granting common object management', async () => {
        mapData.createMarker.mockReturnValue(of(marker));
        mapData.getMarkers.mockReturnValue(of([marker]));
        await initialize();
        expect(
            fixture.nativeElement.querySelector('[data-testid="add-map-marker"]'),
        ).not.toBeNull();

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

    it('notifies the address page only after an explicitly requested canonical position is saved', async () => {
        const saved = { ...linkedMarker, building_id: 20 };
        const pending = new Subject<MapMarker>();
        mapData.createMarker.mockReturnValue(pending);
        mapData.getMarkers.mockReturnValue(of([saved]));
        await initialize();
        const changed = vi.fn();
        fixture.componentInstance.buildingCoordinatesChanged.subscribe(changed);
        const previousReads = mapData.getBuildings.mock.calls.length;
        fixture.componentInstance.markerDraft.set({ ...saved, building_position: { latitude: marker.latitude!, longitude: marker.longitude! } });
        fixture.componentInstance.saveMarker();
        expect(changed).not.toHaveBeenCalled();
        pending.next(saved);
        expect(changed).toHaveBeenCalledExactlyOnceWith({
            id: 20, latitude: String(marker.latitude), longitude: String(marker.longitude),
        });
        expect(mapData.getBuildings.mock.calls.length).toBe(previousReads + 1);
        expect(fixture.componentInstance.markers()).toEqual([saved]);
    });

    it('does not publish a stale coordinate update after switching companies', async () => {
        const pending = new Subject<MapMarker>();
        mapData.createMarker.mockReturnValue(pending);
        await initialize();
        const changed = vi.fn();
        fixture.componentInstance.buildingCoordinatesChanged.subscribe(changed);
        fixture.componentInstance.saveMarker();
        companyChanged.next(2);
        pending.next({ ...marker, building_id: 20, sync_building_coordinates: true });
        expect(changed).not.toHaveBeenCalled();
        expect(fixture.componentInstance.markers()).toEqual([]);
    });

    it('sends only changed fields when renaming a linked marker, not stale coordinate snapshots', async () => {
        const saved = { ...linkedMarker, building_id: 20 };
        mapData.updateMarker.mockReturnValue(of({ ...saved, name: 'Новая подпись' }));
        await initialize();
        fixture.componentInstance.editingMarker.set(saved);
        fixture.componentInstance.markerDraft.set(saved);
        fixture.componentInstance.markerDraft.update(current => ({ ...current, name: 'Новая подпись' }));
        fixture.componentInstance.saveMarker();
        expect(mapData.updateMarker).toHaveBeenCalledWith(saved.id, { name: 'Новая подпись', expected_version: 1 });
    });

    it('loads initial objects even while newly added MapLibre sources are still processing', async () => {
        vi.spyOn(fakeMap, 'isStyleLoaded').mockReturnValue(false);
        await initialize();
        expect(mapData.getBuildings).toHaveBeenCalledOnce();
        expect(mapData.getMarkers).toHaveBeenCalledOnce();
        expect(mapData.getConnections).toHaveBeenCalledOnce();
    });

    it('keeps a binding conflict unsaved until the exact snapshot token is confirmed', async () => {
        const conflict = { code: 'building_binding_conflict', message: 'Подтвердите', confirmation_token: 'expected-version-token',
            snapshot: { marker: null, previous_building: { id: 41, address: 'Старый дом', position: null },
                target_building: { id: 42, address: house.full_address, position: { latitude: 55, longitude: 38 } },
                previous_marker: { id: 2, name: 'Прежняя метка', version: 1 }, requested_name: 'Новое оформление', requested_position: null } };
        mapData.createMarker.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: conflict } }))).mockReturnValue(of(linkedMarker));
        mapData.getMarkers.mockReturnValue(of([linkedMarker]));
        await initialize();
        fixture.componentInstance.markerDraft.set({ ...linkedMarker, name: 'Новое оформление' });
        fixture.componentInstance.saveMarker();
        expect(fixture.componentInstance.bindingConflict()).toEqual(conflict);
        expect(fixture.componentInstance.markerSaving()).toBe(false);
        expect(mapData.createMarker).toHaveBeenCalledOnce();
        fixture.componentInstance.confirmBinding();
        expect(mapData.createMarker).toHaveBeenLastCalledWith(expect.objectContaining({ binding_confirmation: 'expected-version-token' }));
        expect(fixture.componentInstance.bindingConflict()).toBeNull();
    });

    function routeDraft(): MapConnectionDraft {
        return { ...createConnectionDraft(), name: 'Магистраль',
            source: { kind: 'building', id: 42, name: house.full_address, latitude: 55, longitude: 38 },
            target: { kind: 'marker', id: 7, name: marker.name, latitude: 56, longitude: 39 } };
    }

    function splitLine(): MapConnection {
        const draft = routeDraft();
        return { ...draft, source: draft.source!, target: draft.target!, id: 71, company_id: 1, owner_user_id: null,
            visibility: 'company', geometry: { type: 'LineString', coordinates: [[38, 55], [38.5, 55.3], [39, 56]] },
            geometry_token: 'a'.repeat(64), length_m: 10000, position_missing: false, can_manage: true, version: 3,
            created_at: marker.created_at, updated_at: marker.updated_at };
    }

    const snap = { segmentIndex: 0, fraction: .23, position: [38.115, 55.069119] as [number, number], screen: { x: 23, y: 0 }, distancePx: 0 };

    it('opens a splice at the frozen snapped point, reuses the marker editor and cancels without requests', async () => {
        await initialize();
        const c = fixture.componentInstance;
        fixture.componentRef.setInput('canManage', true);
        c.openSpliceEditor({ connection: splitLine(), point: snap });
        fixture.detectChanges();
        expect(c.markerDraft()).toMatchObject({ point_type: 'splice', icon_name: 'splice', latitude: snap.position[1], longitude: snap.position[0] });
        expect(document.body.textContent).toContain('Муфта разделит соединение');
        c.markerDialog()?.close({}); await vi.advanceTimersByTimeAsync(200); fixture.detectChanges();
        expect(c.spliceTarget()).toBeNull();
        expect(mapData.splitConnection).not.toHaveBeenCalled();
        expect(mapData.createMarker).not.toHaveBeenCalled();
    });

    it('sends the exact snapshot once and atomically updates only affected map data, preserving camera', async () => {
        await initialize(); fixture.componentRef.setInput('canManage', true);
        const c = fixture.componentInstance, line = splitLine(), pending = new Subject<any>();
        c.connections.set([line]); mapData.splitConnection.mockReturnValue(pending);
        c.openSpliceEditor({ connection: line, point: snap });
        const moves = fakeMap.easeTo.mock.calls.length;
        c.saveMarker(); c.saveMarker();
        expect(mapData.splitConnection).toHaveBeenCalledTimes(1);
        expect(mapData.splitConnection).toHaveBeenCalledWith(line.id, expect.objectContaining({ expected_version: 3,
            expected_geometry_token: line.geometry_token, segment_index: 0, fraction: .23,
            position: { longitude: snap.position[0], latitude: snap.position[1] }, marker: expect.objectContaining({ name: 'Муфта' }) }));
        const result = { marker: { ...marker, id: 80, point_type: 'splice' }, connections: [{ ...line, version: 4 }, { ...line, id: 72 }] };
        pending.next(result);
        expect(c.connections().map(line => line.id)).toEqual([71, 72]);
        expect(c.markers().some(point => point.id === 80)).toBe(true);
        expect(c.markerSaving()).toBe(false);
        expect(fakeMap.easeTo.mock.calls).toHaveLength(moves);
    });

    it('keeps the splice form after an error and ignores saves from a previous company', async () => {
        await initialize(); fixture.componentRef.setInput('canManage', true);
        const c = fixture.componentInstance, line = splitLine();
        mapData.splitConnection.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: { message: 'Трасса изменилась' } } })));
        c.openSpliceEditor({ connection: line, point: snap }); c.saveMarker();
        expect(c.markerError()).toBe('Трасса изменилась');
        expect(c.markerDraft().name).toBe('Муфта');
        expect(c.spliceTarget()?.connection.id).toBe(71);
        const pending = new Subject<any>(); mapData.splitConnection.mockReturnValue(pending); c.saveMarker();
        companyChanged.next(2);
        pending.next({ marker, connections: [line, { ...line, id: 72 }] });
        expect(c.connections()).toEqual([]); expect(c.spliceTarget()).toBeNull();
    });

    it('does not offer technical splice creation without manage, including on personal lines', async () => {
        await initialize(); const c = fixture.componentInstance;
        c.openSpliceEditor({ connection: { ...splitLine(), visibility: 'private', can_manage: true }, point: snap });
        expect(c.spliceTarget()).toBeNull();
        expect(c.spliceBusy()).toBe(true);
    });

    it('adds, deletes and undoes only intermediate vertices; Escape cancels without saving', async () => {
        await initialize();
        const c = fixture.componentInstance;
        c.connectionDraft.set(routeDraft());
        c.startConnectionMap('vertices');
        // This test checks route state; rendered vertex hit testing is verified in the browser.
        (fakeMap as unknown as { queryRenderedFeatures: () => [] }).queryRenderedFeatures = () => [];
        fakeMap.emit('click', { point: { x: 1, y: 1 }, lngLat: { lng: 38.3, lat: 55.3 } });
        expect(c.connectionDraft().vertices).toEqual([[38.3, 55.3]]);
        c.activeVertex.set(0); c.removeRouteVertex(); expect(c.connectionDraft().vertices).toEqual([]);
        c.undoRoute(); expect(c.connectionDraft().vertices).toEqual([[38.3, 55.3]]);
        c.handleMapKey(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(c.connectionDraft().vertices).toEqual([]);
        expect(c.connectionMapMode()).toBeNull();
        expect(mapData.createConnection).not.toHaveBeenCalled();
    });

    it('preserves a failed route draft and camera, and discards old company save responses', async () => {
        await initialize();
        const c = fixture.componentInstance;
        const draft = routeDraft();
        mapData.createConnection.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
        c.connectionDraft.set(draft); c.saveConnection();
        expect(c.connectionError()).toBeTruthy();
        expect(c.connectionDraft()).toEqual(draft);
        expect(c.connectionSaving()).toBe(false);
        const pending = new Subject(); mapData.createConnection.mockReturnValue(pending);
        c.saveConnection(); expect(c.connectionSaving()).toBe(true);
        const moves = fakeMap.easeTo.mock.calls.length;
        companyChanged.next(2);
        pending.next({ id: 9, ...draft });
        expect(c.connectionSaving()).toBe(false);
        expect(c.connections()).toEqual([]);
        expect(c.connectionDraft().source).toBeNull();
        expect(fakeMap.easeTo.mock.calls).toHaveLength(moves);
    });

    it('retries a tile-session failure with bounded backoff and does not run concurrent refreshes', async () => {
        await initialize();
        const pending = new Subject();
        mapData.createTileSession.mockReturnValue(pending);
        fixture.componentInstance.retryViewport(); fixture.componentInstance.retryViewport();
        expect(mapData.createTileSession).toHaveBeenCalledTimes(2);
        mapData.createTileSession.mockReturnValue(throwError(() => new Error('Offline')));
        pending.error(new Error('Offline'));
        await vi.advanceTimersByTimeAsync(31000);
        expect(mapData.createTileSession).toHaveBeenCalledTimes(6);
        expect(fixture.componentInstance.viewportError()).toContain('сессию карты');
        await vi.advanceTimersByTimeAsync(30000);
        expect(mapData.createTileSession).toHaveBeenCalledTimes(6);
    });
});
