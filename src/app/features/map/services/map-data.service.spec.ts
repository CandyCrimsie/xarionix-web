import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MapDataService } from './map-data.service';


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
});
