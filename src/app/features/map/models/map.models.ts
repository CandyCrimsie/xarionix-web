import type { FeatureCollection, Point } from 'geojson';


export interface MapTileSession {
    tile_url_template: string;
    expires_at: number;
    min_zoom: number;
    max_zoom: number;
    tile_size: number;
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
