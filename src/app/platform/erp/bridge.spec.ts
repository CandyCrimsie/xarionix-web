import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ErpBridge, erpInterceptor } from './bridge';
import { Session } from '../core/session';
import { Config } from '../core/config';
import { Auth } from '../core/auth';
import { RequestScope } from '../core/scope';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const company = '12345678-1234-1234-1234-123456789abc';
const user = '23456789-1234-1234-1234-123456789abc';
const response = {
  core_user_id: user,
  core_company_id: company,
  user: { id: 11, username: 'engineer', is_active: true },
  company: { id: 31, name: 'ERP', is_active: true },
  permissions: ['addresses.read'],
  scopes: { 'addresses.read': 'company' },
};
describe('explicit Core / ERP compatibility boundary', () => {
  let bridge: ErpBridge, http: HttpTestingController, scope: RequestScope;
  const activeCompany = signal({ id: company });
  const authenticated = signal(true);
  beforeEach(() => {
    activeCompany.set({ id: company });
    authenticated.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([erpInterceptor])),
        provideHttpClientTesting(),
        {
          provide: Session,
          useValue: {
            company: activeCompany,
            profile: signal({ user_id: user }),
            auth: { authenticated },
          },
        },
        { provide: Auth, useValue: { token: () => 'opaque-verified-by-server' } },
        { provide: Config, useValue: { value: { erpEnabled: true } } },
      ],
    });
    bridge = TestBed.inject(ErpBridge);
    http = TestBed.inject(HttpTestingController);
    scope = TestBed.inject(RequestScope);
  });
  afterEach(() => http.verify());
  it('uses server numeric IDs, one Core token and no legacy login or refresh', async () => {
    const loaded = bridge.load();
    const bootstrap = http.expectOne('/api/v1/auth/platform-context');
    expect(bootstrap.request.headers.get('X-Core-Company-Id')).toBe(company);
    expect(bootstrap.request.headers.has('X-Company-Id')).toBe(false);
    expect(bootstrap.request.withCredentials).toBe(false);
    bootstrap.flush(response);
    await loaded;
    expect(bridge.context()?.company.id).toBe(31);
    const pending = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/map/markers'));
    const markers = http.expectOne('/api/v1/map/markers');
    expect(markers.request.headers.get('X-Company-Id')).toBe('31');
    expect(markers.request.headers.get('Authorization')).toBe('Bearer opaque-verified-by-server');
    markers.flush([]);
    await pending;
    await expect(
      firstValueFrom(TestBed.inject(HttpClient).post('/api/v1/auth/refresh', {})),
    ).rejects.toThrow();
    http.expectNone('/api/v1/auth/refresh');
  });
  it('never casts UUIDs or invents a mapping when ERP is unlinked', async () => {
    const loaded = bridge.load();
    http
      .expectOne('/api/v1/auth/platform-context')
      .flush({ detail: 'core_identity_unlinked' }, { status: 403, statusText: 'Forbidden' });
    await loaded;
    expect(bridge.context()).toBeNull();
    expect(bridge.error()).toBe(true);
  });
  it('clears old numeric context synchronously and ignores a late company response', async () => {
    const loaded = bridge.load();
    const request = http.expectOne('/api/v1/auth/platform-context');
    scope.invalidate();
    activeCompany.set({ id: '34567890-1234-1234-1234-123456789abc' });
    expect(request.cancelled).toBe(true);
    await loaded;
    expect(bridge.context()).toBeNull();
    expect(bridge.error()).toBe(false);
  });
  it('rejects a mismatched server identity even on HTTP 200', async () => {
    const loaded = bridge.load();
    http.expectOne('/api/v1/auth/platform-context').flush({ ...response, core_user_id: company });
    await loaded;
    expect(bridge.context()).toBeNull();
    expect(bridge.error()).toBe(true);
  });
  it('cancels in-flight map requests and clears data on logout', async () => {
    const loaded = bridge.load();
    http.expectOne('/api/v1/auth/platform-context').flush(response);
    await loaded;
    const pending = firstValueFrom(TestBed.inject(HttpClient).get('/api/v1/map/markers')).catch(
      () => null,
    );
    const request = http.expectOne('/api/v1/map/markers');
    scope.invalidate();
    authenticated.set(false);
    expect(bridge.context()).toBeNull();
    expect(request.cancelled).toBe(true);
    await pending;
  });
});
