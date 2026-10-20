import {
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';

import {
    CdkDrag,
    CdkDragDrop,
    CdkDropList,
    DragDropModule,
} from '@angular/cdk/drag-drop';
import { toast } from '@spartan-ng/brain/sonner';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideBuilding2,
    lucideArrowLeft,
    lucideChevronDown,
    lucideChevronRight,
    lucideCircleAlert,
    lucideDoorOpen,
    lucideEllipsis,
    lucideGripVertical,
    lucideLoaderCircle,
    lucideMapPin,
    lucideMove,
    lucidePencil,
    lucidePlus,
    lucideRefreshCw,
    lucideSettings2,
    lucideTrash2,
    lucideWarehouse,
} from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmButtonGroupImports } from '@spartan-ng/helm/button-group';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import type { BrnDialog } from '@spartan-ng/brain/dialog';

import { AddressApiService } from '../../core/addresses/address-api.service';
import type {
    AddressObject,
    AddressType,
    Building,
    Entrance,
    Location,
} from '../../core/addresses/address.models';
import {
    addressObjectAllowsBuildings,
    addressObjectDisplayName,
    allowedChildCategories,
    filterAllowedAddressTypes,
    ROOT_ADDRESS_TYPE_CATEGORIES,
} from '../../core/addresses/address-hierarchy';
import type { CoordinatePair } from '../../core/addresses/coordinate-input';
import { CompanyContextService } from '../../core/company/company-context.service';
import {
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';
import { PermissionService } from '../../core/permissions/permission.service';
import {
    AddressObjectDialogForm,
    BuildingDialogForm,
    EntranceDialogForm,
    LocationDialogForm,
} from './address-dialog-forms';
import { AddressTypeManager } from './address-type-manager';
import {
    AddressMoveDialogForm,
    type AddressMoveTarget,
} from './address-move-dialog-form';


type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type SearchState = 'idle' | 'loading' | 'ready' | 'error';


interface AddressTreeNode extends AddressObject {
    children: AddressTreeNode[];
    buildings: Building[];
    expanded: boolean;
    loaded: boolean;
    loading: boolean;
    loadError: boolean;
}


interface AddressObjectTreeRow {
    kind: 'address';
    key: `address:${number}`;
    node: AddressTreeNode;
    depth: number;
}


interface BuildingTreeRow {
    kind: 'building';
    key: `building:${number}`;
    building: Building;
    parent: AddressTreeNode;
    depth: number;
}


type AddressTreeRow = AddressObjectTreeRow | BuildingTreeRow;


type TreeDragData =
    | { kind: 'address'; node: AddressTreeNode }
    | { kind: 'building'; building: Building; parent: AddressTreeNode };


type TreeDropTarget =
    | { kind: 'address'; node: AddressTreeNode }
    | { kind: 'building'; parent: AddressTreeNode };


const SEARCH_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;


@Component({
    selector: 'app-addresses',
    imports: [
        NgIcon,
        DragDropModule,
        HlmAlertImports,
        HlmAlertDialogImports,
        HlmAutocompleteImports,
        HlmBadgeImports,
        HlmButtonImports,
        HlmButtonGroupImports,
        HlmDialogImports,
        HlmSelectImports,
        AddressObjectDialogForm,
        BuildingDialogForm,
        EntranceDialogForm,
        LocationDialogForm,
        AddressTypeManager,
        AddressMoveDialogForm,
    ],
    providers: [
        provideIcons({
            lucideArrowLeft,
            lucideBuilding2,
            lucideChevronDown,
            lucideChevronRight,
            lucideCircleAlert,
            lucideDoorOpen,
            lucideEllipsis,
            lucideGripVertical,
            lucideLoaderCircle,
            lucideMapPin,
            lucideMove,
            lucidePencil,
            lucidePlus,
            lucideRefreshCw,
            lucideSettings2,
            lucideTrash2,
            lucideWarehouse,
        }),
    ],
    templateUrl: './addresses.html',
    styleUrl: './addresses.css',
})
export class Addresses {
    private readonly addressApi = inject(AddressApiService);
    private readonly companyContext = inject(CompanyContextService);
    private readonly permissions = inject(PermissionService);
    private readonly destroyRef = inject(DestroyRef);

    readonly canReadAddresses = this.permissions.canSignal(
        PermissionCode.AddressesRead,
        PermissionScope.Company,
    );
    readonly canManageAddresses = this.permissions.canSignal(
        PermissionCode.AddressesManage,
        PermissionScope.Company,
    );

    readonly state = signal<LoadState>('idle');
    readonly types = signal<AddressType[]>([]);
    readonly roots = signal<AddressTreeNode[]>([]);
    readonly selectedObject = signal<AddressObject | null>(null);
    readonly buildings = signal<Building[]>([]);
    readonly buildingsState = signal<LoadState>('idle');
    readonly selectedBuilding = signal<Building | null>(null);
    readonly objectActionSelection = signal<string | null>(null);
    readonly entrances = signal<Entrance[]>([]);
    readonly locations = signal<Location[]>([]);
    readonly detailsState = signal<LoadState>('idle');
    readonly actionError = signal<string | null>(null);

    readonly searchQuery = signal('');
    readonly searchState = signal<SearchState>('idle');
    readonly searchResults = signal<Building[]>([]);
    readonly searchTotal = signal(0);
    readonly searchLoadingMore = signal(false);
    readonly searchPageError = signal(false);
    readonly selectedSearchResult = signal<Building | null>(null);
    readonly searchOverlayState = signal<'open' | 'closed'>('closed');
    readonly hasMoreSearchResults = computed(
        () => this.searchResults().length < this.searchTotal(),
    );
    readonly searchResultToString = (building: Building): string => (
        building.full_address
    );

    readonly objectParent = signal<AddressObject | null>(null);
    readonly editingObject = signal<AddressObject | null>(null);
    readonly objectName = signal('');
    readonly objectTypeId = signal<number | null>(null);
    readonly objectSaving = signal(false);
    readonly objectError = signal<string | null>(null);

    readonly editingBuilding = signal<Building | null>(null);
    readonly buildingParent = signal<AddressObject | null>(null);
    readonly buildingNumber = signal('');
    readonly buildingCorpus = signal('');
    readonly buildingStructure = signal('');
    readonly buildingLatitude = signal('');
    readonly buildingLongitude = signal('');
    readonly buildingSaving = signal(false);
    readonly buildingError = signal<string | null>(null);
    readonly buildingParentName = computed(() => {
        const parent = this.buildingParent();
        return parent ? this.objectDisplayName(parent) : '';
    });
    readonly objectParentName = computed(() => {
        const parent = this.objectParent();
        return parent ? this.objectDisplayName(parent) : null;
    });

    readonly editingEntrance = signal<Entrance | null>(null);
    readonly entranceNumber = signal('');
    readonly entranceSaving = signal(false);
    readonly entranceError = signal<string | null>(null);

    readonly editingLocation = signal<Location | null>(null);
    readonly locationEntranceId = signal<number | null>(null);
    readonly locationFloor = signal('');
    readonly locationName = signal('');
    readonly locationDescription = signal('');
    readonly locationSaving = signal(false);
    readonly locationError = signal<string | null>(null);

    readonly movingObject = signal<AddressObject | null>(null);
    readonly movingBuilding = signal<Building | null>(null);
    readonly moveTargetId = signal<number | null | undefined>(undefined);
    readonly moveSaving = signal(false);
    readonly moveError = signal<string | null>(null);
    readonly activeDropTargetKey = signal<string | null>(null);

    readonly reloadVersion = signal(0);

    private contextGeneration = 0;
    private buildingsRequestGeneration = 0;
    private buildingDetailsRequestGeneration = 0;
    private searchRequestGeneration = 0;
    private searchResultRequestGeneration = 0;
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private searchEnterReopenTimer: ReturnType<typeof setTimeout> | null = null;
    private searchNextOffset = 0;
    private readonly childRequestGenerations = new Map<number, number>();

    readonly treeRows = computed(() => {
        const rows: AddressTreeRow[] = [];
        const append = (nodes: AddressTreeNode[], depth: number): void => {
            for (const node of nodes) {
                rows.push({
                    kind: 'address',
                    key: `address:${node.id}`,
                    node,
                    depth,
                });
                if (node.expanded) {
                    append(node.children, depth + 1);
                    for (const building of node.buildings) {
                        rows.push({
                            kind: 'building',
                            key: `building:${building.id}`,
                            building,
                            parent: node,
                            depth: depth + 1,
                        });
                    }
                }
            }
        };
        append(this.roots(), 0);
        return rows;
    });

    readonly knownMoveTargets = computed<AddressMoveTarget[]>(() => {
        const targets: AddressMoveTarget[] = [];
        const append = (nodes: AddressTreeNode[], depth: number): void => {
            for (const node of nodes) {
                targets.push({
                    id: node.id,
                    label: this.objectDisplayName(node),
                    depth,
                });
                append(node.children, depth + 1);
            }
        };
        append(this.roots(), 0);
        return targets;
    });

    readonly availableMoveTargets = computed<AddressMoveTarget[]>(() => {
        const movingObject = this.movingObject();
        const movingBuilding = this.movingBuilding();
        const candidates = this.knownMoveTargets();
        if (movingObject) {
            const allowRoot = ROOT_ADDRESS_TYPE_CATEGORIES.includes(
                movingObject.type_category,
            );
            const targets = candidates.filter(target => {
                if (target.id === null) {
                    return allowRoot;
                }
                const node = this.findTreeNode(target.id);
                return node !== null && this.canMoveAddressTo(movingObject, node);
            });
            return allowRoot && movingObject.parent_id !== null
                ? [{ id: null, label: 'Корневой уровень', depth: 0 }, ...targets]
                : targets;
        }
        if (movingBuilding) {
            return candidates.filter(target => {
                const node = target.id === null ? null : this.findTreeNode(target.id);
                return node !== null
                    && node.id !== movingBuilding.address_object_id
                    && addressObjectAllowsBuildings(node);
            });
        }
        return [];
    });
    readonly moveDialogTitle = computed(() => (
        this.movingBuilding() ? 'Переместить здание' : 'Переместить адресный объект'
    ));
    readonly moveDialogDescription = computed(() => {
        const building = this.movingBuilding();
        if (building) {
            return `Дом ${building.number} сохранит подъезды и места размещения.`;
        }
        const addressObject = this.movingObject();
        return addressObject
            ? `${this.objectDisplayName(addressObject)} сохранит ID и всю дочернюю структуру.`
            : '';
    });

    readonly treeDropPredicate = (
        drag: CdkDrag<TreeDragData>,
        drop: CdkDropList<TreeDropTarget>,
    ): boolean => this.canDropTreeItem(drag.data, drop.data);

    readonly availableObjectTypes = computed(() => {
        const parent = this.objectParent();
        const available = filterAllowedAddressTypes(this.types(), parent);
        const editing = this.editingObject();
        if (
            editing
            && !available.some(type => type.id === editing.type_id)
        ) {
            const current = this.types().find(type => type.id === editing.type_id);
            if (current) {
                return [...available, current];
            }
        }
        return available;
    });


    constructor() {
        this.destroyRef.onDestroy(() => {
            this.clearSearchDebounce();
            this.clearSearchEnterReopen();
        });
        effect(onCleanup => {
            this.reloadVersion();
            const contextGeneration = ++this.contextGeneration;
            this.invalidatePendingRequests();
            const companyId = this.companyContext.activeCompanyId();
            const canRead = this.canReadAddresses();
            this.resetSelection();

            if (companyId === null || !canRead) {
                this.types.set([]);
                this.roots.set([]);
                this.state.set('idle');
                return;
            }

            this.state.set('loading');
            const subscription = forkJoin({
                types: this.addressApi.listTypes(),
                roots: this.addressApi.listObjects(),
            }).subscribe({
                next: result => {
                    if (contextGeneration !== this.contextGeneration) {
                        return;
                    }
                    this.types.set(result.types);
                    this.roots.set(result.roots.map(item => this.toTreeNode(item)));
                    this.state.set('ready');
                },
                error: () => {
                    if (contextGeneration !== this.contextGeneration) {
                        return;
                    }
                    this.state.set('error');
                },
            });
            onCleanup(() => subscription.unsubscribe());
        });
    }


    retry(): void {
        this.reloadVersion.update(value => value + 1);
    }


    canCreateChild(addressObject: AddressObject): boolean {
        return allowedChildCategories(addressObject).length > 0;
    }


    canCreateBuilding(addressObject: AddressObject): boolean {
        return addressObjectAllowsBuildings(addressObject);
    }


    objectDisplayName(addressObject: AddressObject): string {
        return addressObjectDisplayName(addressObject);
    }


    rowCreateLabel(addressObject: AddressObject): string {
        const action = this.canCreateBuilding(addressObject)
            ? 'Добавить дом в'
            : 'Добавить объект в';
        return `${action} ${this.objectDisplayName(addressObject)}`;
    }


    treeDragData(row: AddressTreeRow): TreeDragData {
        return row.kind === 'address'
            ? { kind: 'address', node: row.node }
            : { kind: 'building', building: row.building, parent: row.parent };
    }


    treeDropTarget(row: AddressTreeRow): TreeDropTarget {
        return row.kind === 'address'
            ? { kind: 'address', node: row.node }
            : { kind: 'building', parent: row.parent };
    }


    canDropTreeItem(data: TreeDragData, target: TreeDropTarget): boolean {
        if (!this.canManageAddresses() || target.kind !== 'address') {
            return false;
        }
        return data.kind === 'address'
            ? this.canMoveAddressTo(data.node, target.node)
            : data.building.address_object_id !== target.node.id
                && addressObjectAllowsBuildings(target.node);
    }


    showTreeDropTarget(row: AddressTreeRow): void {
        if (row.kind === 'address') {
            this.activeDropTargetKey.set(row.key);
        }
    }


    clearTreeDropTarget(rowKey?: string): void {
        if (rowKey === undefined || this.activeDropTargetKey() === rowKey) {
            this.activeDropTargetKey.set(null);
        }
    }


    handleTreeDrop(event: CdkDragDrop<TreeDropTarget>): void {
        this.clearTreeDropTarget();
        const data = event.item.data as TreeDragData;
        const target = event.container.data;
        if (
            !event.isPointerOverContainer
            || !this.canDropTreeItem(data, target)
            || target.kind !== 'address'
        ) {
            this.restoreTreeRender();
            return;
        }
        if (data.kind === 'address') {
            this.moveAddressObject(data.node, target.node.id);
        } else {
            this.moveBuilding(data.building, target.node.id);
        }
    }


    toggleNode(node: AddressTreeNode): void {
        if (node.loading) {
            return;
        }
        if (node.expanded) {
            this.updateTreeNode(node.id, current => ({ ...current, expanded: false }));
            return;
        }
        if (node.loaded) {
            this.updateTreeNode(node.id, current => ({ ...current, expanded: true }));
            return;
        }

        this.loadTreeNode(node.id);
    }


    activateAddressNode(node: AddressTreeNode): void {
        const collapse = this.selectedObject()?.id === node.id && node.expanded;
        this.selectObjectFromTree(node);
        if (collapse) {
            this.updateTreeNode(node.id, current => ({ ...current, expanded: false }));
        } else if (!node.expanded) {
            this.toggleNode(node);
        }
    }


    retryTreeNode(node: AddressTreeNode, event: Event): void {
        event.stopPropagation();
        this.loadTreeNode(node.id, true);
    }


    private loadTreeNode(nodeId: number, force = false): void {
        const node = this.findTreeNode(nodeId);
        if (!node || (!force && (node.loading || node.loaded))) {
            return;
        }

        const contextGeneration = this.contextGeneration;
        const requestGeneration = (this.childRequestGenerations.get(nodeId) ?? 0) + 1;
        this.childRequestGenerations.set(nodeId, requestGeneration);
        this.updateTreeNode(nodeId, current => ({
            ...current,
            expanded: true,
            loading: true,
            loadError: false,
        }));
        forkJoin({
            children: this.addressApi.listObjects(nodeId),
            buildings: addressObjectAllowsBuildings(node)
                ? this.addressApi.listBuildings(nodeId)
                : of([] as Building[]),
        }).subscribe({
            next: result => {
                if (
                    contextGeneration !== this.contextGeneration
                    || this.childRequestGenerations.get(nodeId) !== requestGeneration
                ) {
                    return;
                }
                this.updateTreeNode(nodeId, current => ({
                    ...current,
                    children: this.mergeTreeChildren(current.children, result.children),
                    buildings: result.buildings,
                    expanded: true,
                    loaded: true,
                    loading: false,
                    loadError: false,
                }));
                if (this.selectedObject()?.id === nodeId && !this.selectedBuilding()) {
                    this.buildings.set(result.buildings);
                    this.buildingsState.set('ready');
                }
            },
            error: () => {
                if (
                    contextGeneration !== this.contextGeneration
                    || this.childRequestGenerations.get(nodeId) !== requestGeneration
                ) {
                    return;
                }
                this.updateTreeNode(nodeId, current => ({
                    ...current,
                    loading: false,
                    loadError: true,
                }));
                if (this.selectedObject()?.id === nodeId) {
                    this.buildingsState.set('error');
                }
            },
        });
    }


    selectObject(addressObject: AddressObject): void {
        this.searchResultRequestGeneration += 1;
        this.selectedObject.set(addressObject);
        this.selectedBuilding.set(null);
        this.entrances.set([]);
        this.locations.set([]);
        this.actionError.set(null);
        this.loadBuildings(addressObject.id);
    }


    selectTreeBuilding(building: Building, parent: AddressObject): void {
        this.selectedObject.set(parent);
        this.buildings.set(this.findTreeNode(parent.id)?.buildings ?? []);
        this.buildingsState.set('ready');
        this.selectBuilding(building);
    }


    backToAddressObject(): void {
        this.buildingDetailsRequestGeneration += 1;
        this.selectedBuilding.set(null);
        this.entrances.set([]);
        this.locations.set([]);
        this.detailsState.set('idle');
    }


    selectBuilding(building: Building): void {
        const contextGeneration = this.contextGeneration;
        const requestGeneration = ++this.buildingDetailsRequestGeneration;
        this.selectedBuilding.set(building);
        this.detailsState.set('loading');
        this.actionError.set(null);
        forkJoin({
            entrances: this.addressApi.listEntrances(building.id),
            locations: this.addressApi.listLocations(building.id),
        }).subscribe({
            next: result => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.buildingDetailsRequestGeneration
                    || this.selectedBuilding()?.id !== building.id
                ) {
                    return;
                }
                this.entrances.set(result.entrances);
                this.locations.set(result.locations);
                this.detailsState.set('ready');
            },
            error: () => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.buildingDetailsRequestGeneration
                    || this.selectedBuilding()?.id !== building.id
                ) {
                    return;
                }
                this.detailsState.set('error');
            },
        });
    }


    search(): void {
        this.clearSearchDebounce();
        const query = this.searchQuery().trim();
        if (query) {
            this.searchOverlayState.set('open');
        }
        this.executeSearch(query, false);
    }


    onSearchQueryChange(value: string): void {
        this.searchQuery.set(value);
        this.selectedSearchResult.set(null);
        this.clearSearchDebounce();
        this.clearSearchEnterReopen();
        this.searchRequestGeneration += 1;
        this.searchResults.set([]);
        this.searchTotal.set(0);
        this.searchNextOffset = 0;
        this.searchLoadingMore.set(false);
        this.searchPageError.set(false);

        const query = value.trim();
        if (!query) {
            this.searchState.set('idle');
            this.searchOverlayState.set('closed');
            return;
        }

        this.searchOverlayState.set('open');
        this.searchState.set('loading');
        this.searchDebounceTimer = setTimeout(
            () => {
                this.searchDebounceTimer = null;
                this.executeSearch(query, false);
            },
            SEARCH_DEBOUNCE_MS,
        );
    }


    onSearchEnter(): void {
        if (this.selectedSearchResult() !== null) {
            return;
        }
        this.search();
        this.searchOverlayState.set('closed');
        this.searchEnterReopenTimer = setTimeout(() => {
            this.searchEnterReopenTimer = null;
            if (
                this.selectedSearchResult() === null
                && this.searchQuery().trim()
            ) {
                this.searchOverlayState.set('open');
            }
        });
    }


    onSearchOverlayStateChanged(state: 'open' | 'closed'): void {
        this.searchOverlayState.set(state);
    }


    selectSearchResult(building: Building | null | undefined): void {
        this.selectedSearchResult.set(building ?? null);
        if (building) {
            this.openSearchResult(building);
        }
    }


    loadMoreSearchResults(): void {
        if (
            this.searchLoadingMore()
            || !this.hasMoreSearchResults()
        ) {
            return;
        }
        this.executeSearch(this.searchQuery().trim(), true);
    }


    retrySearch(): void {
        if (this.searchResults().length > 0) {
            this.loadMoreSearchResults();
            return;
        }
        this.search();
    }


    private executeSearch(query: string, append: boolean): void {
        const contextGeneration = this.contextGeneration;
        const requestGeneration = ++this.searchRequestGeneration;
        if (!query) {
            this.searchResults.set([]);
            this.searchTotal.set(0);
            this.searchState.set('idle');
            return;
        }
        const offset = append ? this.searchNextOffset : 0;
        if (append) {
            this.searchLoadingMore.set(true);
            this.searchPageError.set(false);
        } else {
            this.searchResults.set([]);
            this.searchTotal.set(0);
            this.searchNextOffset = 0;
            this.searchLoadingMore.set(false);
            this.searchPageError.set(false);
            this.searchState.set('loading');
        }
        this.addressApi.search(query, SEARCH_PAGE_SIZE, offset).subscribe({
            next: result => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.searchRequestGeneration
                ) {
                    return;
                }
                const items = append
                    ? this.mergeSearchResults(this.searchResults(), result.items)
                    : this.mergeSearchResults([], result.items);
                this.searchResults.set(items);
                this.searchTotal.set(result.total);
                this.searchNextOffset = result.offset + result.items.length;
                this.searchLoadingMore.set(false);
                this.searchPageError.set(false);
                this.searchState.set('ready');
            },
            error: () => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.searchRequestGeneration
                ) {
                    return;
                }
                this.searchLoadingMore.set(false);
                if (append) {
                    this.searchPageError.set(true);
                } else {
                    this.searchState.set('error');
                }
            },
        });
    }


    openSearchResult(building: Building): void {
        const contextGeneration = this.contextGeneration;
        const requestGeneration = ++this.searchResultRequestGeneration;
        this.addressApi.getObject(building.address_object_id).subscribe({
            next: addressObject => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.searchResultRequestGeneration
                ) {
                    return;
                }
                this.loadSearchResultPath(
                    addressObject,
                    building,
                    contextGeneration,
                    requestGeneration,
                    [],
                );
            },
            error: () => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.searchResultRequestGeneration
                ) {
                    return;
                }
                this.actionError.set('Адресный объект больше недоступен');
            },
        });
    }


    startCreateObject(parent: AddressObject | null): void {
        this.objectParent.set(parent);
        this.editingObject.set(null);
        this.objectName.set('');
        this.objectError.set(null);
        const firstType = filterAllowedAddressTypes(this.types(), parent)[0];
        this.objectTypeId.set(firstType?.id ?? null);
    }


    openCreateObjectDialog(
        parent: AddressObject,
        dialog: BrnDialog,
    ): void {
        this.startCreateObject(parent);
        dialog.open();
    }


    startEditObject(addressObject: AddressObject): void {
        this.objectParent.set(
            addressObject.parent_id === null
                ? null
                : this.findTreeNode(addressObject.parent_id),
        );
        this.editingObject.set(addressObject);
        this.objectName.set(addressObject.name);
        this.objectTypeId.set(addressObject.type_id);
        this.objectError.set(null);
    }


    openEditObjectDialog(
        addressObject: AddressObject,
        dialog: BrnDialog,
    ): void {
        this.startEditObject(addressObject);
        dialog.open();
    }


    openDeleteObjectDialog(dialog: BrnDialog): void {
        dialog.open();
    }


    openMoveObjectDialog(addressObject: AddressObject, dialog: BrnDialog): void {
        this.movingBuilding.set(null);
        this.movingObject.set(addressObject);
        this.moveError.set(null);
        this.moveTargetId.set(undefined);
        dialog.open();
    }


    openMoveBuildingDialog(building: Building, dialog: BrnDialog): void {
        this.movingObject.set(null);
        this.movingBuilding.set(building);
        this.moveError.set(null);
        this.moveTargetId.set(undefined);
        dialog.open();
    }


    saveMove(dialog: BrnDialog): void {
        if (this.moveSaving()) {
            return;
        }
        const targetId = this.moveTargetId();
        if (
            targetId === undefined
            || !this.availableMoveTargets().some(target => target.id === targetId)
        ) {
            this.moveError.set('Выберите допустимое новое расположение');
            return;
        }
        const addressObject = this.movingObject();
        const building = this.movingBuilding();
        if (!addressObject && !building) {
            this.moveError.set('Объект для перемещения больше недоступен');
            return;
        }
        this.moveSaving.set(true);
        this.moveError.set(null);
        const contextGeneration = this.contextGeneration;
        const request: Observable<AddressObject | Building> = addressObject
            ? this.addressApi.updateObject(addressObject.id, { parent_id: targetId })
            : this.addressApi.updateBuilding(building!.id, {
                address_object_id: targetId!,
            });
        request.subscribe({
            next: saved => {
                if (contextGeneration !== this.contextGeneration) {
                    return;
                }
                this.moveSaving.set(false);
                dialog.close({});
                if (addressObject) {
                    this.applyAddressMove(
                        saved as AddressObject,
                        targetId,
                        addressObject.parent_id,
                    );
                } else {
                    this.applyBuildingMove(
                        saved as Building,
                        targetId!,
                        building!.address_object_id,
                    );
                }
                this.movingObject.set(null);
                this.movingBuilding.set(null);
                this.moveTargetId.set(undefined);
            },
            error: error => {
                if (contextGeneration !== this.contextGeneration) {
                    return;
                }
                this.moveSaving.set(false);
                const message = this.apiError(error, 'Не удалось переместить объект');
                this.moveError.set(message);
                toast.error('Перемещение не выполнено', { description: message });
                this.restoreTreeRender();
            },
        });
    }


    moveAddressObject(addressObject: AddressObject, targetId: number | null): void {
        if (this.moveSaving()) {
            return;
        }
        const target = targetId === null ? null : this.findTreeNode(targetId);
        if (
            (target === null && !ROOT_ADDRESS_TYPE_CATEGORIES.includes(addressObject.type_category))
            || (target !== null && !this.canMoveAddressTo(addressObject, target))
        ) {
            this.actionError.set('Недопустимое расположение адресного объекта');
            this.restoreTreeRender();
            return;
        }
        this.moveSaving.set(true);
        this.actionError.set(null);
        const contextGeneration = this.contextGeneration;
        this.addressApi.updateObject(addressObject.id, { parent_id: targetId }).subscribe({
            next: saved => {
                if (contextGeneration !== this.contextGeneration) {
                    return;
                }
                this.moveSaving.set(false);
                this.applyAddressMove(saved, targetId, addressObject.parent_id);
            },
            error: error => {
                if (contextGeneration !== this.contextGeneration) {
                    return;
                }
                this.moveSaving.set(false);
                const message = this.apiError(error, 'Не удалось переместить адресный объект');
                this.actionError.set(message);
                toast.error('Адресный объект не перемещён', { description: message });
                this.restoreTreeRender();
            },
        });
    }


    moveBuilding(building: Building, targetId: number): void {
        const target = this.findTreeNode(targetId);
        if (
            this.moveSaving()
            || target === null
            || building.address_object_id === targetId
            || !addressObjectAllowsBuildings(target)
        ) {
            this.restoreTreeRender();
            return;
        }
        this.moveSaving.set(true);
        this.actionError.set(null);
        const contextGeneration = this.contextGeneration;
        this.addressApi.updateBuilding(building.id, {
            address_object_id: targetId,
        }).subscribe({
            next: saved => {
                if (contextGeneration !== this.contextGeneration) {
                    return;
                }
                this.moveSaving.set(false);
                this.applyBuildingMove(saved, targetId, building.address_object_id);
            },
            error: error => {
                if (contextGeneration !== this.contextGeneration) {
                    return;
                }
                this.moveSaving.set(false);
                const message = this.apiError(error, 'Не удалось переместить здание');
                this.actionError.set(message);
                toast.error('Здание не перемещено', { description: message });
                this.restoreTreeRender();
            },
        });
    }


    selectObjectAction(
        action: string | null | undefined,
        addressObject: AddressObject,
        editDialog: BrnDialog,
        moveDialog: BrnDialog,
        deleteDialog: BrnDialog,
    ): void {
        this.objectActionSelection.set(action ?? null);
        if (action === 'edit') {
            this.openEditObjectDialog(addressObject, editDialog);
        } else if (action === 'move') {
            this.openMoveObjectDialog(addressObject, moveDialog);
        } else if (action === 'delete') {
            this.openDeleteObjectDialog(deleteDialog);
        }
        setTimeout(() => this.objectActionSelection.set(null));
    }


    saveObject(dialog: BrnDialog): void {
        const name = this.objectName().trim().replace(/\s+/g, ' ');
        const typeId = this.objectTypeId();
        if (!name) {
            this.objectError.set('Укажите название адресного объекта');
            return;
        }
        if (typeId === null) {
            this.objectError.set('Выберите тип адресного объекта');
            return;
        }
        if (this.objectSaving()) {
            return;
        }
        this.objectSaving.set(true);
        this.objectError.set(null);
        const editing = this.editingObject();
        const request = editing
            ? this.addressApi.updateObject(editing.id, { name, type_id: typeId })
            : this.addressApi.createObject({
                parent_id: this.objectParent()?.id ?? null,
                type_id: typeId,
                name,
            });
        request.subscribe({
            next: saved => {
                this.objectSaving.set(false);
                dialog.close({});
                if (editing) {
                    this.selectedObject.set(saved);
                    this.replaceTreeAddress(saved);
                    toast.success('Адресный объект изменён', {
                        description: this.objectDisplayName(saved),
                    });
                } else {
                    this.addAddressToTree(saved);
                    toast.success('Адресный объект создан', {
                        description: `${saved.type_name} ${saved.name} добавлен`,
                    });
                }
            },
            error: error => {
                this.objectSaving.set(false);
                this.objectError.set(this.apiError(error, 'Не удалось сохранить адресный объект'));
            },
        });
    }


    deleteSelectedObject(): void {
        const selected = this.selectedObject();
        if (!selected) {
            return;
        }
        this.addressApi.deleteObject(selected.id).subscribe({
            next: () => {
                const parent = selected.parent_id === null
                    ? null
                    : this.findTreeNode(selected.parent_id);
                this.removeAddressFromTree(selected.id);
                if (parent) {
                    this.selectObjectFromTree(
                        this.findTreeNode(parent.id) ?? parent,
                    );
                } else {
                    this.selectedObject.set(null);
                    this.buildings.set([]);
                    this.buildingsState.set('idle');
                    this.backToAddressObject();
                }
                toast.success('Адресный объект удалён', {
                    description: this.objectDisplayName(selected),
                });
            },
            error: error => {
                const message = this.apiError(error, 'Не удалось удалить адресный объект');
                this.actionError.set(message);
                toast.error('Адресный объект не удалён', { description: message });
            },
        });
    }


    startCreateBuilding(parent: AddressObject | null = this.selectedObject()): void {
        this.editingBuilding.set(null);
        this.buildingParent.set(parent);
        this.resetBuildingForm();
    }


    startEditBuilding(building: Building): void {
        this.editingBuilding.set(building);
        this.buildingParent.set(this.selectedObject());
        this.buildingNumber.set(building.number);
        this.buildingCorpus.set(building.corpus ?? '');
        this.buildingStructure.set(building.structure ?? '');
        this.buildingLatitude.set(building.latitude?.toString() ?? '');
        this.buildingLongitude.set(building.longitude?.toString() ?? '');
        this.buildingError.set(null);
    }


    saveBuilding(dialog: BrnDialog): void {
        const addressObject = this.buildingParent();
        const number = this.buildingNumber().trim();
        if (!addressObject || !number) {
            this.buildingError.set('Укажите номер дома');
            return;
        }
        const latitude = this.parseCoordinate(this.buildingLatitude(), -90, 90);
        const longitude = this.parseCoordinate(this.buildingLongitude(), -180, 180);
        if (latitude === undefined || longitude === undefined) {
            this.buildingError.set('Проверьте диапазоны координат');
            return;
        }
        if (this.buildingSaving()) {
            return;
        }
        this.buildingSaving.set(true);
        this.buildingError.set(null);
        const data = {
            address_object_id: addressObject.id,
            number,
            corpus: this.optional(this.buildingCorpus()),
            structure: this.optional(this.buildingStructure()),
            latitude,
            longitude,
        };
        const editing = this.editingBuilding();
        const request = editing
            ? this.addressApi.updateBuilding(editing.id, data)
            : this.addressApi.createBuilding(data);
        request.subscribe({
            next: saved => {
                this.buildingSaving.set(false);
                dialog.close({});
                this.selectedObject.set(addressObject);
                this.loadBuildings(addressObject.id, saved.id);
                toast.success(editing ? 'Здание изменено' : 'Здание добавлено', {
                    description: `Дом ${saved.number} сохранён`,
                });
            },
            error: error => {
                this.buildingSaving.set(false);
                this.buildingError.set(this.apiError(error, 'Не удалось сохранить здание'));
            },
        });
    }


    deleteSelectedBuilding(): void {
        const building = this.selectedBuilding();
        const addressObject = this.selectedObject();
        if (!building || !addressObject) {
            return;
        }
        this.addressApi.deleteBuilding(building.id).subscribe({
            next: () => {
                this.backToAddressObject();
                this.loadBuildings(addressObject.id);
                toast.success('Здание удалено', {
                    description: `Дом ${building.number}`,
                });
            },
            error: error => {
                const message = this.apiError(error, 'Не удалось удалить здание');
                this.actionError.set(message);
                toast.error('Здание не удалено', { description: message });
            },
        });
    }


    startCreateEntrance(): void {
        this.editingEntrance.set(null);
        this.entranceNumber.set('');
        this.entranceError.set(null);
    }


    startEditEntrance(entrance: Entrance): void {
        this.editingEntrance.set(entrance);
        this.entranceNumber.set(entrance.number);
        this.entranceError.set(null);
    }


    saveEntrance(dialog: BrnDialog): void {
        const building = this.selectedBuilding();
        const number = this.entranceNumber().trim();
        if (!building || !number) {
            this.entranceError.set('Укажите номер подъезда');
            return;
        }
        if (this.entranceSaving()) {
            return;
        }
        this.entranceSaving.set(true);
        this.entranceError.set(null);
        const editing = this.editingEntrance();
        const request = editing
            ? this.addressApi.updateEntrance(editing.id, number)
            : this.addressApi.createEntrance(building.id, number);
        request.subscribe({
            next: saved => {
                this.entranceSaving.set(false);
                dialog.close({});
                this.selectBuilding(building);
                toast.success(editing ? 'Подъезд изменён' : 'Подъезд добавлен', {
                    description: `Подъезд ${saved.number}`,
                });
            },
            error: error => {
                this.entranceSaving.set(false);
                this.entranceError.set(this.apiError(error, 'Не удалось сохранить подъезд'));
            },
        });
    }


    deleteEntrance(entrance: Entrance): void {
        const building = this.selectedBuilding();
        if (!building) {
            return;
        }
        this.addressApi.deleteEntrance(entrance.id).subscribe({
            next: () => {
                this.selectBuilding(building);
                toast.success('Подъезд удалён', {
                    description: `Подъезд ${entrance.number}`,
                });
            },
            error: error => {
                const message = this.apiError(error, 'Не удалось удалить подъезд');
                this.actionError.set(message);
                toast.error('Подъезд не удалён', { description: message });
            },
        });
    }


    startCreateLocation(): void {
        this.editingLocation.set(null);
        this.locationEntranceId.set(null);
        this.locationFloor.set('');
        this.locationName.set('');
        this.locationDescription.set('');
        this.locationError.set(null);
    }


    startEditLocation(location: Location): void {
        this.editingLocation.set(location);
        this.locationEntranceId.set(location.entrance_id);
        this.locationFloor.set(location.floor ?? '');
        this.locationName.set(location.name);
        this.locationDescription.set(location.description ?? '');
        this.locationError.set(null);
    }


    saveLocation(dialog: BrnDialog): void {
        const building = this.selectedBuilding();
        const name = this.locationName().trim().replace(/\s+/g, ' ');
        if (!building || !name) {
            this.locationError.set('Укажите название места');
            return;
        }
        if (this.locationSaving()) {
            return;
        }
        this.locationSaving.set(true);
        this.locationError.set(null);
        const data = {
            building_id: building.id,
            entrance_id: this.locationEntranceId(),
            floor: this.optional(this.locationFloor()),
            name,
            description: this.optional(this.locationDescription()),
        };
        const editing = this.editingLocation();
        const request = editing
            ? this.addressApi.updateLocation(editing.id, data)
            : this.addressApi.createLocation(data);
        request.subscribe({
            next: saved => {
                this.locationSaving.set(false);
                dialog.close({});
                this.selectBuilding(building);
                toast.success(editing ? 'Место размещения изменено' : 'Место размещения добавлено', {
                    description: saved.name,
                });
            },
            error: error => {
                this.locationSaving.set(false);
                this.locationError.set(this.apiError(error, 'Не удалось сохранить место'));
            },
        });
    }


    applyCoordinatePair(pair: CoordinatePair): void {
        this.buildingLatitude.set(pair.latitude);
        this.buildingLongitude.set(pair.longitude);
        this.buildingError.set(null);
    }


    addressTypeCreated(addressType: AddressType): void {
        this.types.update(types => this.sortAddressTypes([...types, addressType]));
    }


    addressTypeUpdated(addressType: AddressType): void {
        this.types.update(types => this.sortAddressTypes(
            types.map(item => item.id === addressType.id ? addressType : item),
        ));
    }


    addressTypeDeleted(addressTypeId: number): void {
        this.types.update(types => types.filter(item => item.id !== addressTypeId));
    }


    deleteLocation(location: Location): void {
        const building = this.selectedBuilding();
        if (!building) {
            return;
        }
        this.addressApi.deleteLocation(location.id).subscribe({
            next: () => {
                this.selectBuilding(building);
                toast.success('Место размещения удалено', {
                    description: location.name,
                });
            },
            error: error => {
                const message = this.apiError(error, 'Не удалось удалить место размещения');
                this.actionError.set(message);
                toast.error('Место размещения не удалено', { description: message });
            },
        });
    }


    entranceLabel(entranceId: number | null): string {
        if (entranceId === null) {
            return 'Без подъезда';
        }
        const entrance = this.entrances().find(item => item.id === entranceId);
        return entrance ? `Подъезд ${entrance.number}` : 'Подъезд недоступен';
    }


    coordinateDisplay(value: string | number): string {
        return value.toString().replace(',', '.');
    }


    private loadBuildings(
        addressObjectId: number,
        selectId?: number,
        missingSelectionMessage?: string,
    ): void {
        const contextGeneration = this.contextGeneration;
        const requestGeneration = ++this.buildingsRequestGeneration;
        this.buildingDetailsRequestGeneration += 1;
        this.buildingsState.set('loading');
        this.addressApi.listBuildings(addressObjectId).subscribe({
            next: buildings => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.buildingsRequestGeneration
                    || this.selectedObject()?.id !== addressObjectId
                ) {
                    return;
                }
                this.buildings.set(buildings);
                this.buildingsState.set('ready');
                this.updateTreeNode(addressObjectId, current => ({
                    ...current,
                    buildings,
                }));
                const selected = selectId === undefined
                    ? null
                    : buildings.find(item => item.id === selectId) ?? null;
                this.selectedBuilding.set(selected);
                if (selected) {
                    this.selectBuilding(selected);
                } else if (selectId !== undefined && missingSelectionMessage) {
                    this.actionError.set(missingSelectionMessage);
                }
            },
            error: () => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.buildingsRequestGeneration
                    || this.selectedObject()?.id !== addressObjectId
                ) {
                    return;
                }
                this.buildingsState.set('error');
            },
        });
    }


    private invalidatePendingRequests(): void {
        this.clearSearchDebounce();
        this.buildingsRequestGeneration += 1;
        this.buildingDetailsRequestGeneration += 1;
        this.searchRequestGeneration += 1;
        this.searchResultRequestGeneration += 1;
        this.childRequestGenerations.clear();
    }


    private resetSelection(): void {
        this.selectedObject.set(null);
        this.buildingParent.set(null);
        this.selectedBuilding.set(null);
        this.buildings.set([]);
        this.entrances.set([]);
        this.locations.set([]);
        this.searchResults.set([]);
        this.searchTotal.set(0);
        this.searchNextOffset = 0;
        this.searchLoadingMore.set(false);
        this.searchPageError.set(false);
        this.searchState.set('idle');
        this.selectedSearchResult.set(null);
        this.searchOverlayState.set('closed');
        this.actionError.set(null);
        this.movingObject.set(null);
        this.movingBuilding.set(null);
        this.moveTargetId.set(undefined);
        this.moveError.set(null);
        this.moveSaving.set(false);
        this.activeDropTargetKey.set(null);
    }


    private toTreeNode(item: AddressObject): AddressTreeNode {
        return {
            ...item,
            children: [],
            buildings: [],
            expanded: false,
            loaded: false,
            loading: false,
            loadError: false,
        };
    }


    private updateTreeNode(
        id: number,
        update: (node: AddressTreeNode) => AddressTreeNode,
    ): void {
        const visit = (nodes: AddressTreeNode[]): AddressTreeNode[] => nodes.map(
            node => node.id === id
                ? update(node)
                : { ...node, children: visit(node.children) },
        );
        this.roots.update(visit);
    }


    private findTreeNode(id: number): AddressTreeNode | null {
        const stack = [...this.roots()];
        while (stack.length > 0) {
            const node = stack.shift()!;
            if (node.id === id) {
                return node;
            }
            stack.push(...node.children);
        }
        return null;
    }


    private selectObjectFromTree(node: AddressTreeNode): void {
        this.searchResultRequestGeneration += 1;
        this.buildingDetailsRequestGeneration += 1;
        this.selectedObject.set(node);
        this.selectedBuilding.set(null);
        this.entrances.set([]);
        this.locations.set([]);
        this.actionError.set(null);
        this.buildings.set(node.buildings);
        this.buildingsState.set(node.loaded ? 'ready' : 'loading');
    }


    private mergeTreeChildren(
        existing: AddressTreeNode[],
        incoming: AddressObject[],
    ): AddressTreeNode[] {
        return incoming.map(item => {
            const current = existing.find(node => node.id === item.id);
            return current
                ? { ...current, ...item }
                : this.toTreeNode(item);
        });
    }


    private replaceTreeAddress(addressObject: AddressObject): void {
        this.updateTreeNode(addressObject.id, current => ({
            ...current,
            ...addressObject,
        }));
    }


    private addAddressToTree(addressObject: AddressObject): void {
        const added = this.toTreeNode(addressObject);
        if (addressObject.parent_id === null) {
            this.roots.update(nodes => [...nodes, added]);
            return;
        }
        this.updateTreeNode(addressObject.parent_id, parent => ({
            ...parent,
            children: [...parent.children, added],
            expanded: true,
        }));
    }


    private removeAddressFromTree(addressObjectId: number): void {
        const remove = (nodes: AddressTreeNode[]): AddressTreeNode[] => nodes
            .filter(node => node.id !== addressObjectId)
            .map(node => ({ ...node, children: remove(node.children) }));
        this.roots.update(remove);
    }


    private canMoveAddressTo(
        moving: AddressObject,
        target: AddressTreeNode,
    ): boolean {
        if (
            moving.id === target.id
            || moving.parent_id === target.id
            || !allowedChildCategories(target).includes(moving.type_category)
        ) {
            return false;
        }
        let current: AddressTreeNode | null = target;
        while (current) {
            if (current.id === moving.id) {
                return false;
            }
            current = current.parent_id === null
                ? null
                : this.findTreeNode(current.parent_id);
        }
        return true;
    }


    private applyAddressMove(
        saved: AddressObject,
        targetId: number | null,
        sourceId: number | null,
    ): void {
        let detached: AddressTreeNode | null = null;
        const detach = (nodes: AddressTreeNode[]): AddressTreeNode[] => nodes
            .filter(node => {
                if (node.id === saved.id) {
                    detached = node;
                    return false;
                }
                return true;
            })
            .map(node => ({ ...node, children: detach(node.children) }));
        this.roots.update(detach);

        const detachedNode = detached as AddressTreeNode | null;
        const moved: AddressTreeNode = detachedNode
            ? { ...detachedNode, ...saved }
            : this.toTreeNode(saved);
        if (targetId === null) {
            this.roots.update(nodes => [...nodes, moved]);
        } else {
            this.updateTreeNode(targetId, target => ({
                ...target,
                children: [
                    ...target.children.filter(child => child.id !== moved.id),
                    moved,
                ],
                expanded: true,
            }));
            this.loadTreeNode(targetId, true);
        }
        if (sourceId !== null && sourceId !== targetId && this.findTreeNode(sourceId)) {
            this.loadTreeNode(sourceId, true);
        }
        if (this.selectedObject()?.id === saved.id) {
            this.selectedObject.set(saved);
        }
        const selectedBuilding = this.selectedBuilding();
        if (selectedBuilding) {
            const contextGeneration = this.contextGeneration;
            this.addressApi.getBuilding(selectedBuilding.id).subscribe({
                next: refreshed => {
                    if (
                        contextGeneration === this.contextGeneration
                        && this.selectedBuilding()?.id === refreshed.id
                    ) {
                        this.selectedBuilding.set(refreshed);
                    }
                },
            });
        }
        toast.success('Адресный объект перемещён', {
            description: targetId === null
                ? `${this.objectDisplayName(saved)} перенесён на корневой уровень`
                : `${this.objectDisplayName(saved)} перенесён в ${this.objectDisplayName(this.findTreeNode(targetId)!)}`,
        });
    }


    private applyBuildingMove(
        saved: Building,
        targetId: number,
        sourceId: number,
    ): void {
        const updateBuildings = (nodes: AddressTreeNode[]): AddressTreeNode[] => nodes.map(
            node => ({
                ...node,
                buildings: node.id === targetId
                    ? [
                        ...node.buildings.filter(item => item.id !== saved.id),
                        saved,
                    ]
                    : node.buildings.filter(item => item.id !== saved.id),
                children: updateBuildings(node.children),
                expanded: node.id === targetId ? true : node.expanded,
            }),
        );
        this.roots.update(updateBuildings);
        if (this.selectedBuilding()?.id === saved.id) {
            const target = this.findTreeNode(targetId);
            if (target) {
                this.selectedObject.set(target);
                this.buildings.set(target.buildings);
                this.buildingsState.set('ready');
            }
            this.selectBuilding(saved);
        } else if (
            this.selectedObject()?.id === sourceId
            || this.selectedObject()?.id === targetId
        ) {
            this.buildings.set(this.findTreeNode(this.selectedObject()!.id)?.buildings ?? []);
        }
        this.loadTreeNode(targetId, true);
        if (sourceId !== targetId && this.findTreeNode(sourceId)) {
            this.loadTreeNode(sourceId, true);
        }
        toast.success('Здание перемещено', {
            description: `Дом ${saved.number}: ${saved.full_address}`,
        });
    }


    private restoreTreeRender(): void {
        this.roots.update(nodes => [...nodes]);
    }


    private clearSearchDebounce(): void {
        if (this.searchDebounceTimer !== null) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
    }


    private clearSearchEnterReopen(): void {
        if (this.searchEnterReopenTimer === null) {
            return;
        }
        clearTimeout(this.searchEnterReopenTimer);
        this.searchEnterReopenTimer = null;
    }


    private mergeSearchResults(
        current: Building[],
        incoming: Building[],
    ): Building[] {
        const seen = new Set(current.map(item => item.id));
        return [
            ...current,
            ...incoming.filter(item => {
                if (seen.has(item.id)) {
                    return false;
                }
                seen.add(item.id);
                return true;
            }),
        ];
    }


    private loadSearchResultPath(
        addressObject: AddressObject,
        building: Building,
        contextGeneration: number,
        requestGeneration: number,
        descendants: AddressObject[],
    ): void {
        if (
            contextGeneration !== this.contextGeneration
            || requestGeneration !== this.searchResultRequestGeneration
        ) {
            return;
        }

        const path = [addressObject, ...descendants];
        if (addressObject.parent_id === null) {
            this.revealAddressPath(path);
            const selectedObject = path[path.length - 1];
            this.selectedObject.set(selectedObject);
            this.selectedBuilding.set(null);
            this.entrances.set([]);
            this.locations.set([]);
            this.actionError.set(null);
            this.loadBuildings(
                selectedObject.id,
                building.id,
                'Выбранный дом больше недоступен',
            );
            return;
        }

        const knownParent = this.findTreeNode(addressObject.parent_id);
        if (knownParent) {
            this.loadSearchResultPath(
                knownParent,
                building,
                contextGeneration,
                requestGeneration,
                path,
            );
            return;
        }

        this.addressApi.getObject(addressObject.parent_id).subscribe({
            next: parent => this.loadSearchResultPath(
                parent,
                building,
                contextGeneration,
                requestGeneration,
                path,
            ),
            error: () => {
                if (
                    contextGeneration === this.contextGeneration
                    && requestGeneration === this.searchResultRequestGeneration
                ) {
                    this.actionError.set('Адресный объект больше недоступен');
                }
            },
        });
    }


    private revealAddressPath(path: AddressObject[]): void {
        const mergeLevel = (
            nodes: AddressTreeNode[],
            depth: number,
        ): AddressTreeNode[] => {
            const item = path[depth];
            const existingIndex = nodes.findIndex(node => node.id === item.id);
            const existing = existingIndex >= 0
                ? nodes[existingIndex]
                : this.toTreeNode(item);
            const isLeaf = depth === path.length - 1;
            const updated: AddressTreeNode = isLeaf
                ? { ...existing, ...item }
                : {
                    ...existing,
                    ...item,
                    expanded: true,
                    children: mergeLevel(existing.children, depth + 1),
                };

            if (existingIndex < 0) {
                return [...nodes, updated];
            }
            return nodes.map((node, index) => index === existingIndex ? updated : node);
        };

        if (path.length > 0) {
            this.roots.update(nodes => mergeLevel(nodes, 0));
        }
    }


    private resetBuildingForm(): void {
        this.buildingNumber.set('');
        this.buildingCorpus.set('');
        this.buildingStructure.set('');
        this.buildingLatitude.set('');
        this.buildingLongitude.set('');
        this.buildingError.set(null);
    }


    private sortAddressTypes(types: AddressType[]): AddressType[] {
        return [...types].sort((left, right) => (
            left.sort_order - right.sort_order
            || left.name.localeCompare(right.name, 'ru')
            || left.id - right.id
        ));
    }


    private parseCoordinate(
        value: string,
        min: number,
        max: number,
    ): number | null | undefined {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number(trimmed.replace(',', '.'));
        return Number.isFinite(parsed) && parsed >= min && parsed <= max
            ? parsed
            : undefined;
    }


    private optional(value: string): string | null {
        const normalized = value.trim().replace(/\s+/g, ' ');
        return normalized || null;
    }


    private apiError(error: unknown, fallback: string): string {
        if (
            error instanceof HttpErrorResponse
            && error.status === 409
            && typeof error.error?.detail === 'string'
        ) {
            const detail = error.error.detail as string;
            if (detail.includes('dependent')) {
                return 'Сначала удалите связанные дочерние записи';
            }
            if (detail.includes('identical')) {
                return 'Такая запись уже существует';
            }
            if (detail.includes('hierarchy')) {
                return 'Недопустимая структура адресной иерархии';
            }
            if (detail.includes('another building')) {
                return 'Подъезд относится к другому зданию';
            }
        }
        return fallback;
    }
}
