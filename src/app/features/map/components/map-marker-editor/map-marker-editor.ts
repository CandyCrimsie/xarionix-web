import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    model,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMapPin, lucideRotateCcw, lucideSearch } from '@ng-icons/lucide';
import { HlmAlertImports } from '@spartan-ng/helm/alert';
import { HlmAlertDialogImports } from '@spartan-ng/helm/alert-dialog';
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

import { BuildingAddressPicker } from '../../../../shared/building-address-picker/building-address-picker';
import type { Building } from '../../../../core/addresses/address.models';

import {
    createDefaultMapMarker,
    MAP_MARKER_ICON_PROVIDERS,
    MAP_MARKER_ICONS,
    LEGACY_MAP_MARKER_ICONS,
    MAP_MARKER_PRESETS,
    MAP_POINT_TYPES,
    BUILDING_LINK_ROLES,
    pickMarkerAppearance,
} from '../../map-marker.config';
import { MapMarkerPreview } from '../map-marker-preview/map-marker-preview';
import { MapIcon } from '../map-icon/map-icon';
import { markerDataUrl } from '../../map-marker-renderer';
import type {
    MapMarkerPayload,
    MapMarkerShape,
    MapMarkerSize,
    MapPointType,
    BuildingLinkRole,
    MapVisibility,
    MapStylePreset,
    MapMarkerAppearance,
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
        HlmAlertDialogImports,
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
        BuildingAddressPicker,
        MapMarkerPreview,
        MapIcon,
    ],
    providers: [provideIcons({
        ...MAP_MARKER_ICON_PROVIDERS,
        lucideMapPin,
        lucideRotateCcw,
        lucideSearch,
    })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'flex h-[min(48rem,calc(100dvh-4rem))] min-h-0 min-w-0 w-full flex-col gap-5',
    },
    templateUrl: './map-marker-editor.html',
})
export class MapMarkerEditor {
    readonly draft = model.required<MapMarkerPayload>();
    readonly editing = input(false);
    readonly spliceConnection = input<string | null>(null);
    readonly canManage = input(false);
    readonly personalStyles = input<MapStylePreset[]>([]);
    readonly styleRequested = output<{ action: 'create' | 'rename' | 'duplicate' | 'delete'; name: string; appearance: MapMarkerAppearance; preset?: MapStylePreset }>();
    readonly styleName = signal('');
    readonly selectedStyle = signal<number | null>(null);
    readonly relocatingBuilding = signal(false);
    readonly pointTypes = computed(() => this.canManage() ? MAP_POINT_TYPES : MAP_POINT_TYPES.filter(type => type.value === 'note'));
    readonly linkRoles = computed(() => BUILDING_LINK_ROLES.filter(role => role.value !== 'represents' || (this.canManage() && this.draft().visibility === 'company' && this.draft().point_type === 'building')));
    readonly pointTypeLabel = (value: MapPointType) => MAP_POINT_TYPES.find(type => type.value === value)?.label ?? '';
    readonly linkRoleLabel = (value: BuildingLinkRole) => BUILDING_LINK_ROLES.find(role => role.value === value)?.label ?? '';
    readonly visibilityLabel = (value: MapVisibility) => value === 'private' ? 'Личная отметка' : 'Общий объект компании';
    readonly styleLabel = (id: number) => this.personalStyles().find(style => style.id === id)?.name ?? '';
    readonly appearance = computed(() => pickMarkerAppearance(this.draft()));
    readonly canEditCoordinates = computed(() => !this.spliceConnection() && (this.draft().building_link_role !== 'represents'
        || this.relocatingBuilding() || !!this.draft().building_position
        || this.draft().latitude === null || this.draft().longitude === null));
    readonly saving = input(false);
    readonly error = input<string | null>(null);
    readonly saveRequested = output<void>();
    readonly pointRequested = output<void>();
    readonly buildingPicker = viewChild(BuildingAddressPicker);

    readonly iconSearch = signal('');
    readonly icons = computed(() => {
        const query = this.iconSearch().trim().toLocaleLowerCase('ru');
        const legacy = LEGACY_MAP_MARKER_ICONS.find(icon => icon.value === this.draft().icon_name);
        const options = [...MAP_MARKER_ICONS, ...(legacy ? [legacy] : [])];
        return query
            ? options.filter(icon => (
                `${icon.label} ${icon.category} ${icon.value}`
                    .toLocaleLowerCase('ru')
                    .includes(query)
            ))
            : options;
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
            && (this.buildingPicker()?.selectionValid() ?? true)
            && marker.name.trim().length <= 120
            && colorsValid
            && marker.border_width >= 0
            && marker.border_width <= 8
            && (marker.building_id === null || marker.building_id > 0)
            && (!marker.sync_building_coordinates || marker.building_id !== null)
            && marker.latitude !== null
            && marker.longitude !== null
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
        this.draft.update(current => ({
            ...current,
            [field]: value,
            ...(field === 'building_id' && value === null ? { sync_building_coordinates: false } : {}),
        }));
    }


    updateNullableText(
        field: 'description' | 'label_text',
        value: string,
    ): void {
        this.update(field, value || null);
    }


    selectBuilding(building: Building | null): void {
        this.draft.update(current => ({
            ...current,
            building_id: building?.id ?? null,
            sync_building_coordinates: false,
            building_link_role: building ? (current.building_link_role === 'none' ? 'reference' : current.building_link_role) : 'none',
            building_position: null,
        }));
        this.relocatingBuilding.set(false);
        if (building && this.draft().building_link_role === 'represents') {
            this.useBuildingCoordinates(building);
        }
    }

    selectLinkRole(role: BuildingLinkRole | null | undefined): void {
        if (!role || !this.linkRoles().some(item => item.value === role)) return;
        this.update('building_link_role', role);
        this.update('building_position', null);
        this.relocatingBuilding.set(false);
        const building = this.buildingPicker()?.selectedBuilding();
        if (role === 'represents' && building) {
            this.useBuildingCoordinates(building);
        }
    }

    selectPointType(type: MapPointType | null | undefined): void {
        if (!type || !this.pointTypes().some(item => item.value === type)) return;
        const icon = MAP_POINT_TYPES.find(item => item.value === type)!;
        this.draft.update(current => ({ ...current, point_type: type, icon_name: icon.icon,
            visibility: type === 'note' ? 'private' : 'company',
            building_link_role: current.building_link_role === 'represents' && type !== 'building' ? 'reference' : current.building_link_role,
            building_position: null,
        }));
    }

    selectVisibility(visibility: MapVisibility | null | undefined): void {
        if (!visibility || !this.canManage()) return;
        this.draft.update(current => ({ ...current, visibility,
            building_link_role: current.building_link_role === 'represents' && visibility === 'private' ? 'reference' : current.building_link_role,
            building_position: null,
        }));
    }

    requestPoint(): void {
        if (!this.canEditCoordinates()) return;
        if (this.draft().building_link_role === 'represents' && this.draft().latitude !== null && this.draft().longitude !== null) {
            this.update('building_position', { latitude: this.draft().latitude!, longitude: this.draft().longitude! });
        }
        this.pointRequested.emit();
    }

    iconSource(value: string): string {
        return markerDataUrl({ ...this.appearance(), icon_name: value, background_enabled: false, border_enabled: false, marker_opacity: 1 });
    }

    applyPersonalStyle(id: number | null | undefined): void {
        const style = this.personalStyles().find(item => item.id === id);
        if (!style) return;
        this.selectedStyle.set(style.id);
        this.styleName.set(style.name);
        this.draft.update(draft => ({ ...draft, ...style.appearance }));
    }

    requestStyle(action: 'create' | 'rename' | 'duplicate' | 'delete'): void {
        const preset = this.personalStyles().find(item => item.id === this.selectedStyle());
        const name = action === 'duplicate' ? (this.styleName().trim() || preset?.name || 'Стиль') + ' — копия' : this.styleName().trim();
        if (action !== 'delete' && !name) return;
        this.styleRequested.emit({ action, name, appearance: this.appearance(), preset });
    }


    private useBuildingCoordinates(building: Building): void {
        if (
            building.latitude !== null && building.longitude !== null
            && Number.isFinite(Number(building.latitude))
            && Number.isFinite(Number(building.longitude))
        ) {
            // Selecting an already positioned house must not move it to the
            // map centre. The user can choose a different point afterwards.
            this.draft.update(current => ({
                ...current,
                latitude: Number(building.latitude),
                longitude: Number(building.longitude),
            }));
        } else {
            this.draft.update(current => ({ ...current, latitude: null, longitude: null }));
        }
    }


    updateNumber(
        field: 'latitude' | 'longitude' | 'border_width',
        value: string,
    ): void {
        if (field !== 'border_width' && !this.canEditCoordinates()) return;
        const parsed = Number(String(value).replace(',', '.'));
        if (Number.isFinite(parsed)) {
            this.update(field, parsed as never);
            this.recordBuildingPosition();
        }
    }


    handleCoordinatePaste(event: ClipboardEvent): void {
        if (!this.canEditCoordinates()) return;
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
            this.recordBuildingPosition();
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

    private recordBuildingPosition(): void {
        const d = this.draft();
        if (d.building_link_role === 'represents' && d.latitude !== null && d.longitude !== null && this.canEditCoordinates()) {
            this.update('building_position', { latitude: d.latitude, longitude: d.longitude });
        }
    }


    opacityPercent(field: OpacityField): number {
        return Math.round(this.draft()[field] * 100);
    }


    setOpacity(field: OpacityField, values: readonly number[]): void {
        const value = Math.min(100, Math.max(0, values[0] ?? 0));
        this.update(field, value / 100);
    }


    selectedIconName(): string | null {
        return [...MAP_MARKER_ICONS, ...LEGACY_MAP_MARKER_ICONS].find(
            item => item.value === this.draft().icon_name,
        )?.icon ?? null;
    }


    submit(): void {
        if (this.canSave() && !this.saving()) {
            this.saveRequested.emit();
        }
    }
}
