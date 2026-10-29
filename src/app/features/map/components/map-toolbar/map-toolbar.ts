import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCable, lucideFolder, lucideLayers, lucideListFilter, lucideMap, lucideMapPinPlus, lucidePencil, lucidePlus, lucideTrash2, lucideX, lucideArrowUp, lucideArrowDown, lucideInfo, lucideChevronDown, lucideChevronRight } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmButtonGroupImports } from '@spartan-ng/helm/button-group';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmPopoverImports } from '@spartan-ng/helm/popover';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { MapWorkspaceState } from '../../services/map-workspace.state';
import type { ConnectionMode, MapLayer } from '../../models/map-workspace.models';
import type { MapConnection, MapMarker, MapPointType } from '../../models/map.models';
import { MAP_POINT_TYPES } from '../../map-marker.config';
import { INSTALLATION_STYLES } from '../../map-line-styles';
import { MapLegend } from '../map-legend/map-legend';
import { MapIcon } from '../map-icon/map-icon';

export type MapPanel = 'filters' | 'layers' | 'legend';
@Component({
    selector: 'app-map-toolbar',
    imports: [NgIcon, HlmButtonImports, HlmButtonGroupImports, HlmCheckboxImports, HlmPopoverImports, HlmSelectImports, HlmTooltipImports, HlmCollapsibleImports, MapLegend, MapIcon],
    providers: [provideIcons({ lucideCable, lucideFolder, lucideLayers, lucideListFilter, lucideMap, lucideMapPinPlus, lucidePencil, lucidePlus, lucideTrash2, lucideX, lucideArrowUp, lucideArrowDown, lucideInfo, lucideChevronDown, lucideChevronRight })],
    templateUrl: './map-toolbar.html', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapToolbar {
    readonly typesExpanded = signal(false);
    readonly workspace = inject(MapWorkspaceState);
    readonly canManage = input(false);
    readonly expanded = input(false);
    readonly activePanel = model<MapPanel | null>(null);
    readonly markers = input<MapMarker[]>([]);
    readonly connections = input<MapConnection[]>([]);
    readonly hasBuildings = input(false);
    readonly closeRequested = output<void>();
    readonly addMarker = output<void>();
    readonly addConnection = output<void>();
    readonly modeRequested = output<ConnectionMode>();
    readonly resetRequested = output<void>();
    readonly editLayer = output<MapLayer | null>();
    readonly deleteLayer = output<MapLayer>();
    readonly reorderLayer = output<{ layer: MapLayer; direction: -1 | 1 }>();
    readonly types = MAP_POINT_TYPES;
    readonly methods = INSTALLATION_STYLES;
    readonly modes = [{ value: 'hidden', label: 'Скрыты' }, { value: 'viewport', label: 'В области карты' }, { value: 'object', label: 'У выбранного объекта' }] as const;
    readonly statuses = [{ value: 'all', label: 'Любой статус' }, { value: 'planned', label: 'Планируется' }, { value: 'construction', label: 'Строится' }, { value: 'active', label: 'Активно' }, { value: 'inactive', label: 'Неактивно' }] as const;
    readonly mediumLabel = (value: string) => ({ all: 'Любая среда', fiber: 'Оптоволокно', utp: 'Витая пара' } as Record<string, string>)[value] ?? value;
    readonly statusLabel = (value: string) => this.statuses.find(status => status.value === value)?.label ?? '';
    readonly installationLabel = (value: string) => value === 'all' ? 'Любая прокладка' : this.methods.find(method => method.value === value)?.label ?? '';
    readonly modeLabel = (value: string) => this.modes.find(mode => mode.value === value)?.label ?? '';
    readonly orderedLayers = computed(() => {
        const layers = this.workspace.layers(), result: { layer: MapLayer; depth: number }[] = [], seen = new Set<number>();
        const visit = (parent: number | null, depth: number) => {
            for (const layer of layers.filter(layer => layer.parent_id === parent).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)) {
                if (seen.has(layer.id)) continue;
                seen.add(layer.id); result.push({ layer, depth }); visit(layer.id, depth + 1);
            }
        };
        visit(null, 0); return result;
    });

    panelState(panel: MapPanel, state: 'open' | 'closed'): void {
        if (state === 'open') this.activePanel.set(panel);
        else if (this.activePanel() === panel) this.activePanel.set(null);
    }
    layerLeaves(layer: MapLayer): number[] {
        if (layer.mode !== 'group') return [layer.id];
        const seen = new Set<number>([layer.id]);
        for (let i = 0; i < 8; i++) for (const child of this.workspace.layers()) if (child.parent_id !== null && seen.has(child.parent_id)) seen.add(child.id);
        return this.workspace.layers().filter(item => item.mode !== 'group' && seen.has(item.id)).map(item => item.id);
    }
    layerChecked(layer: MapLayer): boolean | 'indeterminate' {
        const ids = this.layerLeaves(layer), enabled = this.workspace.settings().visible_layer_ids;
        const count = ids.filter(id => enabled.includes(id)).length;
        return count === 0 ? false : count === ids.length ? true : 'indeterminate';
    }
    toggleLayer(layer: MapLayer): void {
        const ids = this.layerLeaves(layer), enabled = new Set(this.workspace.settings().visible_layer_ids), turnOn = this.layerChecked(layer) !== true;
        for (const id of ids) { if (turnOn) enabled.add(id); else enabled.delete(id); }
        this.workspace.update({ visible_layer_ids: [...enabled] });
    }
    typeChecked(type: MapPointType): boolean { return !this.workspace.settings().point_types_enabled || this.workspace.settings().point_types.includes(type); }
    toggleType(type: MapPointType): void {
        const selected = new Set(this.workspace.settings().point_types_enabled ? this.workspace.settings().point_types : this.types.map(type => type.value));
        if (selected.has(type)) selected.delete(type); else selected.add(type);
        this.workspace.update({ point_types: [...selected], point_types_enabled: selected.size !== this.types.length });
    }
}
