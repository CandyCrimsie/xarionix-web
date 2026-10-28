import { TestBed, ComponentFixture } from '@angular/core/testing';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapConnectionEditor } from './map-connection-editor';
import { MapDataService } from '../../services/map-data.service';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import { createConnectionDraft } from '../../models/map.models';

describe('MapConnectionEditor', () => {
    let fixture: ComponentFixture<MapConnectionEditor>;
    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [MapConnectionEditor], providers: [
            { provide: BrnDialogRef, useValue: { close: vi.fn(), state: () => 'open' } },
            { provide: MapDataService, useValue: { searchEndpoints: vi.fn() } },
            { provide: CompanyContextService, useValue: { companyChanged$: new Subject() } },
        ] }).compileComponents();
        fixture = TestBed.createComponent(MapConnectionEditor);
        fixture.componentRef.setInput('draft', { ...createConnectionDraft(), name: 'Магистраль',
            source: { kind: 'building', id: 1, name: 'Дом', latitude: 55, longitude: 38 },
            target: { kind: 'marker', id: 1, name: 'Шкаф', latitude: 56, longitude: 39 } });
        fixture.detectChanges();
    });
    it('keeps typed identities separate and disallows missing endpoint coordinates', () => {
        const c = fixture.componentInstance;
        expect(c.canSave()).toBeTruthy();
        c.setEndpoint('target', { ...c.draft().source! });
        expect(c.canSave()).toBeFalsy();
        c.setEndpoint('target', { kind: 'marker', id: 1, name: 'Шкаф', latitude: null, longitude: null });
        expect(c.canSave()).toBeFalsy();
    });
    it('clears incompatible cable parameters when changing medium', () => {
        const c = fixture.componentInstance;
        c.update('fiber_count', 24); c.setMedium('utp');
        expect(c.draft().fiber_count).toBeNull();
        c.update('category', 'Cat 6'); c.setMedium('fiber');
        expect(c.draft().category).toBeNull();
    });
    it('edits vertices with WGS84 order, swaps and undoes without changing endpoint identities', () => {
        const c = fixture.componentInstance;
        c.addVertex(); c.changeVertex(0, '55.577276, 38.245099');
        expect(c.draft().vertices).toEqual([[38.245099, 55.577276]]);
        c.changeVertex(0, '91, 180');
        expect(c.coordinateError()).toBeTruthy();
        c.removeVertex(0); expect(c.draft().vertices).toEqual([]);
        c.undoVertex(); expect(c.draft().vertices).toEqual([[38.245099, 55.577276]]);
        c.swap(); expect(c.draft().source?.kind).toBe('marker'); expect(c.draft().target?.kind).toBe('building');
    });
    it('does not expose company visibility control to read-only users and preserves failed drafts', () => {
        fixture.componentRef.setInput('error', 'Не удалось сохранить'); fixture.detectChanges();
        expect(fixture.nativeElement.textContent).not.toContain('Общее соединение компании');
        expect(fixture.nativeElement.textContent).toContain('Не удалось сохранить');
        expect(fixture.componentInstance.draft().name).toBe('Магистраль');
    });
});
