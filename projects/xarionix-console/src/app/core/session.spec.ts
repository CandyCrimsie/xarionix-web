import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { Session } from './session';
import { CoreApi } from './api';
import { Auth } from './auth';
import { CoreError } from './errors';
import { Company, EffectivePermissions, UUID } from './models';
describe('server-derived capabilities and company isolation', () => {
  const api = { get: vi.fn() };
  beforeEach(() => {
    api.get.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: { authenticated: signal(true) } },
        { provide: CoreApi, useValue: api },
      ],
    });
  });
  it('does not infer Platform Admin from a JWT role', async () => {
    api.get.mockReturnValue(
      throwError(() => new CoreError(403, 'platform_admin_required', 'Denied')),
    );
    const session = TestBed.inject(Session);
    await session.probeAdmin();
    expect(session.admin()).toBe('denied');
  });
  it('recognizes the server-authorized MFA challenge, without granting fresh admin state', async () => {
    api.get.mockReturnValue(
      throwError(() => new CoreError(403, 'configured_recent_mfa_required', 'MFA')),
    );
    const session = TestBed.inject(Session);
    await session.probeAdmin();
    expect(session.admin()).toBe('mfa');
  });
  it('does not treat service outage as an admin grant', async () => {
    api.get.mockReturnValue(throwError(() => new CoreError(503, 'http_503', 'Offline')));
    const session = TestBed.inject(Session);
    await session.probeAdmin();
    expect(session.admin()).toBe('unknown');
  });
  it('discards a late permission response from the previous company', async () => {
    const old = new Subject<EffectivePermissions>();
    api.get.mockReturnValueOnce(old).mockReturnValueOnce(
      of({
        company_id: 'b',
        membership_id: 'm',
        owner: false,
        permissions: ['core.employees.read'],
      }),
    );
    const session = TestBed.inject(Session);
    const first = session.select({ id: 'a', name: 'A' } as Company);
    const second = session.select({ id: 'b', name: 'B' } as Company);
    await second;
    old.next({
      company_id: 'a' as UUID,
      membership_id: 'm' as UUID,
      owner: true,
      permissions: ['core.roles.manage'],
    });
    old.complete();
    await first;
    expect(session.company()?.name).toBe('B');
    expect(session.can('core.employees.read')).toBe(true);
    expect(session.can('core.roles.manage')).toBe(false);
  });
});
