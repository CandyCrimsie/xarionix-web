import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, model, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import { MapDataService } from '../../services/map-data.service';
import type { MapEndpointDetail } from '../../models/map.models';

@Component({
    selector: 'app-map-endpoint-picker',
    imports: [HlmAutocompleteImports, HlmButtonImports],
    templateUrl: './map-endpoint-picker.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapEndpointPicker {
    private readonly api = inject(MapDataService);
    private readonly destroy = inject(DestroyRef);
    readonly value = model<MapEndpointDetail | null>(null);
    readonly disabled = input(false);
    readonly query = signal('');
    readonly items = signal<MapEndpointDetail[]>([]);
    readonly loading = signal(false);
    readonly error = signal(false);
    readonly hasMore = signal(false);
    readonly state = signal<'open' | 'closed'>('closed');
    readonly toString = (value: MapEndpointDetail) => value.name;
    private generation = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private request: Subscription | null = null;
    private offset = 0;

    constructor() {
        effect(() => {
            const selected = this.value();
            if (selected) untracked(() => this.query.set(selected.name));
        });
        inject(CompanyContextService).companyChanged$.pipe(takeUntilDestroyed()).subscribe(() => this.reset());
        this.destroy.onDestroy(() => this.cancel());
    }

    private cancel() {
        this.generation++;
        this.request?.unsubscribe();
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    private reset() {
        this.cancel();
        this.value.set(null);
        this.items.set([]);
        this.query.set('');
        this.state.set('closed');
        this.loading.set(false);
        this.error.set(false);
        this.hasMore.set(false);
    }

    searchChanged(query: string) {
        if (query === this.value()?.name || this.disabled()) return;
        this.cancel();
        this.query.set(query);
        this.value.set(null);
        this.items.set([]);
        this.hasMore.set(false);
        this.error.set(false);
        if (!query.trim() || query.length > 200) {
            this.state.set('closed');
            this.loading.set(false);
            return;
        }
        this.loading.set(true);
        this.state.set('open');
        this.timer = setTimeout(() => this.search(), 300);
    }

    search(append = false) {
        this.cancel();
        if (!this.query().trim() || this.query().length > 200 || this.disabled()) return;
        const generation = this.generation;
        this.loading.set(true);
        this.error.set(false);
        this.request = this.api.searchEndpoints(this.query().trim(), append ? this.offset : 0).subscribe({
            next: result => {
                if (generation !== this.generation) return;
                const items = new Map((append ? this.items() : []).map(item => [item.kind + ':' + item.id, item]));
                result.items.forEach(item => items.set(item.kind + ':' + item.id, item));
                this.items.set([...items.values()]);
                this.offset = result.offset + result.items.length;
                this.hasMore.set(result.has_more);
                this.loading.set(false);
                this.state.set('open');
            },
            error: () => {
                if (generation !== this.generation) return;
                this.loading.set(false);
                this.error.set(true);
            },
        });
    }

    onEnter(event: Event) {
        // Spartan owns Enter selection for an active suggestion. Do not start
        // another HTTP request and reopen the overlay after it selects a row.
        if (this.value() || (this.state() === 'open' && !this.loading() && this.items().length)) return;
        event.preventDefault();
        this.search();
    }

    select(item: MapEndpointDetail | null | undefined) {
        this.cancel();
        this.value.set(item ?? null);
        this.query.set(item?.name ?? '');
        this.loading.set(false);
        this.state.set('closed');
    }
}
