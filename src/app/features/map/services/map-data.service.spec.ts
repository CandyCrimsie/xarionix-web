import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MapDataService } from './map-data.service';
import { createDefaultMapMarker } from '../map-marker.config';
import { pickMarkerAppearance } from '../map-marker.config';


describe('MapDataService', () => {
    let service: MapDataService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        });
        service = TestBed.inject(MapDataService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('sends a typed atomic split snapshot without client ownership or company fields', () => {
        const payload = { expected_version: 3, expected_geometry_token: 'a'.repeat(64), segment_index: 1, fraction: .37,
            position: { latitude: 55.58, longitude: 38.25 }, marker: { ...pickMarkerAppearance(createDefaultMapMarker()), name: 'Муфта', description: null } };
        service.splitConnection(17, payload).subscribe();
        const request = http.expectOne('/api/v1/map/connections/17/split');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual(payload);
        expect(request.request.body).not.toHaveProperty('company_id');
        request.flush({ marker: { id: 99 }, connections: [{ id: 17 }, { id: 18 }] });
    });

    it('requests a protected tile session without an API key in the browser URL', () => {
        service.createTileSession().subscribe();
        const request = http.expectOne('/api/v1/map/session');
        expect(request.request.method).toBe('GET');
        expect(request.request.urlWithParams).not.toContain('apikey');
        request.flush({
            tile_url_template: '/map/tiles/{z}/{x}/{y}.png?expires=1&signature=test',
            expires_at: 1,
            min_zoom: 0,
            max_zoom: 20,
            tile_size: 256,
            default_latitude: 55.7558,
            default_longitude: 37.6176,
            default_zoom: 10,
        });
    });

    it('sends viewport bounds and loads address-object bounds', () => {
        service.getBuildings({ west: 37, south: 55, east: 38, north: 56 }).subscribe();
        const buildings = http.expectOne(
            '/api/v1/map/buildings?west=37&south=55&east=38&north=56',
        );
        expect(buildings.request.method).toBe('GET');
        buildings.flush({ type: 'FeatureCollection', features: [] });

        service.getAddressObjectBounds(42).subscribe();
        const bounds = http.expectOne('/api/v1/map/address-objects/42/bounds');
        expect(bounds.request.method).toBe('GET');
        bounds.flush({ bounds: null, building_count: 0 });
    });

    it('uses company-scoped marker CRUD endpoints and viewport parameters', () => {
        const payload = {
            ...createDefaultMapMarker(55.577276, 38.245099),
            name: 'Узел связи №1',
        };
        service.getMarkers({ west: 38, south: 55, east: 39, north: 56 }).subscribe();
        const list = http.expectOne(
            '/api/v1/map/markers?west=38&south=55&east=39&north=56',
        );
        expect(list.request.method).toBe('GET');
        list.flush([]);

        service.createMarker(payload).subscribe();
        const create = http.expectOne('/api/v1/map/markers');
        expect(create.request.method).toBe('POST');
        expect(create.request.body).toEqual(payload);
        create.flush({ id: 1, company_id: 1, ...payload });

        service.updateMarker(1, { name: 'Новый узел' }).subscribe();
        const update = http.expectOne('/api/v1/map/markers/1');
        expect(update.request.method).toBe('PATCH');
        expect(update.request.body).toEqual({ name: 'Новый узел' });
        update.flush({ id: 1, company_id: 1, ...payload, name: 'Новый узел' });

        service.deleteMarker(1).subscribe();
        const remove = http.expectOne('/api/v1/map/markers/1');
        expect(remove.request.method).toBe('DELETE');
        remove.flush(null);
    });

    it('sends an explicit primary role and canonical position operation, not the legacy sync flag', () => {
        service.createMarker({
            ...createDefaultMapMarker(55.577276, 38.245099),
            name: 'Дом 53', building_id: 20, building_link_role: 'represents', point_type: 'building', visibility: 'company',
            building_position: { latitude: 55.577276, longitude: 38.245099 },
        }).subscribe();
        const create = http.expectOne('/api/v1/map/markers');
        expect(create.request.body).toEqual(expect.objectContaining({
            building_id: 20, building_link_role: 'represents', sync_building_coordinates: false,
            building_position: { latitude: 55.577276, longitude: 38.245099 },
        }));
        create.flush({ id: 1, ...create.request.body });
        service.updateMarker(1, { sync_building_coordinates: false }).subscribe();
        const update = http.expectOne('/api/v1/map/markers/1');
        expect(update.request.body).toEqual({ sync_building_coordinates: false });
        update.flush({ id: 1, ...create.request.body, sync_building_coordinates: false });
    });

    it('uses the protected typed graph and personal style contracts', () => {
        service.searchEndpoints('Дом', 20).subscribe();
        http.expectOne('/api/v1/map/endpoints?q=%D0%94%D0%BE%D0%BC&offset=20&limit=20').flush({ items: [], has_more: false });
        service.getConnections({ west: 38, south: 55, east: 39, north: 56 }).subscribe();
        http.expectOne('/api/v1/map/connections?west=38&south=55&east=39&north=56').flush([]);
        service.getConnections(undefined, { kind: 'marker', id: 1 }).subscribe();
        http.expectOne('/api/v1/map/connections?endpoint_kind=marker&endpoint_id=1').flush([]);
        service.getBuildingMarker(42).subscribe();
        http.expectOne('/api/v1/map/buildings/42/marker').flush(null);
        service.getStyles().subscribe();
        http.expectOne('/api/v1/map/marker-styles').flush([]);
        service.deleteConnection(1).subscribe();
        const remove = http.expectOne('/api/v1/map/connections/1');
        expect(remove.request.method).toBe('DELETE'); remove.flush(null);
        service.deleteStyle(1).subscribe();
        const preset = http.expectOne('/api/v1/map/marker-styles/1');
        expect(preset.request.method).toBe('DELETE'); preset.flush(null);
    });
});
