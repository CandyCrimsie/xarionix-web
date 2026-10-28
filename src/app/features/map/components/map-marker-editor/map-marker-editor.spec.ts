import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { of, Subject } from 'rxjs';

import { AddressApiService } from '../../../../core/addresses/address-api.service';
import { CompanyContextService } from '../../../../core/company/company-context.service';
import type { Building } from '../../../../core/addresses/address.models';

import { createDefaultMapMarker } from '../../map-marker.config';
import { MapMarkerEditor } from './map-marker-editor';
import { pickMarkerAppearance } from '../../map-marker.config';


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
        component.iconSearch.set('маршрутизатор');
        expect(component.icons().map(icon => icon.value)).toEqual(['router']);
        component.selectIcon('router');
        expect(component.draft().icon_name).toBe('router');
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
            '[data-testid="marker-icon-router"]',
        ) as HTMLButtonElement | null;
        expect(server).not.toBeNull();
        expect(server?.getAttribute('aria-label')).toBe('Маршрутизатор');
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
            '[data-testid="marker-live-preview"] app-map-marker-preview',
        ) as HTMLElement | null;
        expect(preview).not.toBeNull();
        expect(preview?.querySelector('img')?.getAttribute('src')).toContain('data:image/svg+xml');
    });

    it('applies a preset and resets only appearance fields', () => {
        component.applyPreset('warning');
        expect(component.draft().icon_name).toBe('note');
        expect(component.draft().background_color).toBe('#DC2626');
        expect(component.draft().name).toBe('Узел связи №1');

        component.resetAppearance();
        expect(component.draft().icon_name).toBe('note');
        expect(component.draft().background_color).toBe(createDefaultMapMarker().background_color);
        expect(component.draft().name).toBe('Узел связи №1');
        expect(component.draft().latitude).toBe(55.577276);
    });

    it('uses a fixed ghost-button grid with an inherited-color glyph, including selected note', () => {
        const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
        tabs[1].click(); fixture.detectChanges();
        const note = fixture.nativeElement.querySelector('[data-testid="marker-icon-note"]') as HTMLButtonElement;
        expect(note.classList.contains('size-11')).toBe(true);
        expect(note.getAttribute('aria-pressed')).toBe('true');
        expect(note.getAttribute('data-selected')).toBe('true');
        expect(note.querySelector('img')).toBeNull();
        expect(note.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
        component.selectIcon('router'); fixture.detectChanges();
        expect(note.getAttribute('aria-pressed')).toBe('false');
        expect(note.classList.contains('size-11')).toBe(true);
    });

    it('allows editing an existing hidden legacy icon but does not offer it for new records', () => {
        expect(component.icons().some(icon => icon.value === 'server')).toBe(false);
        component.update('icon_name', 'server');
        expect(component.icons().some(icon => icon.value === 'server')).toBe(true);
        expect(component.selectedIconName()).toBe('lucideServer');
        component.selectIcon('equipment');
        expect(component.icons().some(icon => icon.value === 'server')).toBe(false);
    });

    it('locks topology coordinates, point type and building binding when inserting a splice', async () => {
        fixture.componentRef.setInput('spliceConnection', 'Магистраль');
        fixture.componentRef.setInput('draft', { ...component.draft(), point_type: 'splice', icon_name: 'splice' });
        fixture.detectChanges();
        await fixture.whenStable(); fixture.detectChanges();
        expect(component.canEditCoordinates()).toBe(false);
        expect(fixture.nativeElement.textContent).toContain('разделит соединение «Магистраль»');
        expect(fixture.nativeElement.querySelector('[data-testid="choose-marker-point"]')).toBeNull();
        expect(fixture.nativeElement.querySelector('app-building-address-picker')).toBeNull();
        expect(fixture.nativeElement.querySelector('#marker-latitude').disabled).toBe(true);
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

    it('selects a suggested house as an informational link without moving the house', async () => {
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
        expect(component.draft().building_link_role).toBe('reference');
        expect(component.draft().sync_building_coordinates).toBe(false);
        expect(component.draft().latitude).toBe(55.577276);
        expect(component.draft().longitude).toBe(38.245099);
        expect(search.value).toBe(building.full_address);

        const save = vi.fn();
        component.saveRequested.subscribe(() => save(component.draft()));
        fixture.nativeElement.querySelector('[data-testid="save-map-marker"]').click();
        expect(save).toHaveBeenCalledWith(expect.objectContaining({
            building_id: 20, building_link_role: 'reference', sync_building_coordinates: false,
            latitude: 55.577276, longitude: 38.245099,
        }));
        expect(fixture.nativeElement.textContent).toContain('не изменяет расположение дома');
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

    it('keeps informational coordinates independent and uses canonical coordinates for an explicit primary role', async () => {
        fixture.componentRef.setInput('canManage', true);
        component.selectPointType('building');
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of({
            ...building, latitude: 54.2, longitude: 37.1,
        }));
        component.selectBuilding({ ...building, latitude: 54.2, longitude: 37.1 });
        fixture.detectChanges();
        await fixture.whenStable();
        expect(component.draft().latitude).toBe(55.577276);
        component.selectLinkRole('represents');
        expect(component.draft()).toEqual(expect.objectContaining({
            building_id: building.id, building_link_role: 'represents', sync_building_coordinates: false,
            latitude: 54.2, longitude: 37.1,
        }));
        component.updateNumber('latitude', '54.3');
        expect(component.draft().latitude).toBe(54.2);
        component.relocatingBuilding.set(true);
        component.updateNumber('latitude', '54.3');
        expect(component.draft().latitude).toBe(54.3);
        expect(component.draft().building_position).toEqual({ latitude: 54.3, longitude: 37.1 });
    });

    it('keeps an explicitly selected point when binding an unpositioned house as primary', async () => {
        fixture.componentRef.setInput('canManage', true); component.selectPointType('building');
        fixture.componentRef.setInput('positionChosen', true);
        component.draft.update(d => ({ ...d, latitude: 55.57, longitude: 38.24 }));
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of(building));
        component.selectBuilding(building); fixture.detectChanges(); await fixture.whenStable();
        component.selectLinkRole('represents');
        expect(component.draft()).toMatchObject({ latitude: 55.57, longitude: 38.24,
            building_position: { latitude: 55.57, longitude: 38.24 } });
    });

    it('does not treat the default map centre as a chosen canonical building position', async () => {
        fixture.componentRef.setInput('canManage', true); component.selectPointType('building');
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of(building));
        component.selectBuilding(building); fixture.detectChanges(); await fixture.whenStable();
        component.selectLinkRole('represents');
        expect(component.draft().latitude).toBeNull(); expect(component.draft().building_position).toBeNull();
    });

    it('keeps informational links independent, without the legacy synchronization toggle', async () => {
        vi.mocked(TestBed.inject(AddressApiService).getBuilding).mockReturnValue(of(building));
        fixture.componentRef.setInput('draft', { ...component.draft(), building_id: building.id });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(component.draft().sync_building_coordinates).toBe(false);
        expect(fixture.nativeElement.textContent).toContain('не изменяет расположение дома');
        expect(fixture.nativeElement.querySelector('[data-testid="marker-building-sync"]')).toBeNull();
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

    it('copies personal appearance without replacing coordinates, ownership or semantic type', () => {
        const c = component;
        const before = { ...c.draft() };
        fixture.componentRef.setInput('personalStyles', [{ id: 1, company_id: 1, owner_user_id: 1, name: 'Личный стиль',
            version: 1, created_at: '', updated_at: '', appearance: { ...pickMarkerAppearance(before), icon_name: 'cabinet', icon_color: '#123456' } }]);
        c.applyPersonalStyle(1);
        expect(c.draft()).toEqual(expect.objectContaining({ latitude: before.latitude, longitude: before.longitude,
            point_type: 'note', visibility: 'private', building_link_role: 'none', icon_name: 'cabinet', icon_color: '#123456' }));
        const save = vi.fn(); c.styleRequested.subscribe(save); c.requestStyle('create');
        const event = save.mock.calls[0][0];
        expect(event.appearance).not.toHaveProperty('latitude');
        expect(event.appearance).not.toHaveProperty('building_id');
        expect(event.appearance).not.toHaveProperty('name');
    });

    it('does not infer primary role from a house icon or allow a private primary marker', () => {
        component.selectIcon('map-house');
        expect(component.draft().point_type).toBe('note');
        expect(component.draft().building_link_role).toBe('none');
        component.selectLinkRole('represents');
        expect(component.draft().building_link_role).toBe('none');
        fixture.componentRef.setInput('canManage', true);
        component.selectPointType('building');
        expect(component.draft().visibility).toBe('company');
        component.selectVisibility('private');
        component.selectLinkRole('represents');
        expect(component.draft().building_link_role).not.toBe('represents');
    });

    it('records pasted coordinates only after an explicit primary-house relocation action', () => {
        fixture.componentRef.setInput('draft', { ...component.draft(), point_type: 'building', visibility: 'company', building_link_role: 'represents', building_id: 20 });
        const event = { clipboardData: { getData: () => '55.6, 38.3' }, preventDefault: vi.fn() } as unknown as ClipboardEvent;
        component.handleCoordinatePaste(event);
        expect(component.draft().building_position).toBeUndefined();
        component.relocatingBuilding.set(true);
        component.handleCoordinatePaste(event);
        expect(component.draft().building_position).toEqual({ latitude: 55.6, longitude: 38.3 });
    });
});
