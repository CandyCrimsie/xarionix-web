import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AddressApiService } from '../../core/addresses/address-api.service';
import type {
    AddressSearchItem,
    AddressSearchResult,
    Building,
} from '../../core/addresses/address.models';
import { CompanyContextService } from '../../core/company/company-context.service';
import { BuildingAddressPicker } from './building-address-picker';


describe('BuildingAddressPicker', () => {
    let fixture: ComponentFixture<BuildingAddressPicker>;
    let component: BuildingAddressPicker;
    let companyChanged: Subject<number | null>;
    const addressApi = { search: vi.fn(), getBuilding: vi.fn() };
    const building: Building = {
        id: 20,
        address_object_id: 12,
        number: '53',
        corpus: null,
        structure: null,
        latitude: null,
        longitude: null,
        full_address: 'Раменское, ул. Гагарина, д. 53',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
    };
    const otherBuilding = { ...building, id: 21, full_address: 'Москва, ул. Ленина, д. 15' };
    const item = (value: Building): AddressSearchItem => ({
        kind: 'building', building: value, full_address: value.full_address,
    });
    const page = (items: AddressSearchItem[], offset = 0, total = items.length): AddressSearchResult => ({
        items, offset, total, limit: 20,
    });

    beforeEach(async () => {
        addressApi.search.mockReset().mockReturnValue(of(page([])));
        addressApi.getBuilding.mockReset().mockReturnValue(of(building));
        companyChanged = new Subject();
        await TestBed.configureTestingModule({
            imports: [BuildingAddressPicker],
            providers: [
                { provide: AddressApiService, useValue: addressApi },
                { provide: CompanyContextService, useValue: { companyChanged$: companyChanged } },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(BuildingAddressPicker);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        vi.useRealTimers();
    });

    function input(): HTMLInputElement {
        return (fixture.nativeElement as HTMLElement).querySelector('input')!;
    }

    function typeQuery(value: string): void {
        input().value = value;
        input().dispatchEvent(new Event('input', { bubbles: true }));
    }

    async function stabilize(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    it('selects a full address from the actual autocomplete overlay and stores the building ID', async () => {
        addressApi.search.mockReturnValue(of(page([item(building)])));
        const changed = vi.fn();
        component.buildingId.subscribe(changed);
        typeQuery('рам гагар 53');
        component.search();
        await stabilize();

        expect(addressApi.search).toHaveBeenCalledWith('рам гагар 53', 20, 0);
        expect(fixture.nativeElement.querySelector('[data-testid="marker-building-results"]')).toBeNull();
        const option = document.body.querySelector<HTMLElement>(
            '[data-testid="marker-building-result-20"]',
        )!;
        expect(option.textContent).toContain(building.full_address);
        option.click();
        await stabilize();

        expect(component.buildingId()).toBe(building.id);
        expect(changed).toHaveBeenLastCalledWith(building.id);
        expect(input().value).toBe(building.full_address);
        expect(component.overlayState()).toBe('closed');
        expect(addressApi.getBuilding).not.toHaveBeenCalled();
    });

    it('debounces queries and cancels stale responses and errors', async () => {
        vi.useFakeTimers();
        const old = new Subject<AddressSearchResult>();
        addressApi.search.mockReturnValueOnce(old).mockReturnValue(of(page([item(otherBuilding)])));
        typeQuery('старый адрес');
        await vi.advanceTimersByTimeAsync(299);
        expect(addressApi.search).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(old.observed).toBe(true);

        typeQuery('Ленина 15');
        expect(old.observed).toBe(false);
        await vi.advanceTimersByTimeAsync(300);
        old.next(page([item(building)]));
        old.error(new Error('late error'));

        expect(component.results()).toEqual([otherBuilding]);
        expect(component.state()).toBe('ready');
        expect(component.buildingId()).toBeNull();
    });

    it('searches immediately on Enter and keeps the results open', async () => {
        vi.useFakeTimers();
        addressApi.search.mockReturnValue(of(page([item(building)])));
        typeQuery('рам гагар 53');
        input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await vi.advanceTimersByTimeAsync(300);

        expect(addressApi.search).toHaveBeenCalledOnce();
        expect(component.results()).toEqual([building]);
        expect(component.overlayState()).toBe('open');
        expect(component.buildingId()).toBeNull();
    });

    it('shows loading, empty and error states and retries through the overlay button', async () => {
        const pending = new Subject<AddressSearchResult>();
        addressApi.search.mockReturnValueOnce(pending).mockReturnValue(of(page([])));
        typeQuery('Ленина');
        component.search();
        await stabilize();
        expect(document.body.querySelector('[data-testid="marker-building-results"]')?.textContent)
            .toContain('Ищем дома');
        pending.error(new Error('offline'));
        await stabilize();
        expect(document.body.querySelector('[data-testid="marker-building-results"]')?.textContent)
            .toContain('Не удалось найти дома');
        document.body.querySelector<HTMLButtonElement>('[data-testid="marker-building-retry"]')!.click();
        await stabilize();
        expect(document.body.querySelector('[data-testid="marker-building-results"]')?.textContent)
            .toContain('Дома не найдены');
    });

    it('filters out geographic objects and paginates using the unfiltered backend offset', async () => {
        const street: AddressSearchItem = {
            kind: 'address_object',
            object: {
                id: 12, parent_id: null, type_id: 3, type_code: 'street', type_category: 'thoroughfare',
                type_name: 'Улица', type_short_name: 'ул.', name: 'Гагарина',
                created_at: building.created_at, updated_at: building.updated_at,
            },
            full_address: 'Раменское, ул. Гагарина',
        };
        addressApi.search.mockReturnValueOnce(of(page([street], 0, 3)))
            .mockReturnValueOnce(of(page([item(building), item(otherBuilding)], 1, 3)));
        typeQuery('Гагарина');
        component.search();
        await stabilize();
        expect(component.results()).toEqual([]);
        expect(component.hasMore()).toBe(true);
        document.body.querySelector<HTMLButtonElement>('[data-testid="marker-building-load-more"]')!.click();
        await stabilize();

        expect(addressApi.search).toHaveBeenLastCalledWith('Гагарина', 20, 1);
        expect(component.results()).toEqual([building, otherBuilding]);
        expect(component.hasMore()).toBe(false);
    });

    it('preserves loaded results after a pagination error and retries the same offset', () => {
        addressApi.search.mockReturnValueOnce(of(page([item(building)], 0, 3)))
            .mockReturnValueOnce(throwError(() => new Error('offline')))
            .mockReturnValueOnce(of(page([item(building), item(otherBuilding)], 1, 3)));
        component.onQueryChange('Ленина');
        component.search();
        component.loadMore();
        expect(component.results()).toEqual([building]);
        expect(component.pageError()).toBe(true);
        component.retrySearch();
        expect(addressApi.search).toHaveBeenLastCalledWith('Ленина', 20, 1);
        expect(component.results()).toEqual([building, otherBuilding]);
    });

    it('resolves an existing building ID and discards a stale lookup when another binding is opened', () => {
        const old = new Subject<Building>();
        addressApi.getBuilding.mockReturnValueOnce(old).mockReturnValue(of(otherBuilding));
        fixture.componentRef.setInput('buildingId', building.id);
        fixture.detectChanges();
        expect(old.observed).toBe(true);
        fixture.componentRef.setInput('buildingId', otherBuilding.id);
        fixture.detectChanges();
        old.next(building);

        expect(old.observed).toBe(false);
        expect(component.buildingId()).toBe(otherBuilding.id);
        expect(component.selectedBuilding()).toEqual(otherBuilding);
        expect(input().value).toBe(otherBuilding.full_address);
    });

    it('retains an existing binding on lookup failure, retries it and can explicitly unlink it', async () => {
        addressApi.getBuilding.mockReturnValueOnce(throwError(() => new Error('offline')))
            .mockReturnValue(of(building));
        fixture.componentRef.setInput('buildingId', building.id);
        await stabilize();
        expect(component.buildingId()).toBe(building.id);
        expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить привязанный дом');
        fixture.nativeElement.querySelector('[data-testid="marker-building-lookup-retry"]').click();
        await stabilize();
        expect(input().value).toBe(building.full_address);

        expect(fixture.nativeElement.querySelector('[data-testid="marker-building-unlink"]')).toBeNull();
        fixture.nativeElement.querySelector('[data-slot="autocomplete-clear"]').click();
        await stabilize();
        expect(component.buildingId()).toBeNull();
        expect(input().value).toBe('');
    });

    it('cancels a pending linked-building lookup when the user starts another search', async () => {
        const pending = new Subject<Building>();
        addressApi.getBuilding.mockReturnValue(pending);
        fixture.componentRef.setInput('buildingId', building.id);
        fixture.detectChanges();
        typeQuery('Ленина');
        component.search();
        pending.next(building);
        await stabilize();
        expect(pending.observed).toBe(false);
        expect(component.buildingId()).toBeNull();
        expect(input().value).toBe('Ленина');
    });

    it('clears stale search data on company change and cancels requests on destruction', () => {
        const pending = new Subject<AddressSearchResult>();
        addressApi.search.mockReturnValue(pending);
        component.onQueryChange('Гагарина');
        component.search();
        companyChanged.next(2);
        pending.next(page([item(building)]));
        expect(pending.observed).toBe(false);
        expect(component.results()).toEqual([]);
        expect(component.overlayState()).toBe('closed');
        expect(component.query()).toBe('');

        const next = new Subject<AddressSearchResult>();
        addressApi.search.mockReturnValue(next);
        component.onQueryChange('Ленина');
        component.search();
        expect(next.observed).toBe(true);
        fixture.destroy();
        expect(next.observed).toBe(false);
    });

    it('disables selection while saving and rejects overlong queries before requesting the API', async () => {
        typeQuery('x'.repeat(256));
        await stabilize();
        expect(addressApi.search).not.toHaveBeenCalled();
        expect(fixture.nativeElement.textContent).toContain('не должен превышать 255 символов');

        fixture.componentRef.setInput('disabled', true);
        fixture.detectChanges();
        expect(input().disabled).toBe(true);
        component.selectBuilding(building);
        component.search();
        expect(component.buildingId()).toBeNull();
        expect(addressApi.search).not.toHaveBeenCalled();
    });
});
