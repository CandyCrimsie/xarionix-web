import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AddressApiService } from './address-api.service';


describe('AddressApiService', () => {
    let service: AddressApiService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });
        service = TestBed.inject(AddressApiService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('should use lazy address object endpoints', () => {
        service.listTypes().subscribe();
        const types = http.expectOne('/api/v1/address-types');
        expect(types.request.method).toBe('GET');
        types.flush([]);

        service.listObjects().subscribe();
        const roots = http.expectOne('/api/v1/address-objects');
        expect(roots.request.method).toBe('GET');
        roots.flush([]);

        service.listObjects(12).subscribe();
        const children = http.expectOne(
            '/api/v1/address-objects?parent_id=12',
        );
        expect(children.request.method).toBe('GET');
        children.flush([]);
    });

    it('should use address CRUD endpoints', () => {
        service.createObject({
            parent_id: 1,
            type_id: 3,
            name: 'Ленина',
        }).subscribe();
        const createObject = http.expectOne('/api/v1/address-objects');
        expect(createObject.request.method).toBe('POST');
        createObject.flush({});

        service.updateObject(2, { name: 'Гагарина' }).subscribe();
        const updateObject = http.expectOne('/api/v1/address-objects/2');
        expect(updateObject.request.method).toBe('PATCH');
        updateObject.flush({});

        service.createBuilding({
            address_object_id: 2,
            number: '15',
            corpus: null,
            structure: null,
            latitude: null,
            longitude: null,
        }).subscribe();
        const building = http.expectOne(
            '/api/v1/address-objects/2/buildings',
        );
        expect(building.request.method).toBe('POST');
        building.flush({});

        service.createEntrance(7, '1').subscribe();
        const entrance = http.expectOne('/api/v1/buildings/7/entrances');
        expect(entrance.request.body).toEqual({ number: '1' });
        entrance.flush({});

        service.createLocation({
            building_id: 7,
            entrance_id: null,
            floor: '-1',
            name: 'Подвал',
            description: null,
        }).subscribe();
        const location = http.expectOne('/api/v1/locations');
        expect(location.request.method).toBe('POST');
        location.flush({});
    });

    it('should search on the backend with pagination', () => {
        service.search('Москва Ленина 15', 10, 20).subscribe();
        const request = http.expectOne(
            '/api/v1/addresses/search?q=%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%20%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2015&limit=10&offset=20',
        );
        expect(request.request.method).toBe('GET');
        request.flush({ items: [], total: 0, limit: 10, offset: 20 });
    });
});
