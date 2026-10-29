import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/api/api.config';
import type { DependencyReport, LayerDraft, MapLayer, MapPassport, MapPreference, MapQuery, MapSettings, MapTarget, PassportWrite } from '../models/map-workspace.models';
import type { MapConnection, MapConnectionPayload, MapConnectionSplitPayload, MapConnectionSplitResponse, MapEndpointDetail, MapMarkerAppearance, MapStylePreset, MapRouteObjectPayload, MapRouteObjectResponse, MapInstallationBoundaryPayload } from '../models/map.models';
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


    getBuildings(bounds: MapBounds, filters?: MapQuery): Observable<MapBuildingFeatureCollection> {
        const params = this.queryParams(new HttpParams()
            .set('west', bounds.west)
            .set('south', bounds.south)
            .set('east', bounds.east)
            .set('north', bounds.north), filters);
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


    getMarkers(bounds?: MapBounds, filters?: MapQuery): Observable<MapMarker[]> {
        const params = this.queryParams(bounds
            ? new HttpParams()
                .set('west', bounds.west)
                .set('south', bounds.south)
                .set('east', bounds.east)
                .set('north', bounds.north)
            : new HttpParams(), filters);
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


    deleteMarker(id: number, expectedVersion?: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/map/markers/${id}`, expectedVersion ? { params: { expected_version: expectedVersion } } : undefined);
    }

    searchEndpoints(q: string, offset = 0) {
        return this.http.get<{ items: MapEndpointDetail[]; has_more: boolean; offset: number; limit: number }>(
            `${API_BASE_URL}/map/endpoints`, { params: { q, offset, limit: 20 } },
        );
    }

    getConnections(bounds?: MapBounds, endpoint?: { kind: 'building' | 'marker'; id: number }, filters?: MapQuery): Observable<MapConnection[]> {
        let params = new HttpParams({ fromObject: { ...(bounds ?? {}) } });
        if (endpoint) params = params.set('endpoint_kind', endpoint.kind).set('endpoint_id', endpoint.id);
        return this.http.get<MapConnection[]>(`${API_BASE_URL}/map/connections`, { params: this.queryParams(params, filters) });
    }

    createConnection(data: MapConnectionPayload): Observable<MapConnection> {
        return this.http.post<MapConnection>(`${API_BASE_URL}/map/connections`, data);
    }

    updateConnection(id: number, data: MapConnectionPayload): Observable<MapConnection> {
        return this.http.patch<MapConnection>(`${API_BASE_URL}/map/connections/${id}`, data);
    }

    deleteConnection(id: number, expectedVersion?: number): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/map/connections/${id}`, expectedVersion ? { params: { expected_version: expectedVersion } } : undefined);
    }

    splitConnection(id: number, data: MapConnectionSplitPayload): Observable<MapConnectionSplitResponse> {
        return this.http.post<MapConnectionSplitResponse>(`${API_BASE_URL}/map/connections/${id}/split`, data);
    }

    placeRouteObject(id: number, data: MapRouteObjectPayload): Observable<MapRouteObjectResponse> {
        return this.http.post<MapRouteObjectResponse>(`${API_BASE_URL}/map/connections/${id}/route-objects`, data);
    }

    setInstallationBoundary(id: number, data: MapInstallationBoundaryPayload): Observable<MapConnection> {
        return this.http.post<MapConnection>(`${API_BASE_URL}/map/connections/${id}/installation-boundaries`, data);
    }

    detachRouteObject(line: MapConnection, markerId: number): Observable<MapRouteObjectResponse> {
        return this.http.post<MapRouteObjectResponse>(`${API_BASE_URL}/map/connections/${line.id}/route-objects/${markerId}/detach`, {
            expected_version: line.version, expected_geometry_token: line.geometry_token,
        });
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

    private queryParams(params: HttpParams, filters?: MapQuery): HttpParams {
        if (!filters) return params;
        for (const [key, value] of Object.entries(filters)) {
            if (Array.isArray(value)) { for (const item of value) params = params.append(key, String(item)); }
            else params = params.set(key, String(value));
        }
        return params;
    }

    getLayers(): Observable<MapLayer[]> { return this.http.get<MapLayer[]>(`${API_BASE_URL}/map/layers`); }
    createLayer(draft: LayerDraft): Observable<MapLayer> { return this.http.post<MapLayer>(`${API_BASE_URL}/map/layers`, draft); }
    updateLayer(layer: MapLayer, draft: LayerDraft): Observable<MapLayer> {
        const { name, parent_id, mode, sort_order, rules } = draft;
        return this.http.patch<MapLayer>(`${API_BASE_URL}/map/layers/${layer.id}`, { name, parent_id, mode, sort_order, rules, expected_version: layer.version });
    }
    deleteLayer(layer: MapLayer): Observable<void> {
        return this.http.delete<void>(`${API_BASE_URL}/map/layers/${layer.id}`, { params: { expected_version: layer.version } });
    }
    setLayerMember(layer: MapLayer, target: MapTarget, present: boolean): Observable<MapLayer> {
        return this.http.put<MapLayer>(`${API_BASE_URL}/map/layers/${layer.id}/members`, { expected_version: layer.version, target, present });
    }
    moveLayer(layer: MapLayer, direction: -1 | 1): Observable<MapLayer[]> {
        return this.http.post<MapLayer[]>(`${API_BASE_URL}/map/layers/${layer.id}/move`, { expected_version: layer.version, direction });
    }
    getTargetLayers(target: MapTarget): Observable<MapLayer[]> { return this.http.get<MapLayer[]>(`${API_BASE_URL}/map/objects/${target.kind}/${target.id}/layers`); }
    getPreferences(): Observable<MapPreference> { return this.http.get<MapPreference>(`${API_BASE_URL}/map/preferences`); }
    savePreferences(settings: MapSettings, expected_version: number): Observable<MapPreference> {
        return this.http.put<MapPreference>(`${API_BASE_URL}/map/preferences`, { settings, expected_version });
    }
    getPassport(target: MapTarget): Observable<MapPassport> { return this.http.get<MapPassport>(`${API_BASE_URL}/map/passports/${target.kind}/${target.id}`); }
    savePassport(target: MapTarget, data: PassportWrite): Observable<MapPassport> { return this.http.put<MapPassport>(`${API_BASE_URL}/map/passports/${target.kind}/${target.id}`, data); }
    getDependencies(target: MapTarget): Observable<DependencyReport> { return this.http.get<DependencyReport>(`${API_BASE_URL}/map/objects/${target.kind}/${target.id}/dependencies`); }
}
