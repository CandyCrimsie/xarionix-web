import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddressApiService } from '../../core/addresses/address-api.service';
import type {
    AddressObject,
    AddressType,
    Building,
    Entrance,
    Location,
} from '../../core/addresses/address.models';
import { CompanyContextService } from '../../core/company/company-context.service';
import {
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';
import { PermissionService } from '../../core/permissions/permission.service';
import { Addresses } from './addresses';


describe('Addresses', () => {
    let fixture: ComponentFixture<Addresses>;
    let component: Addresses;

    const activeCompanyId = signal<number | null>(1);
    const canRead = signal(true);
    const canManage = signal(true);

    const cityType: AddressType = {
        id: 1,
        code: 'city',
        category: 'locality',
        name: 'Город',
        short_name: 'г.',
        sort_order: 30,
        is_system: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };
    const districtType: AddressType = {
        ...cityType,
        id: 2,
        code: 'district',
        category: 'area',
        name: 'Район',
        short_name: 'р-н',
    };
    const streetType: AddressType = {
        ...cityType,
        id: 3,
        code: 'street',
        category: 'thoroughfare',
        name: 'Улица',
        short_name: 'ул.',
    };
    const city: AddressObject = {
        id: 10,
        parent_id: null,
        type_id: cityType.id,
        type_code: cityType.code,
        type_category: cityType.category,
        type_name: cityType.name,
        type_short_name: cityType.short_name,
        name: 'Москва',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };
    const district: AddressObject = {
        ...city,
        id: 11,
        parent_id: city.id,
        type_id: districtType.id,
        type_code: districtType.code,
        type_category: districtType.category,
        type_name: districtType.name,
        type_short_name: districtType.short_name,
        name: 'Академический район',
    };
    const street: AddressObject = {
        ...city,
        id: 12,
        parent_id: city.id,
        type_id: streetType.id,
        type_code: streetType.code,
        type_category: streetType.category,
        type_name: streetType.name,
        type_short_name: streetType.short_name,
        name: 'Дмитрия Ульянова',
    };
    const building: Building = {
        id: 20,
        address_object_id: street.id,
        number: '15',
        corpus: '2',
        structure: null,
        latitude: null,
        longitude: null,
        full_address: 'Москва, ул. Дмитрия Ульянова, д. 15, корп. 2',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };
    const entrance: Entrance = {
        id: 30,
        building_id: building.id,
        number: '1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };
    const location: Location = {
        id: 40,
        company_id: 1,
        building_id: building.id,
        entrance_id: entrance.id,
        floor: '9',
        name: 'Технический шкаф',
        description: 'Возле лифтовой шахты',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };

    const addressApi = {
        listTypes: vi.fn(),
        listObjects: vi.fn(),
        getObject: vi.fn(),
        createObject: vi.fn(),
        updateObject: vi.fn(),
        deleteObject: vi.fn(),
        listBuildings: vi.fn(),
        getBuilding: vi.fn(),
        createBuilding: vi.fn(),
        updateBuilding: vi.fn(),
        deleteBuilding: vi.fn(),
        listEntrances: vi.fn(),
        createEntrance: vi.fn(),
        updateEntrance: vi.fn(),
        deleteEntrance: vi.fn(),
        listLocations: vi.fn(),
        createLocation: vi.fn(),
        updateLocation: vi.fn(),
        deleteLocation: vi.fn(),
        search: vi.fn(),
    };

    const permissions = {
        canSignal: vi.fn((code: PermissionCode, scope?: PermissionScope) => {
            expect(scope).toBe(PermissionScope.Company);
            return code === PermissionCode.AddressesRead
                ? canRead.asReadonly()
                : canManage.asReadonly();
        }),
    };


    beforeEach(async () => {
        vi.clearAllMocks();
        activeCompanyId.set(1);
        canRead.set(true);
        canManage.set(true);
        addressApi.listTypes.mockReturnValue(of([cityType, districtType, streetType]));
        addressApi.listObjects.mockImplementation((parentId?: number) => of(
            parentId === city.id ? [district, street] : [city],
        ));
        addressApi.listBuildings.mockReturnValue(of([building]));
        addressApi.listEntrances.mockReturnValue(of([entrance]));
        addressApi.listLocations.mockReturnValue(of([location]));
        addressApi.search.mockReturnValue(of({ items: [], total: 0, limit: 20, offset: 0 }));

        await TestBed.configureTestingModule({
            imports: [Addresses],
            providers: [
                { provide: AddressApiService, useValue: addressApi },
                {
                    provide: CompanyContextService,
                    useValue: {
                        activeCompanyId: activeCompanyId.asReadonly(),
                    },
                },
                { provide: PermissionService, useValue: permissions },
            ],
        }).compileComponents();
    });


    function createComponent(): void {
        fixture = TestBed.createComponent(Addresses);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }


    it('should load roots and lazy children', () => {
        createComponent();
        expect(fixture.nativeElement.querySelector('[data-testid="address-object-10"]')).not.toBeNull();

        component.toggleNode(component.roots()[0]);
        fixture.detectChanges();

        expect(addressApi.listObjects).toHaveBeenCalledWith(10);
        expect(fixture.nativeElement.textContent).toContain('Академический район');
        expect(fixture.nativeElement.textContent).toContain('Дмитрия Ульянова');
    });


    it('should show loading, error and retry states', () => {
        const pending = new Subject<AddressType[]>();
        addressApi.listTypes.mockReturnValue(pending);
        createComponent();
        expect(fixture.nativeElement.querySelector('[data-testid="addresses-loading"]')).not.toBeNull();

        pending.error(new Error('failed'));
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-testid="addresses-error"]')).not.toBeNull();

        addressApi.listTypes.mockReturnValue(of([cityType, districtType, streetType]));
        fixture.nativeElement.querySelector('[data-testid="addresses-retry"]')?.click();
        fixture.detectChanges();
        expect(addressApi.listTypes).toHaveBeenCalledTimes(2);
    });


    it('should load building details for a selected street', () => {
        createComponent();
        component.selectObject(street);
        component.selectBuilding(building);
        fixture.detectChanges();

        expect(addressApi.listBuildings).toHaveBeenCalledWith(street.id);
        expect(addressApi.listEntrances).toHaveBeenCalledWith(building.id);
        expect(addressApi.listLocations).toHaveBeenCalledWith(building.id);
        expect(fixture.nativeElement.textContent).toContain(building.full_address);
        expect(fixture.nativeElement.textContent).toContain('Технический шкаф');
    });


    it('should create a normalized building and reject invalid input first', () => {
        createComponent();
        component.selectObject(street);
        component.startCreateBuilding();
        const dialog = { close: vi.fn() };

        component.saveBuilding(dialog as never);
        expect(addressApi.createBuilding).not.toHaveBeenCalled();
        expect(component.buildingError()).toBe('Укажите номер дома');

        addressApi.createBuilding.mockReturnValue(of(building));
        component.buildingNumber.set(' 15 ');
        component.buildingCorpus.set(' 2 ');
        component.buildingLatitude.set('55,1234567');
        component.buildingLongitude.set('37.1234567');
        component.saveBuilding(dialog as never);

        expect(addressApi.createBuilding).toHaveBeenCalledWith({
            address_object_id: street.id,
            number: '15',
            corpus: '2',
            structure: null,
            latitude: 55.1234567,
            longitude: 37.1234567,
        });
        expect(dialog.close).toHaveBeenCalled();
    });


    it('should edit a building', () => {
        createComponent();
        component.selectObject(street);
        component.startEditBuilding(building);
        component.buildingNumber.set('17');
        addressApi.updateBuilding.mockReturnValue(of({ ...building, number: '17' }));

        component.saveBuilding({ close: vi.fn() } as never);
        expect(addressApi.updateBuilding).toHaveBeenCalledWith(
            building.id,
            expect.objectContaining({ number: '17' }),
        );
    });


    it('should create an entrance and a company location', () => {
        createComponent();
        component.selectBuilding(building);
        addressApi.createEntrance.mockReturnValue(of(entrance));
        component.startCreateEntrance();
        component.entranceNumber.set(' 1 ');
        component.saveEntrance({ close: vi.fn() } as never);
        expect(addressApi.createEntrance).toHaveBeenCalledWith(building.id, '1');

        addressApi.createLocation.mockReturnValue(of(location));
        component.startCreateLocation();
        component.locationEntranceId.set(entrance.id);
        component.locationFloor.set(' 9 ');
        component.locationName.set(' Технический   шкаф ');
        component.saveLocation({ close: vi.fn() } as never);
        expect(addressApi.createLocation).toHaveBeenCalledWith({
            building_id: building.id,
            entrance_id: entrance.id,
            floor: '9',
            name: 'Технический шкаф',
            description: null,
        });
    });


    it('should search on backend and render an empty state', () => {
        createComponent();
        component.searchQuery.set('Ленина 15');
        component.search();
        fixture.detectChanges();
        expect(addressApi.search).toHaveBeenCalledWith('Ленина 15');
        expect(fixture.nativeElement.querySelector('[data-testid="address-search-empty"]')).not.toBeNull();
    });


    it('should hide management controls for read-only users', () => {
        canManage.set(false);
        createComponent();
        component.selectObject(street);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[data-testid="create-root-address-action"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('[data-testid="create-building-action"]')).toBeNull();
    });


    it('should reload and clear company locations on company context change', () => {
        createComponent();
        component.selectObject(street);
        component.selectBuilding(building);
        expect(component.locations()).toEqual([location]);

        activeCompanyId.set(2);
        fixture.detectChanges();
        expect(addressApi.listTypes).toHaveBeenCalledTimes(2);
        expect(component.selectedBuilding()).toBeNull();
        expect(component.locations()).toEqual([]);
    });


    it('should display backend conflicts without repeating a request', () => {
        createComponent();
        component.selectObject(street);
        component.startCreateBuilding();
        component.buildingNumber.set('15');
        addressApi.createBuilding.mockReturnValue(throwError(() => new HttpErrorResponse({
            status: 409,
            error: { detail: 'An identical address record already exists' },
        })));
        component.saveBuilding({ close: vi.fn() } as never);
        expect(component.buildingError()).toBe('Такая запись уже существует');
        expect(addressApi.createBuilding).toHaveBeenCalledTimes(1);
    });
});
