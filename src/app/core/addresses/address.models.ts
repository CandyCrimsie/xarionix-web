export type AddressTypeCategory =
    | 'country'
    | 'region'
    | 'locality'
    | 'area'
    | 'thoroughfare';


export interface AddressType {
    id: number;
    code: string;
    category: AddressTypeCategory;
    name: string;
    short_name: string | null;
    sort_order: number;
    is_system: boolean;
    created_at: string;
    updated_at: string;
}


export interface AddressObject {
    id: number;
    parent_id: number | null;
    type_id: number;
    type_code: string;
    type_category: AddressTypeCategory;
    type_name: string;
    type_short_name: string | null;
    name: string;
    created_at: string;
    updated_at: string;
}


export interface AddressObjectTree extends AddressObject {
    children: AddressObjectTree[];
}


export interface AddressObjectCreate {
    parent_id: number | null;
    type_id: number;
    name: string;
}


export interface AddressObjectUpdate {
    parent_id?: number | null;
    type_id?: number;
    name?: string;
}


export interface Building {
    id: number;
    address_object_id: number;
    number: string;
    corpus: string | null;
    structure: string | null;
    latitude: string | number | null;
    longitude: string | number | null;
    full_address: string;
    created_at: string;
    updated_at: string;
}


export interface BuildingCreate {
    address_object_id: number;
    number: string;
    corpus: string | null;
    structure: string | null;
    latitude: number | null;
    longitude: number | null;
}


export type BuildingUpdate = Partial<BuildingCreate>;


export interface Entrance {
    id: number;
    building_id: number;
    number: string;
    created_at: string;
    updated_at: string;
}


export interface Location {
    id: number;
    company_id: number;
    building_id: number;
    entrance_id: number | null;
    floor: string | null;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}


export interface LocationCreate {
    building_id: number;
    entrance_id: number | null;
    floor: string | null;
    name: string;
    description: string | null;
}


export type LocationUpdate = Partial<LocationCreate>;


export interface AddressSearchResult {
    items: Building[];
    total: number;
    limit: number;
    offset: number;
}
