import {
  computed,
  inject,
  Injectable,
  Signal,
  signal,
} from '@angular/core';

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

import {
  isScopeAtLeast,
} from './permission.utils';


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

  readonly isCurrentContextReady =
    computed(() => {
      const companyId =
        this.companyContext.activeCompanyId();

      return (
        this._state() === 'ready'
        && companyId !== null
        && this._loadedCompanyId()
        === companyId
      );
    });


  initialize(): Observable<void> {
    const companyId =
      this.companyContext.activeCompanyId();

    if (companyId === null) {
      this.reset();

      return of(undefined);
    }

    /*
     * Permissions для этой компании
     * уже загружены.
     *
     * Повторный initializer не должен
     * делать лишний HTTP request.
     */
    if (
      this._state() === 'ready'
      && this._loadedCompanyId()
      === companyId
    ) {
      return of(undefined);
    }

    /*
     * Ошибка permissions не должна
     * ломать bootstrap всего Angular.
     *
     * load() сам переведёт state в error
     * и очистит старые permissions.
     */
    return this.load().pipe(
      catchError(() =>
        of(undefined),
      ),
    );
  }


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


  hasAny(
    permissions: readonly PermissionCode[],
  ): boolean {
    if (!this.isCurrentContextReady()) {
      return false;
    }

    return permissions.some(
      permission =>
        this._permissions().has(
          permission,
        ),
    );
  }


  hasAll(
    permissions: readonly PermissionCode[],
  ): boolean {
    if (!this.isCurrentContextReady()) {
      return false;
    }

    return permissions.every(
      permission =>
        this._permissions().has(
          permission,
        ),
    );
  }


  hasMinimumScope(
    permission: PermissionCode,
    minimumScope: PermissionScope,
  ): boolean {
    if (!this.isCurrentContextReady()) {
      return false;
    }

    if (
      !this._permissions().has(
        permission,
      )
    ) {
      return false;
    }

    const actualScope =
      this.scope(
        permission,
      );

    if (actualScope === null) {
      return false;
    }

    return isScopeAtLeast(
      actualScope,
      minimumScope,
    );
  }


  can(
    permission: PermissionCode,
    minimumScope?: PermissionScope,
  ): boolean {
    if (!this.isCurrentContextReady()) {
      return false;
    }

    if (
      !this._permissions().has(
        permission,
      )
    ) {
      return false;
    }

    if (minimumScope === undefined) {
      return true;
    }

    return this.hasMinimumScope(
      permission,
      minimumScope,
    );
  }


  canSignal(
    permission: PermissionCode,
    minimumScope?: PermissionScope,
  ): Signal<boolean> {
    return computed(() =>
      this.can(
        permission,
        minimumScope,
      ),
    );
  }


  scopeSignal(
    permission: PermissionCode,
  ): Signal<PermissionScope | null> {
    return computed(() => {
      if (
        !this.isCurrentContextReady()
      ) {
        return null;
      }

      return this.scope(
        permission,
      );
    });
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
