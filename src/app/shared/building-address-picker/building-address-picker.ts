import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    model,
    output,
    signal,
    untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHouse, lucideLoaderCircle, lucideRefreshCw } from '@ng-icons/lucide';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';

import { AddressApiService } from '../../core/addresses/address-api.service';
import type { Building } from '../../core/addresses/address.models';
import { CompanyContextService } from '../../core/company/company-context.service';


const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_PAGE_SIZE = 20;
type LoadState = 'idle' | 'loading' | 'ready' | 'error';


@Component({
    selector: 'app-building-address-picker',
    imports: [NgIcon, HlmAutocompleteImports, HlmButtonImports, HlmFieldImports],
    providers: [provideIcons({ lucideHouse, lucideLoaderCircle, lucideRefreshCw })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { class: 'block min-w-0' },
    templateUrl: './building-address-picker.html',
})
export class BuildingAddressPicker {
    private static nextId = 0;
    private readonly addressApi = inject(AddressApiService);
    private readonly companyContext = inject(CompanyContextService);
    private readonly destroyRef = inject(DestroyRef);

    readonly buildingId = model<number | null>(null);
    readonly buildingSelected = output<Building | null>();
    readonly disabled = input(false);
    readonly inputId = `building-address-${BuildingAddressPicker.nextId++}`;
    readonly query = signal('');
    readonly selectedBuilding = signal<Building | null>(null);
    readonly results = signal<Building[]>([]);
    readonly state = signal<LoadState>('idle');
    readonly linkedBuildingState = signal<LoadState>('idle');
    readonly overlayState = signal<'open' | 'closed'>('closed');
    readonly loadingMore = signal(false);
    readonly pageError = signal(false);
    readonly hasMore = signal(false);
    readonly selectionValid = computed(() => this.buildingId() !== null || !this.query().trim());
    readonly buildingToString = (building: Building): string => building.full_address;

    private requestGeneration = 0;
    private lookupGeneration = 0;
    private nextOffset = 0;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private reopenTimer: ReturnType<typeof setTimeout> | null = null;
    private searchSubscription: Subscription | null = null;
    private lookupSubscription: Subscription | null = null;


    constructor() {
        effect(() => {
            const id = this.buildingId();
            untracked(() => this.loadLinkedBuilding(id));
        });
        this.companyContext.companyChanged$.pipe(
            takeUntilDestroyed(this.destroyRef),
        ).subscribe(() => {
            this.cancelSearch();
            this.resetResults();
            this.query.set('');
            this.selectedBuilding.set(null);
            this.overlayState.set('closed');
            this.loadLinkedBuilding(this.buildingId());
        });
        this.destroyRef.onDestroy(() => {
            this.cancelSearch();
            this.lookupSubscription?.unsubscribe();
        });
    }


    onQueryChange(value: string): void {
        if (this.disabled() || value === this.selectedBuilding()?.full_address) {
            return;
        }
        this.cancelSearch();
        this.lookupGeneration += 1;
        this.lookupSubscription?.unsubscribe();
        this.linkedBuildingState.set('idle');
        this.selectedBuilding.set(null);
        this.buildingId.set(null);
        this.query.set(value);
        this.resetResults();
        if (!value.trim() || value.trim().length > 255) {
            this.overlayState.set('closed');
            return;
        }
        this.overlayState.set('open');
        this.state.set('loading');
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = null;
            this.search();
        }, SEARCH_DEBOUNCE_MS);
    }


    onEnter(): void {
        if (this.selectedBuilding() !== null || !this.query().trim() || this.disabled()) {
            return;
        }
        this.search();
        this.overlayState.set('closed');
        this.reopenTimer = setTimeout(() => {
            this.reopenTimer = null;
            if (this.selectedBuilding() === null && this.query().trim().length <= 255) {
                this.overlayState.set('open');
            }
        });
    }


    selectBuilding(building: Building | null | undefined): void {
        if (this.disabled()) {
            return;
        }
        this.cancelSearch();
        this.lookupGeneration += 1;
        this.lookupSubscription?.unsubscribe();
        this.selectedBuilding.set(building ?? null);
        this.query.set(building?.full_address ?? '');
        this.buildingId.set(building?.id ?? null);
        this.buildingSelected.emit(building ?? null);
        this.linkedBuildingState.set(building ? 'ready' : 'idle');
        this.resetResults();
        this.overlayState.set('closed');
    }


    search(append = false): void {
        const query = this.query().trim();
        if (this.disabled() || !query || query.length > 255) {
            return;
        }
        this.cancelSearch();
        const generation = this.requestGeneration;
        if (append) {
            this.loadingMore.set(true);
            this.pageError.set(false);
        } else {
            this.resetResults();
            this.state.set('loading');
        }
        this.searchSubscription = this.addressApi.search(
            query, SEARCH_PAGE_SIZE, append ? this.nextOffset : 0,
        ).subscribe({
            next: result => {
                if (generation !== this.requestGeneration) {
                    return;
                }
                const buildings = result.items.flatMap(item => (
                    item.kind === 'building' ? [item.building] : []
                ));
                const merged = new Map(
                    (append ? this.results() : []).map(building => [building.id, building]),
                );
                buildings.forEach(building => merged.set(building.id, building));
                this.results.set([...merged.values()]);
                // Pagination offsets belong to the unfiltered server result, not just buildings.
                this.nextOffset = result.offset + result.items.length;
                this.hasMore.set(result.items.length > 0 && this.nextOffset < result.total);
                this.loadingMore.set(false);
                this.pageError.set(false);
                this.state.set('ready');
            },
            error: () => {
                if (generation !== this.requestGeneration) {
                    return;
                }
                this.loadingMore.set(false);
                if (append) {
                    this.pageError.set(true);
                } else {
                    this.state.set('error');
                }
            },
        });
    }


    loadMore(): void {
        if (this.hasMore() && !this.loadingMore()) {
            this.search(true);
        }
    }


    retrySearch(): void {
        this.search(this.pageError());
    }


    retryLinkedBuilding(): void {
        this.loadLinkedBuilding(this.buildingId());
    }


    private loadLinkedBuilding(id: number | null): void {
        const generation = ++this.lookupGeneration;
        this.lookupSubscription?.unsubscribe();
        if (id === null) {
            if (this.selectedBuilding() !== null) {
                this.selectedBuilding.set(null);
                this.query.set('');
            }
            this.linkedBuildingState.set('idle');
            return;
        }
        if (this.selectedBuilding()?.id === id) {
            return;
        }
        this.cancelSearch();
        this.resetResults();
        this.overlayState.set('closed');
        this.selectedBuilding.set(null);
        this.query.set('');
        this.linkedBuildingState.set('loading');
        this.lookupSubscription = this.addressApi.getBuilding(id).subscribe({
            next: building => {
                if (generation !== this.lookupGeneration) {
                    return;
                }
                this.selectedBuilding.set(building);
                this.query.set(building.full_address);
                this.linkedBuildingState.set('ready');
            },
            error: () => {
                if (generation === this.lookupGeneration) {
                    this.linkedBuildingState.set('error');
                }
            },
        });
    }


    private cancelSearch(): void {
        this.requestGeneration += 1;
        this.searchSubscription?.unsubscribe();
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.reopenTimer !== null) {
            clearTimeout(this.reopenTimer);
            this.reopenTimer = null;
        }
    }


    private resetResults(): void {
        this.results.set([]);
        this.state.set('idle');
        this.nextOffset = 0;
        this.hasMore.set(false);
        this.loadingMore.set(false);
        this.pageError.set(false);
    }
}
