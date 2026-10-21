import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';

import { createDefaultMapMarker } from '../../map-marker.config';
import { MapMarkerEditor } from './map-marker-editor';


describe('MapMarkerEditor', () => {
    let fixture: ComponentFixture<MapMarkerEditor>;
    let component: MapMarkerEditor;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MapMarkerEditor],
            providers: [{
                provide: BrnDialogRef,
                useValue: { close: vi.fn(), state: () => 'open' },
            }],
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
