import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { of, Subject } from 'rxjs';

import { AddressApiService } from '../../../../core/addresses/address-api.service';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import type { Building } from '../../../../core/addresses/address.models';

import { createDefaultMapMarker } from '../../map-marker.config';
import { MapMarkerEditor } from './map-marker-editor';


describe('MapMarkerEditor', () => {
    let fixture: ComponentFixture<MapMarkerEditor>;
    let component: MapMarkerEditor;
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

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MapMarkerEditor],
            providers: [
                { provide: AddressApiService, useValue: { search: vi.fn(), getBuilding: vi.fn() } },
                { provide: CompanyContextService, useValue: { companyChanged$: new Subject().asObservable() } },
                {
                    provide: BrnDialogRef,
                    useValue: { close: vi.fn(), state: () => 'open' },
                },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(MapMarkerEditor);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('draft', {
            ...createDefaultMapMarker(55.577276, 38.245099),
            name: 'Узел связи №1',
            label_text: 'Узел №1',
        });
        fixture.detectChanges();
    });

    it('filters the safe icon allowlist and changes the selected icon', () => {
        component.iconSearch.set('сервер');
        expect(component.icons().map(icon => icon.value)).toEqual(['server']);

        component.selectIcon('server');
        expect(component.draft().icon_name).toBe('server');
        expect(component.selectedIconName()).toBe('lucideServer');
    });

    it('groups settings into clear tabs and keeps icon names in accessible tooltips', () => {
        const tabs = Array.from(
            fixture.nativeElement.querySelectorAll('[role="tab"]'),
        ) as HTMLElement[];
        expect(tabs.map(tab => tab.textContent?.trim())).toEqual([
            'Основное',
            'Иконка',
            'Оформление',
        ]);

        const iconTab = tabs.find(tab => tab.textContent?.trim() === 'Иконка')!;
        iconTab.click();
        fixture.detectChanges();

        const server = fixture.nativeElement.querySelector(
            '[data-testid="marker-icon-server"]',
        ) as HTMLButtonElement | null;
        expect(server).not.toBeNull();
        expect(server?.getAttribute('aria-label')).toBe('Сервер');
        expect(server?.textContent?.trim()).toBe('');
    });

    it('updates independent colors, switches and opacity in the live preview', () => {
        component.update('icon_color', '#112233');
        component.update('text_color', '#445566');
        component.update('background_enabled', false);
        component.update('border_enabled', false);
        component.setOpacity('icon_opacity', [45]);
        component.setOpacity('text_opacity', [72]);
        fixture.detectChanges();

        expect(component.draft().icon_color).toBe('#112233');
        expect(component.draft().text_color).toBe('#445566');
        expect(component.draft().background_enabled).toBe(false);
        expect(component.draft().border_enabled).toBe(false);
        expect(component.draft().icon_opacity).toBe(0.45);
        expect(component.draft().text_opacity).toBe(0.72);
        const preview = fixture.nativeElement.querySelector(
            '[data-testid="marker-live-preview"] > div',
        ) as HTMLElement | null;
        expect(preview).not.toBeNull();
        expect(preview?.classList.contains('flex-col')).toBe(true);
    });

    it('applies a preset and resets only appearance fields', () => {
        component.applyPreset('warning');
        expect(component.draft().icon_name).toBe('circle-alert');
        expect(component.draft().background_color).toBe('#DC2626');
        expect(component.draft().name).toBe('Узел связи №1');

        component.resetAppearance();
        expect(component.draft().icon_name).toBe('map-pin');
        expect(component.draft().background_color).toBe('#2563EB');
        expect(component.draft().name).toBe('Узел связи №1');
        expect(component.draft().latitude).toBe(55.577276);
    });

    it('parses pasted latitude and longitude without reversing GeoJSON order', () => {
        const preventDefault = vi.fn();
        component.handleCoordinatePaste({
            clipboardData: { getData: () => '55.751244, 37.618423' },
            preventDefault,
        } as unknown as ClipboardEvent);

        expect(preventDefault).toHaveBeenCalledOnce();
        expect(component.draft().latitude).toBe(55.751244);
        expect(component.draft().longitude).toBe(37.618423);
    });

    it('selects an unpositioned house in the overlay and submits its ID and explicit coordinate synchronization', async () => {
        vi.mocked(TestBed.inject(AddressApiService).search).mockReturnValue(of({
            items: [{ kind: 'building', building, full_address: building.full_address }],
            total: 1, offset: 0, limit: 20,
        }));
        const search = fixture.nativeElement.querySelector(
            '[data-testid="marker-building-search"] input',
        ) as HTMLInputElement;
        search.value = 'рам гагар 53';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 0));
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        document.body.querySelector<HTMLElement>('[data-testid="marker-building-result-20"]')!.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.draft().building_id).toBe(building.id);
        expect(component.draft().sync_building_coordinates).toBe(true);
        expect(component.draft().latitude).toBe(55.577276);
        expect(component.draft().longitude).toBe(38.245099);
        expect(search.value).toBe(building.full_address);

        const save = vi.fn();
        component.saveRequested.subscribe(() => save(component.draft()));
        fixture.nativeElement.querySelector('[data-testid="save-map-marker"]').click();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({
            building_id: 20, sync_building_coordinates: true,
            latitude: 55.577276, longitude: 38.245099,
        }));
        expect(fixture.nativeElement.textContent).toContain('Координаты дома общие для всех компаний');
    });

    it('displays the linked address while editing and can remove the binding without moving the marker', async () => {
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of(building));
        fixture.componentRef.setInput('editing', true);
        fixture.componentRef.setInput('draft', { ...component.draft(), building_id: building.id });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const search = fixture.nativeElement.querySelector(
            '[data-testid="marker-building-search"] input',
        ) as HTMLInputElement;
        expect(search.value).toBe(building.full_address);
        const save = vi.fn();
        component.saveRequested.subscribe(() => save(component.draft()));
        expect(fixture.nativeElement.querySelector('[data-testid="marker-building-unlink"]')).toBeNull();
        fixture.nativeElement.querySelector('[data-slot="autocomplete-clear"]').click();
        fixture.detectChanges();
        expect(component.draft().building_id).toBeNull();
        expect(component.draft().sync_building_coordinates).toBe(false);
        expect(component.draft().latitude).toBe(55.577276);
        expect(component.draft().longitude).toBe(38.245099);
        expect(save).not.toHaveBeenCalled();
        fixture.nativeElement.querySelector('[data-testid="save-map-marker"]').click();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({
            building_id: null, sync_building_coordinates: false,
        }));
    });

    it('requires selecting a suggested house or clearing the search before saving', () => {
        const search = fixture.nativeElement.querySelector(
            '[data-testid="marker-building-search"] input',
        ) as HTMLInputElement;
        search.value = 'рам гагар 53';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        expect(component.canSave()).toBe(false);
        expect(fixture.nativeElement.querySelector('[data-testid="save-map-marker"]').disabled).toBe(true);

        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        expect(component.canSave()).toBe(true);
        expect(component.draft().building_id).toBeNull();
    });

    it('uses existing house coordinates when binding instead of silently moving the house to the map centre', () => {
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of({
            ...building, latitude: 54.2, longitude: 37.1,
        }));
        component.selectBuilding({ ...building, latitude: 54.2, longitude: 37.1 });
        fixture.detectChanges();
        expect(component.draft()).toEqual(expect.objectContaining({
            building_id: building.id, sync_building_coordinates: true,
            latitude: 54.2, longitude: 37.1,
        }));
        component.updateNumber('latitude', '54.3');
        expect(component.draft().latitude).toBe(54.3);
        expect(component.draft().sync_building_coordinates).toBe(true);
    });

    it('keeps old informational links independent until synchronization is explicitly enabled', async () => {
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of(building));
        fixture.componentRef.setInput('draft', { ...component.draft(), building_id: building.id });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.draft().sync_building_coordinates).toBe(false);
        expect(fixture.nativeElement.textContent).toContain('Только справочная связь');
        const toggle = fixture.nativeElement.querySelector(
            '[data-testid="marker-building-sync"] button',
        ) as HTMLButtonElement;
        toggle.click();
        fixture.detectChanges();
        expect(component.draft().sync_building_coordinates).toBe(true);
        toggle.click();
        fixture.detectChanges();
        expect(component.draft().sync_building_coordinates).toBe(false);
        expect(component.draft().latitude).toBe(55.577276);
    });

    it('turns synchronization off when a linked house is cleared by typing', async () => {
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of(building));
        fixture.componentRef.setInput('draft', {
            ...component.draft(), building_id: building.id, sync_building_coordinates: true,
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        const search = fixture.nativeElement.querySelector(
            '[data-testid="marker-building-search"] input',
        ) as HTMLInputElement;
        search.value = '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        expect(component.draft().building_id).toBeNull();
        expect(component.draft().sync_building_coordinates).toBe(false);
    });

    it('emits save only for a valid marker', () => {
        const save = vi.fn();
        component.saveRequested.subscribe(save);
        component.submit();
        expect(save).toHaveBeenCalledOnce();

        component.update('name', '   ');
        component.submit();
        expect(save).toHaveBeenCalledOnce();
    });
});
