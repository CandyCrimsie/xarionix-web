import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapPassportDialog } from './map-passport';
import { MapWorkspaceState } from '../../services/map-workspace.state';
import { MapDataService } from '../../services/map-data.service';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import type { MapLayer, MapPassport } from '../../models/map-workspace.models';

describe('MapPassportDialog', () => {
    let fixture: ComponentFixture<MapPassportDialog>, company: Subject<number>;
    const layer: MapLayer = { id: 2, version: 3, name: 'Проект', mode: 'manual', parent_id: null, sort_order: 0, rules: {} };
    const record: MapPassport = { version: 0, can_manage: true, notice: null, layers: [],
        entity: { kind: 'building', id: 42, company_name: 'Компания A', name: 'Дом 53', description: null, version: null, point_type: 'building', status: null, latitude: 55, longitude: 38 },
        data: { inventory_number: null, purpose: null, note: null, commissioned_on: null, operational_status: null, specs: { kind: 'building', floors: 9, premises: 0 } } };
    const api = { getPassport: vi.fn(), savePassport: vi.fn(), setLayerMember: vi.fn(), getDependencies: vi.fn() };
    const workspace = { layers: signal([layer]), applyLayer: vi.fn(), reloadLayers: vi.fn() };
    beforeEach(async () => {
        company = new Subject(); vi.clearAllMocks();
        api.getPassport.mockReset().mockReturnValue(of(structuredClone(record)));
        api.savePassport.mockReset(); api.setLayerMember.mockReset();
        await TestBed.configureTestingModule({ imports: [MapPassportDialog], providers: [
            { provide: MapDataService, useValue: api }, { provide: MapWorkspaceState, useValue: workspace },
            { provide: CompanyContextService, useValue: { companyChanged$: company } },
        ] }).compileComponents();
        fixture = TestBed.createComponent(MapPassportDialog); fixture.detectChanges();
    });
    afterEach(() => fixture.destroy());
    async function open(): Promise<MapPassportDialog> {
        fixture.componentInstance.open({ kind: 'building', id: 42 }); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        return fixture.componentInstance;
    }
    it('loads only on demand and distinguishes zero from missing derived data', async () => {
        expect(api.getPassport).not.toHaveBeenCalled(); await open();
        expect(api.getPassport).toHaveBeenCalledExactlyOnceWith({ kind: 'building', id: 42 });
        const modal = document.querySelector('[data-testid="map-passport"]')!;
        expect(modal.textContent).toContain('Помещений0'); expect(modal.textContent).toContain('Компания A');
        expect(modal.querySelector('input')).toBeNull();
    });
    it('retains input on failure, uses versions and updates the read view after save', async () => {
        const c = await open(), changed = vi.fn(); c.saved.subscribe(changed); c.beginEdit(); c.text('note', 'Сохранить этот текст');
        api.savePassport.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: { message: 'Паспорт изменён' } } })));
        c.save(); fixture.detectChanges();
        expect(c.editing()).toBe(true); expect(c.draft().note).toBe('Сохранить этот текст'); expect(c.error()).toBe('Паспорт изменён');
        const saved = { ...record, version: 1, data: c.draft() }; api.savePassport.mockReturnValueOnce(of(saved)); c.save(); fixture.detectChanges();
        expect(api.savePassport).toHaveBeenLastCalledWith({ kind: 'building', id: 42 }, expect.objectContaining({ expected_version: 0, expected_entity_version: null }));
        expect(c.editing()).toBe(false); expect(c.record()?.data.note).toBe('Сохранить этот текст'); expect(changed).toHaveBeenCalledExactlyOnceWith(saved);
    });
    it('does not save on cancel and hides edit controls from readers', async () => {
        const c = await open(); c.beginEdit(); c.text('note', 'Отменить'); c.cancelEdit();
        expect(c.record()?.data.note).toBeNull(); expect(api.savePassport).not.toHaveBeenCalled();
        api.getPassport.mockReturnValueOnce(of({ ...record, can_manage: false })); c.reload(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        expect(document.querySelector('[data-testid="edit-map-passport"]')).toBeNull();
    });
    it('updates manual memberships with layer versions without rewriting the passport', async () => {
        fixture.componentRef.setInput('canManageLayers', true); const c = await open();
        api.setLayerMember.mockReturnValueOnce(of({ ...layer, version: 4 })); c.setMembership(layer, true);
        expect(api.setLayerMember).toHaveBeenCalledExactlyOnceWith(layer, { kind: 'building', id: 42 }, true);
        expect(c.members()).toEqual([2]); expect(workspace.applyLayer).toHaveBeenCalled(); expect(api.savePassport).not.toHaveBeenCalled();
    });
    it('does not reveal an old company passport after context changes', async () => {
        const pending = new Subject<MapPassport>(); api.getPassport.mockReturnValueOnce(pending);
        fixture.componentInstance.open({ kind: 'building', id: 42 }); fixture.detectChanges(); company.next(2);
        pending.next(record); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        expect(fixture.componentInstance.record()).toBeNull(); expect(document.querySelector('[data-testid="map-passport"]')).toBeNull();
    });
});
