import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AddressDependenciesDialog, type AddressDependencyConflict } from './address-dependencies-dialog';

describe('AddressDependenciesDialog', () => {
    let fixture: ComponentFixture<AddressDependenciesDialog>;
    let trigger: HTMLButtonElement;
    const conflict: AddressDependencyConflict = { code: 'object_has_dependencies', message: 'Невозможно удалить дом',
        object: { kind: 'building', id: 53 }, dependencies: [
            { type: 'map_connection', count: 1, items: [{ id: 128, medium: 'fiber', name: 'Магистраль', source_name: 'Узел A', target_name: 'Дом 53' }] },
            { type: 'entrance', count: 2 }, { type: 'restricted', message: 'Есть недоступные связи.' },
        ] };
    const settle = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [AddressDependenciesDialog] }).compileComponents();
        fixture = TestBed.createComponent(AddressDependenciesDialog); fixture.detectChanges();
        trigger = document.createElement('button'); trigger.textContent = 'Удалить дом'; document.body.append(trigger); trigger.focus();
        fixture.componentInstance.show(conflict, trigger); await settle();
    });
    afterEach(() => { fixture.destroy(); trigger.remove(); });
    it('shows a single grouped accessible dialog with one close action and no cross', () => {
        const dialog = document.body.querySelector('[role="alertdialog"]')!;
        expect(dialog.textContent).toContain('Оптическая линия №128');
        expect(dialog.textContent).toContain('Узел A → Дом 53');
        expect(dialog.textContent).toContain('Подъезды');
        expect(dialog.querySelectorAll('button')).toHaveLength(1);
        expect(dialog.querySelector('button')?.textContent).toContain('Закрыть');
        fixture.componentInstance.show(conflict, trigger); fixture.detectChanges();
        expect(document.body.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    });
    it.each(['button', 'backdrop', 'escape'])('closes using %s and restores focus', async method => {
        if (method === 'button') document.body.querySelector<HTMLButtonElement>('[data-testid="close-address-dependencies"]')!.click();
        if (method === 'backdrop') document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
        if (method === 'escape') document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await settle();
        expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });
});
