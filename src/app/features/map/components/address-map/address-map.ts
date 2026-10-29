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
import { firstValueFrom, forkJoin, Subscription, map as mapResult, type Observable } from 'rxjs';
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
    lucidePlus,
    lucideMaximize,
} from '@ng-icons/lucide';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSliderImports } from '@spartan-ng/helm/slider';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAlertDialog, HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmButtonGroupImports } from '@spartan-ng/helm/button-group';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmDialog, HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
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
    InstallationMethod, MapPointType, RouteNodeType, RoutePassThroughType,
} from '../../models/map.models';
import { createConnectionDraft } from '../../models/map.models';
import { createMarkerElement, markerImageKey, markerMetrics, rasterizeMarker, labelHaloColor, MAP_FONT_FACES, MAP_LABEL_LAYOUT, MAP_TEXT_FONT } from '../../map-marker-renderer';
import { MapConnectionLayer, connectionLabel, routeCoordinates } from '../../map-connection-layer';
import { installationBoundaries, previewBoundaryMove, type InstallationBoundary } from '../../map-installation-boundaries';
import { nearestRoutePoint, type RouteSnap } from '../../map-connection-geometry';
import type { MapBoundaryEdit } from '../../models/map.models';
import { MapConnectionEditor, CONNECTION_STATUS_LABELS } from '../map-connection-editor/map-connection-editor';
import { MapDataService } from '../../services/map-data.service';
import {
    MapLibreLoaderService,
    type MapLibreModule,
} from '../../services/maplibre-loader.service';
import { MapMarkerEditor } from '../map-marker-editor/map-marker-editor';
import { MapSpliceHover, type SpliceHover, type SpliceTarget } from '../../map-splice-hover';
import { routePosition } from '../../map-connection-geometry';
import { INSTALLATION_STYLES, installationMethods, installationLabel, removeRouteVertex as removeVertexWithMethods } from '../../map-line-styles';
import { MarkerFootprintCache } from '../../map-marker-footprints';
import type { MarkerFootprint } from '../../map-line-clipping';
import { MapIcon } from '../map-icon/map-icon';
import { ROUTE_NODE_OPTIONS, ROUTE_PASS_OPTIONS } from '../../map-route.config';
import { MapWorkspaceState } from '../../services/map-workspace.state';
import type { ConnectionMode, MapPassport, MapTarget } from '../../models/map-workspace.models';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { DomPortal } from '@angular/cdk/portal';
import { ConfigurableFocusTrapFactory, type ConfigurableFocusTrap } from '@angular/cdk/a11y';
import { MapToolbar } from '../map-toolbar/map-toolbar';
import { MapLayerEditor } from '../map-layer-editor/map-layer-editor';
import { AddressDependenciesDialog, type AddressDependencyConflict } from '../../../../shared/address-dependencies-dialog/address-dependencies-dialog';
import { MapPassportDialog } from '../map-passport/map-passport';


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
        HlmSelectImports,
        HlmSliderImports,
        HlmPopoverImports,
        MapIcon,
        MapToolbar,
        MapLayerEditor,
        AddressDependenciesDialog,
        MapPassportDialog,
        HlmDropdownMenuImports,
    ],
    providers: [MapWorkspaceState, provideIcons({
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
        lucidePlus,
        lucideMaximize,
    })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './address-map.html',
    styleUrl: './address-map.css',
})
export class AddressMap implements AfterViewInit {
    readonly workspace = inject(MapWorkspaceState);
    private readonly mapData = inject(MapDataService);
    private readonly mapLibreLoader = inject(MapLibreLoaderService);
    private readonly companyContext = inject(CompanyContextService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly popupViews = inject(ViewContainerRef);
    private readonly addressApi = inject(AddressApiService);
    private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly overlay = inject(Overlay);
    private readonly focusTraps = inject(ConfigurableFocusTrapFactory);
    private expandedOverlay: OverlayRef | null = null;
    private expandedFocusTrap: ConfigurableFocusTrap | null = null;
    private resizeFrame: number | null = null;
    readonly expanded = signal(false);
    readonly expandButton = viewChild<ElementRef<HTMLButtonElement>>('expandButton');

    readonly selectedObject = input<AddressObject | null>(null);
    readonly selectedBuilding = input<Building | null>(null);
    readonly canManage = input(false);
    readonly buildingSelected = output<number>();
    readonly buildingCoordinatesChanged = output<Pick<Building, 'id' | 'latitude' | 'longitude'>>();
    readonly buildingDeleted = output<number>();
    readonly closeRequested = output<void>();

    readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
    readonly markerDialog = viewChild<HlmDialog>('markerDialog');
    readonly deleteMarkerDialog = viewChild<HlmAlertDialog>('deleteMarkerDialog');
    readonly dependenciesDialog = viewChild.required(AddressDependenciesDialog);
    readonly passportDialog = viewChild.required(MapPassportDialog);
    readonly markerPopup = viewChild.required<TemplateRef<{ $implicit: MapMarker }>>('markerPopup');
    readonly state = signal<MapLoadState>('loading');
    readonly setupError = signal<string | null>(null);
    readonly viewportError = signal<string | null>(null);
    readonly connectionLoadError = signal<string | null>(null);
    readonly coordinateNotice = signal<string | null>(null);
    readonly yandexMapsUrl = signal(YANDEX_MAPS_URL);
    readonly markers = signal<MapMarker[]>([]);
    readonly markerDraft = signal<MapMarkerPayload>(createDefaultMapMarker());
    readonly editingMarker = signal<MapMarker | null>(null);
    readonly markerSaving = signal(false);
    readonly markerPositionChosen = signal(false);
    private placementWasChosen = false;
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
    readonly routeHistory = signal<MapConnectionDraft[]>([]);
    readonly popupConnections = signal<MapConnection[]>([]);
    readonly markerDependencies = signal<MapConnection[]>([]);
    readonly markerDeleteError = signal<string | null>(null);
    readonly houseToDelete = signal<Building | null>(null);
    readonly houseDeleting = signal(false);
    readonly houseDeleteError = signal<string | null>(null);
    readonly deleteHouseDialog = viewChild.required<HlmAlertDialog>('deleteHouseDialog');
    readonly activePanel = signal<'filters' | 'layers' | 'legend' | null>(null);
    readonly filterPanelOpen = computed(() => this.activePanel() === 'filters');
    readonly showBuildings = this.workspace.field('show_buildings');
    readonly showInfrastructure = this.workspace.field('show_infrastructure');
    readonly showPersonal = this.workspace.field('show_personal');
    readonly connectionMode = this.workspace.field('connection_mode');
    readonly showConnections = Object.assign(computed(() => this.connectionMode() !== 'hidden'), {
        set: (visible: boolean) => this.requestConnectionMode(visible ? 'viewport' : 'hidden'),
    });
    readonly mediumFilter = this.workspace.field('medium');
    readonly statusFilter = this.workspace.field('status');
    readonly installationFilter = this.workspace.field('installation');
    readonly selectedMapEndpoint = signal<{ kind: 'building' | 'marker'; id: number } | null>(null);
    readonly dark = signal(document.documentElement.classList.contains('dark'));
    readonly spliceHover = signal<SpliceHover | null>(null);
    readonly spliceTarget = signal<SpliceTarget | null>(null);
    readonly routeMenuTarget = signal<SpliceTarget|null>(null);
    readonly routeAnchor = computed(()=>this.routeMenuTarget()?{targets:[this.routeMenuTarget()!],x:this.routeMenuTarget()!.point.screen.x,y:this.routeMenuTarget()!.point.screen.y}:this.spliceHover());
    readonly routeOperation = signal<'split'|'place'>('split');
    readonly routeInstallationAfter = signal<InstallationMethod|null>(null);
    readonly routeNodeOptions=ROUTE_NODE_OPTIONS;
    readonly routePassOptions=ROUTE_PASS_OPTIONS;
    readonly installationStyles=INSTALLATION_STYLES;
    readonly installationLabel=installationLabel;
    readonly boundaryDialog=viewChild<HlmDialog>('boundaryDialog');
    readonly boundaryTarget=signal<SpliceTarget|null>(null);
    readonly boundaryMethod=signal<InstallationMethod>('duct');
    readonly boundaryUntil=signal<'end'|'next_vertex'>('end');
    readonly boundaryUntilLabel = (value: string) => value === 'next_vertex' ? 'До следующей вершины' : 'До конца трассы';
    readonly boundarySaving=signal(false);
    readonly boundaryError=signal<string|null>(null);
    readonly installationEditId = signal<number | null>(null);
    readonly installationHandles = signal<InstallationBoundary[]>([]);
    readonly activeBoundary = signal<{ line: MapConnection; boundary: InstallationBoundary } | null>(null);
    readonly movingBoundary = signal(false);
    readonly boundaryPreview = signal<{ line: MapConnection; snap: RouteSnap } | null>(null);
    readonly boundaryAction = signal<'menu' | 'set' | 'remove'>('menu');
    readonly detachDialog=viewChild<HlmAlertDialog>('detachDialog');
    readonly objectToDetach=signal<{line:MapConnection;markerId:number;name:string}|null>(null);
    readonly objectDetaching=signal(false);
    readonly spliceChoices = signal<SpliceTarget[]>([]);
    readonly spliceChoiceDialog = viewChild<HlmDialog>('spliceChoiceDialog');
    readonly spliceHoverAction = viewChild<ElementRef<HTMLButtonElement>>('spliceHoverAction');
    readonly splicePlacementDialog = viewChild<HlmDialog>('splicePlacementDialog');
    readonly alternativeSpliceLine = signal<MapConnection | null>(null);
    readonly spliceSegment = signal<number | null>(null);
    readonly spliceFraction = signal(.5);
    readonly spliceSegments = computed(() => {
        const points = this.alternativeSpliceLine()?.geometry?.coordinates ?? [];
        return points.slice(0, -1).flatMap((point, index) => point[0] === points[index + 1][0] && point[1] === points[index + 1][1] ? [] : [index]);
    });
    readonly spliceSegmentLabel = (index: number) => `Участок ${index + 1}`;
    readonly alternativeSplicePoint = computed(() => {
        const line = this.alternativeSpliceLine(), index = this.spliceSegment();
        return line?.geometry && index !== null ? routePosition(line.geometry.coordinates[index], line.geometry.coordinates[index + 1], this.spliceFraction()) : null;
    });
    readonly legendHasBuildings = signal(false);
    readonly legendBuildings = computed(() => this.showBuildings() && (this.legendHasBuildings() || this.buildingCenter(this.selectedBuilding()) !== null));
    readonly legendMarkers = computed(() => this.markers().filter(marker => marker.latitude !== null && marker.longitude !== null && this.visibleMarker(marker)));
    readonly visibleConnections = computed(() => this.showConnections() ? this.connections().filter(line =>
        (this.mediumFilter() === 'all' || line.medium === this.mediumFilter())
        && (this.statusFilter() === 'all' || line.status === this.statusFilter())) : []);
    readonly spliceBusy = computed(() => !this.canManage() || this.movingBoundary() || this.activeBoundary()!==null || this.placingMarker() || this.connectionDraftActive() || this.routeMenuTarget()!==null
        || this.markerSaving() || this.connectionSaving() || this.state() !== 'ready'
        || [this.markerDialog(), this.connectionDialog(), this.spliceChoiceDialog(), this.splicePlacementDialog(),
            this.deleteMarkerDialog(), this.connectionDeleteDialog(), this.bindingDialog(),this.boundaryDialog(),this.detachDialog()].some(dialog => dialog?.stateComputed() === 'open'));
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
    private popupKind: 'building' | 'marker' | 'connection' | null = null;
    private destroyed = false;
    private readonly pendingInteractiveMarkers = new Set<number>();
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
    private readonly footprintCache=new MarkerFootprintCache();
    private spliceController: MapSpliceHover | null = null;
    private connectionViewportSubscription: Subscription | null = null;
    private connectionLoadGeneration = 0;
    private markerDependencyGeneration = 0;
    private lastConnectionContext = '';
    private contextGeneration = 0;
    private popupGeneration = 0;
    private connectionMutationGeneration = 0;
    private styleGeneration = 0;
    private sessionRetryCount = 0;
    private themeObserver: MutationObserver | null = null;
    private viewReady = false;
    private routeBeforeMap: MapConnectionDraft | null = null;
    private swallowPanelClick = false;
    private readonly panelPointerGuard = (event: Event) => {
        if (event.type === 'pointerdown' && !this.activePanel()) { this.swallowPanelClick = false; return; }
        if (!this.activePanel() && !this.swallowPanelClick) return;
        if (event.type === 'pointerdown') this.swallowPanelClick = true;
        if (event.type === 'click') this.swallowPanelClick = false;
        this.activePanel.set(null); event.preventDefault(); event.stopImmediatePropagation();
    };


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
            this.connectionLoadGeneration++;
            this.activePanel.set(null);
            this.selectedMapEndpoint.set(null);
            this.lastConnectionContext = '';
            this.houseDeleting.set(false); this.houseToDelete.set(null); this.houseDeleteError.set(null); this.deleteHouseDialog()?.close({});
            this.dependenciesDialog()?.clear();
            this.focusSubscription?.unsubscribe();
            this.coordinateNotice.set(null);
            this.suppressFocusForBuildingId = null;
            this.selectedMarkerId.set(null);
            this.closePopup();
            this.spliceController?.clear();
            this.spliceTarget.set(null);
            this.routeMenuTarget.set(null);this.boundaryTarget.set(null);this.boundaryDialog()?.close({});this.boundarySaving.set(false);
            this.detachDialog()?.close({});this.objectToDetach.set(null);this.objectDetaching.set(false);
            this.spliceChoices.set([]);
            this.alternativeSpliceLine.set(null);
            this.spliceChoiceDialog()?.close({});
            this.splicePlacementDialog()?.close({});
            this.markerDialog()?.close({});
            this.deleteMarkerDialog()?.close({});
            this.bindingDialog()?.close({});
            this.connectionDialog()?.close({});
            this.connectionDeleteDialog()?.close({});
            this.markerDraft.set(createDefaultMapMarker());
            this.editingMarker.set(null);
            this.markerToDelete.set(null);
            this.markerSaving.set(false);
            this.markerPositionChosen.set(false);
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
            this.activeBoundary.set(null);this.boundaryPreview.set(null);this.movingBoundary.set(false);this.installationEditId.set(null);this.installationHandles.set([]);
            this.routeHistory.set([]);
            this.activeVertex.set(null);
            this.setBuildingData(EMPTY_FEATURES);
            this.markers.set([]);
            this.pendingInteractiveMarkers.clear();
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
            if (this.spliceBusy()) this.spliceController?.clear();
        });
        effect(() => {
            this.selectedConnectionId(); this.visibleConnections(); this.connectionDraftActive(); this.boundaryPreview();
            untracked(() => this.refreshInstallationHandles());
        });
        effect(() => {
            this.visibleConnections();
            untracked(() => this.spliceController?.clear());
        });
        effect(() => {
            const selectedObject = this.selectedObject();
            const selectedBuilding = this.selectedBuilding();
            untracked(() => this.selectedMapEndpoint.set(selectedBuilding ? { kind: 'building', id: selectedBuilding.id } : null));
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
                this.connectionLayer?.setDraft(active ? draft : null, mode === 'vertices',this.editingConnection()?.id??null);
            });
        });
        effect(() => {
            const ready = this.workspace.ready();
            this.workspace.query();
            if (ready) untracked(() => {
                if (this.state() !== 'ready') return;
                this.setBuildingData(EMPTY_FEATURES); this.markers.set([]); this.setMarkerData([]);
                this.loadViewport();
                if (this.connectionMode() === 'object') this.loadConnections();
            });
        });
        effect(() => {
            const mode = this.connectionMode(), endpoint = this.selectedMapEndpoint(), ready = this.workspace.ready();
            untracked(() => {
                if (this.state() === 'ready' && ready && this.connectionContext(mode, endpoint) !== this.lastConnectionContext) this.loadConnections();
            });
        });
    }


    ngAfterViewInit(): void {
        this.viewReady = true;
        this.mapContainer().nativeElement.addEventListener('pointerdown', this.panelPointerGuard, true);
        this.mapContainer().nativeElement.addEventListener('click', this.panelPointerGuard, true);
        if (typeof MutationObserver !== 'undefined') {
            this.themeObserver = new MutationObserver(() => this.dark.set(document.documentElement.classList.contains('dark')));
            this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
        void this.initializeMap();
    }

    openCreateMarker(): void { if(this.boundaryDraftBlocksAction())return;this.startCreateMarker(); this.markerDialog()?.open(); }

    private boundaryDraftBlocksAction():boolean {
        if(!this.activeBoundary()&&!this.boundarySaving())return false;
        toast.error('Сначала сохраните или отмените изменение границы прокладки.');return true;
    }

    resetFilters(): void {
        if (this.connectionDraftActive() || this.connectionSaving()) { toast.error('Сначала завершите редактирование соединения.'); return; }
        this.workspace.reset();
    }

    openPassport(target: MapTarget): void { this.activePanel.set(null); this.closePopup(false); this.passportDialog().open(target); }

    onPassportSaved(passport: MapPassport): void {
        const entity = passport.entity;
        if (entity.kind === 'marker') {
            this.markers.update(markers => markers.map(marker => marker.id === entity.id ? { ...marker,
                name: entity.name, description: entity.description, version: entity.version! } : marker));
            this.setMarkerData(this.markers());
        } else if (entity.kind === 'connection') {
            this.connections.update(lines => lines.map(line => line.id === entity.id ? { ...line,
                name: entity.name, description: entity.description, status: entity.status!, version: entity.version! } : line));
            this.renderConnections();
        }
        this.loadViewport();
        if (this.connectionMode() === 'object') this.loadConnections();
    }

    primaryMarkerForBuilding(id: number): MapMarker | undefined { return this.markers().find(marker => this.markerRepresentsBuilding(marker, id)); }

    editBuildingLink(marker: MapMarker, unlink = false): void {
        this.startEditMarker(marker);
        if (unlink) this.markerDraft.update(draft => ({ ...draft, building_id: null, building_link_role: 'none', building_position: null }));
    }

    moveMarker(marker: MapMarker): void {
        this.startEditMarker(marker);
        if (marker.building_link_role === 'represents' && marker.latitude !== null && marker.longitude !== null)
            this.markerDraft.update(draft => ({ ...draft, building_position: { latitude: marker.latitude!, longitude: marker.longitude! } }));
        this.startPointSelection();
    }

    requestDeleteHouse(id: number): void {
        if (!this.canManage() || this.houseDeleting()) return;
        const context = this.contextGeneration, generation = ++this.popupGeneration;
        this.addressApi.getBuilding(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: house => { if (context === this.contextGeneration && generation === this.popupGeneration) { this.houseToDelete.set(house); this.houseDeleteError.set(null); this.deleteHouseDialog().open(); } },
            error: () => { if (context === this.contextGeneration) toast.error('Дом больше недоступен'); },
        });
    }

    deleteHouse(): void {
        const house = this.houseToDelete(); if (!house || this.houseDeleting()) return;
        const context = this.contextGeneration; this.houseDeleting.set(true); this.houseDeleteError.set(null);
        this.addressApi.deleteBuilding(house.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                if (context !== this.contextGeneration || this.destroyed) return;
                this.houseDeleting.set(false); this.deleteHouseDialog().close({}); this.houseToDelete.set(null); this.closePopup();
                this.setBuildingData({ ...this.viewportBuildings, features: this.viewportBuildings.features.filter(feature => feature.properties.id !== house.id) });
                this.markers.update(markers => markers.filter(marker => marker.building_id !== house.id)); this.setMarkerData(this.markers());
                this.buildingDeleted.emit(house.id); this.loadViewport(); toast.success('Дом удалён из адресного каталога');
            },
            error: (error: HttpErrorResponse) => {
                if (context !== this.contextGeneration || this.destroyed) return;
                this.houseDeleting.set(false);
                if (error.status === 409 && error.error?.detail?.code === 'object_has_dependencies') {
                    this.deleteHouseDialog().close({}); this.dependenciesDialog().show(error.error.detail, this.map?.getCanvas() ?? null); return;
                }
                this.houseDeleteError.set(error.error?.detail?.message ?? 'Не удалось удалить дом. Проверьте доступ и повторите действие.');
            },
        });
    }

    closeMapSurface(): void { if (this.expanded()) this.collapseMap(); else this.closeRequested.emit(); }

    expandMap(): void {
        if (this.expandedOverlay) return;
        this.activePanel.set(null);
        const overlay = this.overlay.create({ hasBackdrop: true, backdropClass: 'cdk-overlay-dark-backdrop',
            width: '100vw', height: '100dvh', positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically(),
            scrollStrategy: this.overlay.scrollStrategies.block() });
        this.expandedOverlay = overlay;
        overlay.overlayElement.style.padding = '1rem';
        overlay.overlayElement.style.boxSizing = 'border-box';
        overlay.overlayElement.style.display = 'block';
        overlay.overlayElement.setAttribute('aria-label', 'Развёрнутая карта');
        overlay.overlayElement.setAttribute('role', 'dialog');
        overlay.overlayElement.setAttribute('aria-modal', 'true');
        this.expanded.set(true);
        overlay.attach(new DomPortal(this.hostElement));
        this.expandedFocusTrap = this.focusTraps.create(this.hostElement.nativeElement);
        void this.expandedFocusTrap.focusFirstTabbableElementWhenReady();
        overlay.keydownEvents().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
            if (event.key !== 'Escape' || this.activePanel() || this.activeBoundary() || this.installationEditId() || this.placingMarker() || this.connectionMapMode()
                || Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-slot="popover-content"]'))
                    .some(element => element !== overlay.overlayElement)) return;
            event.preventDefault(); event.stopPropagation(); this.collapseMap();
        });
        this.resizeFrame = requestAnimationFrame(() => { this.resizeFrame = null; this.map?.resize(); });
    }

    collapseMap(restoreFocus = true): void {
        if (!this.expandedOverlay) return;
        this.activePanel.set(null);
        this.expandedFocusTrap?.destroy(); this.expandedFocusTrap = null;
        this.expandedOverlay.dispose(); this.expandedOverlay = null; this.expanded.set(false);
        if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = requestAnimationFrame(() => {
            this.resizeFrame = null;
            if (!this.destroyed) this.map?.resize();
            if (restoreFocus) this.expandButton()?.nativeElement.focus();
        });
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
                    ()=>this.connectionFootprints(),
                    (id,vertex)=>this.selectExistingBoundary(id,vertex),
                );
                this.spliceController = new MapSpliceHover(map, () => this.visibleConnections(), () => this.spliceBusy(), hover => this.spliceHover.set(hover),point=>
                    (this.connectionLayer?.isOccluded(point,true)??false)||this.installationHandles().some(handle=>Math.hypot(handle.x-point.x,handle.y-point.y)<22));
                this.state.set('ready');
                this.scheduleSessionRefresh(session);
                this.updateExternalMapLink();
                this.focusSelection(this.selectedObject(), this.selectedBuilding());
                this.loadViewport();
                if (this.connectionMode() === 'object') this.loadConnections();
                this.loadPersonalStyles();
            });
            map.on('click', event => {
                if(this.movingBoundary()) { if(this.updateBoundaryPreview(event.point))this.movingBoundary.set(false); return; }
                if (this.connectionMapMode() !== 'vertices') return;
                const vertex = map.queryRenderedFeatures(event.point, { layers: ['route-edit-vertices'] })[0];
                if (vertex) { this.activeVertex.set(Number(vertex.properties['index'])); return; }
                if (this.connectionDraft().vertices.length >= 498) { toast.error('Допускается не более 498 промежуточных вершин'); return; }
                this.rememberRoute();
                this.connectionDraft.update(draft => ({ ...draft, vertices: [...draft.vertices, [event.lngLat.lng, event.lngLat.lat]],installation_methods:[...installationMethods(draft.vertices,draft.installation_methods),installationMethods(draft.vertices,draft.installation_methods).at(-1)!] }));
            });
            map.on('mousemove', event => { if(this.movingBoundary()) this.updateBoundaryPreview(event.point); });
            map.on('move', () => { this.refreshInstallationHandles(); });
            map.on('resize', () => { this.refreshInstallationHandles(); });
            map.on('moveend', () => {
                this.updateExternalMapLink();
                this.scheduleViewportLoad();
            });
            map.on('movestart',()=>this.routeMenuTarget.set(null));
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
        return building
            ? this.markers().find(marker => this.markerRepresentsBuilding(marker, building.id)
                && marker.latitude !== null && marker.longitude !== null && this.visibleMarker(marker))
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
            this.connectionLayer?.refreshClipping();
            if (imageKey !== BUILDING_MARKER_IMAGE && imageKey !== SELECTED_BUILDING_IMAGE) this.markerResources.add(imageKey);
        }).catch(() => {
            if (!this.destroyed && this.map === map) this.coordinateNotice.set('Не удалось подготовить изображение метки.');
        }).finally(() => this.pendingMarkerImages.delete(imageKey));
    }


    private visibleMarker(marker: MapMarker): boolean {
        const settings = this.workspace.settings();
        if (settings.point_types_enabled && !settings.point_types.includes(marker.point_type)) return false;
        if (marker.building_link_role === 'represents') return this.showBuildings();
        return marker.visibility === 'private' ? this.showPersonal() : this.showInfrastructure();
    }


    private showBuildingPopup(coordinates: [number, number], buildingId: number, fullAddress: string): void {
        if(this.activeBoundary())return;
        this.renderPopup(this.buildingPopup(), { id: buildingId, full_address: fullAddress }, coordinates);
        this.popupKind = 'building';
        this.popupBuildingId.set(buildingId);
        this.selectedMarkerId.set(this.markers().find(marker => this.markerRepresentsBuilding(marker, buildingId))?.id ?? null);
        this.loadPopupConnections({ kind: 'building', id: buildingId });
    }


    private renderPopup<T>(template: TemplateRef<{ $implicit: T }>, data: T, coordinates: [number, number]): void {
        if (!this.map || !this.mapLibre) return;
        this.closePopup(false);
        const view = this.popupViews.createEmbeddedView(template, { $implicit: data });
        view.detectChanges();
        const container = document.createElement('div');
        container.append(...view.rootNodes);
        const popup = new this.mapLibre.Popup({ closeButton: false, maxWidth: 'none', className: 'address-marker-popup' })
            .setLngLat(coordinates).setDOMContent(container);
        popup.on('close', () => {
            view.destroy();
            if (this.popup === popup) {
                this.popup = null; this.popupKind = null; this.popupGeneration++;
                this.popupConnections.set([]); this.selectedMapEndpoint.set(null); this.selectedMarkerId.set(null);
                this.selectedConnectionId.set(null); this.popupBuildingId.set(null);
            }
        });
        this.popup = popup.addTo(this.map);
    }


    private showCustomMarkerPopup(coordinates: [number, number], marker: MapMarker): void {
        if(this.activeBoundary())return;
        if (marker.building_link_role === 'represents' && marker.building_id !== null) {
            this.showBuildingPopup(coordinates, marker.building_id, marker.building_full_address ?? marker.name);
            return;
        }
        this.renderPopup(this.markerPopup(), marker, coordinates);
        this.popupKind = 'marker';
        this.selectedMarkerId.set(marker.id);
        this.loadPopupConnections({ kind: 'marker', id: marker.id });
    }


    closePopup(clearSelection = true): void {
        this.popupGeneration++;
        const popup = this.popup; this.popup = null; this.popupKind = null; popup?.remove();
        this.popupConnections.set([]);
        this.selectedMarkerId.set(null);
        this.popupBuildingId.set(null);
        if (clearSelection) this.selectedMapEndpoint.set(null);
    }


    startCreateMarker(): void {
        this.markerMutationGeneration++;
        this.markerSaving.set(false);
        this.markerPositionChosen.set(false);
        this.spliceTarget.set(null);
        this.popupGeneration++;
        const center = this.map?.getCenter();
        this.editingMarker.set(null);
        this.markerError.set(null);
        this.bindingConflict.set(null);
        this.markerDraft.set(createDefaultMapMarker(center?.lat, center?.lng));
    }


    startEditMarker(marker: MapMarker): void {
        if(this.boundaryDraftBlocksAction())return;
        this.markerMutationGeneration++;
        this.markerSaving.set(false);
        this.markerPositionChosen.set(false);
        this.bindingConflict.set(null);
        this.spliceTarget.set(null);
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
        if (this.spliceTarget()) { this.saveSplice(); return; }
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
                this.closePopup();
                const effects = new Map(saved.binding_effects?.map(effect => [effect.id, effect]));
                this.markers.update(current => [...current.filter(item => item.id !== saved.id)
                    .map(item => effects.has(item.id) ? { ...item, ...effects.get(item.id)! } : item), ...(this.workspace.layers().length ? [] : [saved])]);
                this.selectedMarkerId.set(saved.id);
                this.setMarkerData(this.markers());
                this.markerDialog()?.close({});
                this.editingMarker.set(null);
                this.focusGeneration++;
                this.focusSubscription?.unsubscribe();
                if (draft.building_position && saved.building_id !== null && saved.building_link_role === 'represents') {
                    this.suppressFocusForBuildingId = saved.building_id;
                    this.buildingCoordinatesChanged.emit({
                        id: saved.building_id, latitude: saved.latitude === null ? null : String(saved.latitude),
                        longitude: saved.longitude === null ? null : String(saved.longitude),
                    });
                }
                if (saved.latitude !== null && saved.longitude !== null) this.coordinateNotice.set(null);
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
        forkJoin({ building: this.addressApi.getBuilding(buildingId), primary: this.mapData.getBuildingMarker(buildingId) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: ({ building, primary }) => {
                if (this.destroyed || generation !== this.contextGeneration || request !== this.popupGeneration) return;
                const existing = primary;
                if (existing) { this.startEditMarker(existing); return; }
                this.startCreateMarker(); this.closePopup();
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
        this.selectedMapEndpoint.set(endpoint);
        this.syncPopupConnections();
    }

    showObjectConnections(endpoint: { kind: 'building' | 'marker'; id: number }): void {
        this.selectedMapEndpoint.set(endpoint);
        this.requestConnectionMode('object');
    }

    requestConnectionMode(mode: ConnectionMode): void {
        if(this.boundaryDraftBlocksAction())return;
        if (this.connectionDraftActive() || this.connectionDialog()?.stateComputed() === 'open' || this.connectionSaving()
            || this.connectionDeleteDialog()?.stateComputed() === 'open' || this.boundaryDialog()?.stateComputed() === 'open' || this.spliceTarget()) {
            toast.error('Сначала сохраните или отмените редактирование соединения.'); return;
        }
        this.connectionMode.set(mode);
        if (mode === 'hidden') this.clearConnectionDisplay();
    }

    private syncPopupConnections(): void {
        const endpoint = this.selectedMapEndpoint();
        this.popupConnections.set(endpoint && this.showConnections() ? this.connections().filter(line =>
            [line.source, line.target].some(end => end.kind === endpoint.kind && end.id === endpoint.id)) : []);
    }

    private clearConnectionDisplay(): void {
        this.activeBoundary.set(null);this.boundaryPreview.set(null);this.movingBoundary.set(false);this.installationEditId.set(null);this.installationHandles.set([]);
        this.connectionLoadGeneration++;
        this.connectionViewportSubscription?.unsubscribe(); this.connectionViewportSubscription = null;
        if (this.popupKind === 'connection') this.closePopup(false);
        this.connections.set([]); this.popupConnections.set([]); this.selectedConnectionId.set(null);
        this.connectionLoadError.set(null);
        this.routeMenuTarget.set(null); this.spliceChoices.set([]); this.alternativeSpliceLine.set(null);
        this.boundaryTarget.set(null); this.spliceController?.clear(); this.spliceHover.set(null);
        this.connectionLayer?.clear();
        if (!this.connectionDraftActive() && this.connectionDialog()?.stateComputed() !== 'open') {
            this.editingConnection.set(null); this.connectionDraft.set(createConnectionDraft()); this.routeHistory.set([]); this.routeBeforeMap = null;
            this.connectionToDelete.set(null);
        }
    }

    private loadConnections(viewport?: MapBounds): void {
        const mode = this.connectionMode(), endpoint = this.selectedMapEndpoint();
        this.lastConnectionContext = this.connectionContext(mode, endpoint);
        if (mode === 'hidden' || (mode === 'object' && !endpoint)) { this.clearConnectionDisplay(); return; }
        const bounds = viewport ?? this.currentViewport();
        if (!this.workspace.ready() || (mode === 'viewport' && !bounds)) return;
        const generation = ++this.connectionLoadGeneration, context = this.contextGeneration;
        this.connectionLoadError.set(null);
        this.connectionViewportSubscription?.unsubscribe();
        this.connections.set([]); this.popupConnections.set([]); this.connectionLayer?.clear(); this.spliceController?.clear();
        this.connectionViewportSubscription = this.mapData.getConnections(mode === 'viewport' ? bounds! : undefined,
            mode === 'object' ? endpoint! : undefined, this.workspace.query()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: lines => {
                if (generation !== this.connectionLoadGeneration || context !== this.contextGeneration || this.destroyed || mode !== this.connectionMode()) return;
                this.connections.set(lines); this.syncPopupConnections(); this.renderConnections();
            },
            error: (error: HttpErrorResponse) => {
                if (generation !== this.connectionLoadGeneration || context !== this.contextGeneration || this.destroyed) return;
                this.connectionLoadError.set(error.error?.detail?.message ?? 'Не удалось загрузить соединения. Повторите запрос.');
            },
        });
    }

    private connectionContext(mode: ConnectionMode, endpoint: { kind: string; id: number } | null): string {
        return JSON.stringify([mode, mode === 'object' ? endpoint : null, this.workspace.query()]);
    }

    private currentViewport(): MapBounds | undefined {
        const bounds = this.map?.getBounds();
        return bounds ? { west: Math.max(-180, bounds.getWest()), south: Math.max(-90, bounds.getSouth()),
            east: Math.min(180, bounds.getEast()), north: Math.min(90, bounds.getNorth()) } : undefined;
    }


    private renderConnections(): void {
        const preview=this.boundaryPreview()?.line;
        this.connectionLayer?.setConnections(this.visibleConnections().map(line=>preview?.id===line.id?preview:line), this.selectedConnectionId());
        this.refreshInstallationHandles();
    }

    private refreshInstallationHandles(): void {
        const map=this.map, preview=this.boundaryPreview()?.line;
        const line=this.visibleConnections().find(line=>line.id===this.selectedConnectionId());
        if(this.installationEditId()!==null&&this.installationEditId()!==line?.id&&!this.activeBoundary())this.installationEditId.set(null);
        this.installationHandles.set(map&&line&&!this.connectionDraftActive()&&!this.placingMarker()
            ?installationBoundaries(preview?.id===line.id?preview:line,map):[]);
    }

    startInstallationEdit(line:MapConnection):void {
        this.closePopup(false);this.cancelBoundaryEdit();this.selectedConnectionId.set(line.id);this.installationEditId.set(line.id);
        this.spliceController?.clear();this.refreshInstallationHandles();
    }

    selectExistingBoundary(id:number,vertex:number):void {
        if(this.activeBoundary()||this.connectionDraftActive()||this.placingMarker())return;
        const line=this.visibleConnections().find(line=>line.id===id);if(!line)return;
        if(!this.canManage()||!line.can_manage){this.openConnectionPopup(id,line.geometry?.coordinates[vertex] as [number,number]);return;}
        this.startInstallationEdit(line);
        const boundary=this.installationHandles().find(handle=>handle.vertex===vertex);
        if(boundary)this.openBoundary(boundary);
    }

    openBoundary(boundary:InstallationBoundary):void {
        if(this.boundarySaving()||this.boundaryPreview())return;
        const line=this.visibleConnections().find(line=>line.id===this.selectedConnectionId());
        if(!line||!line.can_manage||!this.canManage())return;
        this.spliceController?.clear();this.activeBoundary.set({line:structuredClone(line),boundary});
        this.boundaryAction.set('menu');this.boundaryMethod.set(boundary.after);this.boundaryError.set(null);
    }

    moveBoundary():void { this.boundaryError.set(null);this.movingBoundary.set(true); }

    private updateBoundaryPreview(cursor:{x:number;y:number}):boolean {
        const target=this.activeBoundary(),map=this.map;if(!target||!map)return false;
        const snap=nearestRoutePoint(target.line.geometry!.coordinates,cursor,map);
        const preview=snap&&previewBoundaryMove(target.line,target.boundary.vertex,snap);
        if(!preview||!snap)return false;
        this.boundaryPreview.set({line:preview,snap});this.renderConnections();
        return true;
    }

    cancelBoundaryEdit():void {
        if(this.boundarySaving())return;
        this.movingBoundary.set(false);this.activeBoundary.set(null);this.boundaryPreview.set(null);this.boundaryError.set(null);
        this.spliceController?.clear();this.renderConnections();
    }

    finishInstallationEdit():void { if(this.boundarySaving())return;this.cancelBoundaryEdit();this.installationEditId.set(null); }

    saveBoundaryEdit(data?:MapBoundaryEdit):void {
        const target=this.activeBoundary();if(!target||this.boundarySaving())return;
        if(!data){const snap=this.boundaryPreview()?.snap;if(!snap)return;data={operation:'move',segment_index:snap.segmentIndex,fraction:snap.fraction,position:{latitude:snap.position[1],longitude:snap.position[0]}};}
        const generation=++this.markerMutationGeneration;this.boundarySaving.set(true);this.boundaryError.set(null);
        this.mapData.editInstallationBoundary(target.line,target.boundary.vertex,data).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next:line=>{if(this.destroyed||generation!==this.markerMutationGeneration)return;this.boundarySaving.set(false);this.cancelBoundaryEdit();this.applyRouteMutation([line]);toast.success('Граница прокладки сохранена');},
            error:(error:HttpErrorResponse)=>{if(this.destroyed||generation!==this.markerMutationGeneration)return;this.boundarySaving.set(false);this.boundaryError.set(error.error?.detail?.message??'Не удалось сохранить границу. Предварительные изменения не потеряны.');},
        });
    }

    private connectionFootprints():MarkerFootprint[]{
        const map=this.map;
        if(!map||typeof map.queryRenderedFeatures!=='function'||typeof map.project!=='function')return [];
        const layers=['building-points','selected-building-marker','custom-marker-points','building-clusters','custom-marker-clusters'].filter(id=>map.getLayer(id));
        const markers=new Map(this.markers().map(marker=>[marker.id,marker]));
        const result:MarkerFootprint[]=[],seen=new Set<string>(), renderedMarkers=new Set<number>();
        for(const feature of map.queryRenderedFeatures({layers})){
            if(feature.geometry.type!=='Point')continue;
            const center=map.project(feature.geometry.coordinates as [number,number]);
            const key=`${feature.layer.id}:${feature.id}:${center.x.toFixed(2)}:${center.y.toFixed(2)}`;
            if(seen.has(key))continue;seen.add(key);
            if(feature.properties['point_count']){
                const count=Number(feature.properties['point_count']),building=feature.layer.id==='building-clusters';
                const radius=count>=100?(building?26:25):count>=20?(building?21:20):(building?17:16);
                result.push({center,width:radius*2+2,height:radius*2+2,radius:radius+1});continue;
            }
            const markerId=feature.layer.id==='custom-marker-points'?Number(feature.properties['id']):Number(feature.properties['marker_id']);
            const marker=markers.get(markerId);
            if(marker&&Math.abs(feature.geometry.coordinates[0]-marker.longitude!)<1e-7&&Math.abs(feature.geometry.coordinates[1]-marker.latitude!)<1e-7){renderedMarkers.add(marker.id);this.pendingInteractiveMarkers.delete(marker.id);}
            const appearance=marker?pickMarkerAppearance(marker):{...mapAppearanceForTheme(this.dark()),icon_name:'map-house',label_text:null};
            const selected=marker?marker.id===this.selectedMarkerId()||marker.id===this.selectedBuildingMarker()?.id:feature.layer.id==='selected-building-marker'||Number(feature.properties['id'])===this.popupBuildingId();
            const imageKey=String(feature.properties['image_key']??(selected?SELECTED_BUILDING_IMAGE:BUILDING_MARKER_IMAGE));
            const footprint=this.footprintCache.footprint(map,center,appearance,imageKey,selected);
            if(footprint){const metrics=markerMetrics(appearance);result.push({...footprint,hitBox:{center,width:metrics.width+8,height:metrics.size+8}});}
        }
        // GeoJSON worker updates lag behind a successful mutation. Protect the
        // canonical points immediately, before their sprites are queryable.
        // At clustered zooms the rendered cluster footprints remain authoritative.
        if(map.getZoom()>14||this.pendingInteractiveMarkers.size){
            for(const marker of markers.values()){
                if((map.getZoom()<=14&&!this.pendingInteractiveMarkers.has(marker.id))||renderedMarkers.has(marker.id)||marker.longitude===null||marker.latitude===null||!this.visibleMarker(marker))continue;
                const center=map.project([marker.longitude,marker.latitude]);
                const footprint=this.footprintCache.footprint(map,center,pickMarkerAppearance(marker),this.markerImageKey(marker),marker.id===this.selectedMarkerId());
                if(footprint){const metrics=markerMetrics(marker);result.push({...footprint,hitBox:{center,width:metrics.width+8,height:metrics.size+8}});}
            }
        }
        return result;
    }

    holdSpliceHover(held: boolean): void { this.spliceController?.hold(held); }

    moveSpliceHover(event: MouseEvent): void {
        if (event.buttons) return;
        const bounds = this.mapContainer().nativeElement.getBoundingClientRect();
        this.spliceController?.moveOverButton({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }

    chooseHoveredSplice(): void {
        const hover = this.spliceHover();
        if (!hover || this.spliceBusy()) return;
        this.spliceController?.clear();
        if (hover.targets.length === 1) this.openRouteMenu(hover.targets[0]);
        else { this.spliceChoices.set(hover.targets); this.spliceChoiceDialog()?.open(); }
    }

    openRouteMenu(target:SpliceTarget):void {
        if(!this.canManage()||!target.connection.can_manage)return;
        this.splicePlacementDialog()?.close({});
        this.routeMenuTarget.set(structuredClone(target));
        this.spliceController?.clear();
    }

    closeRouteMenu():void {this.routeMenuTarget.set(null);}

    selectRouteObject(type:MapPointType,operation:'split'|'place'):void {
        const target=this.routeMenuTarget();if(!target)return;
        this.routeMenuTarget.set(null);
        this.openSpliceEditor(target,type,operation);
    }

    chooseSpliceConnection(target: SpliceTarget): void {
        this.spliceChoiceDialog()?.close({});
        // A neighboring cable may have a slightly different snapped point.
        // Reposition the one plus onto the explicitly chosen line; only the
        // next activation fixes its position and opens the editor.
        this.spliceController?.chooseConnection(target);
        this.selectedConnectionId.set(target.connection.id);
    }

    focusChosenSplice(): void {
        // Wait until the dialog's focus trap is actually disposed.
        if (!this.destroyed && this.spliceHover()?.targets.length === 1) this.spliceHoverAction()?.nativeElement.focus();
    }

    openSpliceEditor(target: SpliceTarget,type:MapPointType='splice',operation:'split'|'place'='split'): void {
        if (!this.canManage() || !target.connection.can_manage || !target.connection.geometry_token) return;
        this.spliceChoiceDialog()?.close({});
        this.splicePlacementDialog()?.close({});
        this.spliceController?.clear();
        this.closePopup();
        this.editingMarker.set(null);
        this.markerError.set(null);
        this.routeOperation.set(operation);this.routeInstallationAfter.set(null);
        this.spliceTarget.set(structuredClone(target));
        const pointType=MAP_POINT_TYPES.find(item=>item.value===type)!;
        this.markerDraft.set({ ...createDefaultMapMarker(target.point.position[1], target.point.position[0]),
            name: pointType.label, point_type: type, icon_name: pointType.icon, visibility: target.connection.visibility });
        this.markerDialog()?.open();
    }

    onMarkerDialogClosed(): void {
        if (this.placingMarker() || this.markerDialog()?.stateComputed() === 'open') return;
        if (this.markerSaving()) { this.markerMutationGeneration++; this.markerSaving.set(false); }
        this.spliceTarget.set(null);
        this.editingMarker.set(null);
        this.markerPositionChosen.set(false);
        this.bindingConflict.set(null);
    }

    startAccessibleSplice(line: MapConnection): void {
        if (!this.canManage() || !line.can_manage || !line.geometry_token || !line.geometry) return;
        this.closePopup();
        this.spliceController?.clear();
        this.alternativeSpliceLine.set(line);
        this.spliceSegment.set(null);
        this.spliceFraction.set(.5);
        this.splicePlacementDialog()?.open();
    }

    confirmAccessibleSplice(): void {
        const connection = this.alternativeSpliceLine(), position = this.alternativeSplicePoint(), index = this.spliceSegment();
        if (!connection || !position || index === null || !this.map) return;
        this.openRouteMenu({ connection, point: { segmentIndex: index, fraction: this.spliceFraction(), position,
            screen: this.map.project(position), distancePx: 0 } });
    }

    private saveSplice(): void {
        const target = this.spliceTarget();
        if (!target || this.markerSaving()) return;
        const draft = this.markerDraft(), generation = ++this.markerMutationGeneration;
        this.markerSaving.set(true);
        this.markerError.set(null);
        const pointPayload={
            expected_version: target.connection.version, expected_geometry_token: target.connection.geometry_token,
            segment_index: target.point.segmentIndex, fraction: target.point.fraction,
            position: { latitude: target.point.position[1], longitude: target.point.position[0] },
        };
        const appearance={...pickMarkerAppearance(draft),name:draft.name,description:draft.description};
        const request:Observable<{marker:MapMarker;connections:MapConnection[]}>=this.routeOperation()==='split'
            ?this.mapData.splitConnection(target.connection.id,{...pointPayload,marker:{...appearance,point_type:draft.point_type as RouteNodeType}})
            :this.mapData.placeRouteObject(target.connection.id,{...pointPayload,marker:{...appearance,point_type:draft.point_type as RoutePassThroughType},installation_after:this.routeInstallationAfter()})
                .pipe(mapResult(result=>({marker:result.marker,connections:[result.connection]})));
        request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: result => {
                if (this.destroyed || generation !== this.markerMutationGeneration) return;
                // Invalidate pre-split viewport HTTP responses before applying the
                // atomic response. Keep camera, tree and unrelated graph objects.
                this.markerSaving.set(false);
                this.applyRouteMutation(result.connections,result.marker);
                this.markerDialog()?.close({});
                this.spliceTarget.set(null);
                this.selectedMarkerId.set(result.marker.id);
                toast.success(this.routeOperation()==='split'?'Узел вставлен в соединение':'Объект размещён на трассе');
            },
            error: (error: HttpErrorResponse) => {
                if (this.destroyed || generation !== this.markerMutationGeneration) return;
                this.markerSaving.set(false);
                const message = error.error?.detail?.message ?? 'Не удалось добавить объект на трассу. Данные формы сохранены.';
                this.markerError.set(message);
                toast.error(message);
            },
        });
    }

    private applyRouteMutation(connections:MapConnection[],marker?:MapMarker):void {
        if(marker)this.pendingInteractiveMarkers.add(marker.id);
        this.spliceController?.clear();this.spliceHover.set(null);this.routeMenuTarget.set(null);
        this.viewportGeneration++;this.viewportSubscription?.unsubscribe();this.markerViewportSubscription?.unsubscribe();this.connectionViewportSubscription?.unsubscribe();
        this.connectionLoadGeneration++;
        const ids=new Set(connections.map(line=>line.id));
        const endpoint = this.selectedMapEndpoint();
        const candidates = this.workspace.layers().length || this.installationFilter() !== 'all' ? [] : connections.filter(line =>
            this.connectionMode() === 'viewport' || (this.connectionMode() === 'object' && endpoint && [line.source, line.target].some(end => end.kind === endpoint.kind && end.id === endpoint.id)));
        this.connections.update(lines=>this.connectionMode() === 'hidden' ? [] : [...lines.filter(line=>!ids.has(line.id)),...candidates]);
        this.markers.update(current=>{
            const points=marker?[...current.filter(point=>point.id!==marker.id),marker]:current;
            return points.map(point=>{
                for(const line of connections){
                    const attachment=line.route_objects?.find(item=>item.marker_id===point.id);
                    if(attachment)return {...point,route_attachment:{connection_id:line.id,name:line.name,version:line.version,geometry_token:line.geometry_token,segment_index:attachment.segment_index,fraction:attachment.fraction}};
                }
                return point.route_attachment&&ids.has(point.route_attachment.connection_id)&&connections.some(line=>line.id===point.route_attachment!.connection_id&&line.route_objects!==undefined)?{...point,route_attachment:null}:point;
            });
        });
        this.setMarkerData(this.markers());this.connectionLayer?.refreshFootprints(true);this.renderConnections();
        if (this.workspace.layers().length) this.workspace.reloadLayers();
        if (this.workspace.layers().length || this.installationFilter() !== 'all' || this.connectionMode() !== 'viewport') this.loadConnections();
    }

    startInstallationBoundary():void {
        const target=this.routeMenuTarget();if(!target)return;
        this.routeMenuTarget.set(null);this.boundaryTarget.set(target);this.boundaryMethod.set('duct');this.boundaryUntil.set('end');this.boundaryError.set(null);this.boundaryDialog()?.open();
    }

    saveInstallationBoundary():void {
        const target=this.boundaryTarget();if(!target||this.boundarySaving())return;
        const generation=++this.markerMutationGeneration;this.boundarySaving.set(true);this.boundaryError.set(null);
        this.mapData.setInstallationBoundary(target.connection.id,{expected_version:target.connection.version,expected_geometry_token:target.connection.geometry_token,
            segment_index:target.point.segmentIndex,fraction:target.point.fraction,position:{latitude:target.point.position[1],longitude:target.point.position[0]},installation_after:this.boundaryMethod(),until:this.boundaryUntil()})
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:line=>{if(this.destroyed||generation!==this.markerMutationGeneration)return;this.boundarySaving.set(false);this.applyRouteMutation([line]);this.selectedConnectionId.set(line.id);this.installationEditId.set(line.id);this.refreshInstallationHandles();this.boundaryDialog()?.close({});this.boundaryTarget.set(null);toast.success('Способ прокладки изменён');},
                error:(error:HttpErrorResponse)=>{if(this.destroyed||generation!==this.markerMutationGeneration)return;this.boundarySaving.set(false);this.boundaryError.set(error.error?.detail?.message??'Не удалось сохранить способ прокладки');}});
    }

    requestDetachObject(line:MapConnection,markerId:number,name:string):void {this.objectToDetach.set({line,markerId,name});this.detachDialog()?.open();}
    detachObject():void {
        const target=this.objectToDetach();if(!target||this.objectDetaching())return;
        const generation=++this.connectionMutationGeneration;this.objectDetaching.set(true);
        this.mapData.detachRouteObject(target.line,target.markerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:result=>{
            if(this.destroyed||generation!==this.connectionMutationGeneration)return;this.objectDetaching.set(false);this.applyRouteMutation([result.connection],result.marker);this.detachDialog()?.close({});this.closePopup();this.openConnectionPopup(result.connection.id);toast.success('Объект отвязан от трассы');
        },error:(error:HttpErrorResponse)=>{if(this.destroyed||generation!==this.connectionMutationGeneration)return;this.objectDetaching.set(false);toast.error(error.error?.detail?.message??'Не удалось отвязать объект');}});
    }


    startCreateConnection(): void {
        if(this.boundaryDraftBlocksAction())return;
        this.closePopup();
        this.editingConnection.set(null);
        this.connectionError.set(null);
        this.routeHistory.set([]);
        this.connectionDraft.set(createConnectionDraft(this.canManage() ? 'company' : 'private'));
        this.connectionDraftActive.set(true);
        this.connectionDialog()?.open();
    }


    startEditConnection(connection: MapConnection): void {
        if(this.boundaryDraftBlocksAction())return;
        this.closePopup();
        this.editingConnection.set(connection);
        this.connectionError.set(null);
        this.routeHistory.set([]);
        this.connectionDraft.set({ source: connection.source, target: connection.target, name: connection.name,
            description: connection.description, visibility: connection.visibility, medium: connection.medium,
            status: connection.status, fiber_count: connection.fiber_count, category: connection.category,
            vertices: connection.vertices.map(point => [...point] as [number, number]), expected_version: connection.version });
        this.connectionDraft.update(draft=>({...draft,installation_methods:installationMethods(connection.vertices,connection.installation_methods)}));
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
        this.connectionLayer?.setDraft(this.connectionDraft(), false, this.editingConnection()?.id ?? null);
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
        if (this.connectionDialog()?.stateComputed() === 'open') return;
        if (this.connectionMapMode() === null) {
            this.connectionDraftActive.set(false);
            this.connectionLayer?.setDraft(null);
            if (this.connectionSaving()) { this.connectionMutationGeneration++; this.connectionSaving.set(false); }
            this.editingConnection.set(null); this.connectionDraft.set(createConnectionDraft()); this.routeHistory.set([]); this.routeBeforeMap = null;
        }
    }


    private rememberRoute(): void {
        const points = structuredClone(this.connectionDraft());
        this.routeHistory.update(history => [...history.slice(-29), points]);
    }


    private moveRouteVertex(index: number, point: [number, number]): void {
        if (this.connectionMapMode() !== 'vertices') return;
        this.connectionDraft.update(draft => ({ ...draft, vertices: draft.vertices.map((current, i) => i === index ? point : current) }));
    }


    removeRouteVertex(): void {
        const index = this.activeVertex();
        if (index === null || this.connectionMapMode() !== 'vertices') return;
        const draft=this.connectionDraft(),result=removeVertexWithMethods(draft.vertices,installationMethods(draft.vertices,draft.installation_methods),index);
        if(!result){toast.error('Это граница способов прокладки. Выберите способ объединённого участка в редакторе соединения.');return;}
        this.rememberRoute();
        this.connectionDraft.update(draft => ({ ...draft, ...result }));
        this.activeVertex.set(null);
    }


    undoRoute(): void {
        const history = this.routeHistory();
        if (!history.length) return;
        this.connectionDraft.set(history[history.length - 1]);
        this.routeHistory.set(history.slice(0, -1));
        this.activeVertex.set(null);
    }


    @HostListener('window:keydown', ['$event'])
    handleMapKey(event: KeyboardEvent): void {
        // Closing overlays may still consume Escape during their exit animation.
        if((this.movingBoundary()||this.boundaryPreview())&&event.key==='Escape'){
            event.preventDefault();this.cancelBoundaryEdit();return;
        }
        if (event.defaultPrevented || Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="menu"], [data-slot="popover-content"], [role="listbox"]')).some(element=>element!==this.expandedOverlay?.overlayElement)) return;
        if(this.activeBoundary()){
            if(event.key==='Escape'){event.preventDefault();this.cancelBoundaryEdit();}
            else if(event.key==='Enter'&&this.boundaryPreview()){event.preventDefault();this.movingBoundary.set(false);this.saveBoundaryEdit();}
        } else if (this.installationEditId()&&event.key==='Escape'){event.preventDefault();this.finishInstallationEdit();}
        else if (this.connectionMapMode()) {
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
                this.applyRouteMutation([line]);
                this.connectionDraftActive.set(false);
                this.connectionLayer?.setDraft(null);
                this.connectionDialog()?.close({});
                this.selectedConnectionId.set(this.showConnections() ? line.id : null);
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
        if(this.activeBoundary())return;
        const connection = this.connections().find(line => line.id === id) ?? this.popupConnections().find(line => line.id === id);
        if (!connection) return;
        const point = coordinate ?? connection.geometry?.coordinates[0] as [number, number] | undefined;
        if (!point) { toast.error('Для отображения трассы нужны координаты обоих концов'); return; }
        this.selectedConnectionId.set(id);
        this.renderPopup(this.connectionPopup(), connection, point);
        this.popupKind = 'connection';
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
        this.mapData.deleteConnection(line.id, line.version).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                if (this.destroyed || generation !== this.connectionMutationGeneration) return;
                this.connectionDeleting.set(false);
                this.connections.update(lines => lines.filter(item => item.id !== line.id));
                this.connectionDeleteDialog()?.close({});
                this.connectionToDelete.set(null);
                toast.success('Соединение удалено');
            },
            error: (error: HttpErrorResponse) => {
                if (generation !== this.connectionMutationGeneration || this.destroyed) return;
                this.connectionDeleting.set(false);
                const detail = error.error?.detail;
                if (detail?.dependencies && detail.code === 'route_has_objects') {
                    this.connectionDeleteDialog()?.close({}); this.dependenciesDialog().show(detail as AddressDependencyConflict, this.map?.getCanvas() ?? null);
                } else toast.error(detail?.message ?? 'Не удалось удалить соединение');
            },
        });
    }


    requestDeleteMarker(marker: MapMarker): void {
        this.closePopup();
        this.markerToDelete.set(marker);
        this.markerDeleteError.set(null);
        this.markerDependencies.set([]);
        const generation = this.contextGeneration, request = ++this.markerDependencyGeneration;
        this.mapData.getDependencies({ kind: 'marker', id: marker.id }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: report => {
                if (this.destroyed || generation !== this.contextGeneration || request !== this.markerDependencyGeneration) return;
                if (report.dependencies.length) this.dependenciesDialog().show(report as AddressDependencyConflict, this.map?.getCanvas() ?? null);
                else this.deleteMarkerDialog()?.open();
            },
            error: () => { if (generation === this.contextGeneration && request === this.markerDependencyGeneration) toast.error('Не удалось проверить зависимости. Повторите удаление.'); },
        });
    }


    deleteMarker(): void {
        const marker = this.markerToDelete();
        if (!marker || this.markerDeleting()) {
            return;
        }
        const generation = ++this.markerMutationGeneration;
        this.markerDeleting.set(true);
        this.mapData.deleteMarker(marker.id, marker.version).pipe(
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
                if (detail?.dependencies && ['object_has_dependencies', 'endpoint_has_connections'].includes(detail.code)) {
                    this.deleteMarkerDialog()?.close({});
                    this.dependenciesDialog().show(detail as AddressDependencyConflict, this.map?.getCanvas() ?? null);
                    return;
                }
                this.markerDeleteError.set(detail?.message ?? 'Не удалось удалить маркер');
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
        this.placementWasChosen = this.markerPositionChosen();
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
        this.markerPositionChosen.set(true);
        this.placingMarker.set(false);
        this.cleanupPointSelection();
        this.markerDialog()?.open();
    }


    cancelPointSelection(): void {
        const original = this.placementOriginalDraft;
        if (original) {
            this.markerDraft.set(original);
        }
        this.markerPositionChosen.set(this.placementWasChosen);
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
        if (!map || !map.getSource(MAP_BUILDINGS_SOURCE_ID) || !this.workspace.ready()) {
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
        this.viewportSubscription = this.mapData.getBuildings(viewport, this.workspace.query()).subscribe({
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
        this.markerViewportSubscription = this.mapData.getMarkers(viewport, this.workspace.query()).subscribe({
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
        // Object mode is one-hop and does not refetch on every pan/zoom.
        if (this.connectionMode() === 'viewport') this.loadConnections(viewport);
        else if (this.connectionMode() === 'hidden') this.clearConnectionDisplay();
    }


    private setBuildingData(data: MapBuildingFeatureCollection): void {
        this.viewportBuildings = data;
        this.legendHasBuildings.set(data.features.length > 0);
        this.renderBuildingData();
    }


    private renderBuildingData(): void {
        const source = this.map?.getSource(MAP_BUILDINGS_SOURCE_ID) as GeoJSONSource | undefined;
        if (!this.showBuildings()) { source?.setData(EMPTY_FEATURES); return; }
        const selected = this.selectedBuilding();
        const selectedId = this.buildingCenter(selected) || this.selectedBuildingMarker() ? selected?.id : null;
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
        const generation = ++this.focusGeneration;
        this.focusSubscription?.unsubscribe();
        const map = this.map;
        if (!map || !map.getSource(MAP_BUILDINGS_SOURCE_ID)) {
            return;
        }
        const center = this.buildingCenter(building);
        if (building && this.suppressFocusForBuildingId === building.id) {
            this.suppressFocusForBuildingId = null;
            this.coordinateNotice.set(center ? null : 'Для выбранного здания координаты ещё не заданы.');
            return;
        }
        if (center) {
            this.coordinateNotice.set(null);
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
        const settings = this.workspace.settings();
        const unrestricted = this.workspace.ready() && settings.include_unassigned && this.workspace.layers().length === 0
            && (!settings.point_types_enabled || settings.point_types.includes('building'));
        if (!building || (settings.point_types_enabled && !settings.point_types.includes('building')) || (!unrestricted && !this.viewportBuildings.features.some(feature => feature.properties.id === building.id)
            && !this.selectedBuildingMarker())) { source?.setData(EMPTY_FEATURES); return; }
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
        // Browsers clamp an overflowing timeout to ~1 ms, causing a tile
        // refresh loop if a server/fixture ever supplies an excessive expiry.
        const delay = Math.min(2_147_483_647, Math.max(
            1000,
            (session.expires_at - Math.floor(Date.now() / 1000)
                - MAP_SESSION_REFRESH_MARGIN_SECONDS) * 1000,
        ));
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
        this.footprintCache.clear();
        this.spliceController?.destroy();
        this.spliceController = null;
        this.buildingImageSignature = null;
        this.markerResources.clear();
        this.usedMarkerImages.clear();
        this.pendingMarkerImages.clear();
        this.map?.remove();
        this.map = null;
    }


    private destroyMap(): void {
        this.collapseMap(false);
        if (this.resizeFrame !== null) cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = null;
        if (this.viewReady) {
            this.mapContainer().nativeElement.removeEventListener('pointerdown', this.panelPointerGuard, true);
            this.mapContainer().nativeElement.removeEventListener('click', this.panelPointerGuard, true);
        }
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
