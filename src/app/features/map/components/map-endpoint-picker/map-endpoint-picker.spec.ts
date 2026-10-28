import { TestBed, ComponentFixture } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Subject, of, throwError } from 'rxjs';
import { MapEndpointPicker } from './map-endpoint-picker';
import { MapDataService } from '../../services/map-data.service';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import type { MapEndpointDetail } from '../../models/map.models';

describe('MapEndpointPicker', () => {
    let fixture: ComponentFixture<MapEndpointPicker>;
    let changed: Subject<number>;
    const api = { searchEndpoints: vi.fn() };
    const building: MapEndpointDetail = { kind: 'building', id: 1, name: 'Дом 53', latitude: 55, longitude: 38 };
    const marker: MapEndpointDetail = { ...building, kind: 'marker', name: 'Шкаф' };
    beforeEach(async () => {
        vi.useFakeTimers();
        changed = new Subject();
        api.searchEndpoints.mockReset().mockReturnValue(of({ items: [building, marker], has_more: false, offset: 0, limit: 20 }));
        await TestBed.configureTestingModule({ imports: [MapEndpointPicker], providers: [
            { provide: MapDataService, useValue: api },
            { provide: CompanyContextService, useValue: { companyChanged$: changed } },
        ] }).compileComponents();
        fixture = TestBed.createComponent(MapEndpointPicker);
        fixture.detectChanges();
    });
    afterEach(() => { fixture.destroy(); vi.useRealTimers(); });
    it('debounces, supports explicit search and keeps same numeric IDs of different kinds', async () => {
        const c = fixture.componentInstance;
        c.searchChanged('Д'); c.searchChanged('Дом');
        await vi.advanceTimersByTimeAsync(299);
        expect(api.searchEndpoints).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(api.searchEndpoints).toHaveBeenCalledOnce();
        expect(c.items()).toEqual([building, marker]);
        c.onEnter(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(api.searchEndpoints).toHaveBeenCalledOnce();
        c.searchChanged('Шкаф'); c.search();
        expect(api.searchEndpoints).toHaveBeenCalledTimes(2);
        c.select(building);
        c.onEnter(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(api.searchEndpoints).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(300);
        expect(api.searchEndpoints).toHaveBeenCalledTimes(2);
    });
    it('invalidates old requests and removes selected/private values on company switch', () => {
        const pending = new Subject();
        api.searchEndpoints.mockReturnValue(pending);
        const c = fixture.componentInstance;
        c.searchChanged('Дом'); c.search();
        expect(c.loading()).toBe(true);
        changed.next(2);
        pending.next({ items: [building], has_more: false });
        expect(c.items()).toEqual([]);
        expect(c.query()).toBe('');
        expect(c.value()).toBeNull();
        expect(c.loading()).toBe(false);
    });
    it('shows errors, can retry and deduplicates appended pages by kind+id', () => {
        const c = fixture.componentInstance;
        api.searchEndpoints.mockReturnValueOnce(throwError(() => new Error('Offline')));
        c.searchChanged('Дом'); c.search();
        expect(c.error()).toBe(true);
        api.searchEndpoints.mockReturnValueOnce(of({ items: [building], has_more: true, offset: 0, limit: 20 }));
        c.search();
        api.searchEndpoints.mockReturnValueOnce(of({ items: [building, marker], has_more: false, offset: 20, limit: 20 }));
        c.search(true);
        expect(c.items()).toEqual([building, marker]);
        expect(c.error()).toBe(false);
        expect(c.hasMore()).toBe(false);
    });
});
