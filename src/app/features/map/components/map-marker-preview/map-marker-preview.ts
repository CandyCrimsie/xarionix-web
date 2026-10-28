import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { markerDataUrl } from '../../map-marker-renderer';
import type { MapMarkerAppearance } from '../../models/map.models';

@Component({
    selector: 'app-map-marker-preview',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './map-marker-preview.html',
})
export class MapMarkerPreview {
    readonly appearance = input.required<MapMarkerAppearance>();
    readonly selected = input(false);
    readonly source = computed(() => markerDataUrl(this.appearance(), this.selected()));
}
