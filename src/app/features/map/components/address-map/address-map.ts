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
    untracked,
    TemplateRef,
    viewChild,
    ViewContainerRef,
    computed,
    HostListener,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subscription, type Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { toast } from '@spartan-ng/brain/sonner';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideBuilding2,
    lucideMapPin,
    lucideMapPinPlus,
    lucideLoaderCircle,
    lucidePencil,
    lucideRefreshCw,
    lucideTrash2,
    lucideTriangleAlert,
    lucideX,
    lucideCable,
    lucideListFilter,
    lucideUndo2,
} from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAlertDialog, HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmButtonGroupImports } from '@spartan-ng/helm/button-group';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialog, HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { AddressApiService } from '../../../../core/addresses/address-api.service';

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
    mapAppearanceForTheme,
    MAP_POINT_TYPES,
    BUILDING_LINK_ROLES,
    pickMarkerAppearance,
} from '../../map-marker.config';
import type {
    MapBounds,
    MapBuildingFeatureCollection,
    MapMarker,
    MapMarkerPayload,
    MapTileSession,
    MapConnection,
    MapConnectionDraft,
    MapConnectionPayload,
    MapEndpointDetail,
    MapMarkerAppearance,
    MapStylePreset,
    BuildingBindingConflict,
} from '../../models/map.models';
import { createConnectionDraft } from '../../models/map.models';
import { createMarkerElement, markerImageKey, rasterizeMarker, labelHaloColor, MAP_FONT_FACES, MAP_LABEL_LAYOUT, MAP_TEXT_FONT } from '../../map-marker-renderer';
import { MapConnectionLayer, connectionLabel, routeCoordinates } from '../../map-connection-layer';
import { MapConnectionEditor, CONNECTION_STATUS_LABELS } from '../map-connection-editor/map-connection-editor';
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
const SELECTED_BUILDING_IMAGE = 'xarionix-building-selected';
const SELECTED_BUILDING_SOURCE_ID = 'xarionix-selected-building';
interface CustomMarkerFeatureProperties {
    id: number;
    image_key: string;
    label_text: string;
    text_color: string;
    text_halo_color: string;
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
        HlmButtonGroupImports,
        HlmCardImports,
        HlmDialogImports,
        HlmTooltipImports,
        MapMarkerEditor,
        MapConnectionEditor,
        HlmCheckboxImports,
    ],
    providers: [provideIcons({
        lucideBuilding2,
        lucideMapPin,
        lucideMapPinPlus,
        lucideLoaderCircle,
        lucidePencil,
        lucideRefreshCw,
        lucideTrash2,
        lucideTriangleAlert,
        lucideX,
        lucideCable,
        lucideListFilter,
        lucideUndo2,
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
    private readonly popupViews = inject(ViewContainerRef);
    private readonly addressApi = inject(AddressApiService);

    readonly selectedObject = input<AddressObject | null>(null);
    readonly selectedBuilding = input<Building | null>(null);
    readonly canManage = input(false);
    readonly buildingSelected = output<number>();
    readonly buildingCoordinatesChanged = output<Pick<Building, 'id' | 'latitude' | 'longitude'>>();
    readonly closeRequested = output<void>();

    readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
    readonly markerDialog = viewChild<HlmDialog>('markerDialog');
    readonly deleteMarkerDialog = viewChild<HlmAlertDialog>('deleteMarkerDialog');
    readonly markerPopup = viewChild.required<TemplateRef<{ $implicit: MapMarker }>>('markerPopup');
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
    readonly personalStyles = signal<MapStylePreset[]>([]);
    readonly bindingConflict = signal<BuildingBindingConflict | null>(null);
    readonly bindingDialog = viewChild<HlmAlertDialog>('bindingDialog');
    readonly connectionDialog = viewChild<HlmDialog>('connectionDialog');
    readonly connectionDeleteDialog = viewChild<HlmAlertDialog>('connectionDeleteDialog');
    readonly connectionPopup = viewChild.required<TemplateRef<{ $implicit: MapConnection }>>('connectionPopup');
    readonly buildingPopup = viewChild.required<TemplateRef<{ $implicit: { id: number; full_address: string } }>>('buildingPopup');
    readonly choicesPopup = viewChild.required<TemplateRef<{ $implicit: MapEndpointDetail[] }>>('choicesPopup');
    readonly connections = signal<MapConnection[]>([]);
    readonly connectionDraft = signal<MapConnectionDraft>(createConnectionDraft());
    readonly editingConnection = signal<MapConnection | null>(null);
    readonly connectionSaving = signal(false);
    readonly connectionError = signal<string | null>(null);
    readonly connectionToDelete = signal<MapConnection | null>(null);
    readonly connectionDeleting = signal(false);
    readonly connectionMapMode = signal<'source' | 'target' | 'vertices' | null>(null);
    readonly connectionDraftActive = signal(false);
    readonly selectedConnectionId = signal<number | null>(null);
    readonly selectedMarkerId = signal<number | null>(null);
    readonly popupBuildingId = signal<number | null>(null);
    readonly activeVertex = signal<number | null>(null);
    readonly routeHistory = signal<[number, number][][]>([]);
    readonly popupConnections = signal<MapConnection[]>([]);
    readonly markerDependencies = signal<MapConnection[]>([]);
    readonly markerDeleteError = signal<string | null>(null);
    readonly filterPanelOpen = signal(false);
    readonly showBuildings = signal(true);
    readonly showInfrastructure = signal(true);
    readonly showPersonal = signal(true);
    readonly showConnections = signal(true);
    readonly mediumFilter = signal<'all' | 'fiber' | 'utp'>('all');
    readonly statusFilter = signal<'all' | MapConnection['status']>('all');
    readonly dark = signal(document.documentElement.classList.contains('dark'));
    readonly pointTypeLabel = (type: string) => MAP_POINT_TYPES.find(item => item.value === type)?.label ?? 'Объект';
    readonly linkRoleLabel = (role: string) => BUILDING_LINK_ROLES.find(item => item.value === role)?.label ?? '';
    readonly connectionLabel = connectionLabel;
    readonly connectionStatusLabel = (status: MapConnection['status']) => CONNECTION_STATUS_LABELS[status];
    readonly yandexLogoUrl = YANDEX_LOGO_URL;
    readonly yandexTermsUrl = YANDEX_MAPS_TERMS_URL;

    private mapLibre: MapLibreModule | null = null;
    private map: MapInstance | null = null;
    private viewportBuildings: MapBuildingFeatureCollection = EMPTY_FEATURES;
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
    private placementOriginalDraft: MapMarkerPayload | null = null;
    private placementClickHandler: ((event: { lngLat: { lng: number; lat: number } }) => void) | null = null;
    private suppressFocusForBuildingId: number | null = null;
    private buildingImageSignature: string | null = null;
    private readonly pendingMarkerImages = new Set<string>();
    private readonly markerResources = new Set<string>();
    private usedMarkerImages = new Set<string>();
    private connectionLayer: MapConnectionLayer | null = null;
    private connectionViewportSubscription: Subscription | null = null;
    private contextGeneration = 0;
    private popupGeneration = 0;
    private connectionMutationGeneration = 0;
    private styleGeneration = 0;
    private sessionRetryCount = 0;
    private themeObserver: MutationObserver | null = null;
    private viewReady = false;
    private routeBeforeMap: MapConnectionDraft | null = null;


    constructor() {
        this.destroyRef.onDestroy(() => this.destroyMap());

        this.companyContext.companyChanged$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => {
            this.contextGeneration++;
            this.initializationGeneration++;
            this.viewportGeneration += 1;
            this.focusGeneration += 1;
            this.markerMutationGeneration += 1;
            this.connectionMutationGeneration++;
            this.styleGeneration++;
            this.viewportSubscription?.unsubscribe();
            this.markerViewportSubscription?.unsubscribe();
            this.connectionViewportSubscription?.unsubscribe();
            this.focusSubscription?.unsubscribe();
            this.closePopup();
            this.markerDialog()?.close({});
            this.deleteMarkerDialog()?.close({});
            this.bindingDialog()?.close({});
            this.connectionDialog()?.close({});
            this.connectionDeleteDialog()?.close({});
            this.markerDraft.set(createDefaultMapMarker());
            this.editingMarker.set(null);
            this.markerToDelete.set(null);
            this.markerSaving.set(false);
            this.markerDeleting.set(false);
            this.markerError.set(null);
            this.markerDeleteError.set(null);
            this.bindingConflict.set(null);
            this.personalStyles.set([]);
            this.connections.set([]);
            this.connectionDraft.set(createConnectionDraft());
            this.editingConnection.set(null);
            this.connectionToDelete.set(null);
            this.connectionSaving.set(false);
            this.connectionDeleting.set(false);
            this.connectionError.set(null);
            this.connectionMapMode.set(null);
            this.connectionDraftActive.set(false);
            this.selectedConnectionId.set(null);
            this.routeHistory.set([]);
            this.activeVertex.set(null);
            this.setBuildingData(EMPTY_FEATURES);
            this.markers.set([]);
            this.setMarkerData([]);
            this.placingMarker.set(false);
            this.cleanupPointSelection();
            this.sessionRefreshPromise = null;
            this.sessionRetryCount = 0;
            if (this.destroyed) return;
            if (!this.map) {
                if (this.viewReady) void this.initializeMap();
                return;
            }
            void this.refreshTileSession();
            this.loadPersonalStyles();
            this.scheduleViewportLoad(0);
        });

        effect(() => {
            const selectedObject = this.selectedObject();
            const selectedBuilding = this.selectedBuilding();
            if (!this.map) {
                return;
            }
            untracked(() => this.setMarkerData(this.markers()));
            this.focusSelection(selectedObject, selectedBuilding);
        });

        effect(() => {
            this.dark();
            this.showBuildings(); this.showInfrastructure(); this.showPersonal();
            const markers = this.markers();
            this.selectedMarkerId();
            const popupBuildingId = this.popupBuildingId();
            if (this.state() !== 'ready') return;
            untracked(() => {
                if (this.map) this.addBuildingMarkerImage(this.map);
                this.setMarkerData(markers);
                this.map?.setLayoutProperty('building-points', 'icon-image', ['case', ['==', ['get', 'id'], popupBuildingId ?? -1], SELECTED_BUILDING_IMAGE, BUILDING_MARKER_IMAGE]);
                this.map?.setFilter('building-popup-label', ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], popupBuildingId ?? -1]]);
                this.map?.setFilter('custom-marker-selected-label', ['all', ['!', ['has', 'point_count']], ['==', ['get', 'id'], this.selectedMarkerId() ?? -1]]);
                this.map?.setFilter('custom-marker-labels', ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], this.selectedMarkerId() ?? -1]]);
            });
        });
        effect(() => {
            this.connections(); this.selectedConnectionId(); this.showConnections(); this.mediumFilter(); this.statusFilter();
            const draft = this.connectionDraft();
            const active = this.connectionDraftActive();
            const mode = this.connectionMapMode();
            if (this.state() !== 'ready') return;
            untracked(() => {
                this.renderConnections();
                this.connectionLayer?.setDraft(active ? draft : null, mode === 'vertices');
            });
        });
    }


    ngAfterViewInit(): void {
        this.viewReady = true;
        if (typeof MutationObserver !== 'undefined') {
            this.themeObserver = new MutationObserver(() => this.dark.set(document.documentElement.classList.contains('dark')));
            this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
        void this.initializeMap();
    }


    retrySetup(): void {
        void this.initializeMap();
    }


    retryViewport(): void {
        this.sessionRetryCount = 0;
        void this.refreshTileSession();
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
            const buildingCenter = this.buildingCenter(this.selectedBuilding());
            const map = new mapLibre.Map({
                container: this.mapContainer().nativeElement,
                center: buildingCenter ?? [session.default_longitude, session.default_latitude],
                zoom: buildingCenter
                    ? Math.min(session.max_zoom, Math.max(session.min_zoom, MAP_BUILDING_FOCUS_ZOOM))
                    : session.default_zoom,
                minZoom: session.min_zoom,
                maxZoom: session.max_zoom,
                attributionControl: false,
                style: {
                    version: 8,
                    'font-faces': MAP_FONT_FACES,
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
                this.updateSelectedBuildingLayer(this.selectedBuilding()?.id ?? null);
                this.addCustomMarkerLayers(map);
                this.connectionLayer = new MapConnectionLayer(map,
                    (id, coordinate) => this.openConnectionPopup(id, coordinate),
                    index => { this.rememberRoute(); this.activeVertex.set(index); },
                    (index, coordinate) => this.moveRouteVertex(index, coordinate),
                );
                this.state.set('ready');
                this.scheduleSessionRefresh(session);
                this.updateExternalMapLink();
                this.focusSelection(this.selectedObject(), this.selectedBuilding());
                this.loadViewport();
                this.loadPersonalStyles();
            });
            map.on('click', event => {
                if (this.connectionMapMode() !== 'vertices') return;
                const vertex = map.queryRenderedFeatures(event.point, { layers: ['route-edit-vertices'] })[0];
                if (vertex) { this.activeVertex.set(Number(vertex.properties['index'])); return; }
                if (this.connectionDraft().vertices.length >= 498) { toast.error('Допускается не более 498 промежуточных вершин'); return; }
                this.rememberRoute();
                this.connectionDraft.update(draft => ({ ...draft, vertices: [...draft.vertices, [event.lngLat.lng, event.lngLat.lat]] }));
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
        // Keep the selected house visible even at zoom levels where the shared
        // building source combines its point with neighbouring houses.
        map.addSource(SELECTED_BUILDING_SOURCE_ID, { type: 'geojson', data: EMPTY_FEATURES });
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
                'text-font': MAP_TEXT_FONT,
                'text-size': 12,
            },
            paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
            id: 'building-points',
            type: 'symbol',
            source: MAP_BUILDINGS_SOURCE_ID,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': BUILDING_MARKER_IMAGE,
                'icon-size': 1,
                'icon-allow-overlap': true,
            },
        });
        map.addLayer({
            id: 'building-popup-label', type: 'symbol', source: MAP_BUILDINGS_SOURCE_ID,
            filter: ['==', ['get', 'id'], -1],
            layout: { 'text-field': ['concat', 'д. ', ['get', 'number']], ...MAP_LABEL_LAYOUT, 'text-allow-overlap': true },
            paint: { 'text-color': '#465366', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1 },
        });
        map.addLayer({
            id: 'selected-building-marker',
            type: 'symbol',
            source: SELECTED_BUILDING_SOURCE_ID,
            layout: {
                'icon-image': ['coalesce', ['get', 'image_key'], SELECTED_BUILDING_IMAGE],
                'icon-size': 1,
                'icon-allow-overlap': true,
            },
            paint: { 'icon-opacity': ['coalesce', ['get', 'marker_opacity'], 1] },
        });
        map.addLayer({
            id: 'selected-building-marker-label',
            type: 'symbol',
            source: SELECTED_BUILDING_SOURCE_ID,
            layout: {
                'text-field': ['coalesce', ['get', 'label_text'], ''],
                ...MAP_LABEL_LAYOUT,
                'text-allow-overlap': false,
            },
            paint: {
                'text-color': ['coalesce', ['get', 'text_color'], '#ffffff'],
                'text-opacity': ['coalesce', ['get', 'text_opacity'], 1],
                'text-halo-color': ['coalesce', ['get', 'text_halo_color'], '#FFFFFF'],
                'text-halo-width': 0.75,
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
                if (this.destroyed || this.map !== map || feature?.geometry.type !== 'Point') {
                    return;
                }
                map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
            }).catch(() => {});
        });
        for (const layerId of ['building-points', 'selected-building-marker']) {
            map.on('click', layerId, event => {
                if (this.handlePointClick(event, 'building')) return;
                const feature = event.features?.[0];
                if (!feature || feature.geometry.type !== 'Point') {
                    return;
                }
                const markerId = feature.properties?.['marker_id'];
                if (markerId !== undefined) {
                    const marker = this.markers().find(item => item.id === Number(markerId));
                    if (marker) {
                        this.showBuildingPopup(feature.geometry.coordinates as [number, number], marker.building_id!, marker.building_full_address ?? marker.name);
                    }
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
        }
        for (const layerId of ['building-clusters', 'building-points', 'selected-building-marker']) {
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
        }
    }


    private addBuildingMarkerImage(map: MapInstance): void {
        const appearance = { ...mapAppearanceForTheme(this.dark()), icon_name: 'map-house' };
        const signature = markerImageKey({ ...appearance, label_text: null });
        if (this.buildingImageSignature === signature) return;
        this.buildingImageSignature = signature;
        void rasterizeMarker({ ...appearance, label_text: null }, 2).then(image => {
            if (this.destroyed || this.map !== map || this.buildingImageSignature !== signature) return;
            if (map.hasImage(BUILDING_MARKER_IMAGE)) map.updateImage(BUILDING_MARKER_IMAGE, image);
            else map.addImage(BUILDING_MARKER_IMAGE, image, { pixelRatio: 2 });
        }).catch(() => { if (this.map === map) this.buildingImageSignature = null; });
        void rasterizeMarker({ ...appearance, label_text: null }, 2, true).then(image => {
            if (this.destroyed || this.map !== map || this.buildingImageSignature !== signature) return;
            if (map.hasImage(SELECTED_BUILDING_IMAGE)) map.updateImage(SELECTED_BUILDING_IMAGE, image);
            else map.addImage(SELECTED_BUILDING_IMAGE, image, { pixelRatio: 2 });
        }).catch(() => { if (this.map === map) this.buildingImageSignature = null; });
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
                'text-font': MAP_TEXT_FONT,
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
            minzoom: 15,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'text-field': ['get', 'label_text'],
                ...MAP_LABEL_LAYOUT,
                'text-allow-overlap': false,
            },
            paint: {
                'text-color': ['get', 'text_color'],
                'text-opacity': ['get', 'text_opacity'],
                'text-halo-color': ['get', 'text_halo_color'],
                'text-halo-width': 0.75,
            },
        });
        map.addLayer({
            id: 'custom-marker-selected-label', type: 'symbol', source: MAP_MARKERS_SOURCE_ID,
            filter: ['==', ['get', 'id'], -1],
            layout: { 'text-field': ['get', 'label_text'], ...MAP_LABEL_LAYOUT, 'text-allow-overlap': true },
            paint: { 'text-color': ['get', 'text_color'], 'text-opacity': ['get', 'text_opacity'], 'text-halo-color': ['get', 'text_halo_color'], 'text-halo-width': 0.75 },
        });
        map.on('click', 'custom-marker-clusters', event => {
            const feature = event.features?.[0];
            const clusterId = Number(feature?.properties?.['cluster_id']);
            const source = map.getSource(MAP_MARKERS_SOURCE_ID) as GeoJSONSource;
            if (!Number.isFinite(clusterId)) {
                return;
            }
            void source.getClusterExpansionZoom(clusterId).then(zoom => {
                if (!this.destroyed && this.map === map && feature?.geometry.type === 'Point') {
                    map.easeTo({
                        center: feature.geometry.coordinates as [number, number],
                        zoom,
                    });
                }
            }).catch(() => {});
        });
        map.on('click', 'custom-marker-points', event => {
            if (this.handlePointClick(event, 'marker')) return;
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
        const selectedMarkerId = this.selectedBuildingMarker()?.id;
        const data: FeatureCollection<Point, CustomMarkerFeatureProperties> = {
            type: 'FeatureCollection',
            features: markers
                .filter(marker => marker.id !== selectedMarkerId && marker.latitude !== null && marker.longitude !== null && this.visibleMarker(marker))
                .map(marker => this.markerFeature(marker)),
        };
        source.setData(data);
        const used = new Set(data.features.map(feature => feature.properties.image_key));
        const selected = this.selectedBuildingMarker();
        if (selected) used.add(this.markerImageKey(selected));
        this.usedMarkerImages = used;
        for (const resource of this.markerResources) {
            if (!used.has(resource) && map.hasImage(resource)) { map.removeImage(resource); this.markerResources.delete(resource); }
        }
        this.renderBuildingData();
        this.updateSelectedBuildingLayer(this.selectedBuilding()?.id ?? null);
    }


    private markerFeature(marker: MapMarker): Feature<Point, CustomMarkerFeatureProperties> {
        const selected = marker.id === this.selectedMarkerId() || marker.id === this.selectedBuildingMarker()?.id;
        const imageKey = this.markerImageKey(marker);
        if (this.map) {
            this.prepareMarkerImage(this.map, marker, imageKey, selected);
        }
        return {
            type: 'Feature',
            id: marker.id,
            geometry: { type: 'Point', coordinates: [marker.longitude!, marker.latitude!] },
            properties: {
                id: marker.id,
                image_key: imageKey,
                label_text: marker.label_text ?? '',
                text_color: marker.text_color,
                text_halo_color: labelHaloColor(marker.text_color),
                text_opacity: marker.text_opacity * marker.marker_opacity,
                marker_opacity: marker.marker_opacity,
            },
        };
    }


    private markerRepresentsBuilding(marker: MapMarker, id: number, _center?: number[]): boolean {
        return marker.building_id === id && marker.building_link_role === 'represents' && marker.visibility === 'company';
    }


    private selectedBuildingMarker(): MapMarker | undefined {
        const building = this.selectedBuilding();
        const center = this.buildingCenter(building);
        return building && center
            ? this.markers().find(marker => this.markerRepresentsBuilding(marker, building.id, center))
            : undefined;
    }


    private markerImageKey(marker: MapMarkerPayload): string {
        const selected = 'id' in marker && (marker.id === this.selectedMarkerId() || marker.id === this.selectedBuildingMarker()?.id);
        const key = markerImageKey(pickMarkerAppearance(marker), selected);
        const standard = markerImageKey({ ...mapAppearanceForTheme(this.dark()), icon_name: 'map-house', label_text: null }, selected);
        // An unchanged primary house style reuses the standard house sprite,
        // rather than allocating a second identical texture under another ID.
        return key === standard ? (selected ? SELECTED_BUILDING_IMAGE : BUILDING_MARKER_IMAGE) : key;
    }


    private prepareMarkerImage(map: MapInstance, marker: MapMarkerPayload, imageKey: string, selected = false): void {
        if (map.hasImage(imageKey) || this.pendingMarkerImages.has(imageKey)) return;
        this.pendingMarkerImages.add(imageKey);
        void rasterizeMarker(pickMarkerAppearance(marker), 2, selected).then(image => {
            if (this.destroyed || this.map !== map || map.hasImage(imageKey) || !this.usedMarkerImages.has(imageKey)) return;
            map.addImage(imageKey, image, { pixelRatio: 2 });
            if (imageKey !== BUILDING_MARKER_IMAGE && imageKey !== SELECTED_BUILDING_IMAGE) this.markerResources.add(imageKey);
        }).catch(() => {
            if (!this.destroyed && this.map === map) this.coordinateNotice.set('Не удалось подготовить изображение метки.');
        }).finally(() => this.pendingMarkerImages.delete(imageKey));
    }


    private visibleMarker(marker: MapMarker): boolean {
        if (marker.building_link_role === 'represents') return this.showBuildings();
        return marker.visibility === 'private' ? this.showPersonal() : this.showInfrastructure();
    }


    private showBuildingPopup(coordinates: [number, number], buildingId: number, fullAddress: string): void {
        this.renderPopup(this.buildingPopup(), { id: buildingId, full_address: fullAddress }, coordinates);
        this.popupBuildingId.set(buildingId);
        this.selectedMarkerId.set(this.markers().find(marker => this.markerRepresentsBuilding(marker, buildingId))?.id ?? null);
        this.loadPopupConnections({ kind: 'building', id: buildingId });
    }


    private renderPopup<T>(template: TemplateRef<{ $implicit: T }>, data: T, coordinates: [number, number]): void {
        if (!this.map || !this.mapLibre) return;
        this.closePopup();
        const view = this.popupViews.createEmbeddedView(template, { $implicit: data });
        view.detectChanges();
        const container = document.createElement('div');
        container.append(...view.rootNodes);
        const popup = new this.mapLibre.Popup({ closeButton: false, maxWidth: 'none', className: 'address-marker-popup' })
            .setLngLat(coordinates).setDOMContent(container);
        popup.on('close', () => {
            view.destroy();
            if (this.popup === popup) { this.popup = null; this.popupGeneration++; }
        });
        this.popup = popup.addTo(this.map);
    }


    private showCustomMarkerPopup(coordinates: [number, number], marker: MapMarker): void {
        if (marker.building_link_role === 'represents' && marker.building_id !== null) {
            this.showBuildingPopup(coordinates, marker.building_id, marker.building_full_address ?? marker.name);
            return;
        }
        this.renderPopup(this.markerPopup(), marker, coordinates);
        this.selectedMarkerId.set(marker.id);
        this.loadPopupConnections({ kind: 'marker', id: marker.id });
    }


    closePopup(): void {
        this.popupGeneration++;
        this.popup?.remove();
        this.popup = null;
        this.popupConnections.set([]);
        this.selectedMarkerId.set(null);
        this.popupBuildingId.set(null);
    }


    startCreateMarker(): void {
        this.popupGeneration++;
        const center = this.map?.getCenter();
        this.editingMarker.set(null);
        this.markerError.set(null);
        this.bindingConflict.set(null);
        this.markerDraft.set(createDefaultMapMarker(center?.lat, center?.lng));
    }


    startEditMarker(marker: MapMarker): void {
        this.closePopup();
        this.editingMarker.set(marker);
        this.markerError.set(null);
        const defaults = createDefaultMapMarker();
        const draft = Object.fromEntries(Object.keys(defaults).map(key => [
            key, key in marker ? marker[key as keyof MapMarkerPayload] : defaults[key as keyof MapMarkerPayload],
        ])) as unknown as MapMarkerPayload;
        draft.latitude = marker.latitude;
        draft.longitude = marker.longitude;
        this.markerDraft.set({ ...draft, expected_version: marker.version, sync_building_coordinates: false });
        this.markerDialog()?.open();
    }


    saveMarker(confirmation?: string): void {
        if (this.markerSaving()) return;
        const generation = ++this.markerMutationGeneration;
        const editing = this.editingMarker();
        const draft = { ...this.markerDraft(), ...(confirmation ? { binding_confirmation: confirmation } : {}) };
        this.markerSaving.set(true);
        this.markerError.set(null);
        const allowed = new Set([...Object.keys(createDefaultMapMarker()), 'building_position', 'binding_confirmation']);
        const payload = Object.fromEntries(Object.entries(draft).filter(([key]) => allowed.has(key))) as unknown as MapMarkerPayload;
        const changes = editing ? Object.fromEntries(Object.entries(payload).filter(([key, value]) =>
            key === 'building_position' ? value != null : key === 'binding_confirmation' || value !== editing[key as keyof MapMarker])) : payload;
        if (editing && payload.building_id !== editing.building_id) changes['building_link_role'] = payload.building_link_role;
        const request = editing ? this.mapData.updateMarker(editing.id, { ...changes, expected_version: editing.version }) : this.mapData.createMarker(payload);
        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: saved => {
                if (generation !== this.markerMutationGeneration || this.destroyed) return;
                this.markerSaving.set(false);
                this.bindingConflict.set(null);
                this.bindingDialog()?.close({});
                this.markers.update(current => [...current.filter(item => item.id !== saved.id), saved]);
                this.setMarkerData(this.markers());
                this.markerDialog()?.close({});
                this.editingMarker.set(null);
                if (draft.building_position && saved.building_id !== null && saved.building_link_role === 'represents') {
                    this.suppressFocusForBuildingId = saved.building_id;
                    this.buildingCoordinatesChanged.emit({
                        id: saved.building_id, latitude: saved.latitude === null ? null : String(saved.latitude),
                        longitude: saved.longitude === null ? null : String(saved.longitude),
                    });
                }
                this.loadViewport();
                toast.success(editing ? 'Маркер изменён' : 'Маркер создан');
            },
            error: (error: unknown) => {
                if (generation !== this.markerMutationGeneration || this.destroyed) return;
                this.markerSaving.set(false);
                const detail = error instanceof HttpErrorResponse ? error.error?.detail : null;
                if (detail?.code === 'building_binding_conflict' && detail.snapshot && detail.confirmation_token) {
                    this.bindingConflict.set(detail);
                    this.bindingDialog()?.open();
                } else {
                    const message = detail?.message ?? 'Проверьте поля и повторите попытку. Введённые данные сохранены в форме.';
                    this.markerError.set(message);
                    toast.error(message);
                }
            },
        });
    }


    confirmBinding(): void {
        const conflict = this.bindingConflict();
        if (conflict) this.saveMarker(conflict.confirmation_token);
    }


    loadPersonalStyles(): void {
        const generation = this.contextGeneration;
        this.mapData.getStyles().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: styles => { if (!this.destroyed && generation === this.contextGeneration) this.personalStyles.set(styles); },
            error: () => { if (!this.destroyed && generation === this.contextGeneration) toast.error('Не удалось загрузить личные стили'); },
        });
    }


    savePersonalStyle(event: { action: 'create' | 'rename' | 'duplicate' | 'delete'; name: string; appearance: MapMarkerAppearance; preset?: MapStylePreset }): void {
        const generation = this.contextGeneration;
        const operation = ++this.styleGeneration;
        const request: Observable<unknown> = event.action === 'delete' && event.preset
            ? this.mapData.deleteStyle(event.preset.id)
            : event.action === 'rename' && event.preset
                ? this.mapData.updateStyle(event.preset, event.name, event.appearance)
                : this.mapData.createStyle(event.name, event.appearance);
        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                if (this.destroyed || generation !== this.contextGeneration || operation !== this.styleGeneration) return;
                toast.success(event.action === 'delete' ? 'Личный стиль удалён' : 'Личный стиль сохранён');
                this.loadPersonalStyles();
            },
            error: (error: HttpErrorResponse) => {
                if (!this.destroyed && generation === this.contextGeneration && operation === this.styleGeneration)
                    toast.error(error.error?.detail?.message ?? 'Не удалось сохранить личный стиль');
            },
        });
    }


    startBuildingStyle(buildingId: number): void {
        const generation = this.contextGeneration;
        const request = ++this.popupGeneration;
        this.addressApi.getBuilding(buildingId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: building => {
                if (this.destroyed || generation !== this.contextGeneration || request !== this.popupGeneration) return;
                const existing = this.markers().find(marker => this.markerRepresentsBuilding(marker, buildingId));
                if (existing) { this.startEditMarker(existing); return; }
                this.closePopup();
                this.editingMarker.set(null);
                this.markerError.set(null);
                this.markerDraft.set({
                    ...createDefaultMapMarker(), visibility: 'company', point_type: 'building',
                    building_link_role: 'represents', building_id: buildingId, icon_name: 'map-house',
                    name: 'Дом ' + building.number, label_text: building.number,
                    latitude: building.latitude === null ? null : Number(building.latitude),
                    longitude: building.longitude === null ? null : Number(building.longitude),
                });
                this.markerDialog()?.open();
            },
            error: () => { if (generation === this.contextGeneration) toast.error('Дом больше недоступен'); },
        });
    }


    private handlePointClick(event: import('maplibre-gl').MapLayerMouseEvent, hint: 'building' | 'marker'): boolean {
        if (this.placingMarker() || this.connectionMapMode() === 'vertices') return true;
        const features = event.point && this.map
            ? this.map.queryRenderedFeatures(event.point, { layers: ['building-points', 'selected-building-marker', 'custom-marker-points'] })
            : event.features ?? [];
        const choices = new Map<string, MapEndpointDetail>();
        for (const feature of features) {
            if (feature.geometry.type !== 'Point') continue;
            const properties = feature.properties;
            const markerId = properties['marker_id'] ?? ((feature.layer?.id === 'custom-marker-points' || (!feature.layer && hint === 'marker')) ? properties['id'] : undefined);
            const marker = markerId === undefined ? undefined : this.markers().find(item => item.id === Number(markerId));
            let option: MapEndpointDetail;
            if (marker) {
                option = marker.building_link_role === 'represents' && marker.building_id !== null
                    ? { kind: 'building', id: marker.building_id, name: marker.building_full_address ?? marker.name, latitude: marker.latitude, longitude: marker.longitude }
                    : { kind: 'marker', id: marker.id, name: marker.name, latitude: marker.latitude, longitude: marker.longitude };
            } else {
                option = { kind: 'building', id: Number(properties['id']), name: String(properties['full_address']), latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0] };
            }
            if (Number.isInteger(option.id)) choices.set(option.kind + ':' + option.id, option);
        }
        const options = [...choices.values()];
        if (options.length > 1) {
            const point = options[0];
            this.renderPopup(this.choicesPopup(), options, [point.longitude!, point.latitude!]);
            return true;
        }
        if (options.length === 1 && this.connectionMapMode()) {
            this.selectMapChoice(options[0]);
            return true;
        }
        return false;
    }


    selectMapChoice(endpoint: MapEndpointDetail): void {
        const mode = this.connectionMapMode();
        if (mode === 'source' || mode === 'target') {
            this.connectionDraft.update(draft => ({ ...draft, [mode]: endpoint }));
            this.finishConnectionMap();
            this.closePopup();
        } else this.openEndpoint(endpoint);
    }


    openEndpoint(endpoint: MapEndpointDetail): void {
        if (endpoint.kind === 'building') {
            this.closePopup();
            this.buildingSelected.emit(endpoint.id);
            return;
        }
        const generation = this.contextGeneration;
        const request = ++this.popupGeneration;
        this.mapData.getMarker(endpoint.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: marker => {
                if (this.destroyed || generation !== this.contextGeneration || request !== this.popupGeneration) return;
                if (marker.latitude === null || marker.longitude === null) { toast.error('У объекта не задано расположение'); return; }
                this.map?.easeTo({ center: [marker.longitude, marker.latitude], zoom: 17 });
                this.showCustomMarkerPopup([marker.longitude, marker.latitude], marker);
            },
            error: () => { if (generation === this.contextGeneration && request === this.popupGeneration) toast.error('Объект больше недоступен'); },
        });
    }


    private loadPopupConnections(endpoint: { kind: 'building' | 'marker'; id: number }): void {
        const generation = ++this.popupGeneration;
        const context = this.contextGeneration;
        this.mapData.getConnections(undefined, endpoint).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: lines => { if (!this.destroyed && generation === this.popupGeneration && context === this.contextGeneration) this.popupConnections.set(lines); },
            error: () => { if (generation === this.popupGeneration && context === this.contextGeneration) toast.error('Не удалось загрузить присоединённые линии'); },
        });
    }


    private renderConnections(): void {
        this.connectionLayer?.setConnections(this.showConnections() ? this.connections().filter(line =>
            (this.mediumFilter() === 'all' || line.medium === this.mediumFilter())
            && (this.statusFilter() === 'all' || line.status === this.statusFilter())) : [], this.selectedConnectionId());
    }


    startCreateConnection(): void {
        this.closePopup();
        this.editingConnection.set(null);
        this.connectionError.set(null);
        this.routeHistory.set([]);
        this.connectionDraft.set(createConnectionDraft(this.canManage() ? 'company' : 'private'));
        this.connectionDraftActive.set(true);
        this.connectionDialog()?.open();
    }


    startEditConnection(connection: MapConnection): void {
        this.closePopup();
        this.editingConnection.set(connection);
        this.connectionError.set(null);
        this.routeHistory.set([]);
        this.connectionDraft.set({ source: connection.source, target: connection.target, name: connection.name,
            description: connection.description, visibility: connection.visibility, medium: connection.medium,
            status: connection.status, fiber_count: connection.fiber_count, category: connection.category,
            vertices: connection.vertices.map(point => [...point] as [number, number]), expected_version: connection.version });
        this.connectionDraftActive.set(true);
        this.connectionDialog()?.open();
    }


    startConnectionMap(mode: 'source' | 'target' | 'vertices'): void {
        if (mode === 'vertices' && !routeCoordinates(this.connectionDraft())) { toast.error('Укажите оба конца с координатами'); return; }
        this.routeBeforeMap = structuredClone(this.connectionDraft());
        this.connectionMapMode.set(mode);
        this.connectionDraftActive.set(true);
        this.activeVertex.set(null);
        this.connectionDialog()?.close({});
        this.closePopup();
        if (this.map) this.map.getCanvas().style.cursor = mode === 'vertices' ? 'crosshair' : 'pointer';
    }


    finishConnectionMap(): void {
        this.connectionMapMode.set(null);
        this.routeBeforeMap = null;
        this.activeVertex.set(null);
        this.connectionLayer?.setDraft(this.connectionDraft(), false);
        if (this.map) this.map.getCanvas().style.cursor = '';
        this.connectionDialog()?.open();
    }


    cancelConnectionMap(): void {
        if (this.routeBeforeMap) this.connectionDraft.set(this.routeBeforeMap);
        this.routeBeforeMap = null;
        this.connectionMapMode.set(null);
        this.connectionDraftActive.set(false);
        this.activeVertex.set(null);
        this.connectionLayer?.setDraft(null);
        if (this.map) this.map.getCanvas().style.cursor = '';
    }


    onConnectionDialogClosed(): void {
        if (this.connectionMapMode() === null) {
            this.connectionDraftActive.set(false);
            this.connectionLayer?.setDraft(null);
        }
    }


    private rememberRoute(): void {
        const points = this.connectionDraft().vertices.map(point => [...point] as [number, number]);
        this.routeHistory.update(history => [...history.slice(-29), points]);
    }


    private moveRouteVertex(index: number, point: [number, number]): void {
        if (this.connectionMapMode() !== 'vertices') return;
        this.connectionDraft.update(draft => ({ ...draft, vertices: draft.vertices.map((current, i) => i === index ? point : current) }));
    }


    removeRouteVertex(): void {
        const index = this.activeVertex();
        if (index === null || this.connectionMapMode() !== 'vertices') return;
        this.rememberRoute();
        this.connectionDraft.update(draft => ({ ...draft, vertices: draft.vertices.filter((_, i) => i !== index) }));
        this.activeVertex.set(null);
    }


    undoRoute(): void {
        const history = this.routeHistory();
        if (!history.length) return;
        this.connectionDraft.update(draft => ({ ...draft, vertices: history[history.length - 1] }));
        this.routeHistory.set(history.slice(0, -1));
        this.activeVertex.set(null);
    }


    @HostListener('window:keydown', ['$event'])
    handleMapKey(event: KeyboardEvent): void {
        if (this.connectionMapMode()) {
            if (event.key === 'Escape') { event.preventDefault(); this.cancelConnectionMap(); }
            else if (event.key === 'Enter') { event.preventDefault(); this.finishConnectionMap(); }
            else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.removeRouteVertex(); }
        } else if (this.placingMarker()) {
            if (event.key === 'Escape') { event.preventDefault(); this.cancelPointSelection(); }
            else if (event.key === 'Enter') { event.preventDefault(); this.confirmPointSelection(); }
        }
    }


    saveConnection(): void {
        if (this.connectionSaving()) return;
        const draft = this.connectionDraft();
        if (!draft.source || !draft.target || !draft.name.trim()) return;
        const payload: MapConnectionPayload = { ...draft, source: { kind: draft.source.kind, id: draft.source.id }, target: { kind: draft.target.kind, id: draft.target.id } };
        const editing = this.editingConnection();
        const generation = ++this.connectionMutationGeneration;
        this.connectionSaving.set(true);
        this.connectionError.set(null);
        const request = editing ? this.mapData.updateConnection(editing.id, { ...payload, expected_version: editing.version }) : this.mapData.createConnection(payload);
        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: line => {
                if (this.destroyed || generation !== this.connectionMutationGeneration) return;
                this.connectionSaving.set(false);
                this.connections.update(lines => [...lines.filter(item => item.id !== line.id), line]);
                this.connectionDraftActive.set(false);
                this.connectionLayer?.setDraft(null);
                this.connectionDialog()?.close({});
                this.selectedConnectionId.set(line.id);
                this.renderConnections();
                this.loadViewport();
                toast.success(editing ? 'Соединение изменено' : 'Соединение создано');
            },
            error: (error: HttpErrorResponse) => {
                if (this.destroyed || generation !== this.connectionMutationGeneration) return;
                this.connectionSaving.set(false);
                this.connectionError.set(error.error?.detail?.message ?? 'Не удалось сохранить соединение. Проверьте поля и повторите попытку.');
                toast.error(this.connectionError()!);
            },
        });
    }


    openConnectionPopup(id: number, coordinate?: [number, number]): void {
        const connection = this.connections().find(line => line.id === id) ?? this.popupConnections().find(line => line.id === id);
        if (!connection) return;
        const point = coordinate ?? connection.geometry?.coordinates[0] as [number, number] | undefined;
        if (!point) { toast.error('Для отображения трассы нужны координаты обоих концов'); return; }
        this.selectedConnectionId.set(id);
        this.renderPopup(this.connectionPopup(), connection, point);
    }


    requestDeleteConnection(connection: MapConnection): void {
        this.closePopup();
        this.connectionToDelete.set(connection);
        this.connectionDeleteDialog()?.open();
    }


    deleteConnection(): void {
        const line = this.connectionToDelete();
        if (!line || this.connectionDeleting()) return;
        const generation = ++this.connectionMutationGeneration;
        this.connectionDeleting.set(true);
        this.mapData.deleteConnection(line.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                if (this.destroyed || generation !== this.connectionMutationGeneration) return;
                this.connectionDeleting.set(false);
                this.connections.update(lines => lines.filter(item => item.id !== line.id));
                this.connectionDeleteDialog()?.close({});
                this.connectionToDelete.set(null);
                toast.success('Соединение удалено');
            },
            error: () => { if (generation === this.connectionMutationGeneration && !this.destroyed) { this.connectionDeleting.set(false); toast.error('Не удалось удалить соединение'); } },
        });
    }


    requestDeleteMarker(marker: MapMarker): void {
        this.closePopup();
        this.markerToDelete.set(marker);
        this.markerDeleteError.set(null);
        this.markerDependencies.set([]);
        this.deleteMarkerDialog()?.open();
        const generation = this.contextGeneration;
        this.mapData.getConnections(undefined, { kind: 'marker', id: marker.id }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: lines => { if (!this.destroyed && generation === this.contextGeneration && this.markerToDelete()?.id === marker.id) this.markerDependencies.set(lines); },
            error: () => { if (generation === this.contextGeneration) this.markerDeleteError.set('Не удалось проверить присоединённые линии. Попробуйте снова.'); },
        });
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
            error: (error: HttpErrorResponse) => {
                if (generation !== this.markerMutationGeneration || this.destroyed) {
                    return;
                }
                this.markerDeleting.set(false);
                const detail = error.error?.detail;
                this.markerDeleteError.set(detail?.message ?? 'Не удалось удалить маркер');
                toast.error(this.markerDeleteError()!);
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
        const center = map.getCenter();
        this.placementOriginalDraft = structuredClone(draft);
        this.placingMarker.set(true);
        this.markerDialog()?.close({});
        this.cleanupPointSelection();
        this.placementOriginalDraft = structuredClone(draft);
        this.placementMarker = new mapLibre.Marker({
            draggable: true,
            anchor: 'center',
            element: createMarkerElement(pickMarkerAppearance(draft), true),
        })
            .setLngLat([draft.longitude ?? center.lng, draft.latitude ?? center.lat])
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
        const position = this.placementMarker?.getLngLat();
        if (position) this.applyDraftCoordinates(position.lng, position.lat);
        this.placingMarker.set(false);
        this.cleanupPointSelection();
        this.markerDialog()?.open();
    }


    cancelPointSelection(): void {
        const original = this.placementOriginalDraft;
        if (original) {
            this.markerDraft.set(original);
        }
        this.placingMarker.set(false);
        this.cleanupPointSelection();
        this.markerDialog()?.open();
    }


    private applyDraftCoordinates(longitude: number, latitude: number): void {
        this.markerDraft.update(current => ({ ...current, longitude, latitude,
            ...(current.building_link_role === 'represents' ? { building_position: { latitude, longitude } } : {}),
        }));
    }


    private cleanupPointSelection(): void {
        if (this.map && this.placementClickHandler) {
            this.map.off('click', this.placementClickHandler);
        }
        this.placementClickHandler = null;
        this.placementMarker?.remove();
        this.placementMarker = null;
        this.placementOriginalDraft = null;
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
        // Adding GeoJSON sources in the load callback temporarily makes
        // isStyleLoaded() false. That must not suppress the initial API read.
        if (!map || !map.getSource(MAP_BUILDINGS_SOURCE_ID)) {
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
            error: (error: HttpErrorResponse) => {
                if (generation !== this.viewportGeneration || this.destroyed) {
                    return;
                }
                this.viewportError.set(error.error?.detail?.message ?? 'Не удалось загрузить маркеры для этой области');
            },
        });
        this.connectionViewportSubscription?.unsubscribe();
        this.connectionViewportSubscription = this.mapData.getConnections(viewport).subscribe({
            next: lines => {
                if (generation !== this.viewportGeneration || this.destroyed) return;
                this.connections.set(lines);
                this.renderConnections();
            },
            error: (error: HttpErrorResponse) => {
                if (generation !== this.viewportGeneration || this.destroyed) return;
                this.viewportError.set(error.error?.detail?.message ?? 'Не удалось загрузить соединения для этой области');
            },
        });
    }


    private setBuildingData(data: MapBuildingFeatureCollection): void {
        this.viewportBuildings = data;
        this.renderBuildingData();
    }


    private renderBuildingData(): void {
        const source = this.map?.getSource(MAP_BUILDINGS_SOURCE_ID) as GeoJSONSource | undefined;
        if (!this.showBuildings()) { source?.setData(EMPTY_FEATURES); return; }
        const selected = this.selectedBuilding();
        const selectedId = this.buildingCenter(selected) ? selected?.id : null;
        const linked = new Map<number, MapMarker[]>();
        for (const marker of this.markers()) {
            if (marker.building_id !== null) {
                linked.set(marker.building_id, [...(linked.get(marker.building_id) ?? []), marker]);
            }
        }
        source?.setData({
            ...this.viewportBuildings,
            features: this.viewportBuildings.features.filter(feature => (
                feature.properties.id !== selectedId
                && !linked.get(feature.properties.id)?.some(marker => this.markerRepresentsBuilding(
                    marker, feature.properties.id, feature.geometry.coordinates,
                ))
            )),
        });
    }


    private buildingCenter(building: Building | null): [number, number] | null {
        if (!building || building.latitude === null || building.longitude === null) {
            return null;
        }
        const latitude = Number(building.latitude);
        const longitude = Number(building.longitude);
        return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
            && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
            ? [longitude, latitude]
            : null;
    }


    private focusSelection(
        addressObject: AddressObject | null,
        building: Building | null,
    ): void {
        const map = this.map;
        if (!map || !map.getSource(MAP_BUILDINGS_SOURCE_ID)) {
            return;
        }
        const center = this.buildingCenter(building);
        if (building && this.suppressFocusForBuildingId === building.id) { this.suppressFocusForBuildingId = null; return; }
        if (center) {
            this.coordinateNotice.set(null);
            this.focusGeneration += 1;
            this.focusSubscription?.unsubscribe();
            map.easeTo({
                center,
                zoom: Math.min(map.getMaxZoom(), MAP_BUILDING_FOCUS_ZOOM),
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
        if (!this.map?.getSource(SELECTED_BUILDING_SOURCE_ID)) {
            return;
        }
        const source = this.map.getSource(SELECTED_BUILDING_SOURCE_ID) as GeoJSONSource | undefined;
        if (!this.showBuildings()) { source?.setData(EMPTY_FEATURES); return; }
        const building = this.selectedBuilding();
        const center = this.buildingCenter(building);
        const marker = this.selectedBuildingMarker();
        if (building && marker) {
            const feature = this.markerFeature(marker);
            source?.setData({
                type: 'FeatureCollection',
                features: [{
                    ...feature,
                    properties: { ...feature.properties, id: building.id, marker_id: marker.id, full_address: building.full_address },
                }],
            });
            return;
        }
        source?.setData(building && building.id === buildingId && center ? {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: building.id,
                geometry: { type: 'Point', coordinates: center },
                properties: {
                    id: building.id,
                    address_object_id: building.address_object_id,
                    number: building.number,
                    corpus: building.corpus,
                    structure: building.structure,
                    full_address: building.full_address,
                },
            }],
        } : EMPTY_FEATURES);
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
        const generation = this.contextGeneration;
        const map = this.map;
        try {
            const session = await this.firstValueFromSession();
            if (this.destroyed || !this.map || map !== this.map || generation !== this.contextGeneration) {
                return;
            }
            const source = this.map.getSource(MAP_SOURCE_ID) as RasterTileSource | undefined;
            source?.setTiles([session.tile_url_template]);
            this.scheduleSessionRefresh(session);
            this.sessionRetryCount = 0;
        } catch {
            if (this.destroyed || generation !== this.contextGeneration || map !== this.map) return;
            if (this.sessionRetryCount < 4) {
                const delay = 2000 * 2 ** this.sessionRetryCount++;
                if (this.sessionRefreshTimer !== null) clearTimeout(this.sessionRefreshTimer);
                this.sessionRefreshTimer = setTimeout(() => { this.sessionRefreshTimer = null; void this.refreshTileSession(); }, delay);
            } else {
                this.viewportError.set('Не удалось обновить сессию карты. Нажмите «Повторить».');
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
        this.cleanupPointSelection();
        this.connectionLayer?.destroy();
        this.connectionLayer = null;
        this.buildingImageSignature = null;
        this.markerResources.clear();
        this.usedMarkerImages.clear();
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
        this.contextGeneration++;
        this.connectionMutationGeneration++;
        this.themeObserver?.disconnect();
        if (this.viewportTimer !== null) {
            clearTimeout(this.viewportTimer);
        }
        if (this.sessionRefreshTimer !== null) {
            clearTimeout(this.sessionRefreshTimer);
        }
        this.viewportSubscription?.unsubscribe();
        this.markerViewportSubscription?.unsubscribe();
        this.connectionViewportSubscription?.unsubscribe();
        this.focusSubscription?.unsubscribe();
        this.destroyCurrentMap();
    }
}
