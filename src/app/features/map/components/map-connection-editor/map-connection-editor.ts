import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { MapEndpointPicker } from '../map-endpoint-picker/map-endpoint-picker';
import type { MapConnectionDraft, MapEndpointDetail } from '../../models/map.models';

export const CONNECTION_STATUS_LABELS = { planned: 'Запланировано', construction: 'Строится', active: 'Действует', inactive: 'Не действует' } as const;
@Component({
    selector: 'app-map-connection-editor',
    imports: [FormsModule, HlmButtonImports, HlmDialogImports, HlmFieldImports, HlmInputImports, HlmSelectImports, HlmTextareaImports, MapEndpointPicker],
    templateUrl: './map-connection-editor.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapConnectionEditor {
    readonly draft = model.required<MapConnectionDraft>();
    readonly canManage = input(false);
    readonly saving = input(false);
    readonly error = input<string | null>(null);
    readonly editing = input(false);
    readonly mapRequested = output<'source' | 'target' | 'vertices'>();
    readonly saveRequested = output<void>();
    readonly vertexHistory = signal<[number, number][][]>([]);
    readonly coordinateError = signal<string | null>(null);
    readonly statuses = Object.entries(CONNECTION_STATUS_LABELS);
    readonly statusLabel = (value: keyof typeof CONNECTION_STATUS_LABELS) => CONNECTION_STATUS_LABELS[value];
    readonly mediumLabel = (value: string) => value === 'fiber' ? 'Оптоволокно' : 'UTP';
    readonly visibilityLabel = (value: string) => value === 'company' ? 'Общее соединение компании' : 'Личное соединение';
    readonly canSave = computed(() => {
        const d = this.draft();
        return d.name.trim().length > 0 && d.name.length <= 120 && d.source && d.target
            && (d.source.kind !== d.target.kind || d.source.id !== d.target.id)
            && d.source.latitude !== null && d.source.longitude !== null && d.target.latitude !== null && d.target.longitude !== null;
    });
    update<K extends keyof MapConnectionDraft>(field: K, value: MapConnectionDraft[K]) {
        this.draft.update(draft => ({ ...draft, [field]: value }));
    }
    setEndpoint(side: 'source' | 'target', endpoint: MapEndpointDetail | null) { this.update(side, endpoint); }
    setMedium(medium: 'fiber' | 'utp' | null | undefined) {
        if (medium) this.draft.update(d => ({ ...d, medium, fiber_count: null, category: null }));
    }
    swap() { this.draft.update(d => ({ ...d, source: d.target, target: d.source, vertices: [...d.vertices].reverse() })); }
    private setVertices(vertices: [number, number][]) {
        this.vertexHistory.update(history => [...history.slice(-29), this.draft().vertices.map(p => [...p] as [number, number])]);
        this.update('vertices', vertices);
        this.coordinateError.set(null);
    }
    addVertex() {
        if (this.draft().vertices.length >= 498) return;
        const source = this.draft().source;
        if (source?.latitude == null || source.longitude == null) return;
        this.setVertices([...this.draft().vertices, [source.longitude, source.latitude]]);
    }
    changeVertex(index: number, value: string) {
        const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
        if (!match || Math.abs(Number(match[1])) > 90 || Math.abs(Number(match[2])) > 180) {
            this.coordinateError.set('Укажите широту и долготу, например 55.577276, 38.245099');
            return;
        }
        this.setVertices(this.draft().vertices.map((point, i) => i === index ? [Number(match[2]), Number(match[1])] : point));
    }
    removeVertex(index: number) { this.setVertices(this.draft().vertices.filter((_, i) => i !== index)); }
    undoVertex() {
        const history = this.vertexHistory();
        if (history.length) { this.update('vertices', history[history.length - 1]); this.vertexHistory.set(history.slice(0, -1)); }
    }
}
