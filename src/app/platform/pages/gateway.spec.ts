import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { GatewayPage } from './gateway';
import { Session } from '../core/session';
import { RequestScope } from '../core/scope';
import { Config } from '../core/config';
import { Actions, ActionForm } from '../shared/actions';

describe('administrative gateway identity metadata', () => {
  const api = { get: vi.fn(), patch: vi.fn(), page: vi.fn() };
  const actions = { open: vi.fn() };
  let page: GatewayPage, scope: RequestScope;
  beforeEach(() => {
    vi.clearAllMocks();
    api.page.mockReturnValue(
      of({ items: [{ id: 'host-a', name: 'A', status: 'active' }], limit: 20, offset: 0 }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: Session, useFactory: () => ({ api, scope: TestBed.inject(RequestScope) }) },
        { provide: Config, useValue: { value: { issuer: 'https://id.example.test' } } },
        { provide: Actions, useValue: actions },
      ],
    });
    scope = TestBed.inject(RequestScope);
    page = TestBed.runInInjectionContext(() => new GatewayPage());
  });
  it('clears an obsolete binding and ignores a late response after scope invalidation', async () => {
    const response = new Subject<object>();
    api.get.mockReturnValue(response);
    const request = page.select('host-a');
    scope.invalidate();
    response.next({ host_id: 'host-a', identity: { revision: 1 } });
    response.complete();
    await request;
    expect(page.binding()).toBeNull();
    expect(page.selected()).toBeNull();
  });
  it('binds a status mutation to the displayed server revision', async () => {
    api.get.mockReturnValue(
      of({
        host_id: 'host-a',
        identity: {
          issuer: 'https://id.example.test',
          subject: 's',
          client_id: 'g',
          revision: 7,
          status: 'active',
        },
      }),
    );
    await page.select('host-a');
    page.change('revoked');
    const action = actions.open.mock.calls[0][0] as ActionForm;
    action.execute({});
    expect(api.patch).toHaveBeenCalledWith('/platform/deployment-hosts/host-a/gateway-identity', {
      status: 'revoked',
      expected_revision: 7,
    });
    expect(action.destructive).toBe(true);
  });
  it('does not invent gateway identity for an unknown host', async () => {
    await page.select('unknown');
    expect(api.get).not.toHaveBeenCalled();
  });
});
