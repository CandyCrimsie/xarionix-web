import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { Subject, of, throwError } from 'rxjs';
import { Actions, ActionDialogs } from './actions';
import { Auth } from '../core/auth';
import { CoreError } from '../core/errors';
import { RequestScope } from '../core/scope';
describe('real Spartan action dialogs', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [ActionDialogs],
      providers: [
        provideRouter([]),
        provideSpartanHlm(),
        { provide: Auth, useValue: { login: vi.fn() } },
      ],
    }),
  );
  it('does not duplicate a pending mutation and does not close on API error', async () => {
    const fixture = TestBed.createComponent(ActionDialogs);
    await fixture.whenStable();
    const actions = TestBed.inject(Actions),
      pending = new Subject<unknown>(),
      execute = vi.fn(() => pending);
    actions.open({
      title: 'Сохранить',
      description: 'Проверка',
      fields: [{ key: 'name', label: 'Название', initial: 'Сеть' }],
      execute,
    });
    await fixture.whenStable();
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    expect(execute).toHaveBeenCalledOnce();
    pending.error(new CoreError(409, 'version_conflict', 'Версия изменилась'));
    await fixture.whenStable();
    expect(actions.current()).not.toBeNull();
    expect(fixture.componentInstance.values['name']).toBe('Сеть');
    expect(fixture.componentInstance.error()?.status).toBe(409);
  });
  it('only reports success after a real successful response', async () => {
    const fixture = TestBed.createComponent(ActionDialogs);
    await fixture.whenStable();
    const done = vi.fn();
    TestBed.inject(Actions).open({
      title: 'Сохранить',
      description: 'Проверка',
      execute: () => of({ id: 1 }),
      done,
    });
    await fixture.whenStable();
    fixture.componentInstance.submit();
    expect(done).toHaveBeenCalledWith({ id: 1 });
    expect(TestBed.inject(Actions).current()).toBeNull();
  });
  it('requires explicit checkbox confirmation for global privilege grants', async () => {
    const fixture = TestBed.createComponent(ActionDialogs);
    await fixture.whenStable();
    const execute = vi.fn(() => of({}));
    TestBed.inject(Actions).open({
      title: 'Назначить',
      description: 'Глобальный доступ',
      fields: [{ key: 'confirmed', label: 'Подтверждаю', type: 'checkbox', required: true }],
      execute,
    });
    await fixture.whenStable();
    fixture.componentInstance.submit();
    expect(execute).not.toHaveBeenCalled();
    fixture.componentInstance.set('confirmed', true);
    fixture.componentInstance.submit();
    expect(execute).toHaveBeenCalledOnce();
  });
  it('clears stale dialogs on company/logout epoch and cancels pending save', async () => {
    const fixture = TestBed.createComponent(ActionDialogs);
    await fixture.whenStable();
    let cancelled = false;
    const pending = new Subject<unknown>();
    const sub = pending.subscribe();
    sub.add(() => (cancelled = true));
    TestBed.inject(Actions).open({
      title: 'Сохранить',
      description: 'Проверка',
      execute: () => pending,
    });
    await fixture.whenStable();
    fixture.componentInstance.submit();
    TestBed.inject(RequestScope).invalidate();
    await fixture.whenStable();
    expect(TestBed.inject(Actions).current()).toBeNull();
    expect(pending.observed).toBe(true);
    sub.unsubscribe();
    expect(cancelled).toBe(true);
  });
  it('keeps MFA refusal without replaying the mutation', async () => {
    const fixture = TestBed.createComponent(ActionDialogs);
    await fixture.whenStable();
    const execute = vi.fn(() =>
      throwError(() => new CoreError(403, 'configured_recent_mfa_required', 'MFA')),
    );
    TestBed.inject(Actions).open({
      title: 'Одобрить',
      description: 'План',
      confirm: true,
      execute,
    });
    await fixture.whenStable();
    fixture.componentInstance.submit();
    expect(execute).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.error()?.mfa).toBe(true);
    expect(TestBed.inject(Actions).current()).not.toBeNull();
  });
});
