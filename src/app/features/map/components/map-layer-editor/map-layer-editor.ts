import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { debounceTime, Subject, Subscription } from 'rxjs';
import { HlmDialog, HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmAlertDialog, HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
import { HlmAutocompleteImports } from '@spartan-ng/helm/autocomplete';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { toast } from '@spartan-ng/brain/sonner';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import { AddressApiService } from '../../../../core/addresses/address-api.service';
import type { AddressObject } from '../../../../core/addresses/address.models';
import type { LayerDraft, MapLayer } from '../../models/map-workspace.models';
import type { MapConnection, MapPointType } from '../../models/map.models';
import { MapDataService } from '../../services/map-data.service';
import { MapWorkspaceState } from '../../services/map-workspace.state';
import { MAP_POINT_TYPES } from '../../map-marker.config';

const emptyDraft = (): LayerDraft => ({ name: '', parent_id: null, mode: 'manual', sort_order: 0, rules: {} });
@Component({
    selector: 'app-map-layer-editor',
    imports: [HlmDialogImports, HlmAlertDialogImports, HlmAutocompleteImports, HlmButtonImports, HlmCheckboxImports, HlmFieldImports, HlmInputImports, HlmSelectImports],
    templateUrl: './map-layer-editor.html', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapLayerEditor {
    private readonly api = inject(MapDataService);
    private readonly address = inject(AddressApiService);
    readonly workspace = inject(MapWorkspaceState);
    private readonly destroyRef = inject(DestroyRef);
    private generation = 0;
    private searchGeneration = 0;
    private searchRequest?: Subscription;
    private readonly queries = new Subject<{ query: string; generation: number }>();
    readonly dialog = viewChild.required<HlmDialog>('dialog');
    readonly deleteDialog = viewChild.required<HlmAlertDialog>('deleteDialog');
    readonly editing = signal<MapLayer | null>(null);
    readonly deleting = signal<MapLayer | null>(null);
    readonly draft = signal<LayerDraft>(emptyDraft());
    readonly saving = signal(false);
    readonly error = signal<string | null>(null);
    readonly query = signal('');
    readonly addressOptions = signal<AddressObject[]>([]);
    readonly selectedAddress = signal<AddressObject | null>(null);
    readonly searchError = signal(false);
    readonly searching = signal(false);
    readonly pointTypes = MAP_POINT_TYPES;
    readonly statuses = [{ value: 'planned', label: 'Планируется' }, { value: 'construction', label: 'Строится' }, { value: 'active', label: 'Активно' }, { value: 'inactive', label: 'Неактивно' }] as const;
    readonly groups = computed(() => this.workspace.layers().filter(layer => layer.mode === 'group' && layer.id !== this.editing()?.id));
    readonly modeLabel = (value: string) => ({ group: 'Группа слоёв', manual: 'Ручной слой', dynamic: 'Динамический слой' } as Record<string, string>)[value] ?? '';
    readonly parentLabel = (value: number) => value === 0 ? 'Без группы' : this.workspace.layers().find(layer => layer.id === value)?.name ?? 'Группа недоступна';
    readonly objectLabel = (value: AddressObject) => value ? `${value.type_short_name || value.type_name} ${value.name}` : '';

    constructor() {
        this.queries.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(({ query, generation }) => {
            if (generation !== this.searchGeneration || !query.trim()) return;
            this.searchRequest = this.address.search(query.trim(), 20, 0).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                next: result => { if (generation === this.searchGeneration) { this.addressOptions.set(result.items.flatMap(item => item.kind === 'address_object' ? [item.object] : [])); this.searching.set(false); } },
                error: () => { if (generation === this.searchGeneration) { this.searching.set(false); this.searchError.set(true); } },
            });
        });
        inject(CompanyContextService).companyChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.generation++; this.searchGeneration++; this.searchRequest?.unsubscribe(); this.saving.set(false); this.dialog().close({}); this.deleteDialog().close({});
        });
    }

    open(layer: MapLayer | null): void {
        if (this.saving()) return;
        const generation = ++this.generation;
        this.searchGeneration++; this.searchRequest?.unsubscribe(); this.addressOptions.set([]); this.searching.set(false); this.searchError.set(false);
        this.editing.set(layer); this.error.set(null); this.selectedAddress.set(null); this.query.set('');
        this.draft.set(layer ? structuredClone({ name: layer.name, parent_id: layer.parent_id, mode: layer.mode, rules: layer.rules, sort_order: layer.sort_order }) : emptyDraft());
        const id = layer?.rules.address_object_id;
        if (id) this.address.getObject(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: object => { if (generation === this.generation) { this.selectedAddress.set(object); this.query.set(this.objectLabel(object)); } },
            error: () => { if (generation === this.generation) this.error.set('Адрес правила больше недоступен. Выберите другой или очистите правило.'); },
        });
        this.dialog().open();
    }
    onClosed(): void {
        if (this.dialog().stateComputed() === 'open' || this.saving()) return;
        this.generation++; this.searchGeneration++; this.searchRequest?.unsubscribe(); this.addressOptions.set([]); this.searching.set(false);
    }
    changeMode(mode: string | null | undefined): void {
        if (!mode || this.editing()) return;
        this.draft.update(draft => ({ ...draft, mode: mode as LayerDraft['mode'], rules: {} }));
        this.selectedAddress.set(null); this.query.set('');
    }
    setName(name: string): void { this.draft.update(draft => ({ ...draft, name })); }
    setParent(id: number | null | undefined): void { this.draft.update(draft => ({ ...draft, parent_id: id || null })); }
    onQuery(query: string): void {
        this.query.set(query); this.searchRequest?.unsubscribe(); const generation = ++this.searchGeneration;
        this.addressOptions.set([]); this.searchError.set(false); this.searching.set(!!query.trim());
        if (!query.trim()) this.selectAddress(null);
        this.queries.next({ query, generation });
    }
    selectAddress(object: AddressObject | null | undefined): void {
        this.searchGeneration++; this.searchRequest?.unsubscribe(); this.searching.set(false);
        this.selectedAddress.set(object ?? null); this.query.set(object ? this.objectLabel(object) : '');
        this.draft.update(draft => ({ ...draft, rules: { ...draft.rules, address_object_id: object?.id ?? null } }));
    }
    toggleRule(field: 'point_types' | 'media' | 'statuses', value: string): void {
        this.draft.update(draft => {
            const values = new Set<string>(draft.rules[field] ?? []);
            if (values.has(value)) values.delete(value); else values.add(value);
            return { ...draft, rules: { ...draft.rules, [field]: [...values] } };
        });
    }
    save(): void {
        if (this.saving()) return;
        const generation = this.generation, draft = this.draft(), editing = this.editing();
        this.saving.set(true); this.error.set(null);
        (editing ? this.api.updateLayer(editing, draft) : this.api.createLayer(draft)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: layer => {
                if (generation !== this.generation) return;
                this.saving.set(false); this.workspace.applyLayer(layer);
                if (!editing && layer.mode !== 'group') this.workspace.update({ visible_layer_ids: [...this.workspace.settings().visible_layer_ids, layer.id] });
                this.dialog().close({}); toast.success(editing ? 'Слой изменён' : 'Слой создан');
            },
            error: error => { if (generation === this.generation) { this.saving.set(false); this.error.set(this.message(error)); } },
        });
    }
    requestDelete(layer: MapLayer): void { if (!this.saving()) { this.generation++; this.deleting.set(layer); this.error.set(null); this.deleteDialog().open(); } }
    remove(): void {
        const layer = this.deleting(); if (!layer || this.saving()) return;
        const generation = this.generation; this.saving.set(true); this.error.set(null);
        this.api.deleteLayer(layer).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => { if (generation === this.generation) { this.saving.set(false); this.deleteDialog().close({}); this.workspace.reloadLayers(); toast.success('Слой удалён. Объекты сохранены'); } },
            error: error => { if (generation === this.generation) { this.saving.set(false); this.error.set(this.message(error)); } },
        });
    }
    reorder(layer: MapLayer, direction: -1 | 1): void {
        if (this.saving()) return;
        const siblings = this.workspace.layers().filter(item => item.parent_id === layer.parent_id).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        const neighbour = siblings[siblings.findIndex(item => item.id === layer.id) + direction]; if (!neighbour) return;
        const generation = this.generation; this.saving.set(true);
        this.api.moveLayer(layer, direction).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: changed => { if (generation === this.generation) { this.saving.set(false); for (const item of changed) this.workspace.applyLayer(item); } },
            error: error => { if (generation === this.generation) { this.saving.set(false); toast.error(this.message(error)); this.workspace.reloadLayers(); } },
        });
    }
    private message(error: unknown): string { return error instanceof HttpErrorResponse && error.error?.detail?.message || 'Не удалось сохранить слой. Проверьте название и хотя бы одно правило для динамического состава.'; }
}
