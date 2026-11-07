import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { HelloBusinessPage } from './hello-business';
import { Session } from '../core/session';
import { RequestScope } from '../core/scope';
import { CoreError } from '../core/errors';

describe('compiled stateful module UI boundaries', () => {
  let page: HelloBusinessPage;
  const company = signal<{ id: string; name: string } | null>({ id: 'company-a', name: 'A' });
  const permissions = signal(['hello.items.read', 'hello.items.create']);
  const api = { post: vi.fn() };
  let scope: RequestScope;
  beforeEach(() => {
    company.set({ id: 'company-a', name: 'A' });
    permissions.set(['hello.items.read', 'hello.items.create']);
    api.post.mockReset();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Session,
          useFactory: () => ({
            company,
            can: (p: string) => permissions().includes(p),
            api,
            scope: TestBed.inject(RequestScope),
          }),
        },
      ],
    });
    scope = TestBed.inject(RequestScope);
    page = TestBed.runInInjectionContext(() => new HelloBusinessPage());
  });
  const response = (id = 'company-a') => ({
    request_id: 'correlation',
    body: { company_id: id, version: '1.1.0', items: [{ id: 'item', name: 'A1' }] },
  });
  it('uses only the declared operation endpoint and leaves company authority with Core', async () => {
    api.post.mockReturnValue(of(response()));
    page.name.set(' A1 ');
    await page.create();
    expect(api.post).toHaveBeenCalledWith(
      '/companies/company-a/modules/hello-business/operations/items-create',
      { name: 'A1' },
    );
    expect(page.data()?.items[0].name).toBe('A1');
    expect(page.name()).toBe('');
  });
  it('does not invoke create without its effective permission', async () => {
    permissions.set(['hello.items.read']);
    page.name.set('A1');
    await page.create();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('removes old rows immediately and ignores late responses after company switch', async () => {
    const late = new Subject<ReturnType<typeof response>>();
    api.post.mockReturnValue(late);
    const request = page.read();
    scope.invalidate();
    company.set({ id: 'company-b', name: 'B' });
    late.next(response());
    late.complete();
    await request;
    expect(page.data()).toBeNull();
    expect(page.busy()).toBe(false);
  });
  it('rejects a mismatched company response', async () => {
    api.post.mockReturnValue(of(response('company-b')));
    await page.read();
    expect(page.data()).toBeNull();
    expect(page.error()?.code).toBe('module_context_mismatch');
  });
  it('retains input after an uncertain failure and never retries a write', async () => {
    api.post.mockReturnValue(
      throwError(() => new CoreError(504, 'gateway_timeout_outcome_unknown', 'Ошибка')),
    );
    page.name.set('A1');
    await page.create();
    expect(page.name()).toBe('A1');
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(page.error()?.status).toBe(504);
  });
  it('blocks duplicate submits while a request is pending', async () => {
    const pending = new Subject<ReturnType<typeof response>>();
    api.post.mockReturnValue(pending);
    page.name.set('A1');
    const first = page.create();
    await page.create();
    expect(api.post).toHaveBeenCalledTimes(1);
    pending.next(response());
    pending.complete();
    await first;
  });
});
