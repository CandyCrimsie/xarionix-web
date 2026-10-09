import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api/api.config';
import type {
    AddressObject,
    AddressObjectCreate,
    AddressObjectTree,
    AddressObjectUpdate,
    AddressSearchResult,
    AddressType,
    Building,
    BuildingCreate,
    BuildingUpdate,
    Entrance,
    Location,
    LocationCreate,
    LocationUpdate,
} from './address.models';


@Injectable({ providedIn: 'root' })
export class AddressApiService {
    private readonly http = inject(HttpClient);


    listTypes(): Observable<AddressType[]> {
        return this.http.get<AddressType[]>(
            `${API_BASE_URL}/address-types`,
        );
    }


    listObjects(
        parentId: number | null = null,
    ): Observable<AddressObject[]> {
        const options = parentId === null
            ? undefined
            : {
                params: new HttpParams().set(
                    'parent_id',
                    parentId,
                ),
            };
        return this.http.get<AddressObject[]>(
            `${API_BASE_URL}/address-objects`,
            options,
        );
    }


    getTree(): Observable<AddressObjectTree[]> {
        return this.http.get<AddressObjectTree[]>(
            `${API_BASE_URL}/address-objects/tree`,
        );
    }


    getObject(id: number): Observable<AddressObject> {
        return this.http.get<AddressObject>(
            `${API_BASE_URL}/address-objects/${id}`,
        );
    }


    createObject(data: AddressObjectCreate): Observable<AddressObject> {
        return this.http.post<AddressObject>(
            `${API_BASE_URL}/address-objects`,
            data,
        );
    }


    updateObject(
        id: number,
        data: AddressObjectUpdate,
    ): Observable<AddressObject> {
        return this.http.patch<AddressObject>(
            `${API_BASE_URL}/address-objects/${id}`,
            data,
        );
    }


    deleteObject(id: number): Observable<void> {
        return this.http.delete<void>(
            `${API_BASE_URL}/address-objects/${id}`,
        );
    }


    listBuildings(addressObjectId: number): Observable<Building[]> {
        return this.http.get<Building[]>(
            `${API_BASE_URL}/address-objects/${addressObjectId}/buildings`,
        );
    }


    getBuilding(id: number): Observable<Building> {
        return this.http.get<Building>(
            `${API_BASE_URL}/buildings/${id}`,
        );
    }


    createBuilding(data: BuildingCreate): Observable<Building> {
        return this.http.post<Building>(
            `${API_BASE_URL}/address-objects/${data.address_object_id}/buildings`,
            data,
        );
    }


    updateBuilding(
        id: number,
        data: BuildingUpdate,
    ): Observable<Building> {
        return this.http.patch<Building>(
            `${API_BASE_URL}/buildings/${id}`,
            data,
        );
    }


    deleteBuilding(id: number): Observable<void> {
        return this.http.delete<void>(
            `${API_BASE_URL}/buildings/${id}`,
        );
    }


    listEntrances(buildingId: number): Observable<Entrance[]> {
        return this.http.get<Entrance[]>(
            `${API_BASE_URL}/buildings/${buildingId}/entrances`,
        );
    }


    createEntrance(
        buildingId: number,
        number: string,
    ): Observable<Entrance> {
        return this.http.post<Entrance>(
            `${API_BASE_URL}/buildings/${buildingId}/entrances`,
            { number },
        );
    }


    updateEntrance(
        id: number,
        number: string,
    ): Observable<Entrance> {
        return this.http.patch<Entrance>(
            `${API_BASE_URL}/entrances/${id}`,
            { number },
        );
    }


    deleteEntrance(id: number): Observable<void> {
        return this.http.delete<void>(
            `${API_BASE_URL}/entrances/${id}`,
        );
    }


    listLocations(buildingId: number): Observable<Location[]> {
        return this.http.get<Location[]>(
            `${API_BASE_URL}/buildings/${buildingId}/locations`,
        );
    }


    createLocation(data: LocationCreate): Observable<Location> {
        return this.http.post<Location>(
            `${API_BASE_URL}/locations`,
            data,
        );
    }


    updateLocation(
        id: number,
        data: LocationUpdate,
    ): Observable<Location> {
        return this.http.patch<Location>(
            `${API_BASE_URL}/locations/${id}`,
            data,
        );
    }


    deleteLocation(id: number): Observable<void> {
        return this.http.delete<void>(
            `${API_BASE_URL}/locations/${id}`,
        );
    }


    search(
        query: string,
        limit = 20,
        offset = 0,
    ): Observable<AddressSearchResult> {
        const params = new HttpParams()
            .set('q', query)
            .set('limit', limit)
            .set('offset', offset);
        return this.http.get<AddressSearchResult>(
            `${API_BASE_URL}/addresses/search`,
            { params },
        );
    }
}
