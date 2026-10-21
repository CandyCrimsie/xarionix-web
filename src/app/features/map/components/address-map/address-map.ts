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
import type { FeatureCollection, Point } from 'geojson';
import { toast } from '@spartan-ng/brain/sonner';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideBuilding2,
    lucideMapPinPlus,
    lucideLoaderCircle,
    lucideRefreshCw,
    lucideTrash2,
    lucideTriangleAlert,
    lucideX,
} from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAlertDialog, HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialog, HlmDialogImports } from '@spartan-ng/helm/dialog';

import type { AddressObject, Building } from '../../../../core/addresses/address.models';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import {
    MAP_BUILDING_FOCUS_ZOOM,
    MAP_BUILDINGS_SOURCE_ID,
    MAP_MARKERS_SOURCE_ID,
    MAP_SESSION_REFRESH_MARGIN_SECONDS,
    MAP_SOURCE_ID,
    MAP_VIEWPORT_DEBOUNCE_MS,
    YANDEX_LOGO_URL,
    YANDEX_MAPS_TERMS_URL,
    YANDEX_MAPS_URL,
} from '../../map.config';
import {
    createDefaultMapMarker,
    mapMarkerIconSvg,
} from '../../map-marker.config';
import type {
    MapBounds,
    MapBuildingFeatureCollection,
    MapMarker,
    MapMarkerPayload,
    MapTileSession,
} from '../../models/map.models';
import { MapDataService } from '../../services/map-data.service';
import {
    MapLibreLoaderService,
    type MapLibreModule,
} from '../../services/maplibre-loader.service';
import { MapMarkerEditor } from '../map-marker-editor/map-marker-editor';


type MapInstance = import('maplibre-gl').Map;
type RasterTileSource = import('maplibre-gl').RasterTileSource;
type GeoJSONSource = import('maplibre-gl').GeoJSONSource;
type MapPopup = import('maplibre-gl').Popup;
type DraggableMapMarker = import('maplibre-gl').Marker;
type MapLoadState = 'loading' | 'ready' | 'error';

const EMPTY_FEATURES: MapBuildingFeatureCollection = {
    type: 'FeatureCollection',
    features: [],
};
const BUILDING_MARKER_IMAGE = 'xarionix-building-marker';
interface CustomMarkerFeatureProperties {
    id: number;
    image_key: string;
    label_text: string;
    text_color: string;
    text_opacity: number;
    marker_opacity: number;
}


const EMPTY_MARKER_FEATURES: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: [],
};


@Component({
    selector: 'app-address-map',
    imports: [
        NgIcon,
        HlmAlertImports,
        HlmAlertDialogImports,
        HlmButtonImports,
        HlmDialogImports,
        MapMarkerEditor,
    ],
    providers: [provideIcons({
        lucideBuilding2,
        lucideMapPinPlus,
        lucideLoaderCircle,
        lucideRefreshCw,
        lucideTrash2,
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
    readonly canManage = input(false);
    readonly buildingSelected = output<number>();
    readonly closeRequested = output<void>();

    readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
    readonly markerDialog = viewChild<HlmDialog>('markerDialog');
    readonly deleteMarkerDialog = viewChild<HlmAlertDialog>('deleteMarkerDialog');
    readonly state = signal<MapLoadState>('loading');
    readonly setupError = signal<string | null>(null);
    readonly viewportError = signal<string | null>(null);
    readonly coordinateNotice = signal<string | null>(null);
    readonly yandexMapsUrl = signal(YANDEX_MAPS_URL);
    readonly markers = signal<MapMarker[]>([]);
    readonly markerDraft = signal<MapMarkerPayload>(createDefaultMapMarker());
    readonly editingMarker = signal<MapMarker | null>(null);
    readonly markerSaving = signal(false);
    readonly markerError = signal<string | null>(null);
    readonly placingMarker = signal(false);
    readonly markerToDelete = signal<MapMarker | null>(null);
    readonly markerDeleting = signal(false);
    readonly yandexLogoUrl = YANDEX_LOGO_URL;
    readonly yandexTermsUrl = YANDEX_MAPS_TERMS_URL;

    private mapLibre: MapLibreModule | null = null;
    private map: MapInstance | null = null;
    private popup: MapPopup | null = null;
    private destroyed = false;
    private initializationGeneration = 0;
    private viewportGeneration = 0;
    private focusGeneration = 0;
    private markerMutationGeneration = 0;
    private viewportTimer: ReturnType<typeof setTimeout> | null = null;
    private sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private viewportSubscription: Subscription | null = null;
    private markerViewportSubscription: Subscription | null = null;
    private focusSubscription: Subscription | null = null;
    private sessionRefreshPromise: Promise<void> | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private placementMarker: DraggableMapMarker | null = null;
    private placementOriginalCoordinates: [number, number] | null = null;
    private placementClickHandler: ((event: { lngLat: { lng: number; lat: number } }) => void) | null = null;
    private readonly pendingMarkerImages = new Set<string>();


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
            this.markerMutationGeneration += 1;
            this.viewportSubscription?.unsubscribe();
            this.markerViewportSubscription?.unsubscribe();
            this.focusSubscription?.unsubscribe();
            this.setBuildingData(EMPTY_FEATURES);
            this.markers.set([]);
            this.setMarkerData([]);
            this.placingMarker.set(false);
            this.cleanupPointSelection();
            void this.refreshTileSession();
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
                center: [session.default_longitude, session.default_latitude],
                zoom: session.default_zoom,
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
                this.addCustomMarkerLayers(map);
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


    private addCustomMarkerLayers(map: MapInstance): void {
        if (map.getSource(MAP_MARKERS_SOURCE_ID)) {
            return;
        }
        map.addSource(MAP_MARKERS_SOURCE_ID, {
            type: 'geojson',
            data: EMPTY_MARKER_FEATURES,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 42,
        });
        map.addLayer({
            id: 'custom-marker-clusters',
            type: 'circle',
            source: MAP_MARKERS_SOURCE_ID,
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': '#2563eb',
                'circle-radius': [
                    'step', ['get', 'point_count'], 16, 20, 20, 100, 25,
                ],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
            },
        });
        map.addLayer({
            id: 'custom-marker-cluster-count',
            type: 'symbol',
            source: MAP_MARKERS_SOURCE_ID,
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-size': 12,
            },
            paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
            id: 'custom-marker-points',
            type: 'symbol',
            source: MAP_MARKERS_SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': ['get', 'image_key'],
                'icon-size': 1,
                'icon-allow-overlap': true,
            },
            paint: {
                'icon-opacity': ['get', 'marker_opacity'],
            },
        });
        map.addLayer({
            id: 'custom-marker-labels',
            type: 'symbol',
            source: MAP_MARKERS_SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'text-field': ['get', 'label_text'],
                'text-size': 13,
                'text-anchor': 'top',
                'text-offset': [0, 2.2],
                'text-allow-overlap': false,
            },
            paint: {
                'text-color': ['get', 'text_color'],
                'text-opacity': ['get', 'text_opacity'],
                'text-halo-color': 'rgba(0, 0, 0, 0.65)',
                'text-halo-width': 1,
            },
        });
        map.on('click', 'custom-marker-clusters', event => {
            const feature = event.features?.[0];
            const clusterId = Number(feature?.properties?.['cluster_id']);
            const source = map.getSource(MAP_MARKERS_SOURCE_ID) as GeoJSONSource;
            if (!Number.isFinite(clusterId)) {
                return;
            }
            void source.getClusterExpansionZoom(clusterId).then(zoom => {
                if (feature?.geometry.type === 'Point') {
                    map.easeTo({
                        center: feature.geometry.coordinates as [number, number],
                        zoom,
                    });
                }
            });
        });
        map.on('click', 'custom-marker-points', event => {
            const feature = event.features?.[0];
            const id = Number(feature?.properties?.['id']);
            if (!Number.isInteger(id) || feature?.geometry.type !== 'Point') {
                return;
            }
            const marker = this.markers().find(item => item.id === id);
            if (marker) {
                this.showCustomMarkerPopup(
                    feature.geometry.coordinates as [number, number],
                    marker,
                );
            }
        });
        for (const layerId of ['custom-marker-clusters', 'custom-marker-points']) {
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        }
    }


    private setMarkerData(markers: MapMarker[]): void {
        const map = this.map;
        const source = map?.getSource(MAP_MARKERS_SOURCE_ID) as GeoJSONSource | undefined;
        if (!map || !source) {
            return;
        }
        const data: FeatureCollection<Point, CustomMarkerFeatureProperties> = {
            type: 'FeatureCollection',
            features: markers.map(marker => {
                const imageKey = this.markerImageKey(marker);
                this.prepareMarkerImage(map, marker, imageKey);
                return {
                    type: 'Feature',
                    id: marker.id,
                    geometry: {
                        type: 'Point',
                        coordinates: [marker.longitude, marker.latitude],
                    },
                    properties: {
                        id: marker.id,
                        image_key: imageKey,
                        label_text: marker.label_text ?? '',
                        text_color: marker.text_color,
                        text_opacity: marker.text_opacity * marker.marker_opacity,
                        marker_opacity: marker.marker_opacity,
                    },
                };
            }),
        };
        source.setData(data);
    }


    private markerImageKey(marker: MapMarkerPayload): string {
        const signature = JSON.stringify({
            icon_name: marker.icon_name,
            icon_color: marker.icon_color,
            icon_opacity: marker.icon_opacity,
            background_enabled: marker.background_enabled,
            background_color: marker.background_color,
            background_opacity: marker.background_opacity,
            border_enabled: marker.border_enabled,
            border_color: marker.border_color,
            border_width: marker.border_width,
            border_opacity: marker.border_opacity,
            marker_size: marker.marker_size,
            marker_shape: marker.marker_shape,
        });
        let hash = 2166136261;
        for (let index = 0; index < signature.length; index += 1) {
            hash ^= signature.charCodeAt(index);
            hash = Math.imul(hash, 16777619);
        }
        return `xarionix-marker-${(hash >>> 0).toString(16)}`;
    }


    private prepareMarkerImage(
        map: MapInstance,
        marker: MapMarkerPayload,
        imageKey: string,
    ): void {
        if (map.hasImage(imageKey) || this.pendingMarkerImages.has(imageKey)) {
            return;
        }
        this.pendingMarkerImages.add(imageKey);
        const size = { small: 32, normal: 42, large: 54 }[marker.marker_size];
        const width = marker.marker_shape === 'pill' ? Math.round(size * 1.4) : size;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
            this.pendingMarkerImages.delete(imageKey);
            return;
        }
        this.drawMarkerBackground(context, marker, width, size);
        const svg = mapMarkerIconSvg(marker.icon_name);
        if (!svg) {
            this.addPreparedMarkerImage(map, imageKey, context, canvas);
            return;
        }
        const image = new Image();
        image.addEventListener('load', () => {
            const iconSize = Math.round(size * 0.52);
            context.globalAlpha = marker.icon_opacity;
            context.drawImage(
                image,
                (width - iconSize) / 2,
                (size - iconSize) / 2,
                iconSize,
                iconSize,
            );
            context.globalAlpha = 1;
            this.addPreparedMarkerImage(map, imageKey, context, canvas);
        }, { once: true });
        image.addEventListener('error', () => {
            this.addPreparedMarkerImage(map, imageKey, context, canvas);
        }, { once: true });
        const coloredSvg = svg.replaceAll('currentColor', marker.icon_color);
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coloredSvg)}`;
    }


    private drawMarkerBackground(
        context: CanvasRenderingContext2D,
        marker: MapMarkerPayload,
        width: number,
        height: number,
    ): void {
        const backgroundEnabled = marker.background_enabled && marker.marker_shape !== 'icon';
        const borderEnabled = marker.border_enabled && marker.marker_shape !== 'icon';
        if (!backgroundEnabled && !borderEnabled) {
            return;
        }
        const inset = borderEnabled ? marker.border_width / 2 + 1 : 1;
        const x = inset;
        const y = inset;
        const shapeWidth = width - inset * 2;
        const shapeHeight = height - inset * 2;
        const radius = marker.marker_shape === 'circle' || marker.marker_shape === 'pill'
            ? shapeHeight / 2
            : Math.min(10, shapeHeight / 4);
        context.beginPath();
        context.roundRect(x, y, shapeWidth, shapeHeight, radius);
        if (backgroundEnabled) {
            context.globalAlpha = marker.background_opacity;
            context.fillStyle = marker.background_color;
            context.fill();
        }
        if (borderEnabled && marker.border_width > 0) {
            context.globalAlpha = marker.border_opacity;
            context.lineWidth = marker.border_width;
            context.strokeStyle = marker.border_color;
            context.stroke();
        }
        context.globalAlpha = 1;
    }


    private addPreparedMarkerImage(
        map: MapInstance,
        imageKey: string,
        context: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
    ): void {
        this.pendingMarkerImages.delete(imageKey);
        if (this.destroyed || this.map !== map || map.hasImage(imageKey)) {
            return;
        }
        map.addImage(
            imageKey,
            context.getImageData(0, 0, canvas.width, canvas.height),
            { pixelRatio: 1 },
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


    private showCustomMarkerPopup(
        coordinates: [number, number],
        marker: MapMarker,
    ): void {
        if (!this.map || !this.mapLibre) {
            return;
        }
        this.popup?.remove();
        const container = document.createElement('div');
        container.className = 'grid min-w-52 gap-2';
        const title = document.createElement('p');
        title.className = 'text-sm font-medium';
        title.textContent = marker.name;
        container.append(title);
        if (marker.description) {
            const description = document.createElement('p');
            description.className = 'text-xs text-muted-foreground';
            description.textContent = marker.description;
            container.append(description);
        }
        const coordinatesText = document.createElement('p');
        coordinatesText.className = 'text-xs tabular-nums text-muted-foreground';
        coordinatesText.textContent = (
            `${marker.latitude.toFixed(6)} / ${marker.longitude.toFixed(6)}`
        );
        container.append(coordinatesText);
        if (this.canManage()) {
            const actions = document.createElement('div');
            actions.className = 'flex gap-3 pt-1 text-sm';
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'underline underline-offset-4';
            edit.textContent = 'Редактировать';
            edit.addEventListener('click', () => this.startEditMarker(marker));
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'text-destructive underline underline-offset-4';
            remove.textContent = 'Удалить';
            remove.addEventListener('click', () => this.requestDeleteMarker(marker));
            actions.append(edit, remove);
            container.append(actions);
        }
        this.popup = new this.mapLibre.Popup({ closeButton: true, maxWidth: '320px' })
            .setLngLat(coordinates)
            .setDOMContent(container)
            .addTo(this.map);
    }


    startCreateMarker(): void {
        const center = this.map?.getCenter();
        this.editingMarker.set(null);
        this.markerError.set(null);
        this.markerDraft.set(createDefaultMapMarker(center?.lat, center?.lng));
    }


    startEditMarker(marker: MapMarker): void {
        this.popup?.remove();
        this.editingMarker.set(marker);
        this.markerError.set(null);
        const {
            id: _id,
            company_id: _companyId,
            created_at: _createdAt,
            updated_at: _updatedAt,
            ...draft
        } = marker;
        this.markerDraft.set(draft);
        this.markerDialog()?.open();
    }


    saveMarker(): void {
        if (this.markerSaving()) {
            return;
        }
        const generation = ++this.markerMutationGeneration;
        const editing = this.editingMarker();
        const draft = this.markerDraft();
        this.markerSaving.set(true);
        this.markerError.set(null);
        const request = editing
            ? this.mapData.updateMarker(editing.id, draft)
            : this.mapData.createMarker(draft);
        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: saved => {
                if (generation !== this.markerMutationGeneration || this.destroyed) {
                    return;
                }
                this.markerSaving.set(false);
                this.markers.update(current => {
                    const withoutSaved = current.filter(item => item.id !== saved.id);
                    return [...withoutSaved, saved];
                });
                this.setMarkerData(this.markers());
                this.markerDialog()?.close({});
                this.editingMarker.set(null);
                toast.success(editing ? 'Маркер изменён' : 'Маркер создан');
            },
            error: () => {
                if (generation !== this.markerMutationGeneration || this.destroyed) {
                    return;
                }
                this.markerSaving.set(false);
                this.markerError.set('Проверьте поля и повторите попытку. Введённые данные сохранены в форме.');
            },
        });
    }


    requestDeleteMarker(marker: MapMarker): void {
        this.popup?.remove();
        this.markerToDelete.set(marker);
        this.deleteMarkerDialog()?.open();
    }


    deleteMarker(): void {
        const marker = this.markerToDelete();
        if (!marker || this.markerDeleting()) {
            return;
        }
        const generation = ++this.markerMutationGeneration;
        this.markerDeleting.set(true);
        this.mapData.deleteMarker(marker.id).pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe({
            next: () => {
                if (generation !== this.markerMutationGeneration || this.destroyed) {
                    return;
                }
                this.markerDeleting.set(false);
                this.markers.update(current => current.filter(item => item.id !== marker.id));
                this.setMarkerData(this.markers());
                this.deleteMarkerDialog()?.close({});
                this.markerToDelete.set(null);
                toast.success('Маркер удалён');
            },
            error: () => {
                if (generation !== this.markerMutationGeneration || this.destroyed) {
                    return;
                }
                this.markerDeleting.set(false);
                toast.error('Не удалось удалить маркер');
            },
        });
    }


    startPointSelection(): void {
        const map = this.map;
        const mapLibre = this.mapLibre;
        if (!map || !mapLibre) {
            return;
        }
        const draft = this.markerDraft();
        this.markerDialog()?.close({});
        this.cleanupPointSelection();
        this.placementOriginalCoordinates = [draft.longitude, draft.latitude];
        this.placingMarker.set(true);
        this.placementMarker = new mapLibre.Marker({
            draggable: true,
            color: draft.background_color,
        })
            .setLngLat([draft.longitude, draft.latitude])
            .addTo(map);
        this.placementMarker.on('dragend', () => {
            const position = this.placementMarker?.getLngLat();
            if (position) {
                this.applyDraftCoordinates(position.lng, position.lat);
            }
        });
        this.placementClickHandler = event => {
            this.placementMarker?.setLngLat([event.lngLat.lng, event.lngLat.lat]);
            this.applyDraftCoordinates(event.lngLat.lng, event.lngLat.lat);
        };
        map.on('click', this.placementClickHandler);
        map.getCanvas().style.cursor = 'crosshair';
    }


    confirmPointSelection(): void {
        this.placingMarker.set(false);
        this.cleanupPointSelection();
        this.markerDialog()?.open();
    }


    cancelPointSelection(): void {
        const original = this.placementOriginalCoordinates;
        if (original) {
            this.applyDraftCoordinates(original[0], original[1]);
        }
        this.placingMarker.set(false);
        this.cleanupPointSelection();
        this.markerDialog()?.open();
    }


    private applyDraftCoordinates(longitude: number, latitude: number): void {
        this.markerDraft.update(current => ({ ...current, longitude, latitude }));
    }


    private cleanupPointSelection(): void {
        if (this.map && this.placementClickHandler) {
            this.map.off('click', this.placementClickHandler);
        }
        this.placementClickHandler = null;
        this.placementMarker?.remove();
        this.placementMarker = null;
        this.placementOriginalCoordinates = null;
        if (this.map) {
            this.map.getCanvas().style.cursor = '';
        }
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
        this.markerViewportSubscription?.unsubscribe();
        this.markerViewportSubscription = this.mapData.getMarkers(viewport).subscribe({
            next: markers => {
                if (generation !== this.viewportGeneration || this.destroyed) {
                    return;
                }
                this.markers.set(markers);
                this.setMarkerData(markers);
            },
            error: () => {
                if (generation !== this.viewportGeneration || this.destroyed) {
                    return;
                }
                this.viewportError.set('Не удалось загрузить маркеры для этой области');
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
                zoom: Math.min(
                    map.getMaxZoom(),
                    Math.max(map.getZoom(), MAP_BUILDING_FOCUS_ZOOM),
                ),
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
            void this.refreshTileSession();
        }, delay);
    }


    private refreshTileSession(): Promise<void> {
        if (this.sessionRefreshPromise) {
            return this.sessionRefreshPromise;
        }
        const request = this.performTileSessionRefresh();
        const tracked = request.finally(() => {
            if (this.sessionRefreshPromise === tracked) {
                this.sessionRefreshPromise = null;
            }
        });
        this.sessionRefreshPromise = tracked;
        return tracked;
    }


    private async performTileSessionRefresh(): Promise<void> {
        try {
            const session = await this.firstValueFromSession();
            if (this.destroyed || !this.map) {
                return;
            }
            const source = this.map.getSource(MAP_SOURCE_ID) as RasterTileSource | undefined;
            source?.setTiles([session.tile_url_template]);
            this.scheduleSessionRefresh(session);
        } catch {
            // Keep the current signed tile URL. Reopening the map requests a
            // fresh session without replacing the usable map with an alert.
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
        this.cleanupPointSelection();
        this.pendingMarkerImages.clear();
        this.map?.remove();
        this.map = null;
    }


    private destroyMap(): void {
        this.destroyed = true;
        this.initializationGeneration += 1;
        this.viewportGeneration += 1;
        this.focusGeneration += 1;
        this.markerMutationGeneration += 1;
        if (this.viewportTimer !== null) {
            clearTimeout(this.viewportTimer);
        }
        if (this.sessionRefreshTimer !== null) {
            clearTimeout(this.sessionRefreshTimer);
        }
        this.viewportSubscription?.unsubscribe();
        this.markerViewportSubscription?.unsubscribe();
        this.focusSubscription?.unsubscribe();
        this.destroyCurrentMap();
    }
}
