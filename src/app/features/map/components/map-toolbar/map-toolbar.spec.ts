import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapToolbar } from './map-toolbar';
import { MapWorkspaceState } from '../../services/map-workspace.state';
import { defaultMapSettings, type MapLayer, type MapSettings } from '../../models/map-workspace.models';

describe('MapToolbar', () => {
    let fixture: ComponentFixture<MapToolbar>;
    const group: MapLayer = { id: 1, name: 'Группа', parent_id: null, mode: 'group', sort_order: 0, rules: {}, version: 1 };
    const a = { ...group, id: 2, mode: 'manual' as const, parent_id: 1, name: 'A' }, b = { ...group, id: 3, mode: 'dynamic' as const, parent_id: 1, name: 'B', rules: { media: ['fiber' as const] } };
    const settings = signal(defaultMapSettings());
    const workspace = { settings, layers: signal([group, a, b]), restricted: signal(false), saving: signal(false), notice: signal(null), error: signal(null),
        conflict: signal(false), retrySave: vi.fn(), update: (patch: Partial<MapSettings>) => settings.update(current => ({ ...current, ...patch })) };
    beforeEach(async () => {
        settings.set(defaultMapSettings());
        await TestBed.configureTestingModule({ imports: [MapToolbar], providers: [{ provide: MapWorkspaceState, useValue: workspace }] }).compileComponents();
        fixture = TestBed.createComponent(MapToolbar); fixture.detectChanges();
    });
    afterEach(() => fixture.destroy());
    it('represents group mixed state, toggles all current leaves and never treats all-off as all-on', () => {
        const c = fixture.componentInstance; settings.update(value => ({ ...value, visible_layer_ids: [2], include_unassigned: false }));
        expect(c.layerChecked(group)).toBe('indeterminate'); c.toggleLayer(group);
        expect(settings().visible_layer_ids).toEqual([2, 3]); expect(c.layerChecked(group)).toBe(true);
        c.toggleLayer(group); expect(settings().visible_layer_ids).toEqual([]); expect(settings().include_unassigned).toBe(false);
    });
    it('can explicitly turn every point type off without reverting to all types', () => {
        const c = fixture.componentInstance; for (const type of c.types) c.toggleType(type.value);
        expect(settings().point_types).toEqual([]); expect(settings().point_types_enabled).toBe(true);
    });
    it('opens, toggles and dismisses tools with supported Spartan popover behavior', async () => {
        const trigger = fixture.nativeElement.querySelector('[data-testid="map-filters-toggle"]') as HTMLButtonElement;
        trigger.click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        expect(document.querySelector('[data-testid="map-filters"]')).not.toBeNull();
        trigger.click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        expect(document.querySelector('[data-testid="map-filters"]')).toBeNull();
        trigger.click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); expect(fixture.componentInstance.activePanel()).toBeNull();
    });
    it('keeps management actions out of the layer list for readers', async () => {
        (fixture.nativeElement.querySelector('[data-testid="map-layers-toggle"]') as HTMLButtonElement).click(); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        expect(document.querySelector('[data-testid="create-map-layer"]')).toBeNull();
        expect(document.querySelector('[aria-label="Изменить слой"]')).toBeNull();
        expect(document.querySelector('[data-testid="map-layers"]')).not.toBeNull();
    });
});
