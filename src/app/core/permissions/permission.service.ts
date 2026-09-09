import { Injectable, computed, inject, signal } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import {
  catchError,
  map,
  Observable,
  of,
  tap,
  throwError,
} from 'rxjs';

import { API_BASE_URL } from '../api/api.config';

import {
  CompanyContextService,
} from '../company/company-context.service';

import {
  EffectivePermissionsResponse,
  PermissionCode,
  PermissionScope,
  PermissionState,
} from './permission.models';


@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly http = inject(HttpClient);

  private readonly companyContext = inject(CompanyContextService);

  private readonly _permissions =
    signal<ReadonlySet<PermissionCode>>(
      new Set(),
    );

  private readonly _scopes =
    signal<
      Readonly<
        Partial<
          Record<
            PermissionCode,
            PermissionScope
          >
        >
      >
    >({});

  private readonly _state = signal<PermissionState>('idle');

  private readonly _loadedCompanyId = signal<number | null>(null);


  readonly permissions = this._permissions.asReadonly();

  readonly scopes = this._scopes.asReadonly();

  readonly state = this._state.asReadonly();

  readonly loadedCompanyId = this._loadedCompanyId.asReadonly();


  readonly isLoading = computed(
    () => this._state() === 'loading',
  );

  readonly isReady = computed(
    () => this._state() === 'ready',
  );


  load(): Observable<void> {
    const companyId =
      this.companyContext.activeCompanyId();

    if (companyId === null) {
      this.reset();

      return of(undefined);
    }

    this._state.set('loading');

    return this.http
      .get<EffectivePermissionsResponse>(
        `${API_BASE_URL}/me/permissions`,
      )
      .pipe(
        tap(response => {
          /*
           * Пока HTTP request выполнялся,
           * пользователь мог переключить
           * компанию.
           *
           * Ответ старой компании нельзя
           * записывать в current state.
           */
          if (
            this.companyContext
              .activeCompanyId()
            !== companyId
          ) {
            return;
          }

          this._permissions.set(
            new Set(
              response.permissions,
            ),
          );

          this._scopes.set({
            ...response.scopes,
          });

          this._loadedCompanyId.set(
            companyId,
          );

          this._state.set('ready');
        }),

        map(() => undefined),

        catchError(error => {
          /*
           * Ошибка старого запроса после
           * company switch тоже не должна
           * портить state новой компании.
           */
          if (
            this.companyContext
              .activeCompanyId()
            === companyId
          ) {
            this.clearPermissions();
            this._state.set('error');
          }

          return throwError(
            () => error,
          );
        }),
      );
  }


  has(
    permission: PermissionCode,
  ): boolean {
    return this._permissions().has(
      permission,
    );
  }


  scope(
    permission: PermissionCode,
  ): PermissionScope | null {
    return (
      this._scopes()[permission]
      ?? null
    );
  }


  reset(): void {
    this.clearPermissions();

    this._state.set('idle');
  }


  private clearPermissions(): void {
    this._permissions.set(
      new Set(),
    );

    this._scopes.set({});

    this._loadedCompanyId.set(null);
  }
}
