import type { FeatureCollection, Point } from 'geojson';


export interface MapTileSession {
    tile_url_template: string;
    expires_at: number;
    min_zoom: number;
    max_zoom: number;
    tile_size: number;
    default_latitude: number;
    default_longitude: number;
    default_zoom: number;
}


export interface MapBuildingProperties {
    id: number;
    address_object_id: number;
    number: string;
    corpus: string | null;
    structure: string | null;
    full_address: string;
}


export type MapBuildingFeatureCollection = FeatureCollection<
    Point,
    MapBuildingProperties
>;


export interface MapBounds {
    west: number;
    south: number;
    east: number;
    north: number;
}


export interface MapAddressObjectBounds {
    bounds: MapBounds | null;
    building_count: number;
}


export type MapMarkerSize = 'small' | 'normal' | 'large';
export type MapMarkerShape = 'circle' | 'rounded' | 'pill' | 'icon';
export type MapVisibility = 'company' | 'private';
export type MapPointType = 'building' | 'network_node' | 'cabinet' | 'splice' | 'pole' | 'chamber' | 'equipment' | 'note' | 'fiber_box' | 'odf' | 'transition';
export type InstallationMethod = 'unknown' | 'aerial' | 'duct' | 'direct_buried' | 'facade' | 'indoor';
export type RouteNodeType = 'splice' | 'fiber_box' | 'odf' | 'network_node' | 'cabinet';
export type RoutePassThroughType = 'chamber' | 'pole' | 'transition' | 'fiber_box' | 'network_node' | 'cabinet';
export interface RouteAttachment {
    connection_id: number; name: string; version: number; geometry_token: string; segment_index: number; fraction: number;
}
export interface RouteObject {
    marker_id: number; name: string; point_type: MapPointType; latitude: number; longitude: number;
    segment_index: number; fraction: number; state: 'on_route' | 'needs_attention';
}
export type BuildingLinkRole = 'none' | 'represents' | 'located_at' | 'reference';


export interface MapMarkerPayload {
    visibility: MapVisibility;
    point_type: MapPointType;
    building_link_role: BuildingLinkRole;
    building_id: number | null;
    sync_building_coordinates: boolean;
    building_position?: { latitude: number; longitude: number } | null;
    binding_confirmation?: string;
    expected_version?: number;
    name: string;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
    icon_name: string | null;
    label_text: string | null;
    icon_color: string;
    icon_opacity: number;
    text_color: string;
    text_opacity: number;
    background_enabled: boolean;
    background_color: string;
    background_opacity: number;
    border_enabled: boolean;
    border_color: string;
    border_width: number;
    border_opacity: number;
    marker_opacity: number;
    marker_size: MapMarkerSize;
    marker_shape: MapMarkerShape;
}


export interface MapMarker extends MapMarkerPayload {
    binding_effects?: Pick<MapMarker, 'id' | 'building_id' | 'building_link_role' | 'latitude' | 'longitude' | 'version'>[];
    route_attachment?: RouteAttachment | null;
    id: number;
    company_id: number;
    owner_user_id: number | null;
    building_full_address: string | null;
    version: number;
    can_manage: boolean;
    created_at: string;
    updated_at: string;
}


export type MapMarkerUpdate = Partial<MapMarkerPayload>;

export type MapMarkerAppearance = Pick<MapMarkerPayload,
    'icon_name' | 'label_text' | 'icon_color' | 'icon_opacity' | 'text_color' | 'text_opacity'
    | 'background_enabled' | 'background_color' | 'background_opacity' | 'border_enabled'
    | 'border_color' | 'border_width' | 'border_opacity' | 'marker_opacity' | 'marker_size' | 'marker_shape'>;

export type MapEndpoint = { kind: 'building'; id: number } | { kind: 'marker'; id: number };
export type MapEndpointDetail = MapEndpoint & { name: string; latitude: number | null; longitude: number | null };
export interface MapConnectionPayload {
    installation_methods?: InstallationMethod[];
    source: MapEndpoint;
    target: MapEndpoint;
    visibility: MapVisibility;
    name: string;
    description: string | null;
    medium: 'fiber' | 'utp';
    status: 'planned' | 'construction' | 'active' | 'inactive';
    fiber_count: number | null;
    category: 'Cat 5e' | 'Cat 6' | 'Cat 6A' | null;
    vertices: [number, number][];
    expected_version?: number;
}
export interface MapConnection extends MapConnectionPayload {
    route_objects?: RouteObject[];
    id: number;
    company_id: number;
    owner_user_id: number | null;
    source: MapEndpointDetail;
    target: MapEndpointDetail;
    geometry: GeoJSON.LineString | null;
    geometry_token: string;
    length_m: number | null;
    position_missing: boolean;
    can_manage: boolean;
    version: number;
    created_at: string;
    updated_at: string;
}
export interface MapConnectionSplitPayload {
    expected_version: number;
    expected_geometry_token: string;
    segment_index: number;
    fraction: number;
    position: { latitude: number; longitude: number };
    marker: MapMarkerAppearance & { name: string; description: string | null; point_type?: RouteNodeType };
}
export type RoutePointPayload = Omit<MapConnectionSplitPayload, 'marker'>;
export interface MapRouteObjectPayload extends RoutePointPayload {
    marker: MapMarkerAppearance & { name: string; description: string | null; point_type: RoutePassThroughType };
    installation_after?: InstallationMethod | null;
}
export interface MapRouteObjectResponse { marker: MapMarker; connection: MapConnection }
export interface MapInstallationBoundaryPayload extends RoutePointPayload {
    installation_after: InstallationMethod; until: 'end' | 'next_vertex';
}
export interface MapConnectionSplitResponse {
    marker: MapMarker;
    connections: [MapConnection, MapConnection];
}
export interface MapStylePreset {
    id: number;
    company_id: number;
    owner_user_id: number;
    name: string;
    appearance: MapMarkerAppearance;
    version: number;
    created_at: string;
    updated_at: string;
}
export type MapConnectionDraft = Omit<MapConnectionPayload, 'source' | 'target'> & {
    source: MapEndpointDetail | null;
    target: MapEndpointDetail | null;
};
export function createConnectionDraft(visibility: MapVisibility = 'private'): MapConnectionDraft {
    return { source: null, target: null, visibility, name: '', description: null, medium: 'fiber', status: 'planned', fiber_count: null, category: null, vertices: [] };
}
export interface BuildingBindingConflict {
    code: 'building_binding_conflict';
    message: string;
    confirmation_token: string;
    snapshot: {
        marker: { id: number; version: number; name: string; building_id: number | null } | null;
        previous_building: { id: number; address: string; position: unknown } | null;
        target_building: { id: number; address: string; position: { latitude: number | null; longitude: number | null } };
        previous_marker: { id: number; version: number; name: string } | null;
        requested_name: string;
        requested_position: { latitude: number; longitude: number } | null;
    };
}
