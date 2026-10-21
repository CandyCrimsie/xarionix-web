import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    effect,
    inject,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideBuilding2,
    lucideLoaderCircle,
    lucideRefreshCw,
    lucideTriangleAlert,
    lucideX,
} from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';

import type { AddressObject, Building } from '../../../../core/addresses/address.models';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import {
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM,
    MAP_BUILDINGS_SOURCE_ID,
    MAP_SESSION_REFRESH_MARGIN_SECONDS,
    MAP_SOURCE_ID,
    MAP_VIEWPORT_DEBOUNCE_MS,
    YANDEX_LOGO_URL,
    YANDEX_MAPS_TERMS_URL,
    YANDEX_MAPS_URL,
} from '../../map.config';
import type {
    MapBounds,
    MapBuildingFeatureCollection,
    MapTileSession,
} from '../../models/map.models';
import { MapDataService } from '../../services/map-data.service';
import {
    MapLibreLoaderService,
    type MapLibreModule,
} from '../../services/maplibre-loader.service';


type MapInstance = import('maplibre-gl').Map;
type RasterTileSource = import('maplibre-gl').RasterTileSource;
type GeoJSONSource = import('maplibre-gl').GeoJSONSource;
type MapPopup = import('maplibre-gl').Popup;
type MapLoadState = 'loading' | 'ready' | 'error';

const EMPTY_FEATURES: MapBuildingFeatureCollection = {
    type: 'FeatureCollection',
    features: [],
};
const BUILDING_MARKER_IMAGE = 'xarionix-building-marker';


@Component({
    selector: 'app-address-map',
    imports: [NgIcon, HlmAlertImports, HlmButtonImports],
    providers: [provideIcons({
        lucideBuilding2,
        lucideLoaderCircle,
        lucideRefreshCw,
        lucideTriangleAlert,
        lucideX,
    })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './address-map.html',
    styleUrl: './address-map.css',
})
export class AddressMap implements AfterViewInit {
    private readonly mapData = inject(MapDataService);
    private readonly mapLibreLoader = inject(MapLibreLoaderService);
    private readonly companyContext = inject(CompanyContextService);
    private readonly destroyRef = inject(DestroyRef);

    readonly selectedObject = input<AddressObject | null>(null);
    readonly selectedBuilding = input<Building | null>(null);
    readonly buildingSelected = output<number>();
    readonly closeRequested = output<void>();

    readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
    readonly state = signal<MapLoadState>('loading');
    readonly setupError = signal<string | null>(null);
    readonly viewportError = signal<string | null>(null);
    readonly coordinateNotice = signal<string | null>(null);
    readonly tileError = signal(false);
    readonly yandexMapsUrl = signal(YANDEX_MAPS_URL);
    readonly yandexLogoUrl = YANDEX_LOGO_URL;
    readonly yandexTermsUrl = YANDEX_MAPS_TERMS_URL;

    private mapLibre: MapLibreModule | null = null;
    private map: MapInstance | null = null;
    private popup: MapPopup | null = null;
    private destroyed = false;
    private initializationGeneration = 0;
    private viewportGeneration = 0;
    private focusGeneration = 0;
    private viewportTimer: ReturnType<typeof setTimeout> | null = null;
    private sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private viewportSubscription: Subscription | null = null;
    private focusSubscription: Subscription | null = null;
    private resizeObserver: ResizeObserver | null = null;


    constructor() {
        this.destroyRef.onDestroy(() => this.destroyMap());

        this.companyContext.companyChanged$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => {
            if (!this.map || this.destroyed) {
                return;
            }
            this.viewportGeneration += 1;
            this.focusGeneration += 1;
            this.viewportSubscription?.unsubscribe();
            this.focusSubscription?.unsubscribe();
            this.setBuildingData(EMPTY_FEATURES);
            void this.refreshTileSession(true);
            this.scheduleViewportLoad(0);
        });

        effect(() => {
            const selectedObject = this.selectedObject();
            const selectedBuilding = this.selectedBuilding();
            if (!this.map) {
                return;
            }
            this.updateSelectedBuildingLayer(selectedBuilding?.id ?? null);
            this.focusSelection(selectedObject, selectedBuilding);
        });
    }


    ngAfterViewInit(): void {
        void this.initializeMap();
    }


    retrySetup(): void {
        void this.initializeMap();
    }


    retryViewport(): void {
        this.loadViewport();
    }


    private async initializeMap(): Promise<void> {
        const generation = ++this.initializationGeneration;
        this.state.set('loading');
        this.setupError.set(null);
        this.tileError.set(false);
        try {
            const [mapLibre, session] = await Promise.all([
                this.mapLibreLoader.load(),
                this.firstValueFromSession(),
            ]);
            if (this.destroyed || generation !== this.initializationGeneration) {
                return;
            }
            this.destroyCurrentMap();
            this.mapLibre = mapLibre;
            const map = new mapLibre.Map({
                container: this.mapContainer().nativeElement,
                center: DEFAULT_MAP_CENTER,
                zoom: DEFAULT_MAP_ZOOM,
                minZoom: session.min_zoom,
                maxZoom: session.max_zoom,
                attributionControl: false,
                style: {
                    version: 8,
                    sources: {
                        [MAP_SOURCE_ID]: {
                            type: 'raster',
                            tiles: [session.tile_url_template],
                            tileSize: session.tile_size,
                            minzoom: session.min_zoom,
                            maxzoom: session.max_zoom,
                            attribution: '© Яндекс',
                        },
                    },
                    layers: [{
                        id: 'yandex-map-layer',
                        type: 'raster',
                        source: MAP_SOURCE_ID,
                    }],
                },
            });
            this.map = map;
            if (typeof ResizeObserver !== 'undefined') {
                this.resizeObserver = new ResizeObserver(() => map.resize());
                this.resizeObserver.observe(this.mapContainer().nativeElement);
            }
            map.addControl(new mapLibre.NavigationControl(), 'top-right');
            map.on('load', () => {
                if (this.destroyed || this.map !== map) {
                    return;
                }
                this.addBuildingLayers(map);
                this.state.set('ready');
                this.scheduleSessionRefresh(session);
                this.updateExternalMapLink();
                this.focusSelection(this.selectedObject(), this.selectedBuilding());
                this.loadViewport();
            });
            map.on('moveend', () => {
                this.updateExternalMapLink();
                this.scheduleViewportLoad();
            });
            map.on('error', event => {
                const sourceId = 'sourceId' in event ? event.sourceId : undefined;
                if (sourceId === MAP_SOURCE_ID) {
                    this.tileError.set(true);
                }
            });
        } catch (error) {
            if (this.destroyed || generation !== this.initializationGeneration) {
                return;
            }
            this.state.set('error');
            this.setupError.set(
                error instanceof HttpErrorResponse && error.status === 503
                    ? 'Карта не настроена на сервере'
                    : 'Не удалось загрузить карту',
            );
        }
    }


    private firstValueFromSession(): Promise<MapTileSession> {
        return firstValueFrom(this.mapData.createTileSession());
    }


    private addBuildingLayers(map: MapInstance): void {
        this.addBuildingMarkerImage(map);
        map.addSource(MAP_BUILDINGS_SOURCE_ID, {
            type: 'geojson',
            data: EMPTY_FEATURES,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 48,
        });
        map.addLayer({
            id: 'building-clusters',
            type: 'circle',
            source: MAP_BUILDINGS_SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': '#18181b',
                'circle-radius': [
                    'step', ['get', 'point_count'], 17, 20, 21, 100, 26,
                ],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
            },
        });
        map.addLayer({
            id: 'building-cluster-count',
            type: 'symbol',
            source: MAP_BUILDINGS_SOURCE_ID,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-size': 12,
            },
            paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
            id: 'selected-building-point',
            type: 'circle',
            source: MAP_BUILDINGS_SOURCE_ID,
            filter: ['==', ['get', 'id'], -1],
            paint: {
                'circle-color': '#ef4444',
                'circle-radius': 14,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 3,
            },
        });
        map.addLayer({
            id: 'building-points',
            type: 'symbol',
            source: MAP_BUILDINGS_SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': BUILDING_MARKER_IMAGE,
                'icon-size': 0.8,
                'icon-allow-overlap': true,
            },
        });
        map.on('click', 'building-clusters', event => {
            const feature = event.features?.[0];
            const clusterId = Number(feature?.properties?.['cluster_id']);
            const source = map.getSource(MAP_BUILDINGS_SOURCE_ID) as GeoJSONSource;
            if (!Number.isFinite(clusterId)) {
                return;
            }
            void source.getClusterExpansionZoom(clusterId).then(zoom => {
                if (feature?.geometry.type !== 'Point') {
                    return;
                }
                map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
            });
        });
        map.on('click', 'building-points', event => {
            const feature = event.features?.[0];
            if (!feature || feature.geometry.type !== 'Point') {
                return;
            }
            const id = Number(feature.properties?.['id']);
            const fullAddress = String(feature.properties?.['full_address'] ?? '');
            if (!Number.isInteger(id) || !fullAddress) {
                return;
            }
            this.showBuildingPopup(
                feature.geometry.coordinates as [number, number],
                id,
                fullAddress,
            );
        });
        for (const layerId of ['building-clusters', 'building-points']) {
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        }
    }


    private addBuildingMarkerImage(map: MapInstance): void {
        if (map.hasImage(BUILDING_MARKER_IMAGE)) {
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const context = canvas.getContext('2d');
        if (!context) {
            return;
        }
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.lineWidth = 2.5;
        context.strokeStyle = '#18181b';
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.moveTo(5, 15);
        context.lineTo(16, 5);
        context.lineTo(27, 15);
        context.lineTo(24, 15);
        context.lineTo(24, 27);
        context.lineTo(8, 27);
        context.lineTo(8, 15);
        context.closePath();
        context.fill();
        context.stroke();
        context.beginPath();
        context.rect(14, 20, 5, 7);
        context.stroke();
        map.addImage(
            BUILDING_MARKER_IMAGE,
            context.getImageData(0, 0, canvas.width, canvas.height),
        );
    }


    private showBuildingPopup(
        coordinates: [number, number],
        buildingId: number,
        fullAddress: string,
    ): void {
        if (!this.map || !this.mapLibre) {
            return;
        }
        this.popup?.remove();
        const container = document.createElement('div');
        container.className = 'grid gap-2';
        const address = document.createElement('p');
        address.className = 'text-sm font-medium';
        address.textContent = fullAddress;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'text-sm underline underline-offset-4';
        button.textContent = 'Подробнее';
        button.addEventListener('click', () => {
            this.buildingSelected.emit(buildingId);
            this.popup?.remove();
        });
        container.append(address, button);
        this.popup = new this.mapLibre.Popup({ closeButton: true })
            .setLngLat(coordinates)
            .setDOMContent(container)
            .addTo(this.map);
    }


    private scheduleViewportLoad(delay = MAP_VIEWPORT_DEBOUNCE_MS): void {
        if (this.viewportTimer !== null) {
            clearTimeout(this.viewportTimer);
        }
        this.viewportTimer = setTimeout(() => {
            this.viewportTimer = null;
            this.loadViewport();
        }, delay);
    }


    private loadViewport(): void {
        const map = this.map;
        if (!map || !map.isStyleLoaded()) {
            return;
        }
        const bounds = map.getBounds();
        const viewport: MapBounds = {
            west: Math.max(-180, bounds.getWest()),
            south: Math.max(-90, bounds.getSouth()),
            east: Math.min(180, bounds.getEast()),
            north: Math.min(90, bounds.getNorth()),
        };
        if (viewport.west >= viewport.east || viewport.south >= viewport.north) {
            return;
        }
        const generation = ++this.viewportGeneration;
        this.viewportSubscription?.unsubscribe();
        this.viewportError.set(null);
        this.viewportSubscription = this.mapData.getBuildings(viewport).subscribe({
            next: data => {
                if (generation !== this.viewportGeneration || this.destroyed) {
                    return;
                }
                this.setBuildingData(data);
                this.updateSelectedBuildingLayer(this.selectedBuilding()?.id ?? null);
            },
            error: error => {
                if (generation !== this.viewportGeneration || this.destroyed) {
                    return;
                }
                this.viewportError.set(
                    error instanceof HttpErrorResponse && error.status === 422
                        ? 'Слишком много зданий. Увеличьте масштаб карты.'
                        : 'Не удалось загрузить здания для этой области',
                );
            },
        });
    }


    private setBuildingData(data: MapBuildingFeatureCollection): void {
        const source = this.map?.getSource(MAP_BUILDINGS_SOURCE_ID) as GeoJSONSource | undefined;
        source?.setData(data);
    }


    private focusSelection(
        addressObject: AddressObject | null,
        building: Building | null,
    ): void {
        const map = this.map;
        if (!map || !map.isStyleLoaded()) {
            return;
        }
        const latitude = Number(building?.latitude);
        const longitude = Number(building?.longitude);
        if (
            building
            && Number.isFinite(latitude)
            && latitude >= -90
            && latitude <= 90
            && Number.isFinite(longitude)
            && longitude >= -180
            && longitude <= 180
        ) {
            this.coordinateNotice.set(null);
            this.focusGeneration += 1;
            this.focusSubscription?.unsubscribe();
            map.easeTo({
                center: [longitude, latitude],
                zoom: Math.max(map.getZoom(), 16),
            });
            return;
        }
        this.coordinateNotice.set(
            building
                ? 'Для выбранного здания координаты ещё не заданы.'
                : null,
        );
        if (!addressObject) {
            return;
        }
        const generation = ++this.focusGeneration;
        this.focusSubscription?.unsubscribe();
        this.focusSubscription = this.mapData
            .getAddressObjectBounds(addressObject.id)
            .subscribe({
                next: result => {
                    if (generation !== this.focusGeneration || this.destroyed) {
                        return;
                    }
                    if (!result.bounds) {
                        if (!building) {
                            this.coordinateNotice.set(
                                'Для выбранного объекта координаты ещё не заданы.',
                            );
                        }
                        return;
                    }
                    if (!building) {
                        this.coordinateNotice.set(null);
                    }
                    const { west, south, east, north } = result.bounds;
                    if (west === east && south === north) {
                        map.easeTo({ center: [west, south], zoom: 16 });
                    } else {
                        map.fitBounds([[west, south], [east, north]], {
                            padding: 64,
                            maxZoom: 17,
                        });
                    }
                },
                error: () => undefined,
            });
    }


    private updateSelectedBuildingLayer(buildingId: number | null): void {
        if (!this.map?.getLayer('selected-building-point')) {
            return;
        }
        this.map.setFilter(
            'selected-building-point',
            ['==', ['get', 'id'], buildingId ?? -1],
        );
    }


    private scheduleSessionRefresh(session: MapTileSession): void {
        if (this.sessionRefreshTimer !== null) {
            clearTimeout(this.sessionRefreshTimer);
        }
        const delay = Math.max(
            1000,
            (session.expires_at - Math.floor(Date.now() / 1000)
                - MAP_SESSION_REFRESH_MARGIN_SECONDS) * 1000,
        );
        this.sessionRefreshTimer = setTimeout(() => {
            this.sessionRefreshTimer = null;
            void this.refreshTileSession(false);
        }, delay);
    }


    private async refreshTileSession(forceVisibleError: boolean): Promise<void> {
        try {
            const session = await this.firstValueFromSession();
            if (this.destroyed || !this.map) {
                return;
            }
            const source = this.map.getSource(MAP_SOURCE_ID) as RasterTileSource | undefined;
            source?.setTiles([session.tile_url_template]);
            this.tileError.set(false);
            this.scheduleSessionRefresh(session);
        } catch {
            if (forceVisibleError || !this.destroyed) {
                this.tileError.set(true);
            }
        }
    }


    private updateExternalMapLink(): void {
        if (!this.map) {
            return;
        }
        const center = this.map.getCenter();
        const zoom = this.map.getZoom().toFixed(2);
        this.yandexMapsUrl.set(
            `${YANDEX_MAPS_URL}?ll=${center.lng.toFixed(6)}%2C${center.lat.toFixed(6)}&z=${zoom}`,
        );
    }


    private destroyCurrentMap(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.popup?.remove();
        this.popup = null;
        this.map?.remove();
        this.map = null;
    }


    private destroyMap(): void {
        this.destroyed = true;
        this.initializationGeneration += 1;
        this.viewportGeneration += 1;
        this.focusGeneration += 1;
        if (this.viewportTimer !== null) {
            clearTimeout(this.viewportTimer);
        }
        if (this.sessionRefreshTimer !== null) {
            clearTimeout(this.sessionRefreshTimer);
        }
        this.viewportSubscription?.unsubscribe();
        this.focusSubscription?.unsubscribe();
        this.destroyCurrentMap();
    }
}
