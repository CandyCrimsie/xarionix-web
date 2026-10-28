import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/api/api.config';
import type { MapConnection, MapConnectionPayload, MapConnectionSplitPayload, MapConnectionSplitResponse, MapEndpointDetail, MapMarkerAppearance, MapStylePreset } from '../models/map.models';
import type {
    MapAddressObjectBounds,
    MapBounds,
    MapBuildingFeatureCollection,
    MapMarker,
    MapMarkerPayload,
    MapMarkerUpdate,
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


    getMarkers(bounds?: MapBounds): Observable<MapMarker[]> {
        const params = bounds
            ? new HttpParams()
                .set('west', bounds.west)
                .set('south', bounds.south)
                .set('east', bounds.east)
                .set('north', bounds.north)
            : undefined;
        return this.http.get<MapMarker[]>(
            `${API_BASE_URL}/map/markers`,
            params ? { params } : undefined,
        );
    }


    getMarker(id: number): Observable<MapMarker> {
        return this.http.get<MapMarker>(`${API_BASE_URL}/map/markers/${id}`);
    }

    getBuildingMarker(id: number): Observable<MapMarker | null> {
        return this.http.get<MapMarker | null>(`${API_BASE_URL}/map/buildings/${id}/marker`);
    }


    createMarker(data: MapMarkerPayload): Observable<MapMarker> {
        return this.http.post<MapMarker>(`${API_BASE_URL}/map/markers`, data);
    }


    updateMarker(id: number, data: MapMarkerUpdate): Observable<MapMarker> {
        return this.http.patch<MapMarker>(
            `${API_BASE_URL}/map/markers/${id}`,
            data,
        );
    }


    deleteMarker(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/map/markers/${id}`);
    }

    searchEndpoints(q: string, offset = 0) {
        return this.http.get<{ items: MapEndpointDetail[]; has_more: boolean; offset: number; limit: number }>(
            `${API_BASE_URL}/map/endpoints`, { params: { q, offset, limit: 20 } },
        );
    }

    getConnections(bounds?: MapBounds, endpoint?: { kind: 'building' | 'marker'; id: number }): Observable<MapConnection[]> {
        const params: Record<string, string | number> = { ...(bounds ?? {}) };
        if (endpoint) Object.assign(params, { endpoint_kind: endpoint.kind, endpoint_id: endpoint.id });
        return this.http.get<MapConnection[]>(`${API_BASE_URL}/map/connections`, { params });
    }

    createConnection(data: MapConnectionPayload): Observable<MapConnection> {
        return this.http.post<MapConnection>(`${API_BASE_URL}/map/connections`, data);
    }

    updateConnection(id: number, data: MapConnectionPayload): Observable<MapConnection> {
        return this.http.patch<MapConnection>(`${API_BASE_URL}/map/connections/${id}`, data);
    }

    deleteConnection(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/map/connections/${id}`);
    }

    splitConnection(id: number, data: MapConnectionSplitPayload): Observable<MapConnectionSplitResponse> {
        return this.http.post<MapConnectionSplitResponse>(`${API_BASE_URL}/map/connections/${id}/split`, data);
    }

    getStyles(): Observable<MapStylePreset[]> {
        return this.http.get<MapStylePreset[]>(`${API_BASE_URL}/map/marker-styles`);
    }

    createStyle(name: string, appearance: MapMarkerAppearance): Observable<MapStylePreset> {
        return this.http.post<MapStylePreset>(`${API_BASE_URL}/map/marker-styles`, { name, appearance });
    }

    updateStyle(style: MapStylePreset, name: string, appearance: MapMarkerAppearance): Observable<MapStylePreset> {
        return this.http.patch<MapStylePreset>(`${API_BASE_URL}/map/marker-styles/${style.id}`, { name, appearance, expected_version: style.version });
    }

    deleteStyle(id: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/map/marker-styles/${id}`);
    }
}
