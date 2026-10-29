import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { HlmDialog, HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { toast } from '@spartan-ng/brain/sonner';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import { MAP_POINT_TYPES } from '../../map-marker.config';
import { installationLabel } from '../../map-line-styles';
import type { MapConnection } from '../../models/map.models';
import type { DependencyReport, MapLayer, MapPassport, MapTarget, PassportData, PassportSpecs, PassportWrite } from '../../models/map-workspace.models';
import { MapDataService } from '../../services/map-data.service';
import { MapWorkspaceState } from '../../services/map-workspace.state';

const emptyData = (): PassportData => ({ inventory_number: null, purpose: null, note: null, commissioned_on: null, operational_status: null, specs: { kind: 'general' } });
@Component({
    selector: 'app-map-passport',
    imports: [HlmDialogImports, HlmButtonImports, HlmFieldImports, HlmInputImports, HlmTextareaImports, HlmSelectImports, HlmCheckboxImports],
    templateUrl: './map-passport.html', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPassportDialog {
    private readonly api = inject(MapDataService);
    readonly workspace = inject(MapWorkspaceState);
    private readonly destroyRef = inject(DestroyRef);
    private generation = 0;
    private readRequest?: Subscription;
    private dependencyRequest?: Subscription;
    readonly dialog = viewChild.required<HlmDialog>('dialog');
    readonly canManageLayers = input(false);
    readonly saved = output<MapPassport>();
    readonly membershipChanged = output<void>();
    readonly record = signal<MapPassport | null>(null);
    readonly target = signal<MapTarget | null>(null);
    readonly loading = signal(false);
    readonly saving = signal(false);
    readonly editing = signal(false);
    readonly error = signal<string | null>(null);
    readonly draft = signal<PassportData>(emptyData());
    readonly name = signal('');
    readonly description = signal('');
    readonly status = signal<MapConnection['status'] | 'none'>('none');
    readonly members = signal<number[]>([]);
    readonly membershipSaving = signal(false);
    readonly dependencies = signal<DependencyReport | null>(null);
    readonly dependenciesLoading = signal(false);
    readonly manualLayers = computed(() => this.workspace.layers().filter(layer => layer.mode === 'manual'));
    readonly dynamicLayers = computed(() => this.record()?.layers.filter(layer => layer.mode === 'dynamic') ?? []);
    readonly statuses = [{ value: 'planned', label: 'Планируется' }, { value: 'construction', label: 'Строится' }, { value: 'active', label: 'Активно' }, { value: 'inactive', label: 'Неактивно' }] as const;
    readonly statusLabel = (value: string) => this.statuses.find(status => status.value === value)?.label ?? 'Не указано';
    readonly installationLabel = installationLabel;
    readonly typeLabel = (value: string) => value === 'connection' ? 'Кабельное соединение' : MAP_POINT_TYPES.find(type => type.value === value)?.label ?? 'Объект';

    constructor() {
        inject(CompanyContextService).companyChanged$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.generation++; this.dialog().close({}); this.record.set(null); this.target.set(null); this.saving.set(false); this.membershipSaving.set(false);
        });
    }
    open(target: MapTarget): void {
        if (this.saving()) return;
        this.target.set(target); this.record.set(null); this.editing.set(false); this.dependencies.set(null); this.error.set(null);
        this.dialog().open(); this.reload();
    }
    reload(): void {
        const target = this.target(); if (!target || this.saving()) return;
        const generation = ++this.generation; this.loading.set(true); this.error.set(null);
        this.readRequest?.unsubscribe();
        this.readRequest = this.api.getPassport(target).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: record => { if (generation === this.generation) { this.record.set(record); this.members.set(record.layers.filter(layer => layer.mode === 'manual').map(layer => layer.id)); this.loading.set(false); } },
            error: () => { if (generation === this.generation) { this.loading.set(false); this.error.set('Не удалось открыть паспорт. Объект мог быть удалён или доступ изменился.'); } },
        });
    }
    onClosed(): void {
        if (this.dialog().stateComputed() === 'open' || this.saving() || this.membershipSaving()) return;
        this.generation++; this.readRequest?.unsubscribe(); this.dependencyRequest?.unsubscribe(); this.record.set(null);
        this.loading.set(false); this.dependenciesLoading.set(false); this.dependencies.set(null); this.draft.set(emptyData());
    }
    beginEdit(): void {
        const record = this.record(); if (!record?.can_manage) return;
        this.draft.set(structuredClone(record.data)); this.name.set(record.entity.name); this.description.set(record.entity.description ?? '');
        this.status.set(record.entity.status ?? record.data.operational_status ?? 'none'); this.error.set(null);
        if (record.notice) {
            const kind = record.entity.kind === 'building' ? 'building' : ['cabinet', 'pole'].includes(record.entity.point_type) ? record.entity.point_type : 'general';
            this.draft.update(data => ({ ...data, specs: { kind } as PassportSpecs }));
        }
        this.editing.set(true);
    }
    cancelEdit(): void { if (!this.saving()) { this.editing.set(false); this.error.set(null); } }
    text(field: 'inventory_number' | 'purpose' | 'note' | 'commissioned_on', value: string): void { this.draft.update(data => ({ ...data, [field]: value || null })); }
    specNumber(field: string, source = this.draft().specs): number | null { return (source as unknown as Record<string, number | null>)[field] ?? null; }
    setSpec(field: string, value: string): void {
        const number = value === '' ? null : Number(value);
        this.draft.update(data => ({ ...data, specs: { ...data.specs, [field]: number } }));
    }
    save(): void {
        const target = this.target(), record = this.record(); if (!target || !record || this.saving()) return;
        const generation = this.generation, data = structuredClone(this.draft());
        if (target.kind !== 'connection') data.operational_status = this.status() === 'none' ? null : this.status() as MapConnection['status'];
        const request: PassportWrite = { expected_version: record.version, expected_entity_version: record.entity.version, data };
        if (target.kind !== 'building') Object.assign(request, { name: this.name(), description: this.description() || null });
        if (target.kind === 'connection') request.status = this.status() as MapConnection['status'];
        this.saving.set(true); this.error.set(null);
        this.api.savePassport(target, request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: record => { if (generation === this.generation) { this.saving.set(false); this.editing.set(false); this.record.set(record); this.saved.emit(record); toast.success('Паспорт сохранён'); } },
            error: error => { if (generation === this.generation) { this.saving.set(false); this.error.set(this.message(error, 'Не удалось сохранить паспорт. Проверьте поля. Введённые данные сохранены в форме.')); } },
        });
    }
    setMembership(layer: MapLayer, present: boolean): void {
        const target = this.target(); if (!target || this.membershipSaving() || !this.canManageLayers()) return;
        const generation = this.generation; this.membershipSaving.set(true); this.error.set(null);
        this.api.setLayerMember(layer, target, present).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: changed => { if (generation === this.generation) { this.membershipSaving.set(false); this.workspace.applyLayer(changed); this.members.update(ids => present ? [...new Set([...ids, layer.id])] : ids.filter(id => id !== layer.id)); this.membershipChanged.emit(); } },
            error: error => { if (generation === this.generation) { this.membershipSaving.set(false); this.error.set(this.message(error, 'Не удалось изменить слой объекта.')); this.workspace.reloadLayers(); } },
        });
    }
    loadDependencies(): void {
        const target = this.target(); if (!target || this.dependenciesLoading()) return;
        const generation = this.generation; this.dependenciesLoading.set(true);
        this.dependencyRequest = this.api.getDependencies(target).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: report => { if (generation === this.generation) { this.dependencies.set(report); this.dependenciesLoading.set(false); } },
            error: error => { if (generation === this.generation) { this.dependenciesLoading.set(false); this.error.set(this.message(error, 'Не удалось проверить связи.')); } },
        });
    }
    dependencyLabel(type: string): string { return ({ map_connection: 'Сетевые соединения', entrance: 'Подъезды', location: 'Помещения', route_object: 'Объекты вдоль трассы', restricted: 'Другие связи' } as Record<string, string>)[type] ?? 'Связанные объекты'; }
    private message(error: unknown, fallback: string): string { return error instanceof HttpErrorResponse && error.error?.detail?.message || fallback; }
}
