import type { InstallationMethod, MapConnection, MapPointType } from './map.models';

export type MapEntityKind = 'building' | 'marker' | 'connection';
export interface MapTarget { kind: MapEntityKind; id: number }
export type ConnectionMode = 'hidden' | 'viewport' | 'object';
export interface LayerRules { address_object_id?: number | null; point_types?: MapPointType[]; media?: ('fiber' | 'utp')[]; statuses?: MapConnection['status'][] }
export interface MapLayer {
    id: number; version: number; name: string; parent_id: number | null;
    mode: 'group' | 'manual' | 'dynamic'; sort_order: number; rules: LayerRules;
}
export type LayerDraft = Omit<MapLayer, 'id' | 'version'>;
export interface MapSettings {
    schema_version: 1; show_buildings: boolean; show_infrastructure: boolean; show_personal: boolean;
    point_types: MapPointType[]; point_types_enabled: boolean; visible_layer_ids: number[]; include_unassigned: boolean;
    medium: 'all' | 'fiber' | 'utp'; status: 'all' | MapConnection['status'];
    installation: 'all' | InstallationMethod; connection_mode: ConnectionMode;
}
export const defaultMapSettings = (): MapSettings => ({
    schema_version: 1, show_buildings: true, show_infrastructure: true, show_personal: true,
    point_types: [], point_types_enabled: false, visible_layer_ids: [], include_unassigned: true,
    medium: 'all', status: 'all', installation: 'all', connection_mode: 'viewport',
});
export const safeMapSettings = (): MapSettings => ({ ...defaultMapSettings(),
    show_buildings: false, show_infrastructure: false, show_personal: false, include_unassigned: false, connection_mode: 'hidden' });
export interface MapPreference { version: number; settings: MapSettings; notice: string | null }
export interface MapQuery {
    layers_active: boolean; layer_ids: number[]; include_unassigned: boolean;
    point_types: MapPointType[]; point_types_enabled: boolean; medium: MapSettings['medium']; status: MapSettings['status']; installation: MapSettings['installation'];
}
export type PassportSpecs = { kind: 'general' } | { kind: 'building'; floors?: number | null; premises?: number | null }
    | { kind: 'pole'; height_m?: number | null } | { kind: 'cabinet'; height_u?: number | null };
export interface PassportData {
    inventory_number: string | null; purpose: string | null; note: string | null; commissioned_on: string | null;
    operational_status: MapConnection['status'] | null; specs: PassportSpecs;
}
export interface PassportEntity extends MapTarget {
    company_name: string;
    name: string; description: string | null; version: number | null; point_type: MapPointType | 'connection';
    status: MapConnection['status'] | null; latitude: number | null; longitude: number | null;
    full_address?: string; building_id?: number | null; building_full_address?: string | null;
    building_link_role?: string; medium?: 'fiber' | 'utp'; fiber_count?: number | null; category?: string | null;
    length_m?: number | null; source?: { name: string }; target?: { name: string }; installation_methods?: InstallationMethod[];
}
export interface MapPassport { entity: PassportEntity; version: number; data: PassportData; can_manage: boolean; layers: MapLayer[]; notice: string | null }
export interface PassportWrite {
    expected_version: number; expected_entity_version: number | null;
    name?: string; description?: string | null; status?: MapConnection['status']; data: PassportData;
}
export interface DependencyReport {
    code: 'object_has_dependencies' | 'endpoint_has_connections' | 'route_has_objects'; message: string;
    object: { kind: string; id: number };
    dependencies: { type: string; count?: number; message?: string; has_more?: boolean;
        items?: { id: number; name: string; medium?: 'fiber' | 'utp'; source_name?: string; target_name?: string }[] }[];
}
