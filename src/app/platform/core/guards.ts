import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';
import { uuid } from './models';
import { coreError } from './errors';
export const authGuard: CanActivateFn = async (_route, state) => {
  const session = inject(Session),
    router = inject(Router);
  if (!session.auth.authenticated())
    return router.createUrlTree(['/login'], { queryParams: { returnTo: state.url } });
  if (!session.profile()) await session.load();
  if (!session.profile()) return router.createUrlTree(['/unavailable']);
  return true;
};
export const adminGuard: CanActivateFn = async (_route, state) => {
  const session = inject(Session),
    router = inject(Router);
  if (!session.profile()) await session.load();
  await session.probeAdmin();
  return session.admin() === 'allowed'
    ? true
    : router.createUrlTree(['/unavailable'], { queryParams: { returnTo: state.url } });
};
export const companyGuard: CanActivateFn = async (route) => {
  const session = inject(Session),
    router = inject(Router);
  try {
    await session.ensureCompany(uuid(route.paramMap.get('companyId') ?? ''));
    const permission = route.data['permission'];
    if (typeof permission === 'string' && !session.can(permission))
      return router.createUrlTree(['/unavailable']);
    return true;
  } catch (error) {
    session.error.set(coreError(error));
    return router.createUrlTree(['/unavailable']);
  }
};
