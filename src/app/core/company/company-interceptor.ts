import { HttpInterceptorFn } from '@angular/common/http';

import {
  inject,
} from '@angular/core';

import {
  API_BASE_URL,
} from '../api/api.config';

import {
  CompanyContextService,
} from './company-context.service';

export const companyInterceptor: HttpInterceptorFn = (request, next) => {
  // return next(req);

  const companyContext =
    inject(CompanyContextService);

  /*
   * Чужие запросы не трогаем.
   */
  if (
    !request.url.startsWith(API_BASE_URL)
  ) {
    return next(request);
  }

  /*
   * Auth вообще не относится
   * к company context.
   */
  if (
    request.url.startsWith(
      `${API_BASE_URL}/auth/`,
    )
  ) {
    return next(request);
  }

  /*
   * Этот endpoint нужен как раз
   * для определения доступных компаний,
   * поэтому activeCompany здесь
   * ещё может отсутствовать.
   */
  if (
    request.url ===
    `${API_BASE_URL}/me/companies`
  ) {
    return next(request);
  }

  const companyId =
    companyContext.activeCompanyId();

  if (companyId === null) {
    return next(request);
  }

  const companyRequest =
    request.clone({
      setHeaders: {
        'X-Company-Id':
          String(companyId),
      },
    });

  return next(companyRequest);
};
