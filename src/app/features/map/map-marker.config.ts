import {
    lucideBuilding2,
    lucideCable,
    lucideCircleAlert,
    lucideHardDrive,
    lucideHouse,
    lucideMapPin,
    lucideNetwork,
    lucideRadioTower,
    lucideRouter,
    lucideServer,
    lucideWifi,
    lucideWrench,
    lucideZap,
} from '@ng-icons/lucide';

import type { MapMarkerPayload } from './models/map.models';
import { APPROVED_MAP_ICONS } from './icons/map-icons';


export const MAP_MARKER_ICONS = [
    ...APPROVED_MAP_ICONS.map(icon => ({ ...icon, icon: 'lucideMapPin', category: 'Инфраструктура' })),
    { value: 'map-pin', icon: 'lucideMapPin', label: 'Метка', category: 'Общие', svg: lucideMapPin },
    { value: 'house', icon: 'lucideHouse', label: 'Дом', category: 'Общие', svg: lucideHouse },
    { value: 'building-2', icon: 'lucideBuilding2', label: 'Здание', category: 'Общие', svg: lucideBuilding2 },
    { value: 'network', icon: 'lucideNetwork', label: 'Сеть', category: 'Связь', svg: lucideNetwork },
    { value: 'router', icon: 'lucideRouter', label: 'Роутер', category: 'Связь', svg: lucideRouter },
    { value: 'wifi', icon: 'lucideWifi', label: 'Wi-Fi', category: 'Связь', svg: lucideWifi },
    { value: 'cable', icon: 'lucideCable', label: 'Кабель', category: 'Связь', svg: lucideCable },
    { value: 'radio-tower', icon: 'lucideRadioTower', label: 'Радиовышка', category: 'Связь', svg: lucideRadioTower },
    { value: 'server', icon: 'lucideServer', label: 'Сервер', category: 'Оборудование', svg: lucideServer },
    { value: 'hard-drive', icon: 'lucideHardDrive', label: 'Накопитель', category: 'Оборудование', svg: lucideHardDrive },
    { value: 'wrench', icon: 'lucideWrench', label: 'Работы', category: 'Оборудование', svg: lucideWrench },
    { value: 'zap', icon: 'lucideZap', label: 'Питание', category: 'Состояние', svg: lucideZap },
    { value: 'circle-alert', icon: 'lucideCircleAlert', label: 'Предупреждение', category: 'Состояние', svg: lucideCircleAlert },
] as const;


export const MAP_MARKER_ICON_PROVIDERS = {
    lucideBuilding2,
    lucideCable,
    lucideCircleAlert,
    lucideHardDrive,
    lucideHouse,
    lucideMapPin,
    lucideNetwork,
    lucideRadioTower,
    lucideRouter,
    lucideServer,
    lucideWifi,
    lucideWrench,
    lucideZap,
};


export const DEFAULT_MAP_MARKER_APPEARANCE = {
    icon_name: 'note',
    icon_color: '#E3EAF3',
    icon_opacity: 1,
    text_color: '#E3EAF3',
    text_opacity: 1,
    background_enabled: true,
    background_color: '#222E3E',
    background_opacity: 1,
    border_enabled: true,
    border_color: '#3B485A',
    border_width: 1,
    border_opacity: 1,
    marker_opacity: 1,
    marker_size: 'normal',
    marker_shape: 'circle',
} satisfies Pick<
    MapMarkerPayload,
    | 'icon_name'
    | 'icon_color'
    | 'icon_opacity'
    | 'text_color'
    | 'text_opacity'
    | 'background_enabled'
    | 'background_color'
    | 'background_opacity'
    | 'border_enabled'
    | 'border_color'
    | 'border_width'
    | 'border_opacity'
    | 'marker_opacity'
    | 'marker_size'
    | 'marker_shape'
>;


export function createDefaultMapMarker(
    latitude = 55.751244,
    longitude = 37.618423,
): MapMarkerPayload {
    return {
        visibility: 'private',
        point_type: 'note',
        building_link_role: 'none',
        building_id: null,
        sync_building_coordinates: false,
        name: '',
        description: null,
        latitude,
        longitude,
        label_text: null,
        ...mapAppearanceForTheme(),
    };
}


export interface MapMarkerPreset {
    id: string;
    label: string;
    values: Partial<MapMarkerPayload>;
}


export const MAP_MARKER_PRESETS: readonly MapMarkerPreset[] = [
    { id: 'default', label: 'Стандартный', values: { ...DEFAULT_MAP_MARKER_APPEARANCE } },
    { id: 'network', label: 'Узел связи', values: { ...DEFAULT_MAP_MARKER_APPEARANCE, icon_name: 'network-node' } },
    { id: 'equipment', label: 'Оборудование', values: { ...DEFAULT_MAP_MARKER_APPEARANCE, icon_name: 'equipment' } },
    { id: 'important', label: 'Важный объект', values: { ...DEFAULT_MAP_MARKER_APPEARANCE, icon_name: 'zap', background_color: '#7C3AED', border_color: '#EDE9FE', marker_size: 'large' } },
    { id: 'warning', label: 'Предупреждение', values: { ...DEFAULT_MAP_MARKER_APPEARANCE, icon_name: 'circle-alert', background_color: '#DC2626', border_color: '#FEE2E2', marker_shape: 'circle' } },
    { id: 'minimal', label: 'Минималистичный', values: { ...DEFAULT_MAP_MARKER_APPEARANCE, icon_name: 'map-pin', background_enabled: false, border_enabled: false, icon_color: '#18181B', marker_shape: 'icon' } },
];


export function mapMarkerIconSvg(iconName: string | null): string | null {
    return MAP_MARKER_ICONS.find(item => item.value === iconName)?.svg ?? null;
}

export function mapAppearanceForTheme(dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return {
        ...DEFAULT_MAP_MARKER_APPEARANCE,
        ...(!dark ? { icon_color: '#465366', text_color: '#465366', background_color: '#FFFFFF', border_color: '#DAE1EB' } : {}),
    };
}

export const MAP_POINT_TYPES = [
    { value: 'building', label: 'Дом', icon: 'map-house' },
    { value: 'network_node', label: 'Узел связи', icon: 'network-node' },
    { value: 'cabinet', label: 'Шкаф', icon: 'cabinet' },
    { value: 'splice', label: 'Муфта', icon: 'splice' },
    { value: 'pole', label: 'Опора', icon: 'pole' },
    { value: 'chamber', label: 'Колодец', icon: 'chamber' },
    { value: 'equipment', label: 'Оборудование', icon: 'equipment' },
    { value: 'note', label: 'Заметка', icon: 'note' },
] as const;

export const BUILDING_LINK_ROLES = [
    { value: 'represents', label: 'Основная метка дома' },
    { value: 'located_at', label: 'Объект расположен у дома' },
    { value: 'reference', label: 'Справочная связь' },
] as const;

export function pickMarkerAppearance(marker: Partial<MapMarkerPayload>) {
    return Object.fromEntries(
        [...Object.keys(DEFAULT_MAP_MARKER_APPEARANCE), 'label_text'].map(key => [key, marker[key as keyof MapMarkerPayload] ?? (key === 'label_text' ? null : DEFAULT_MAP_MARKER_APPEARANCE[key as keyof typeof DEFAULT_MAP_MARKER_APPEARANCE])]),
    ) as import('./models/map.models').MapMarkerAppearance;
}
