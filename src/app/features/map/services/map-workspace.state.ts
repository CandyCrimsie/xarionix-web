import { computed, DestroyRef, inject, Injectable, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, forkJoin, Subject, Subscription } from 'rxjs';
import { CompanyContextService } from '../../../core/company/company-context.service';
import { defaultMapSettings, safeMapSettings, type MapLayer, type MapQuery, type MapSettings } from '../models/map-workspace.models';
import { MapDataService } from './map-data.service';

/** One per open map. Only small definitions/preferences are retained, never GeoJSON. */
@Injectable()
export class MapWorkspaceState {
    private readonly api = inject(MapDataService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly company = inject(CompanyContextService);
    readonly settings = signal(defaultMapSettings());
    readonly layers = signal<MapLayer[]>([]);
    readonly ready = signal(false);
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);
    readonly notice = signal<string | null>(null);
    readonly conflict = signal(false);
    private revision = 0;
    private generation = 0;
    private changeVersion = 0;
    private writable = false;
    private queued: MapSettings | null = null;
    private savedJson = '';
    private readonly changes = new Subject<{ value: MapSettings; generation: number }>();
    private layerGeneration = 0;
    private loadSubscription?: Subscription;
    private saveSubscription?: Subscription;
    readonly query = computed<MapQuery>(() => {
        this.layers(); // Changed dynamic rules/memberships invalidate the current SQL selection too.
        const value = this.settings();
        return { layers_active: true, layer_ids: value.visible_layer_ids, include_unassigned: value.include_unassigned,
            point_types: value.point_types, point_types_enabled: value.point_types_enabled, medium: value.medium, status: value.status, installation: value.installation };
    });
    readonly restricted = computed(() => {
        const p = this.settings();
        return !p.show_buildings || !p.show_infrastructure || !p.show_personal || p.point_types_enabled
            || p.medium !== 'all' || p.status !== 'all' || p.installation !== 'all' || !p.include_unassigned || p.visible_layer_ids.length > 0;
    });

    constructor() {
        this.changes.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(change => {
            if (change.generation === this.generation) this.enqueue(change.value);
        });
        this.company.companyChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
        this.destroyRef.onDestroy(() => { this.generation++; this.loadSubscription?.unsubscribe(); this.saveSubscription?.unsubscribe(); this.queued = null; });
        this.load();
    }

    field<K extends keyof MapSettings>(key: K): Signal<MapSettings[K]> & { set(value: MapSettings[K]): void } {
        return Object.assign(computed(() => this.settings()[key]), { set: (value: MapSettings[K]) => this.update({ [key]: value }) });
    }

    update(patch: Partial<MapSettings>): void {
        this.changeVersion++;
        this.settings.update(current => ({ ...current, ...patch }));
        this.changes.next({ value: structuredClone(this.settings()), generation: this.generation });
    }

    reset(): void { this.update(defaultMapSettings()); }

    load(): void {
        const generation = ++this.generation;
        this.changeVersion++;
        this.loadSubscription?.unsubscribe(); this.saveSubscription?.unsubscribe(); this.queued = null;
        this.ready.set(false); this.saving.set(false); this.writable = false;
        this.settings.set(safeMapSettings()); this.layers.set([]); this.error.set(null); this.notice.set(null); this.conflict.set(false);
        this.loadSubscription = forkJoin({ preference: this.api.getPreferences(), layers: this.api.getLayers() })
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                next: ({ preference, layers }) => {
                    if (generation !== this.generation) return;
                    this.layers.set(layers); this.revision = preference.version;
                    this.settings.set(preference.settings); this.savedJson = JSON.stringify(preference.settings);
                    this.notice.set(preference.notice); this.writable = true; this.ready.set(true);
                },
                error: () => {
                    if (generation !== this.generation) return;
                    this.error.set('Не удалось прочитать настройки карты. Повторите загрузку; скрытые данные не включены автоматически.'); this.ready.set(true);
                },
            });
    }

    reloadLayers(): void {
        const generation = this.generation, request = ++this.layerGeneration;
        this.api.getLayers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: layers => {
                if (generation !== this.generation || request !== this.layerGeneration) return;
                this.layers.set(layers);
                const ids = new Set(layers.filter(layer => layer.mode !== 'group').map(layer => layer.id));
                const visible = this.settings().visible_layer_ids.filter(id => ids.has(id));
                if (visible.length !== this.settings().visible_layer_ids.length) this.update({ visible_layer_ids: visible });
            },
            error: () => { if (generation === this.generation && request === this.layerGeneration) this.error.set('Не удалось обновить слои. Повторите загрузку.'); },
        });
    }

    applyLayer(layer: MapLayer): void {
        this.layerGeneration++;
        this.layers.update(layers => [...layers.filter(item => item.id !== layer.id), layer].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
    }

    retrySave(): void { if (this.conflict() || !this.writable) this.load(); else this.enqueue(this.settings()); }

    private enqueue(value: MapSettings): void {
        if (!this.writable || this.conflict()) return;
        if (this.saving()) { this.queued = value; return; }
        if (JSON.stringify(value) === this.savedJson) return;
        const generation = this.generation, change = this.changeVersion;
        this.saving.set(true); this.error.set(null);
        this.saveSubscription = this.api.savePreferences(value, this.revision).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: saved => {
                if (generation !== this.generation) return;
                this.revision = saved.version; this.savedJson = JSON.stringify(saved.settings);
                // An acknowledgement is not a new filter change. Only apply
                // actual server normalization (e.g. a deleted layer ID).
                if (change === this.changeVersion && JSON.stringify(this.settings()) !== this.savedJson) this.settings.set(saved.settings);
                this.notice.set(saved.notice); this.saving.set(false);
                if (this.queued) { const queued = this.queued; this.queued = null; this.enqueue(queued); }
            },
            error: error => {
                if (generation !== this.generation) return;
                this.saving.set(false); this.queued = null;
                this.conflict.set(error instanceof HttpErrorResponse && error.status === 409);
                this.error.set(this.conflict() ? 'Настройки изменены в другой вкладке. Перечитать сохранённые?' : 'Настройки не сохранены. Текущие фильтры продолжают работать.');
            },
        });
    }
}
