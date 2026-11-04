import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { of } from 'rxjs';
import { Session } from '../core/session';
import { CoreApi } from '../core/api';
import { RequestScope } from '../core/scope';
import { RolePicker } from './role-picker';
import { PermissionPicker } from './permission-picker';
import { DataTable } from './data-table';

describe('Spartan selection controls and server tables', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideSpartanHlm()],
    });
  });

  it('labels each role independently and selects the clicked role, not the first one', async () => {
    TestBed.overrideProvider(Session, {
      useValue: {
        company: signal({ id: 'company' }),
        api: {
          page: () =>
            of({
              items: [
                { id: 'admin', name: 'Администратор', code: 'admin', active: true },
                { id: 'engineer', name: 'Инженер сети', code: 'engineer', active: true },
              ],
              limit: 20,
              offset: 0,
              total: 2,
            }),
        },
      },
    });
    const fixture = TestBed.createComponent(RolePicker);
    await fixture.whenStable();
    const labels = fixture.nativeElement.querySelectorAll('label') as NodeListOf<HTMLLabelElement>;
    const inputs = fixture.nativeElement.querySelectorAll(
      'button[role=checkbox]',
    ) as NodeListOf<HTMLButtonElement>;
    expect(inputs).toHaveLength(2);
    expect(inputs[0].id).not.toBe(inputs[1].id);
    expect(inputs[1].labels?.[0].textContent).toContain('Инженер сети');
    labels[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toEqual(['engineer']);
    TestBed.inject(RequestScope).invalidate();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('Инженер сети');
  });

  it('searches catalogue descriptions without changing already selected permission keys', async () => {
    TestBed.overrideProvider(CoreApi, {
      useValue: {
        page: () =>
          of({
            items: [
              { key: 'core.employees.read', description: 'Просмотр сотрудников' },
              { key: 'core.roles.manage', description: 'Управление ролями' },
            ],
            limit: 20,
            offset: 0,
            total: 2,
          }),
      },
    });
    const fixture = TestBed.createComponent(PermissionPicker);
    fixture.componentRef.setInput('selected', ['core.roles.manage']);
    await fixture.whenStable();
    fixture.componentInstance.query.set('сотрудников');
    await fixture.whenStable();
    const labels = fixture.nativeElement.querySelectorAll('label') as NodeListOf<HTMLLabelElement>;
    expect(labels).toHaveLength(1);
    labels[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toEqual([
      'core.roles.manage',
      'core.employees.read',
    ]);
  });

  it('shows a truthful empty range and prevents paging beyond the server total', async () => {
    const fixture = TestBed.createComponent(DataTable);
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('page', { items: [], limit: 20, offset: 0, total: 0 });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('0–0');
    expect(fixture.nativeElement.textContent).toContain('Здесь пока нет записей');
    const next = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'Далее',
    ) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });
});
