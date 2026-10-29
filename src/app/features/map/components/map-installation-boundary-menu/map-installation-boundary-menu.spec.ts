import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapInstallationBoundaryMenu } from './map-installation-boundary-menu';

describe('MapInstallationBoundaryMenu', () => {
    let fixture: ComponentFixture<MapInstallationBoundaryMenu>;
    const boundary = { vertex: 2, before: 'aerial', after: 'duct', position: [38.25, 55.57], x: 100, y: 100 };
    const button = (text: string) => [...fixture.nativeElement.querySelectorAll('button')].find((el: any) => el.textContent.trim() === text) as HTMLButtonElement;
    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [MapInstallationBoundaryMenu] }).compileComponents();
        fixture = TestBed.createComponent(MapInstallationBoundaryMenu);
        fixture.componentRef.setInput('boundary', boundary);
        fixture.componentRef.setInput('method', 'duct');
        fixture.detectChanges();
    });
    afterEach(() => fixture.destroy());

    it('groups actions and hides precise coordinates until the info control is opened', async () => {
        expect(fixture.nativeElement.textContent).toContain('Переход между участками');
        expect(fixture.nativeElement.querySelector('[data-testid="boundary-coordinates"]').getAttribute('data-state')).toBe('closed');
        fixture.nativeElement.querySelector('[aria-label="Координаты границы"]').click();
        fixture.detectChanges(); await fixture.whenStable();
        expect(fixture.componentInstance.infoExpanded()).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('55.570000');
        expect(fixture.nativeElement.querySelector('hlm-separator')).not.toBeNull();
    });

    it('goes back without losing the selected method or boundary', () => {
        const c = fixture.componentInstance;
        button('Изменить способ прокладки').click(); fixture.detectChanges();
        c.method.set('facade');
        fixture.nativeElement.querySelector('[aria-label="Назад"]').click(); fixture.detectChanges();
        expect(c.action()).toBe('menu');
        button('Изменить способ прокладки').click(); fixture.detectChanges();
        expect(c.method()).toBe('facade'); expect(c.boundary()).toEqual(boundary);
        const save = vi.fn(); c.saveRequested.subscribe(save); button('Сохранить').click();
        expect(save).toHaveBeenCalledWith({ operation: 'set', installation_after: 'facade' });
    });

    it('requires an explicit merge choice and never deletes on the first menu click', () => {
        const c = fixture.componentInstance, save = vi.fn(); c.saveRequested.subscribe(save);
        button('Удалить границу').click(); fixture.detectChanges();
        expect(save).not.toHaveBeenCalled();
        expect(button('Объединить участки').disabled).toBe(true);
        c.selectKeep('next'); fixture.detectChanges(); button('Объединить участки').click();
        expect(save).toHaveBeenCalledWith({ operation: 'remove', keep: 'next' });
    });

    it('preserves the form and selected merge option after an API failure', () => {
        const c = fixture.componentInstance;
        button('Удалить границу').click(); c.selectKeep('previous');
        fixture.componentRef.setInput('error', 'Конфликт версии. Обновите данные.'); fixture.detectChanges();
        expect(c.action()).toBe('remove'); expect(c.keep()).toBe('previous');
        expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Конфликт версии');
        expect(button('Объединить участки').disabled).toBe(false);
    });

    it('opens the installed Spartan Select inside the menu and changes its value', async () => {
        button('Изменить способ прокладки').click(); fixture.detectChanges();
        fixture.nativeElement.querySelector('[data-testid="boundary-method-select"] button').click();
        fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
        const option = [...document.querySelectorAll('[role="option"]')].find(el => el.textContent?.includes('По фасаду')) as HTMLElement;
        expect(option).toBeTruthy(); option.click(); fixture.detectChanges(); await fixture.whenStable();
        expect(fixture.componentInstance.method()).toBe('facade');
        expect(fixture.componentInstance.action()).toBe('set');
    });

    it('blocks all destructive interaction and keeps state while saving', () => {
        const c = fixture.componentInstance, save = vi.fn(); c.saveRequested.subscribe(save);
        button('Удалить границу').click(); c.selectKeep('previous');
        fixture.componentRef.setInput('saving', true); fixture.detectChanges();
        expect([...fixture.nativeElement.querySelectorAll('button')].every((el: any) => el.disabled)).toBe(true);
        c.confirmRemove(); expect(save).not.toHaveBeenCalled(); expect(c.keep()).toBe('previous');
    });

    it('delegates moving and cancellation without inventing a route mutation', () => {
        const c = fixture.componentInstance, move = vi.fn(), cancel = vi.fn(), save = vi.fn();
        c.moveRequested.subscribe(move); c.cancelRequested.subscribe(cancel); c.saveRequested.subscribe(save);
        button('Переместить границу').click(); expect(move).toHaveBeenCalledOnce();
        button('Изменить способ прокладки').click(); fixture.detectChanges(); button('Отмена').click();
        expect(cancel).toHaveBeenCalledOnce(); expect(save).not.toHaveBeenCalled();
    });
});
