import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/api/api.config';
import type {
    MapAddressObjectBounds,
    MapBounds,
    MapBuildingFeatureCollection,
    MapTileSession,
} from '../models/map.models';


@Injectable({ providedIn: 'root' })
export class MapDataService {
    private readonly http = inject(HttpClient);


    createTileSession(): Observable<MapTileSession> {
        return this.http.get<MapTileSession>(`${API_BASE_URL}/map/session`);
    }


    getBuildings(bounds: MapBounds): Observable<MapBuildingFeatureCollection> {
        const params = new HttpParams()
            .set('west', bounds.west)
            .set('south', bounds.south)
            .set('east', bounds.east)
            .set('north', bounds.north);
        return this.http.get<MapBuildingFeatureCollection>(
            `${API_BASE_URL}/map/buildings`,
            { params },
        );
    }


    getAddressObjectBounds(id: number): Observable<MapAddressObjectBounds> {
        return this.http.get<MapAddressObjectBounds>(
            `${API_BASE_URL}/map/address-objects/${id}/bounds`,
        );
    }
}
