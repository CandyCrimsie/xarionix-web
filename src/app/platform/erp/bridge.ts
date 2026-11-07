import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { NEVER, Subject, catchError, firstValueFrom, takeUntil, throwError } from 'rxjs';
import { Auth } from '../core/auth';
import { Config } from '../core/config';
import { Session } from '../core/session';
import { RequestScope } from '../core/scope';
import type { User } from '../../core/auth/auth.models';
import type { Company } from '../../core/company/company.models';

export interface ErpContext {
  core_user_id: string;
  core_company_id: string;
  user: User;
  company: Company;
  permissions: string[];
  scopes: Record<string, string>;
}
export const ERP_BOOTSTRAP = new HttpContextToken(() => false);
const erpPath = (path: string) =>
  /^\/api\/v1\/(?:map(?:\/|$)|address-objects(?:\/|$)|address-types(?:\/|$)|buildings(?:\/|$)|entrances(?:\/|$)|locations(?:\/|$)|me\/(?:permissions|profile)$)/.test(
    path,
  );

@Injectable({ providedIn: 'root' })
export class ErpBridge {
  readonly session = inject(Session);
  private readonly http = inject(HttpClient);
  private readonly config = inject(Config);
  private readonly scope = inject(RequestScope);
  private readonly snapshot = signal<{ epoch: number; data: ErpContext } | null>(null);
  readonly changed = new Subject<number | null>();
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly context = computed(() => {
    const value = this.snapshot();
    return value?.epoch === this.scope.epoch() &&
      value.data.core_company_id === this.session.company()?.id &&
      value.data.core_user_id === this.session.profile()?.user_id &&
      this.session.auth.authenticated()
      ? value.data
      : null;
  });
  constructor() {
    const subscription = this.scope.changed.subscribe(() => this.reset());
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    effect(() => {
      if (!this.session.auth.authenticated()) this.reset();
    });
  }
  reset(): void {
    this.snapshot.set(null);
    this.loading.set(false);
    this.error.set(false);
    this.changed.next(null);
  }
  async load(): Promise<void> {
    if (!this.config.value.erpEnabled || !this.session.company() || this.loading()) return;
    const company = this.session.company()!,
      epoch = this.scope.epoch();
    this.snapshot.set(null);
    this.changed.next(null);
    this.loading.set(true);
    this.error.set(false);
    try {
      const value = await firstValueFrom(
        this.http.get<ErpContext>('/api/v1/auth/platform-context', {
          context: new HttpContext().set(ERP_BOOTSTRAP, true),
        }),
      );
      if (epoch !== this.scope.epoch()) return;
      if (
        value.core_company_id !== company.id ||
        value.core_user_id !== this.session.profile()?.user_id ||
        !Number.isSafeInteger(value.company?.id) ||
        value.company.id <= 0 ||
        !Number.isSafeInteger(value.user?.id) ||
        value.user.id <= 0 ||
        !value.company.is_active ||
        !value.user.is_active ||
        !Array.isArray(value.permissions)
      )
        throw new Error('Неподтверждённый контекст ERP');
      this.snapshot.set({ epoch, data: value });
      this.changed.next(value.company.id);
    } catch {
      if (epoch === this.scope.epoch()) this.error.set(true);
    } finally {
      if (epoch === this.scope.epoch()) this.loading.set(false);
    }
  }
}

export const erpInterceptor: HttpInterceptorFn = (request, next) => {
  const url = new URL(request.url, location.origin);
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/v1/')) return next(request);
  const auth = inject(Auth),
    config = inject(Config),
    scope = inject(RequestScope),
    bridge = inject(ErpBridge);
  const bootstrap =
    request.context.get(ERP_BOOTSTRAP) &&
    url.pathname === '/api/v1/auth/platform-context' &&
    request.method === 'GET';
  const company = bridge.session.company(),
    context = bridge.context();
  if (
    !config.value.erpEnabled ||
    !auth.token() ||
    !company ||
    (!bootstrap && (!context || !erpPath(url.pathname)))
  )
    return throwError(() => new Error('Контекст ERP недоступен'));
  let headers = request.headers
    .delete('Cookie')
    .delete('X-Company-Id')
    .delete('X-Core-Company-Id')
    .delete('Authorization');
  headers = headers
    .set('Authorization', `Bearer ${auth.token()}`)
    .set('X-Core-Company-Id', company.id);
  if (!bootstrap && context) headers = headers.set('X-Company-Id', String(context.company.id));
  return next(request.clone({ headers, withCredentials: false })).pipe(
    takeUntil(scope.changed),
    takeUntil(bootstrap ? NEVER : bridge.changed),
    catchError((error) => {
      if ([401, 403].includes(error?.status)) bridge.reset();
      // A failure never invokes the legacy password/refresh mechanism or retries writes.
      return throwError(() => error);
    }),
  );
};
