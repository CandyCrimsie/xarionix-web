import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapDataService } from './map-data.service';
import { MapWorkspaceState } from './map-workspace.state';
import { CompanyContextService } from '../../../core/company/company-context.service';
import { defaultMapSettings, type MapPreference, type MapSettings } from '../models/map-workspace.models';

describe('MapWorkspaceState', () => {
    let company: Subject<number>;
    let state: MapWorkspaceState;
    const api = { getPreferences: vi.fn(), getLayers: vi.fn(), savePreferences: vi.fn() };
    beforeEach(() => {
        vi.useFakeTimers(); company = new Subject();
        api.getPreferences.mockReset().mockImplementation(() => of({ version: 0, settings: defaultMapSettings(), notice: null }));
        api.getLayers.mockReset().mockReturnValue(of([]));
        api.savePreferences.mockReset().mockImplementation((settings, version) => of({ version: version + 1, settings, notice: null }));
        TestBed.configureTestingModule({ providers: [MapWorkspaceState, { provide: MapDataService, useValue: api }, { provide: CompanyContextService, useValue: { companyChanged$: company } }] });
        state = TestBed.inject(MapWorkspaceState);
    });
    afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

    it('debounces changes and persists only the final validated settings, not map entities', async () => {
        state.update({ medium: 'fiber' }); state.update({ status: 'active' }); state.update({ connection_mode: 'hidden' });
        await vi.advanceTimersByTimeAsync(299); expect(api.savePreferences).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(api.savePreferences).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ medium: 'fiber', status: 'active', connection_mode: 'hidden' }), 0);
        expect(Object.keys(api.savePreferences.mock.calls[0][0])).not.toContain('geometry');
    });

    it('serializes writes with the returned version and never overwrites newer local input with an old response', async () => {
        const first = new Subject<MapPreference>(); api.savePreferences.mockReturnValueOnce(first);
        state.update({ medium: 'fiber' }); await vi.advanceTimersByTimeAsync(300);
        const firstValue = structuredClone(state.settings());
        state.update({ medium: 'utp' }); await vi.advanceTimersByTimeAsync(300);
        expect(api.savePreferences).toHaveBeenCalledOnce();
        first.next({ version: 1, settings: firstValue, notice: null }); first.complete();
        expect(state.settings().medium).toBe('utp');
        expect(api.savePreferences).toHaveBeenLastCalledWith(expect.objectContaining({ medium: 'utp' }), 1);
    });

    it('does not invalidate viewport filters just because the server acknowledges the same settings', async () => {
        api.savePreferences.mockImplementationOnce((settings, version) => of({ version: version + 1, settings: structuredClone(settings), notice: null }));
        state.update({ medium: 'fiber' }); const settings = state.settings(), query = state.query();
        await vi.advanceTimersByTimeAsync(300);
        expect(state.settings()).toBe(settings); expect(state.query()).toBe(query);
    });

    it('does not send an old company debounce to the new company', async () => {
        state.update({ medium: 'fiber' }); company.next(2);
        await vi.advanceTimersByTimeAsync(400);
        expect(api.savePreferences).not.toHaveBeenCalled(); expect(state.settings().medium).toBe('all');
    });

    it('clears old data before reading the next company and ignores the old pending write', async () => {
        const saving = new Subject<MapPreference>(), loading = new Subject<MapPreference>();
        api.savePreferences.mockReturnValueOnce(saving);
        state.update({ medium: 'fiber' }); await vi.advanceTimersByTimeAsync(300);
        api.getPreferences.mockReturnValueOnce(loading); company.next(2);
        expect(state.ready()).toBe(false); expect(state.settings().connection_mode).toBe('hidden'); expect(state.layers()).toEqual([]);
        saving.next({ version: 100, settings: { ...defaultMapSettings(), medium: 'fiber' }, notice: null });
        loading.next({ version: 3, settings: { ...defaultMapSettings(), medium: 'utp' }, notice: null }); loading.complete();
        expect(state.settings().medium).toBe('utp'); expect(state.ready()).toBe(true);
    });

    it('handles version conflicts without an automatic overwrite or notification loop', async () => {
        api.savePreferences.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
        state.update({ status: 'inactive' }); await vi.advanceTimersByTimeAsync(1000);
        expect(state.conflict()).toBe(true); expect(state.settings().status).toBe('inactive');
        state.update({ medium: 'fiber' }); await vi.advanceTimersByTimeAsync(1000);
        expect(api.savePreferences).toHaveBeenCalledOnce();
        state.retrySave(); expect(api.getPreferences).toHaveBeenCalledTimes(2); expect(state.conflict()).toBe(false);
    });

    it('prunes deleted layers without enabling unassigned objects', () => {
        state.update({ visible_layer_ids: [42], include_unassigned: false }); state.reloadLayers();
        expect(state.settings().visible_layer_ids).toEqual([]); expect(state.settings().include_unassigned).toBe(false);
        expect(state.query().layers_active).toBe(true);
    });

    it('keeps initial read failures safe and lets local filtering work without silently writing defaults', async () => {
        api.getPreferences.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
        state.load(); expect(state.settings().show_buildings).toBe(false); expect(state.error()).toBeTruthy();
        state.update({ show_buildings: true }); await vi.advanceTimersByTimeAsync(300);
        expect(state.settings().show_buildings).toBe(true); expect(api.savePreferences).not.toHaveBeenCalled();
    });

    it('cancels pending debounce and HTTP callbacks when the map is destroyed', async () => {
        state.update({ medium: 'fiber' }); TestBed.resetTestingModule();
        await vi.advanceTimersByTimeAsync(400); expect(api.savePreferences).not.toHaveBeenCalled();
    });
});
