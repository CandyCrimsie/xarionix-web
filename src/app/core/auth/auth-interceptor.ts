import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';

import {
  inject,
} from '@angular/core';

import {
  Router,
} from '@angular/router';

import {
  catchError,
  switchMap,
  throwError,
} from 'rxjs';

import {
  API_BASE_URL,
} from '../api/api.config';

import {
  AuthService,
} from './auth.service';


export const authInterceptor: HttpInterceptorFn = (
  request,
  next,
) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  /*
   * Чужие URL вообще не трогаем.
   */
  if (!request.url.startsWith(API_BASE_URL)) {
    return next(request);
  }

  const loginUrl =
    `${API_BASE_URL}/auth/login`;

  const registerUrl =
    `${API_BASE_URL}/auth/register`;

  const refreshUrl =
    `${API_BASE_URL}/auth/refresh`;

  /*
   * Эти endpoint'ы не используют Access JWT
   * и не должны запускать automatic refresh.
   */
  const isPublicAuthRequest =
    request.url === loginUrl ||
    request.url === registerUrl ||
    request.url === refreshUrl;

  if (isPublicAuthRequest) {
    return next(request);
  }

  /*
   * Запоминаем JWT, с которым отправился
   * первоначальный запрос.
   */
  const tokenAtRequest = auth.accessToken();

  const authenticatedRequest = tokenAtRequest
    ? withBearerToken(
      request,
      tokenAtRequest,
    )
    : request;

  return next(
    authenticatedRequest,
  ).pipe(
    catchError(error => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401
      ) {
        return throwError(() => error);
      }

      const currentToken =
        auth.accessToken();

      if (
        currentToken &&
        currentToken !== tokenAtRequest
      ) {
        return next(
          withBearerToken(
            request,
            currentToken,
          ),
        );
      }

      return auth.refresh().pipe(
        catchError(refreshError => {
          if (
            refreshError instanceof HttpErrorResponse &&
            (
              refreshError.status === 401 ||
              refreshError.status === 403
            )
          ) {
            auth.invalidateLocalSession();

            void router.navigateByUrl(
              '/login',
            );
          }

          return throwError(
            () => refreshError,
          );
        }),

        switchMap(() => {
          const newToken =
            auth.accessToken();

          if (!newToken) {
            return throwError(
              () => new Error(
                'Access token is missing after refresh',
              ),
            );
          }

          return next(
            withBearerToken(
              request,
              newToken,
            ),
          );
        }),
      );
    }),
  );
};


function withBearerToken(
  request: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}