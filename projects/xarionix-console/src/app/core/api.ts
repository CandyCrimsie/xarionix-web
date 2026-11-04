import { HttpClient, HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, takeUntil, throwError } from 'rxjs';
import { Auth } from './auth';
import { Config } from './config';
import { coreError } from './errors';
import { RequestScope } from './scope';
import type { Page } from './models';

export const CORE_REQUEST = new HttpContextToken(() => false);
export const coreInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.context.get(CORE_REQUEST)) return next(request);
  const auth = inject(Auth),
    config = inject(Config).value,
    scope = inject(RequestScope);
  const url = new URL(request.url, location.origin),
    api = new URL(config.coreApi, location.origin),
    health = new URL(config.coreHealth, location.origin);
  const apiPath = url.pathname === api.pathname || url.pathname.startsWith(`${api.pathname}/`);
  if (
    url.origin !== api.origin ||
    (!apiPath &&
      ![`${health.pathname}/health/live`, `${health.pathname}/health/ready`].includes(url.pathname))
  )
    return throwError(() => new Error('Недоверенный адрес Core'));
  const token = apiPath ? auth.token() : null;
  request = request.clone({
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    withCredentials: false,
  });
  return next(request).pipe(
    takeUntil(scope.changed),
    catchError((error) => {
      const safe = coreError(error);
      if (safe.status === 403) scope.denied.next({ path: url.pathname, mfa: safe.mfa });
      if (safe.status === 401 || safe.code === 'user_suspended') auth.expire();
      return throwError(() => safe);
    }),
  );
};
@Injectable({ providedIn: 'root' })
export class CoreApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(Config);
  private context(): HttpContext {
    return new HttpContext().set(CORE_REQUEST, true);
  }
  url(path: string): string {
    if (!/^\/(?!\/)[A-Za-z0-9_/-]*$/.test(path)) throw new Error('Некорректный путь API');
    return `${this.config.value.coreApi}${path}`;
  }
  get<T>(path: string, params: Record<string, string | number> = {}) {
    return this.http.get<T>(this.url(path), { context: this.context(), params });
  }
  page<T>(path: string, offset = 0, limit = 20) {
    return this.http.get<Page<T>>(this.url(path), {
      context: this.context(),
      params: { limit, offset },
    });
  }
  post<T>(path: string, body: unknown = {}) {
    return this.http.post<T>(this.url(path), body, { context: this.context() });
  }
  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(this.url(path), body, { context: this.context() });
  }
  put<T>(path: string, body: unknown) {
    return this.http.put<T>(this.url(path), body, { context: this.context() });
  }
  delete<T>(path: string) {
    return this.http.delete<T>(this.url(path), { context: this.context() });
  }
  health() {
    return this.http.get<{ status: string }>(`${this.config.value.coreHealth}/health/ready`, {
      context: this.context(),
    });
  }
  upload(file: File) {
    return this.http.post<import('./models').Package>(this.url('/platform/packages'), file, {
      context: this.context(),
      headers: { 'Content-Type': 'application/vnd.xarionix.package+zip' },
      observe: 'events',
      reportProgress: true,
    });
  }
}
