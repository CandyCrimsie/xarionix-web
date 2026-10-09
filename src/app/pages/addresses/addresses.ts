import {
    Component,
    computed,
    effect,
    inject,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
    lucideBuilding2,
    lucideChevronDown,
    lucideChevronRight,
    lucideDoorOpen,
    lucideLoaderCircle,
    lucideMapPin,
    lucidePencil,
    lucidePlus,
    lucideRefreshCw,
    lucideSearch,
    lucideTrash2,
    lucideWarehouse,
} from '@ng-icons/lucide';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import type { BrnDialog } from '@spartan-ng/brain/dialog';

import { AddressApiService } from '../../core/addresses/address-api.service';
import type {
    AddressObject,
    AddressType,
    AddressTypeCategory,
    Building,
    Entrance,
    Location,
} from '../../core/addresses/address.models';
import { CompanyContextService } from '../../core/company/company-context.service';
import {
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';
import { PermissionService } from '../../core/permissions/permission.service';


type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type SearchState = 'idle' | 'loading' | 'ready' | 'error';


interface AddressTreeNode extends AddressObject {
    children: AddressTreeNode[];
    expanded: boolean;
    loaded: boolean;
    loading: boolean;
}


interface AddressTreeRow {
    node: AddressTreeNode;
    depth: number;
}


const ROOT_CATEGORIES: AddressTypeCategory[] = [
    'country',
    'region',
    'locality',
];


const ALLOWED_CHILD_CATEGORIES: Record<
    AddressTypeCategory,
    AddressTypeCategory[]
> = {
    country: ['region', 'locality'],
    region: ['area', 'locality'],
    locality: ['area', 'locality', 'thoroughfare'],
    area: ['area', 'locality', 'thoroughfare'],
    thoroughfare: [],
};


@Component({
    selector: 'app-addresses',
    imports: [
        FormsModule,
        NgTemplateOutlet,
        NgIcon,
        HlmAlertDialogImports,
        HlmBadgeImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
        HlmNativeSelectImports,
    ],
    providers: [
        provideIcons({
            lucideBuilding2,
            lucideChevronDown,
            lucideChevronRight,
            lucideDoorOpen,
            lucideLoaderCircle,
            lucideMapPin,
            lucidePencil,
            lucidePlus,
            lucideRefreshCw,
            lucideSearch,
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
    readonly entrances = signal<Entrance[]>([]);
    readonly locations = signal<Location[]>([]);
    readonly detailsState = signal<LoadState>('idle');
    readonly actionError = signal<string | null>(null);

    readonly searchQuery = signal('');
    readonly searchState = signal<SearchState>('idle');
    readonly searchResults = signal<Building[]>([]);

    readonly objectParent = signal<AddressObject | null>(null);
    readonly editingObject = signal<AddressObject | null>(null);
    readonly objectName = signal('');
    readonly objectTypeId = signal<number | null>(null);
    readonly objectSaving = signal(false);
    readonly objectError = signal<string | null>(null);

    readonly editingBuilding = signal<Building | null>(null);
    readonly buildingNumber = signal('');
    readonly buildingCorpus = signal('');
    readonly buildingStructure = signal('');
    readonly buildingLatitude = signal('');
    readonly buildingLongitude = signal('');
    readonly buildingSaving = signal(false);
    readonly buildingError = signal<string | null>(null);

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

    readonly reloadVersion = signal(0);

    private contextGeneration = 0;
    private buildingsRequestGeneration = 0;
    private buildingDetailsRequestGeneration = 0;
    private searchRequestGeneration = 0;
    private searchResultRequestGeneration = 0;
    private readonly childRequestGenerations = new Map<number, number>();

    readonly treeRows = computed(() => {
        const rows: AddressTreeRow[] = [];
        const append = (nodes: AddressTreeNode[], depth: number): void => {
            for (const node of nodes) {
                rows.push({ node, depth });
                if (node.expanded) {
                    append(node.children, depth + 1);
                }
            }
        };
        append(this.roots(), 0);
        return rows;
    });

    readonly availableObjectTypes = computed(() => {
        const parent = this.objectParent();
        const categories = parent
            ? ALLOWED_CHILD_CATEGORIES[parent.type_category]
            : ROOT_CATEGORIES;
        const available = this.types().filter(
            type => categories.includes(type.category),
        );
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
        return ALLOWED_CHILD_CATEGORIES[
            addressObject.type_category
        ].length > 0;
    }


    toggleNode(node: AddressTreeNode): void {
        if (node.expanded) {
            this.updateTreeNode(node.id, current => ({ ...current, expanded: false }));
            return;
        }
        if (node.loading) {
            return;
        }
        if (node.loaded) {
            this.updateTreeNode(node.id, current => ({ ...current, expanded: true }));
            return;
        }

        const contextGeneration = this.contextGeneration;
        const requestGeneration = (this.childRequestGenerations.get(node.id) ?? 0) + 1;
        this.childRequestGenerations.set(node.id, requestGeneration);
        this.updateTreeNode(node.id, current => ({ ...current, loading: true }));
        this.addressApi.listObjects(node.id).subscribe({
            next: children => {
                if (
                    contextGeneration !== this.contextGeneration
                    || this.childRequestGenerations.get(node.id) !== requestGeneration
                ) {
                    return;
                }
                this.updateTreeNode(node.id, current => ({
                    ...current,
                    children: children.map(item => this.toTreeNode(item)),
                    expanded: true,
                    loaded: true,
                    loading: false,
                }));
            },
            error: () => {
                if (
                    contextGeneration !== this.contextGeneration
                    || this.childRequestGenerations.get(node.id) !== requestGeneration
                ) {
                    return;
                }
                this.updateTreeNode(node.id, current => ({ ...current, loading: false }));
                this.actionError.set('Не удалось загрузить дочерние адресные объекты');
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
        const query = this.searchQuery().trim();
        const contextGeneration = this.contextGeneration;
        const requestGeneration = ++this.searchRequestGeneration;
        if (!query) {
            this.searchResults.set([]);
            this.searchState.set('idle');
            return;
        }
        this.searchState.set('loading');
        this.addressApi.search(query).subscribe({
            next: result => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.searchRequestGeneration
                ) {
                    return;
                }
                this.searchResults.set(result.items);
                this.searchState.set('ready');
            },
            error: () => {
                if (
                    contextGeneration !== this.contextGeneration
                    || requestGeneration !== this.searchRequestGeneration
                ) {
                    return;
                }
                this.searchState.set('error');
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
                this.buildingsRequestGeneration += 1;
                this.buildingDetailsRequestGeneration += 1;
                this.selectedObject.set(addressObject);
                this.buildings.set([building]);
                this.buildingsState.set('ready');
                this.selectBuilding(building);
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
        const categories = parent
            ? ALLOWED_CHILD_CATEGORIES[parent.type_category]
            : ROOT_CATEGORIES;
        const firstType = this.types().find(type => categories.includes(type.category));
        this.objectTypeId.set(firstType?.id ?? null);
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
                this.retry();
                if (editing) {
                    this.selectedObject.set(saved);
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
            next: () => this.retry(),
            error: error => this.actionError.set(
                this.apiError(error, 'Не удалось удалить адресный объект'),
            ),
        });
    }


    startCreateBuilding(): void {
        this.editingBuilding.set(null);
        this.resetBuildingForm();
    }


    startEditBuilding(building: Building): void {
        this.editingBuilding.set(building);
        this.buildingNumber.set(building.number);
        this.buildingCorpus.set(building.corpus ?? '');
        this.buildingStructure.set(building.structure ?? '');
        this.buildingLatitude.set(building.latitude?.toString() ?? '');
        this.buildingLongitude.set(building.longitude?.toString() ?? '');
        this.buildingError.set(null);
    }


    saveBuilding(dialog: BrnDialog): void {
        const addressObject = this.selectedObject();
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
                this.loadBuildings(addressObject.id, saved.id);
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
            next: () => this.loadBuildings(addressObject.id),
            error: error => this.actionError.set(
                this.apiError(error, 'Не удалось удалить здание'),
            ),
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
        this.entranceSaving.set(true);
        const editing = this.editingEntrance();
        const request = editing
            ? this.addressApi.updateEntrance(editing.id, number)
            : this.addressApi.createEntrance(building.id, number);
        request.subscribe({
            next: () => {
                this.entranceSaving.set(false);
                dialog.close({});
                this.selectBuilding(building);
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
            next: () => this.selectBuilding(building),
            error: error => this.actionError.set(
                this.apiError(error, 'Не удалось удалить подъезд'),
            ),
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
            this.locationError.set('Укажите название помещения');
            return;
        }
        this.locationSaving.set(true);
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
            next: () => {
                this.locationSaving.set(false);
                dialog.close({});
                this.selectBuilding(building);
            },
            error: error => {
                this.locationSaving.set(false);
                this.locationError.set(this.apiError(error, 'Не удалось сохранить помещение'));
            },
        });
    }


    deleteLocation(location: Location): void {
        const building = this.selectedBuilding();
        if (!building) {
            return;
        }
        this.addressApi.deleteLocation(location.id).subscribe({
            next: () => this.selectBuilding(building),
            error: error => this.actionError.set(
                this.apiError(error, 'Не удалось удалить помещение'),
            ),
        });
    }


    entranceLabel(entranceId: number | null): string {
        if (entranceId === null) {
            return 'Без подъезда';
        }
        const entrance = this.entrances().find(item => item.id === entranceId);
        return entrance ? `Подъезд ${entrance.number}` : 'Подъезд недоступен';
    }


    private loadBuildings(addressObjectId: number, selectId?: number): void {
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
                const selected = selectId === undefined
                    ? null
                    : buildings.find(item => item.id === selectId) ?? null;
                this.selectedBuilding.set(selected);
                if (selected) {
                    this.selectBuilding(selected);
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
        this.buildingsRequestGeneration += 1;
        this.buildingDetailsRequestGeneration += 1;
        this.searchRequestGeneration += 1;
        this.searchResultRequestGeneration += 1;
        this.childRequestGenerations.clear();
    }


    private resetSelection(): void {
        this.selectedObject.set(null);
        this.selectedBuilding.set(null);
        this.buildings.set([]);
        this.entrances.set([]);
        this.locations.set([]);
        this.searchResults.set([]);
        this.searchState.set('idle');
        this.actionError.set(null);
    }


    private toTreeNode(item: AddressObject): AddressTreeNode {
        return {
            ...item,
            children: [],
            expanded: false,
            loaded: false,
            loading: false,
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


    private resetBuildingForm(): void {
        this.buildingNumber.set('');
        this.buildingCorpus.set('');
        this.buildingStructure.set('');
        this.buildingLatitude.set('');
        this.buildingLongitude.set('');
        this.buildingError.set(null);
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
