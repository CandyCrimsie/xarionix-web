import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MapDataService } from './map-data.service';
import { createDefaultMapMarker } from '../map-marker.config';
import { pickMarkerAppearance } from '../map-marker.config';
import { defaultMapSettings, type MapLayer } from '../models/map-workspace.models';
import type {MapConnection} from '../models/map.models';


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

    it('serializes layer OR filters and explicit empty point selection before viewport limits', () => {
        service.getConnections(undefined, { kind: 'building', id: 42 }, {
            layers_active: true, layer_ids: [2, 7], include_unassigned: false,
            point_types: [], point_types_enabled: true, medium: 'fiber', status: 'active', installation: 'duct',
        }).subscribe();
        const request = http.expectOne(req => req.url === '/api/v1/map/connections');
        expect(request.request.params.getAll('layer_ids')).toEqual(['2', '7']);
        expect(request.request.params.get('include_unassigned')).toBe('false');
        expect(request.request.params.get('point_types_enabled')).toBe('true');
        expect(request.request.params.get('endpoint_id')).toBe('42'); request.flush([]);
    });
    it('edits a boundary through PATCH with the frozen revision and geometry snapshot',()=>{
        const line={id:17,version:4,geometry_token:'a'.repeat(64)} as MapConnection;
        service.editInstallationBoundary(line,2,{operation:'remove',keep:'next'}).subscribe();
        const request=http.expectOne('/api/v1/map/connections/17/installation-boundaries/2');
        expect(request.request.method).toBe('PATCH');
        expect(request.request.body).toEqual({operation:'remove',keep:'next',expected_version:4,expected_geometry_token:line.geometry_token});request.flush({});
    });

    it('sends revisions for metadata and deletion, without client company or unknown layer fields', () => {
        const layer: MapLayer = { id: 3, version: 7, name: 'Север', parent_id: null, mode: 'manual', rules: {}, sort_order: 0 };
        service.updateLayer(layer, layer).subscribe();
        const patch = http.expectOne('/api/v1/map/layers/3');
        expect(patch.request.body).toEqual({ name: 'Север', parent_id: null, mode: 'manual', rules: {}, sort_order: 0, expected_version: 7 }); patch.flush(layer);
        service.setLayerMember(layer, { kind: 'marker', id: 42 }, true).subscribe();
        const member = http.expectOne('/api/v1/map/layers/3/members');
        expect(member.request.body).toEqual({ expected_version: 7, target: { kind: 'marker', id: 42 }, present: true }); member.flush(layer);
        service.savePreferences(defaultMapSettings(), 5).subscribe();
        const prefs = http.expectOne('/api/v1/map/preferences'); expect(prefs.request.body.expected_version).toBe(5); prefs.flush({});
        service.deleteMarker(42, 3).subscribe(); http.expectOne('/api/v1/map/markers/42?expected_version=3').flush(null);
        service.getDependencies({ kind: 'marker', id: 42 }).subscribe(); http.expectOne('/api/v1/map/objects/marker/42/dependencies').flush({ dependencies: [] });
    });

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

    it('uses distinct protected contracts for pass-through objects, boundaries and explicit detach', () => {
        const point = { expected_version: 3, expected_geometry_token: 'a'.repeat(64), segment_index: 0, fraction: .5, position: { latitude: 55, longitude: 38 } };
        const payload = { ...point, marker: { ...pickMarkerAppearance(createDefaultMapMarker()), point_type: 'chamber' as const, name: 'Колодец', description: null } };
        service.placeRouteObject(17, payload).subscribe();
        const place = http.expectOne('/api/v1/map/connections/17/route-objects');
        expect(place.request.method).toBe('POST'); expect(place.request.body).toEqual(payload);
        place.flush({ marker: { id: 91 }, connection: { id: 17 } });
        service.setInstallationBoundary(17, { ...point, installation_after: 'duct', until: 'end' }).subscribe();
        const boundary = http.expectOne('/api/v1/map/connections/17/installation-boundaries');
        expect(boundary.request.body).not.toHaveProperty('marker'); boundary.flush({ id: 17 });
        service.detachRouteObject({ id: 17, version: 3, geometry_token: point.expected_geometry_token } as any, 91).subscribe();
        const detach = http.expectOne('/api/v1/map/connections/17/route-objects/91/detach');
        expect(detach.request.body).toEqual({ expected_version: 3, expected_geometry_token: point.expected_geometry_token });
        detach.flush({ marker: { id: 91 }, connection: { id: 17 } });
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
