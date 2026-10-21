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


export interface MapMarkerPayload {
    building_id: number | null;
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
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
    id: number;
    company_id: number;
    created_at: string;
    updated_at: string;
}


export type MapMarkerUpdate = Partial<MapMarkerPayload>;
