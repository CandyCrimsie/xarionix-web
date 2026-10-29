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
        expect(c.canSave()).toBeFalsy();
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

    it('preserves mixed methods through reverse, vertex edits and explicit boundary merging', () => {
        const c = fixture.componentInstance;
        c.update('vertices', [[38.2, 55.2], [38.6, 55.6]]);
        c.update('installation_methods', ['aerial', 'duct', 'indoor']);
        c.changeVertex(0, '55.3, 38.3');
        expect(c.methods()).toEqual(['aerial', 'duct', 'indoor']);
        c.removeVertex(0);
        expect(c.draft().vertices).toHaveLength(2);
        expect(c.coordinateError()).toContain('Выберите способ');
        c.setMergeMethod(0, 'facade'); c.removeVertex(0);
        expect(c.methods()).toEqual(['facade', 'indoor']);
        c.undoVertex(); expect(c.methods()).toEqual(['aerial', 'duct', 'indoor']);
        c.swap(); expect(c.methods()).toEqual(['indoor', 'duct', 'aerial']);
    });

    it('inherits the last method when extending a route and offers an explicit whole-route override', () => {
        const c = fixture.componentInstance;
        c.setAllMethods('duct'); c.addVertex();
        expect(c.methods()).toEqual(['duct', 'duct']);
        c.setMethod(1, 'direct_buried'); expect(c.uniformMethod()).toBeNull();
        c.setAllMethods('aerial'); expect(c.methods()).toEqual(['aerial', 'aerial']);
    });
    it('uses keyboard-accessible Spartan collapsibles and a labelled icon-only direction control',()=>{
        const section=fixture.nativeElement.querySelector('[data-testid="connection-installation-sections"] button') as HTMLButtonElement;
        expect(fixture.nativeElement.querySelector('details, summary')).toBeNull();
        expect(section.getAttribute('aria-expanded')).toBe('false');section.click();fixture.detectChanges();
        expect(section.getAttribute('aria-expanded')).toBe('true');expect(fixture.componentInstance.sectionsExpanded()).toBe(true);
        const swap=fixture.nativeElement.querySelector('[aria-label="Поменять местами"]') as HTMLButtonElement;
        expect(swap.textContent?.trim()).toBe('');swap.click();fixture.detectChanges();expect(fixture.componentInstance.draft().source?.kind).toBe('marker');
    });
});
