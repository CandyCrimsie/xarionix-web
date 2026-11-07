import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { adminGuard } from './core/guards';
import { Session } from './core/session';
import { Auth } from './core/auth';
import { routes } from './app.routes';
import { Shell } from './shell';

@Component({ template: '' })
class EmptyPage {}

describe('Единая оболочка Xarionix и серверный доступ', () => {
  const session = {
    admin: signal('denied'),
    profile: signal({ display_name: 'Инженер', principal_type: 'human' }),
    company: signal(null),
    permissions: signal(null),
    can: () => false,
    load: vi.fn(),
    probeAdmin: vi.fn(),
    auth: {
      state: signal('authenticated'),
      authenticated: () => true,
      login: vi.fn(),
      logout: vi.fn(),
    },
  };
  beforeEach(() => {
    session.admin.set('denied');
    session.probeAdmin.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: EmptyPage }]),
        { provide: Session, useValue: session },
        { provide: Auth, useValue: session.auth },
      ],
    });
  });
  it.each(['denied', 'unknown', 'mfa'])('не открывает /admin/modules при %s', async (state) => {
    session.admin.set(state);
    const result = await TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, { url: '/admin/modules' } as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      '/unavailable?returnTo=%2Fadmin%2Fmodules',
    );
    expect(session.probeAdmin).toHaveBeenCalledOnce();
  });
  it('разрешает маршрут только после свежей серверной проверки', async () => {
    session.admin.set('allowed');
    expect(
      await TestBed.runInInjectionContext(() =>
        adminGuard({} as ActivatedRouteSnapshot, { url: '/admin/modules' } as RouterStateSnapshot),
      ),
    ).toBe(true);
  });
  it('показывает одну оболочку без административного меню обычному пользователю', async () => {
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelectorAll('[data-testid="unified-shell"]').length).toBe(1);
    expect(element.textContent).toContain('Xarionix');
    expect(element.textContent).not.toContain('Console');
    expect(element.querySelector('a[href^="/admin"]')).toBeNull();
    expect(element.querySelector('a[href="/addresses"]')).not.toBeNull();
    fixture.destroy();
  });
  it('встраивает администратора в ту же навигацию', async () => {
    session.admin.set('allowed');
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Администрирование');
    expect(fixture.nativeElement.querySelector('a[href="/admin/modules/packages"]')).not.toBeNull();
    fixture.destroy();
  });
  it('содержит один login и ленивую административную границу', () => {
    expect(routes.filter((r) => r.path === 'login')).toHaveLength(1);
    const shell = routes.find((r) => r.path === '')!;
    const admin = shell.children!.find((r) => r.path === 'admin')!;
    expect(admin.loadChildren).toBeDefined();
    expect(admin.canActivate).toContain(adminGuard);
    expect(admin.canActivateChild).toContain(adminGuard);
    expect(shell.children!.find((r) => r.path === 'addresses')!.loadComponent).toBeDefined();
  });
});
