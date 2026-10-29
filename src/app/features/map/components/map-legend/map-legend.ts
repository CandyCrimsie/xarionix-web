import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { HlmCollapsibleImports } from '@spartan-ng/helm/collapsible';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronDown, lucideChevronRight, lucideMap } from '@ng-icons/lucide';
import { MapIcon } from '../map-icon/map-icon';
import { MAP_MARKER_ICONS, LEGACY_MAP_MARKER_ICONS } from '../../map-marker.config';
import type { MapConnection, MapMarker } from '../../models/map.models';
import { CONNECTION_COLORS, CONNECTION_STATUSES } from '../../map-connection-layer';
import { INSTALLATION_STYLES, installationMethods } from '../../map-line-styles';
import { MapLineSample } from '../map-line-sample/map-line-sample';

@Component({
    selector: 'app-map-legend',
    imports: [HlmCollapsibleImports, HlmButtonImports, HlmTooltipImports, HlmSeparatorImports, NgIcon, MapIcon, MapLineSample],
    providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucideMap })],
    templateUrl: './map-legend.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapLegend {
    readonly embedded = input(false);
    readonly markers = input<MapMarker[]>([]);
    readonly connections = input<MapConnection[]>([]);
    readonly hasBuildings = input(false);
    readonly expanded = signal(false);
    readonly methodsExpanded = signal(true);
    readonly objects = computed(() => {
        const ids = new Set(this.markers().map(marker => marker.icon_name).filter(Boolean));
        if (this.hasBuildings()) ids.add('map-house');
        return [...MAP_MARKER_ICONS, ...LEGACY_MAP_MARKER_ICONS].filter(icon => ids.has(icon.value));
    });
    readonly media = computed(() => Object.entries(CONNECTION_COLORS).filter(([medium]) => this.connections().some(line => line.geometry && line.medium === medium)));
    readonly statuses = computed(() => CONNECTION_STATUSES.filter(status => this.connections().some(line => line.geometry && line.status === status.value)));
    readonly methods = computed(() => {
        const used = new Set(this.connections().filter(line => line.geometry).flatMap(line => installationMethods(line.vertices ?? [], line.installation_methods)));
        return INSTALLATION_STYLES.filter(style => used.has(style.value));
    });
}
