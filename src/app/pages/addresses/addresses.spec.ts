import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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


    async function openDialog(triggerTestId: string): Promise<HTMLElement> {
        const selector = `[data-testid="${triggerTestId}"]`;
        const trigger = (
            fixture.nativeElement.querySelector(selector)
            ?? document.body.querySelector(selector)
        ) as HTMLElement | null;
        expect(trigger).not.toBeNull();
        (trigger?.querySelector('button') ?? trigger)?.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
        expect(dialog).not.toBeNull();
        return dialog as HTMLElement;
    }


    async function openAddressObjectActions(): Promise<HTMLElement> {
        const trigger = fixture.nativeElement.querySelector(
            '[data-testid="address-object-actions"]',
        ) as HTMLElement | null;
        expect(trigger).not.toBeNull();
        (trigger?.querySelector('button') ?? trigger)?.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const menu = document.body.querySelector<HTMLElement>('[role="listbox"]');
        expect(menu).not.toBeNull();
        return menu as HTMLElement;
    }


    function enterValue(element: HTMLInputElement, value: string): void {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
    }


    function addressSearchInput(): HTMLInputElement {
        const input = fixture.nativeElement.querySelector(
            '[data-testid="address-search-input"] input',
        ) as HTMLInputElement | null;
        expect(input).not.toBeNull();
        return input as HTMLInputElement;
    }


    async function closeDialog(dialog: HTMLElement, cancelTestId: string): Promise<void> {
        const cancel = dialog.querySelector<HTMLElement>(`[data-testid="${cancelTestId}"]`);
        expect(cancel).not.toBeNull();
        cancel?.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    }


    afterEach(() => {
        fixture?.destroy();
        vi.useRealTimers();
    });


    it('should load roots and lazy children', () => {
        createComponent();
        expect(fixture.nativeElement.querySelector('[data-testid="address-object-10"]')).not.toBeNull();

        component.toggleNode(component.roots()[0]);
        fixture.detectChanges();

        expect(addressApi.listObjects).toHaveBeenCalledWith(10);
        expect(fixture.nativeElement.textContent).toContain('Академический район');
        expect(fixture.nativeElement.textContent).toContain('Дмитрия Ульянова');
    });


    it('should render the create-root form inside the dialog overlay', async () => {
        createComponent();

        const dialog = await openDialog('create-root-address-action');

        expect(dialog.textContent).toContain('Новый адресный объект');
        expect(dialog.querySelector('[data-testid="address-object-type"]')).not.toBeNull();
        expect(dialog.querySelector('[data-testid="address-object-name"]')).not.toBeNull();
    });


    it('should close the dialog on cancel and open it again', async () => {
        createComponent();
        const firstDialog = await openDialog('create-root-address-action');

        await closeDialog(firstDialog, 'address-object-cancel');

        const secondDialog = await openDialog('create-root-address-action');
        expect(secondDialog.textContent).toContain('Новый адресный объект');

        secondDialog.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
        }));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });


    it('should render the create-building form inside the dialog overlay', async () => {
        createComponent();
        component.selectObject(street);
        fixture.detectChanges();

        const dialog = await openDialog('create-building-action');

        expect(dialog.textContent).toContain('Новое здание');
        expect(dialog.textContent).toContain(street.name);
        expect(dialog.querySelector('[data-testid="building-number"]')).not.toBeNull();
    });


    it('should render child-object and edit-building forms inside the overlay', async () => {
        createComponent();
        component.selectObject(city);
        fixture.detectChanges();

        const childDialog = await openDialog('create-child-address-action');
        expect(childDialog.textContent).toContain('Новый адресный объект');
        expect(childDialog.textContent).toContain(`Родитель: ${city.name}`);
        await closeDialog(childDialog, 'address-object-cancel');

        component.selectObject(street);
        component.selectBuilding(building);
        fixture.detectChanges();
        const buildingDialog = await openDialog('edit-building-action');
        expect(buildingDialog.textContent).toContain('Изменение здания');
        expect(buildingDialog.querySelector<HTMLInputElement>('[data-testid="building-number"]')?.value)
            .toBe(building.number);
        await closeDialog(buildingDialog, 'building-cancel');
    });


    it('should render create and edit forms for entrances and locations', async () => {
        createComponent();
        component.selectObject(street);
        component.selectBuilding(building);
        fixture.detectChanges();

        const createEntranceDialog = await openDialog('create-entrance-action');
        expect(createEntranceDialog.textContent).toContain('Новый подъезд');
        await closeDialog(createEntranceDialog, 'entrance-cancel');

        const editEntranceDialog = await openDialog(`edit-entrance-action-${entrance.id}`);
        expect(editEntranceDialog.textContent).toContain('Изменение подъезда');
        expect(editEntranceDialog.querySelector<HTMLInputElement>('[data-testid="entrance-number"]')?.value)
            .toBe(entrance.number);
        await closeDialog(editEntranceDialog, 'entrance-cancel');

        const createLocationDialog = await openDialog('create-location-action');
        expect(createLocationDialog.textContent).toContain('Новое помещение');
        expect(createLocationDialog.querySelector('[data-testid="location-entrance"]')).not.toBeNull();
        await closeDialog(createLocationDialog, 'location-cancel');

        const editLocationDialog = await openDialog(`edit-location-action-${location.id}`);
        expect(editLocationDialog.textContent).toContain('Изменение помещения');
        expect(editLocationDialog.querySelector<HTMLInputElement>('[data-testid="location-name"]')?.value)
            .toBe(location.name);
        await closeDialog(editLocationDialog, 'location-cancel');
    });


    it('should render the current address name in the edit dialog', async () => {
        createComponent();
        component.selectObject(street);
        fixture.detectChanges();

        const menu = await openAddressObjectActions();
        expect(
            menu.querySelector('[data-testid="delete-address-action"]')
                ?.getAttribute('data-variant'),
        ).toBe('destructive');

        const dialog = await openDialog('edit-address-action');
        const nameInput = dialog.querySelector<HTMLInputElement>(
            '[data-testid="address-object-name"]',
        );

        expect(dialog.textContent).toContain('Изменение адресного объекта');
        expect(nameInput?.value).toBe(street.name);
    });


    it('should save a root object from the rendered dialog and close it', async () => {
        createComponent();
        addressApi.createObject.mockReturnValue(of(city));
        const dialog = await openDialog('create-root-address-action');
        const nameInput = dialog.querySelector<HTMLInputElement>(
            '[data-testid="address-object-name"]',
        );
        expect(nameInput).not.toBeNull();
        enterValue(nameInput as HTMLInputElement, '  Москва  ');

        (dialog.querySelector('[data-testid="address-object-submit"]') as HTMLElement).click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(addressApi.createObject).toHaveBeenCalledWith({
            parent_id: null,
            type_id: cityType.id,
            name: 'Москва',
        });
        expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    });


    it('should keep the rendered dialog open when the API returns an error', async () => {
        createComponent();
        addressApi.createObject.mockReturnValue(throwError(() => new HttpErrorResponse({
            status: 409,
            error: { detail: 'An identical address record already exists' },
        })));
        const dialog = await openDialog('create-root-address-action');
        const nameInput = dialog.querySelector<HTMLInputElement>(
            '[data-testid="address-object-name"]',
        );
        enterValue(nameInput as HTMLInputElement, 'Москва');

        (dialog.querySelector('[data-testid="address-object-submit"]') as HTMLElement).click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const openDialogElement = document.body.querySelector<HTMLElement>('[role="dialog"]');
        expect(openDialogElement).not.toBeNull();
        expect(openDialogElement?.querySelector('[data-testid="address-object-error"]')?.textContent)
            .toContain('Такая запись уже существует');
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


    it('should ignore an older building list after another street is selected', () => {
        const otherStreet: AddressObject = {
            ...street,
            id: 13,
            name: 'Гагарина',
        };
        const otherBuilding: Building = {
            ...building,
            id: 21,
            address_object_id: otherStreet.id,
            number: '17',
            full_address: 'Москва, ул. Гагарина, д. 17',
        };
        const firstRequest = new Subject<Building[]>();
        const secondRequest = new Subject<Building[]>();
        addressApi.listBuildings.mockImplementation((addressObjectId: number) => (
            addressObjectId === street.id ? firstRequest : secondRequest
        ));
        createComponent();

        component.selectObject(street);
        component.selectObject(otherStreet);
        secondRequest.next([otherBuilding]);
        secondRequest.complete();
        firstRequest.error(new Error('late street error'));

        expect(component.selectedObject()?.id).toBe(otherStreet.id);
        expect(component.buildings()).toEqual([otherBuilding]);
        expect(component.buildingsState()).toBe('ready');
    });


    it('should ignore older building details and their late error', () => {
        const otherBuilding: Building = {
            ...building,
            id: 21,
            number: '17',
            full_address: 'Москва, ул. Дмитрия Ульянова, д. 17',
        };
        const otherEntrance: Entrance = {
            ...entrance,
            id: 31,
            building_id: otherBuilding.id,
            number: '2',
        };
        const otherLocation: Location = {
            ...location,
            id: 41,
            building_id: otherBuilding.id,
            entrance_id: otherEntrance.id,
            name: 'Серверная',
        };
        const firstEntrances = new Subject<Entrance[]>();
        const firstLocations = new Subject<Location[]>();
        const secondEntrances = new Subject<Entrance[]>();
        const secondLocations = new Subject<Location[]>();
        addressApi.listEntrances.mockImplementation((buildingId: number) => (
            buildingId === building.id ? firstEntrances : secondEntrances
        ));
        addressApi.listLocations.mockImplementation((buildingId: number) => (
            buildingId === building.id ? firstLocations : secondLocations
        ));
        createComponent();

        component.selectBuilding(building);
        component.selectBuilding(otherBuilding);
        secondEntrances.next([otherEntrance]);
        secondEntrances.complete();
        secondLocations.next([otherLocation]);
        secondLocations.complete();
        firstEntrances.error(new Error('late building error'));

        expect(component.selectedBuilding()?.id).toBe(otherBuilding.id);
        expect(component.entrances()).toEqual([otherEntrance]);
        expect(component.locations()).toEqual([otherLocation]);
        expect(component.detailsState()).toBe('ready');
    });


    it('should keep only the latest search response', () => {
        const otherBuilding: Building = {
            ...building,
            id: 21,
            number: '17',
            full_address: 'Москва, ул. Гагарина, д. 17',
        };
        const firstSearch = new Subject<{
            items: Building[];
            total: number;
            limit: number;
            offset: number;
        }>();
        const secondSearch = new Subject<{
            items: Building[];
            total: number;
            limit: number;
            offset: number;
        }>();
        addressApi.search.mockImplementation((query: string) => (
            query === 'Ленина 15' ? firstSearch : secondSearch
        ));
        createComponent();

        component.searchQuery.set('Ленина 15');
        component.search();
        component.searchQuery.set('Гагарина 17');
        component.search();
        secondSearch.next({ items: [otherBuilding], total: 1, limit: 20, offset: 0 });
        secondSearch.complete();
        firstSearch.error(new Error('late search error'));

        expect(component.searchResults()).toEqual([otherBuilding]);
        expect(component.searchState()).toBe('ready');
    });


    it('should ignore an older opened search result', () => {
        const otherStreet: AddressObject = {
            ...street,
            id: 13,
            name: 'Гагарина',
        };
        const otherBuilding: Building = {
            ...building,
            id: 21,
            address_object_id: otherStreet.id,
            number: '17',
            full_address: 'Москва, ул. Гагарина, д. 17',
        };
        const firstObject = new Subject<AddressObject>();
        const secondObject = new Subject<AddressObject>();
        addressApi.getObject.mockImplementation((addressObjectId: number) => (
            addressObjectId === street.id ? firstObject : secondObject
        ));
        addressApi.listBuildings.mockImplementation((addressObjectId: number) => of(
            addressObjectId === otherStreet.id ? [otherBuilding] : [building],
        ));
        createComponent();

        component.openSearchResult(building);
        component.openSearchResult(otherBuilding);
        secondObject.next(otherStreet);
        secondObject.complete();
        firstObject.error(new Error('late result error'));

        expect(component.selectedObject()).toEqual(otherStreet);
        expect(component.selectedBuilding()).toEqual(otherBuilding);
        expect(component.actionError()).toBeNull();
    });


    it('should invalidate lazy child requests when company context changes', () => {
        const pendingChildren = new Subject<AddressObject[]>();
        addressApi.listObjects.mockImplementation((parentId?: number) => (
            parentId === city.id ? pendingChildren : of([city])
        ));
        createComponent();

        component.toggleNode(component.roots()[0]);
        activeCompanyId.set(2);
        fixture.detectChanges();
        pendingChildren.error(new Error('late company A error'));

        expect(component.actionError()).toBeNull();
        expect(component.roots()[0].children).toEqual([]);
        expect(component.roots()[0].loading).toBe(false);
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


    it('should render search results in the autocomplete overlay, not in the page', async () => {
        createComponent();
        enterValue(addressSearchInput(), 'Ленина 15');
        component.search();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(addressApi.search).toHaveBeenCalledWith('Ленина 15', 20, 0);
        expect(
            fixture.nativeElement.querySelector('[data-testid="address-search-results"]'),
        ).toBeNull();
        expect(
            document.body.querySelector('[data-testid="address-search-results"]'),
        ).not.toBeNull();
        expect(
            document.body.querySelector('[data-testid="address-search-empty"]'),
        ).not.toBeNull();
    });


    it('should debounce search input and search immediately on Enter', async () => {
        vi.useFakeTimers();
        createComponent();

        component.onSearchQueryChange('р');
        component.onSearchQueryChange('рам');
        component.onSearchQueryChange('рам гагар 53');
        await vi.advanceTimersByTimeAsync(299);
        expect(addressApi.search).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(addressApi.search).toHaveBeenCalledTimes(1);
        expect(addressApi.search).toHaveBeenLastCalledWith('рам гагар 53', 20, 0);

        addressApi.search.mockClear();
        enterValue(addressSearchInput(), 'Москва Ленина 15');
        addressSearchInput().dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
        }));
        await vi.advanceTimersByTimeAsync(300);
        expect(addressApi.search).toHaveBeenCalledTimes(1);
        expect(addressApi.search).toHaveBeenCalledWith('Москва Ленина 15', 20, 0);
        expect(component.searchOverlayState()).toBe('open');
    });


    it('should clear results immediately for an empty query', () => {
        addressApi.search.mockReturnValue(of({
            items: [building], total: 1, limit: 20, offset: 0,
        }));
        createComponent();
        component.searchQuery.set('Ленина 15');
        component.search();
        expect(component.searchResults()).toEqual([building]);

        component.onSearchQueryChange('   ');

        expect(component.searchState()).toBe('idle');
        expect(component.searchResults()).toEqual([]);
        expect(component.searchTotal()).toBe(0);
    });


    it('should show loading, API error and retry the search', async () => {
        const pending = new Subject<{
            items: Building[];
            total: number;
            limit: number;
            offset: number;
        }>();
        addressApi.search
            .mockReturnValueOnce(pending)
            .mockReturnValueOnce(of({ items: [building], total: 1, limit: 20, offset: 0 }));
        createComponent();
        enterValue(addressSearchInput(), 'Ленина 15');
        component.search();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.searchState()).toBe('loading');
        expect(document.body.textContent).toContain('Ищем адреса...');

        pending.error(new Error('failed'));
        fixture.detectChanges();
        expect(component.searchState()).toBe('error');
        expect(document.body.textContent).toContain('Не удалось выполнить поиск');

        component.retrySearch();
        expect(component.searchState()).toBe('ready');
        expect(component.searchResults()).toEqual([building]);
    });


    it('should open an address selected from the autocomplete overlay', async () => {
        addressApi.search.mockReturnValue(of({
            items: [building], total: 1, limit: 20, offset: 0,
        }));
        addressApi.getObject.mockReturnValue(of(street));
        createComponent();
        enterValue(addressSearchInput(), 'Москва Ульянова 15');
        component.search();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const result = document.body.querySelector<HTMLElement>(
            `[data-testid="address-search-result-${building.id}"]`,
        );
        expect(result).not.toBeNull();
        result?.click();

        expect(addressApi.getObject).toHaveBeenCalledWith(street.id);
    });


    it('should append search pages without duplicate buildings', () => {
        const secondBuilding: Building = {
            ...building,
            id: 21,
            number: '17',
            full_address: 'Москва, ул. Дмитрия Ульянова, д. 17',
        };
        const thirdBuilding: Building = {
            ...building,
            id: 22,
            number: '19',
            full_address: 'Москва, ул. Дмитрия Ульянова, д. 19',
        };
        addressApi.search.mockImplementation((query: string, limit: number, offset: number) => (
            offset === 0
                ? of({ items: [building, secondBuilding], total: 3, limit, offset })
                : of({ items: [secondBuilding, thirdBuilding], total: 3, limit, offset })
        ));
        createComponent();
        component.searchQuery.set('Москва Ульянова');
        component.search();

        expect(component.hasMoreSearchResults()).toBe(true);
        component.loadMoreSearchResults();

        expect(addressApi.search).toHaveBeenLastCalledWith('Москва Ульянова', 20, 2);
        expect(component.searchResults().map(item => item.id)).toEqual([20, 21, 22]);
        expect(component.hasMoreSearchResults()).toBe(false);
    });


    it('should reset pagination when the query changes', () => {
        const otherBuilding: Building = {
            ...building,
            id: 21,
            number: '53',
            full_address: 'Раменское, ул. Гагарина, д. 53',
        };
        addressApi.search.mockImplementation((query: string, limit: number, offset: number) => of({
            items: query === 'новый запрос' ? [otherBuilding] : [building],
            total: query === 'новый запрос' ? 1 : 2,
            limit,
            offset,
        }));
        createComponent();
        component.searchQuery.set('старый запрос');
        component.search();
        component.loadMoreSearchResults();

        component.searchQuery.set('новый запрос');
        component.search();

        expect(addressApi.search).toHaveBeenLastCalledWith('новый запрос', 20, 0);
        expect(component.searchResults()).toEqual([otherBuilding]);
        expect(component.searchTotal()).toBe(1);
    });


    it('should ignore a late response from a previous search page', () => {
        const latePage = new Subject<{
            items: Building[];
            total: number;
            limit: number;
            offset: number;
        }>();
        const otherBuilding: Building = {
            ...building,
            id: 21,
            number: '53',
            full_address: 'Раменское, ул. Гагарина, д. 53',
        };
        addressApi.search.mockImplementation((query: string, limit: number, offset: number) => {
            if (query === 'старый' && offset > 0) {
                return latePage;
            }
            return of({
                items: query === 'новый' ? [otherBuilding] : [building],
                total: query === 'старый' ? 2 : 1,
                limit,
                offset,
            });
        });
        createComponent();
        component.searchQuery.set('старый');
        component.search();
        component.loadMoreSearchResults();
        component.searchQuery.set('новый');
        component.search();

        latePage.next({ items: [building], total: 2, limit: 20, offset: 1 });
        latePage.complete();

        expect(component.searchResults()).toEqual([otherBuilding]);
        expect(component.searchTotal()).toBe(1);
        expect(component.searchPageError()).toBe(false);
    });


    it('should invalidate an active search when the company changes', () => {
        const pending = new Subject<{
            items: Building[];
            total: number;
            limit: number;
            offset: number;
        }>();
        addressApi.search.mockReturnValue(pending);
        createComponent();
        component.searchQuery.set('Ленина 15');
        component.search();

        activeCompanyId.set(2);
        fixture.detectChanges();
        pending.next({ items: [building], total: 1, limit: 20, offset: 0 });
        pending.complete();

        expect(component.searchResults()).toEqual([]);
        expect(component.searchState()).toBe('idle');
    });


    it('should open a search result with the complete building list and reveal its path', () => {
        const neighbour: Building = {
            ...building,
            id: 21,
            number: '17',
            full_address: 'Москва, ул. Дмитрия Ульянова, д. 17',
        };
        addressApi.getObject.mockReturnValue(of(street));
        addressApi.listBuildings.mockReturnValue(of([building, neighbour]));
        createComponent();

        component.openSearchResult(building);

        expect(addressApi.listBuildings).toHaveBeenCalledWith(street.id);
        expect(component.buildings()).toEqual([building, neighbour]);
        expect(component.selectedBuilding()).toEqual(building);
        expect(component.entrances()).toEqual([entrance]);
        expect(component.locations()).toEqual([location]);
        expect(component.treeRows().map(row => row.node.id)).toContain(street.id);
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
