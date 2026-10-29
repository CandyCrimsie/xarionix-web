import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapLayerEditor } from './map-layer-editor';
import { MapDataService } from '../../services/map-data.service';
import { MapWorkspaceState } from '../../services/map-workspace.state';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import { AddressApiService } from '../../../../core/addresses/address-api.service';
import { defaultMapSettings, type MapLayer } from '../../models/map-workspace.models';

describe('MapLayerEditor', () => {
    let fixture: ComponentFixture<MapLayerEditor>, company: Subject<number>;
    const layer: MapLayer = { id: 5, version: 3, name: 'Проект', mode: 'manual', parent_id: null, sort_order: 0, rules: {} };
    const api = { createLayer: vi.fn(), updateLayer: vi.fn(), deleteLayer: vi.fn(), moveLayer: vi.fn() };
    const address = { search: vi.fn(), getObject: vi.fn() };
    const workspace = { layers: signal([layer]), settings: signal(defaultMapSettings()), applyLayer: vi.fn(), update: vi.fn(), reloadLayers: vi.fn() };
    beforeEach(async () => {
        company = new Subject(); vi.clearAllMocks();
        api.createLayer.mockReset(); api.updateLayer.mockReset(); address.search.mockReset().mockReturnValue(of({ items: [], total: 0, limit: 20, offset: 0 }));
        await TestBed.configureTestingModule({ imports: [MapLayerEditor], providers: [
            { provide: MapDataService, useValue: api }, { provide: MapWorkspaceState, useValue: workspace },
            { provide: AddressApiService, useValue: address }, { provide: CompanyContextService, useValue: { companyChanged$: company } },
        ] }).compileComponents();
        fixture = TestBed.createComponent(MapLayerEditor); fixture.detectChanges();
    });
    afterEach(() => { vi.useRealTimers(); fixture.destroy(); });
    it('keeps draft after a version conflict and updates the same layer rather than creating a copy', () => {
        const c = fixture.componentInstance; c.open(layer); c.setName('Проект Север');
        api.updateLayer.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: { message: 'Слой изменён' } } })));
        c.save(); expect(c.error()).toBe('Слой изменён'); expect(c.draft().name).toBe('Проект Север');
        api.updateLayer.mockReturnValueOnce(of({ ...layer, version: 4, name: 'Проект Север' })); c.save();
        expect(api.createLayer).not.toHaveBeenCalled(); expect(api.updateLayer).toHaveBeenLastCalledWith(layer, expect.objectContaining({ name: 'Проект Север' }));
        expect(workspace.applyLayer).toHaveBeenCalledWith(expect.objectContaining({ id: 5, version: 4 }));
    });
    it('debounces address rules and invalidates pending search when company changes', async () => {
        const c = fixture.componentInstance; c.open(null); fixture.detectChanges(); await fixture.whenStable(); vi.useFakeTimers();
        c.changeMode('dynamic'); c.onQuery('Рам'); await vi.advanceTimersByTimeAsync(200); c.onQuery('Раменское');
        await vi.advanceTimersByTimeAsync(299); expect(address.search).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1); expect(address.search).toHaveBeenCalledExactlyOnceWith('Раменское', 20, 0);
        c.onQuery('Гагарина'); company.next(2); await vi.advanceTimersByTimeAsync(300); expect(address.search).toHaveBeenCalledTimes(1);
    });
    it('does not double-save or apply an old company mutation to the new map', () => {
        const pending = new Subject<MapLayer>(); api.createLayer.mockReturnValueOnce(pending);
        const c = fixture.componentInstance; c.open(null); c.setName('Черновик'); c.save(); c.save();
        expect(api.createLayer).toHaveBeenCalledTimes(1); company.next(2); pending.next(layer);
        expect(workspace.applyLayer).not.toHaveBeenCalled(); expect(c.saving()).toBe(false);
    });
    it('uses the atomic sibling move contract instead of guessing equal sort orders', () => {
        const neighbour = { ...layer, id: 6, name: 'Сосед' }; workspace.layers.set([layer, neighbour]);
        api.moveLayer.mockReturnValueOnce(of([{ ...neighbour, sort_order: 0, version: 4 }, { ...layer, sort_order: 10, version: 4 }]));
        fixture.componentInstance.reorder(neighbour, -1);
        expect(api.moveLayer).toHaveBeenCalledWith(neighbour, -1); expect(api.updateLayer).not.toHaveBeenCalled();
        expect(workspace.applyLayer).toHaveBeenCalledTimes(2); workspace.layers.set([layer]);
    });
});
