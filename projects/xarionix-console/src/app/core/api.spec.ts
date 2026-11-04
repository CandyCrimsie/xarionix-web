import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  HttpEventType,
  HttpErrorResponse,
  HttpHeaders,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CoreApi, CORE_REQUEST, coreInterceptor } from './api';
import { Config } from './config';
import { Auth } from './auth';
import { RequestScope } from './scope';
import { coreError } from './errors';
describe('Core API isolation and real request contracts', () => {
  let api: CoreApi, http: HttpTestingController;
  const auth = { token: () => 'memory-only-access', expire: vi.fn() };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([coreInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
        {
          provide: Config,
          useValue: { value: { coreApi: '/core-api/api/v1', coreHealth: '/core-api' } },
        },
      ],
    });
    api = TestBed.inject(CoreApi);
    http = TestBed.inject(HttpTestingController);
    auth.expire.mockClear();
  });
  afterEach(() => http.verify());
  it('attaches bearer only to the marked same-origin Core API', () => {
    api.get('/me').subscribe();
    expect(http.expectOne('/core-api/api/v1/me').request.headers.get('Authorization')).toBe(
      'Bearer memory-only-access',
    );
    TestBed.inject(HttpClient).get('https://untrusted.test/data').subscribe();
    expect(http.expectOne('https://untrusted.test/data').request.headers.has('Authorization')).toBe(
      false,
    );
  });
  it('never attaches bearer to public health endpoints', () => {
    api.health().subscribe();
    expect(http.expectOne('/core-api/health/ready').request.headers.has('Authorization')).toBe(
      false,
    );
  });
  it('refuses an external URL even if a caller marks it as Core', () => {
    let error: unknown;
    TestBed.inject(HttpClient)
      .get('https://untrusted.test/data', { context: new HttpContext().set(CORE_REQUEST, true) })
      .subscribe({ error: (e) => (error = e) });
    http.expectNone('https://untrusted.test/data');
    expect(error).toBeInstanceOf(Error);
  });
  it('keeps bounded server pagination and comparison query parameters', () => {
    api.page('/platform/packages', 40, 20).subscribe();
    const request = http.expectOne('/core-api/api/v1/platform/packages?limit=20&offset=40');
    request.flush({ items: [], offset: 40, limit: 20, total: 40 });
    api.get('/platform/packages/abc/diff', { previous_id: '123' }).subscribe();
    http.expectOne('/core-api/api/v1/platform/packages/abc/diff?previous_id=123');
  });
  it('uploads a File as raw xpkg bytes and reports actual HTTP progress', () => {
    const file = new File(['binary'], 'a.xpkg');
    const events: number[] = [];
    api.upload(file).subscribe((event) => events.push(event.type));
    const req = http.expectOne('/core-api/api/v1/platform/packages');
    expect(req.request.body).toBe(file);
    expect(req.request.body).not.toBeInstanceOf(FormData);
    expect(req.request.reportProgress).toBe(true);
    expect(req.request.headers.get('Content-Type')).toBe('application/vnd.xarionix.package+zip');
    req.event({ type: HttpEventType.UploadProgress, loaded: 3, total: 6 });
    req.flush({ id: 'id' });
    expect(events).toContain(HttpEventType.UploadProgress);
  });
  it('cancels in-flight old-company HTTP and prevents stale success', () => {
    const next = vi.fn();
    api.get('/me').subscribe(next);
    const req = http.expectOne('/core-api/api/v1/me');
    TestBed.inject(RequestScope).invalidate();
    expect(req.cancelled).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
  it('expires the session on 401 and surfaces a safe request ID', () => {
    let error: ReturnType<typeof coreError> | undefined;
    api.get('/me').subscribe({ error: (e) => (error = e) });
    http.expectOne('/core-api/api/v1/me').flush(
      { detail: 'Unauthorized' },
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'X-Request-ID': 'safe-request-123' },
      },
    );
    expect(auth.expire).toHaveBeenCalledOnce();
    expect(error?.requestId).toBe('safe-request-123');
  });
  it('does not swallow access denial and broadcasts permission revalidation', () => {
    const denied = vi.fn();
    TestBed.inject(RequestScope).denied.subscribe(denied);
    api.get('/companies/id/members').subscribe({ error: () => {} });
    http
      .expectOne('/core-api/api/v1/companies/id/members')
      .flush({ detail: { code: 'permission_denied' } }, { status: 403, statusText: 'Forbidden' });
    expect(denied).toHaveBeenCalledWith({
      path: '/core-api/api/v1/companies/id/members',
      mfa: false,
    });
  });
});
describe('FastAPI error normalization', () => {
  it.each([400, 401, 403, 404, 409, 413, 422, 429, 503])(
    'handles HTTP %s without echoing arbitrary payload',
    (status) => {
      const e = coreError(
        new HttpErrorResponse({ status, error: { detail: 'JWT secret stacktrace' } }),
      );
      expect(e.status).toBe(status);
      expect(e.message).not.toContain('JWT');
    },
  );
  it('recognizes actual recent-MFA code', () =>
    expect(
      coreError(
        new HttpErrorResponse({
          status: 403,
          error: { detail: { code: 'configured_recent_mfa_required' } },
        }),
      ).mfa,
    ).toBe(true));
  it('maps validation locations to inline errors without input or ctx', () => {
    const e = coreError(
      new HttpErrorResponse({
        status: 422,
        error: {
          detail: [{ loc: ['body', 'name'], input: 'private', ctx: 'private', msg: 'private' }],
        },
      }),
    );
    expect(e.fields).toEqual({ name: 'Проверьте значение' });
    expect(e.message).not.toContain('private');
  });
  it('does not trust a malformed response request ID', () =>
    expect(
      coreError(
        new HttpErrorResponse({
          status: 500,
          headers: new HttpHeaders({ 'X-Request-ID': '<script>' }),
        }),
      ).requestId,
    ).toBeNull());
});
