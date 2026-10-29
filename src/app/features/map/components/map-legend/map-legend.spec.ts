import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MapLegend } from './map-legend';
import type { MapConnection, MapMarker } from '../../models/map.models';

describe('MapLegend', () => {
    it('collapses with Spartan and lists only currently displayed icons, media and statuses', async () => {
        await TestBed.configureTestingModule({ imports: [MapLegend] }).compileComponents();
        const fixture = TestBed.createComponent(MapLegend);
        fixture.componentRef.setInput('hasBuildings', true);
        fixture.componentRef.setInput('markers', [{ icon_name: 'splice' }, { icon_name: 'splice' }] as MapMarker[]);
        fixture.componentRef.setInput('connections', [{ medium: 'fiber', status: 'construction', vertices:[],installation_methods:['duct'],geometry: { type: 'LineString', coordinates: [[0,0],[1,1]] } }, { medium: 'utp', status: 'inactive', geometry: null }] as unknown as MapConnection[]);
        fixture.detectChanges();
        const button = fixture.nativeElement.querySelector('[data-testid="map-legend-toggle"]') as HTMLButtonElement;
        expect(button.getAttribute('aria-expanded')).toBe('false');
        button.click(); fixture.detectChanges();
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(fixture.componentInstance.objects().map(icon => icon.value)).toEqual(['map-house', 'splice']);
        expect(fixture.componentInstance.statuses().map(status => status.value)).toEqual(['construction']);
        expect(fixture.nativeElement.textContent).toContain('Оптоволокно');
        expect(fixture.nativeElement.textContent).not.toContain('Витая пара');
        expect(fixture.nativeElement.querySelector('path[stroke-dasharray="8.1 4.86"]')).not.toBeNull();
        expect(fixture.componentInstance.methods().map(method=>method.value)).toEqual(['duct']);
        const methodButton=Array.from(fixture.nativeElement.querySelectorAll('button')).find(button=>(button as HTMLButtonElement).textContent?.includes('Способ прокладки')) as HTMLButtonElement;
        expect(methodButton.getAttribute('aria-expanded')).toBe('true');methodButton.click();fixture.detectChanges();
        expect(fixture.componentInstance.methodsExpanded()).toBe(false);expect(methodButton.getAttribute('aria-expanded')).toBe('false');
        button.click(); fixture.detectChanges();
        expect(button.getAttribute('aria-expanded')).toBe('false');
    });
});
