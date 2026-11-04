import { moduleNavigation } from './navigation';
import { ConsoleRouteReuse } from './route-reuse';
import { ActivatedRouteSnapshot } from '@angular/router';
describe('future module navigation boundary', () => {
  const compiled = new Map([['reviewed-module', '/modules/reviewed-module']]);
  const permissions = new Set(['reviewed.objects.read']);
  const metadata = {
    moduleId: 'reviewed-module',
    label: 'Проверенный модуль',
    icon: 'package',
    permission: 'reviewed.objects.read',
  };
  it('accepts only a reviewed compiled implementation with an effective permission', () =>
    expect(moduleNavigation(metadata, compiled, permissions)?.path).toBe(
      '/modules/reviewed-module',
    ));
  it.each([
    { moduleId: 'unknown' },
    { icon: '<svg onload=alert(1)>' },
    { permission: 'core.roles.manage' },
    { path: 'https://evil.test/app.js' },
    { url: 'javascript:alert(1)' },
  ])('rejects untrusted or unauthorized metadata', (extra) =>
    expect(moduleNavigation({ ...metadata, ...extra }, compiled, permissions)).toBeNull(),
  );
  it('does not load an imported frontend artifact as a module', () =>
    expect(moduleNavigation(metadata, new Map(), permissions)).toBeNull());
  it('rejects external URLs even in a malformed compiled registry', () =>
    expect(
      moduleNavigation(metadata, new Map([['reviewed-module', 'https://evil.test']]), permissions),
    ).toBeNull());
});
describe('detail route lifecycle', () => {
  const strategy = new ConsoleRouteReuse();
  const config = { path: 'runtime/:id' };
  const route = (id: string) =>
    ({ routeConfig: config, params: { id } }) as unknown as ActivatedRouteSnapshot;
  it('reuses the same detail UUID', () =>
    expect(strategy.shouldReuseRoute(route('a'), route('a'))).toBe(true));
  it('does not reuse another company or plan UUID with stale detail state', () =>
    expect(strategy.shouldReuseRoute(route('a'), route('b'))).toBe(false));
});
