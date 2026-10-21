import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    model,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMapPin, lucideRotateCcw, lucideSearch } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmSliderImports } from '@spartan-ng/helm/slider';
import { HlmSwitchImports } from '@spartan-ng/helm/switch';
import { HlmTabsImports } from '@spartan-ng/helm/tabs';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { HlmTooltipImports } from '@spartan-ng/helm/tooltip';

import {
    createDefaultMapMarker,
    MAP_MARKER_ICON_PROVIDERS,
    MAP_MARKER_ICONS,
    MAP_MARKER_PRESETS,
} from '../../map-marker.config';
import type {
    MapMarkerPayload,
    MapMarkerShape,
    MapMarkerSize,
} from '../../models/map.models';


type OpacityField =
    | 'marker_opacity'
    | 'icon_opacity'
    | 'text_opacity'
    | 'background_opacity'
    | 'border_opacity';


@Component({
    selector: 'app-map-marker-editor',
    imports: [
        FormsModule,
        NgIcon,
        HlmAlertImports,
        HlmButtonImports,
        HlmDialogImports,
        HlmFieldImports,
        HlmInputImports,
        HlmSelectImports,
        HlmSliderImports,
        HlmSwitchImports,
        HlmTabsImports,
        HlmTextareaImports,
        HlmTooltipImports,
    ],
    providers: [provideIcons({
        ...MAP_MARKER_ICON_PROVIDERS,
        lucideMapPin,
        lucideRotateCcw,
        lucideSearch,
    })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './map-marker-editor.html',
})
export class MapMarkerEditor {
    readonly draft = model.required<MapMarkerPayload>();
    readonly editing = input(false);
    readonly saving = input(false);
    readonly error = input<string | null>(null);
    readonly saveRequested = output<void>();
    readonly pointRequested = output<void>();

    readonly iconSearch = signal('');
    readonly icons = computed(() => {
        const query = this.iconSearch().trim().toLocaleLowerCase('ru');
        return query
            ? MAP_MARKER_ICONS.filter(icon => (
                `${icon.label} ${icon.category} ${icon.value}`
                    .toLocaleLowerCase('ru')
                    .includes(query)
            ))
            : MAP_MARKER_ICONS;
    });
    readonly presets = MAP_MARKER_PRESETS;
    readonly sizes: readonly { value: MapMarkerSize; label: string }[] = [
        { value: 'small', label: 'Маленький' },
        { value: 'normal', label: 'Обычный' },
        { value: 'large', label: 'Большой' },
    ];
    readonly shapes: readonly { value: MapMarkerShape; label: string }[] = [
        { value: 'circle', label: 'Круг' },
        { value: 'rounded', label: 'Скруглённый квадрат' },
        { value: 'pill', label: 'Pill' },
        { value: 'icon', label: 'Только иконка' },
    ];
    readonly presetToString = (id: string): string => (
        this.presets.find(item => item.id === id)?.label ?? ''
    );
    readonly sizeToString = (value: MapMarkerSize): string => (
        this.sizes.find(item => item.value === value)?.label ?? ''
    );
    readonly shapeToString = (value: MapMarkerShape): string => (
        this.shapes.find(item => item.value === value)?.label ?? ''
    );

    readonly canSave = computed(() => {
        const marker = this.draft();
        const colorsValid = [
            marker.icon_color,
            marker.text_color,
            marker.background_color,
            marker.border_color,
        ].every(color => /^#[0-9a-f]{6}$/i.test(color));
        return Boolean(marker.name.trim())
            && marker.name.trim().length <= 120
            && colorsValid
            && marker.border_width >= 0
            && marker.border_width <= 8
            && (marker.building_id === null || marker.building_id > 0)
            && Number.isFinite(marker.latitude)
            && marker.latitude >= -90
            && marker.latitude <= 90
            && Number.isFinite(marker.longitude)
            && marker.longitude >= -180
            && marker.longitude <= 180;
    });


    update<K extends keyof MapMarkerPayload>(
        field: K,
        value: MapMarkerPayload[K],
    ): void {
        this.draft.update(current => ({ ...current, [field]: value }));
    }


    updateNullableText(
        field: 'description' | 'label_text',
        value: string,
    ): void {
        this.update(field, value || null);
    }


    updateNumber(
        field: 'latitude' | 'longitude' | 'border_width' | 'building_id',
        value: string,
    ): void {
        if (field === 'building_id' && !value.trim()) {
            this.update('building_id', null);
            return;
        }
        const parsed = Number(value.replace(',', '.'));
        if (Number.isFinite(parsed)) {
            this.update(field, parsed as never);
        }
    }


    handleCoordinatePaste(event: ClipboardEvent): void {
        const text = event.clipboardData?.getData('text')?.trim() ?? '';
        const match = text.match(
            /^\s*(-?\d+(?:[.,]\d+)?)\s*[,;/\s]\s*(-?\d+(?:[.,]\d+)?)\s*$/,
        );
        if (!match) {
            return;
        }
        const latitude = Number(match[1].replace(',', '.'));
        const longitude = Number(match[2].replace(',', '.'));
        if (
            latitude >= -90 && latitude <= 90
            && longitude >= -180 && longitude <= 180
        ) {
            event.preventDefault();
            this.draft.update(current => ({ ...current, latitude, longitude }));
        }
    }


    selectIcon(iconName: string | null): void {
        this.update('icon_name', iconName);
    }


    applyPreset(id: string | null | undefined): void {
        const preset = this.presets.find(item => item.id === id);
        if (!preset) {
            return;
        }
        this.draft.update(current => ({ ...current, ...preset.values }));
    }


    selectSize(value: MapMarkerSize | null | undefined): void {
        if (value) {
            this.update('marker_size', value);
        }
    }


    selectShape(value: MapMarkerShape | null | undefined): void {
        if (value) {
            this.update('marker_shape', value);
        }
    }


    resetAppearance(): void {
        const defaults = createDefaultMapMarker();
        this.draft.update(current => ({
            ...current,
            icon_name: defaults.icon_name,
            icon_color: defaults.icon_color,
            icon_opacity: defaults.icon_opacity,
            text_color: defaults.text_color,
            text_opacity: defaults.text_opacity,
            background_enabled: defaults.background_enabled,
            background_color: defaults.background_color,
            background_opacity: defaults.background_opacity,
            border_enabled: defaults.border_enabled,
            border_color: defaults.border_color,
            border_width: defaults.border_width,
            border_opacity: defaults.border_opacity,
            marker_opacity: defaults.marker_opacity,
            marker_size: defaults.marker_size,
            marker_shape: defaults.marker_shape,
        }));
    }


    opacityPercent(field: OpacityField): number {
        return Math.round(this.draft()[field] * 100);
    }


    setOpacity(field: OpacityField, values: readonly number[]): void {
        const value = Math.min(100, Math.max(0, values[0] ?? 0));
        this.update(field, value / 100);
    }


    previewSize(): number {
        return { small: 32, normal: 42, large: 54 }[this.draft().marker_size];
    }


    previewRadius(): string {
        switch (this.draft().marker_shape) {
            case 'circle': return '9999px';
            case 'pill': return '9999px';
            case 'icon': return '0';
            default: return '10px';
        }
    }


    previewWidth(): number {
        return this.draft().marker_shape === 'pill'
            ? Math.round(this.previewSize() * 1.4)
            : this.previewSize();
    }


    selectedIconName(): string | null {
        return MAP_MARKER_ICONS.find(
            item => item.value === this.draft().icon_name,
        )?.icon ?? null;
    }


    submit(): void {
        if (this.canSave() && !this.saving()) {
            this.saveRequested.emit();
        }
    }
}
