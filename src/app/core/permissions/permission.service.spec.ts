import {
  signal,
} from '@angular/core';

import {
  TestBed,
} from '@angular/core/testing';

import {
  HttpClient,
} from '@angular/common/http';

import {
  of,
  Subject,
  throwError,
} from 'rxjs';

import {
  describe,
  expect,
  it,
  beforeEach,
  vi,
} from 'vitest';

import {
  CompanyContextService,
} from '../company/company-context.service';

import {
  PermissionCode,
  PermissionScope,
  type EffectivePermissionsResponse,
} from './permission.models';

import {
  PermissionService,
} from './permission.service';


describe(
  'PermissionService',
  () => {
    let service: PermissionService;

    const http = {
      get: vi.fn(),
    };

    const activeCompanyId =
      signal<number | null>(1);

    const companyChanged =
      new Subject<number | null>();

    const companyContext = {
      activeCompanyId:
        activeCompanyId.asReadonly(),

      companyChanged$:
        companyChanged.asObservable(),
    };

    beforeEach(() => {
      vi.clearAllMocks();

      activeCompanyId.set(1);

      TestBed.configureTestingModule({
        providers: [
          PermissionService,

          {
            provide: HttpClient,
            useValue: http,
          },

          {
            provide:
              CompanyContextService,

            useValue:
              companyContext,
          },
        ],
      });

      service = TestBed.inject(
        PermissionService,
      );
    });


    it(
      'should start with empty permissions',
      () => {
        expect(
          service.state(),
        ).toBe('idle');

        expect(
          service.permissions().size,
        ).toBe(0);

        expect(
          service.loadedCompanyId(),
        ).toBeNull();
      },
    );


    it(
      'should load effective permissions',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.CompaniesRead,
              PermissionCode.RolesManage,
            ],

            scopes: {
              [
                PermissionCode
                  .CompaniesRead
              ]:
                PermissionScope.Company,

              [
                PermissionCode
                  .RolesManage
              ]:
                PermissionScope.Company,
            },
          }),
        );

        service.load().subscribe();

        expect(
          service.state(),
        ).toBe('ready');

        expect(
          service.loadedCompanyId(),
        ).toBe(1);

        expect(
          service.has(
            PermissionCode.CompaniesRead,
          ),
        ).toBe(true);

        expect(
          service.has(
            PermissionCode.TasksDelete,
          ),
        ).toBe(false);

        expect(
          service.scope(
            PermissionCode.RolesManage,
          ),
        ).toBe(
          PermissionScope.Company,
        );
      },
    );


    it(
      'should reset when there is no active company',
      () => {
        activeCompanyId.set(null);

        service.load().subscribe();

        expect(
          service.state(),
        ).toBe('idle');

        expect(
          service.permissions().size,
        ).toBe(0);

        expect(
          service.loadedCompanyId(),
        ).toBeNull();

        expect(
          http.get,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      'should clear permissions on current company request error',
      () => {
        http.get.mockReturnValue(
          throwError(
            () => new Error(
              'Request failed',
            ),
          ),
        );

        service.load().subscribe({
          error: () => undefined,
        });

        expect(
          service.state(),
        ).toBe('error');

        expect(
          service.permissions().size,
        ).toBe(0);

        expect(
          service.loadedCompanyId(),
        ).toBeNull();
      },
    );

    it(
      'should ignore permissions from a previously active company',
      () => {
        const response$ =
          new Subject<any>();

        http.get.mockReturnValue(
          response$,
        );

        activeCompanyId.set(1);

        service.load().subscribe();

        /*
         * Пока request выполняется,
         * переключились на company 2.
         */
        activeCompanyId.set(2);

        response$.next({
          permissions: [
            PermissionCode.RolesManage,
          ],

          scopes: {
            [
              PermissionCode
                .RolesManage
            ]:
              PermissionScope.Company,
          },
        });

        response$.complete();

        expect(
          service.has(
            PermissionCode.RolesManage,
          ),
        ).toBe(false);

        expect(
          service.loadedCompanyId(),
        ).toBeNull();

        /*
         * State "loading" пока допустим:
         * новый company load будет
         * запускаться Stage 19.6.
         */
        expect(
          service.state(),
        ).toBe('loading');
      },
    );

    it(
      'should initialize permissions for active company',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.MembersRead,
            ],

            scopes: {
              [
                PermissionCode
                  .MembersRead
              ]:
                PermissionScope.Company,
            },
          }),
        );

        service.initialize().subscribe();

        expect(
          http.get,
        ).toHaveBeenCalledTimes(1);

        expect(
          service.state(),
        ).toBe('ready');

        expect(
          service.loadedCompanyId(),
        ).toBe(1);

        expect(
          service.has(
            PermissionCode.MembersRead,
          ),
        ).toBe(true);
      },
    );

    it(
      'should not reload permissions when active company is already initialized',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.CompaniesRead,
            ],

            scopes: {
              [
                PermissionCode
                  .CompaniesRead
              ]:
                PermissionScope.Company,
            },
          }),
        );

        service.initialize().subscribe();

        service.initialize().subscribe();

        expect(
          http.get,
        ).toHaveBeenCalledTimes(1);

        expect(
          service.loadedCompanyId(),
        ).toBe(1);

        expect(
          service.state(),
        ).toBe('ready');
      },
    );

    it(
      'should keep initialization resilient when permission loading fails',
      () => {
        http.get.mockReturnValue(
          throwError(
            () => new Error(
              'Permissions unavailable',
            ),
          ),
        );

        let completed = false;
        let emittedError = false;

        service.initialize().subscribe({
          complete: () => {
            completed = true;
          },

          error: () => {
            emittedError = true;
          },
        });

        expect(
          completed,
        ).toBe(true);

        expect(
          emittedError,
        ).toBe(false);

        expect(
          service.state(),
        ).toBe('error');

        expect(
          service.permissions().size,
        ).toBe(0);

        expect(
          service.loadedCompanyId(),
        ).toBeNull();
      },
    );

    it(
      'should allow permission in current ready company context',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.TasksRead,
            ],

            scopes: {
              [
                PermissionCode
                  .TasksRead
              ]:
                PermissionScope.Self,
            },
          }),
        );

        service.load().subscribe();

        expect(
          service.can(
            PermissionCode.TasksRead,
          ),
        ).toBe(true);

        expect(
          service.can(
            PermissionCode.TasksDelete,
          ),
        ).toBe(false);
      },
    );

    it(
      'should enforce minimum permission scope',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.MembersManage,
            ],

            scopes: {
              [
                PermissionCode
                  .MembersManage
              ]:
                PermissionScope.OwnUnitTree,
            },
          }),
        );

        service.load().subscribe();

        expect(
          service.can(
            PermissionCode.MembersManage,
            PermissionScope.Self,
          ),
        ).toBe(true);

        expect(
          service.can(
            PermissionCode.MembersManage,
            PermissionScope.OwnUnit,
          ),
        ).toBe(true);

        expect(
          service.can(
            PermissionCode.MembersManage,
            PermissionScope.OwnUnitTree,
          ),
        ).toBe(true);

        expect(
          service.can(
            PermissionCode.MembersManage,
            PermissionScope.Company,
          ),
        ).toBe(false);
      },
    );

    it(
      'should check any and all permissions',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.TasksRead,
              PermissionCode.TasksCreate,
            ],

            scopes: {
              [
                PermissionCode
                  .TasksRead
              ]:
                PermissionScope.Self,

              [
                PermissionCode
                  .TasksCreate
              ]:
                PermissionScope.Self,
            },
          }),
        );

        service.load().subscribe();

        expect(
          service.hasAny([
            PermissionCode.TasksDelete,
            PermissionCode.TasksRead,
          ]),
        ).toBe(true);

        expect(
          service.hasAny([
            PermissionCode.TasksDelete,
            PermissionCode.RolesManage,
          ]),
        ).toBe(false);

        expect(
          service.hasAll([
            PermissionCode.TasksRead,
            PermissionCode.TasksCreate,
          ]),
        ).toBe(true);

        expect(
          service.hasAll([
            PermissionCode.TasksRead,
            PermissionCode.TasksDelete,
          ]),
        ).toBe(false);
      },
    );

    it(
      'should deny helpers when loaded permissions belong to another company',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.RolesManage,
            ],

            scopes: {
              [
                PermissionCode
                  .RolesManage
              ]:
                PermissionScope.Company,
            },
          }),
        );

        activeCompanyId.set(1);

        service.load().subscribe();

        expect(
          service.can(
            PermissionCode.RolesManage,
          ),
        ).toBe(true);

        /*
         * Company переключилась,
         * но permissions новой компании
         * ещё не загружены.
         */
        activeCompanyId.set(2);

        expect(
          service.isCurrentContextReady(),
        ).toBe(false);

        expect(
          service.can(
            PermissionCode.RolesManage,
          ),
        ).toBe(false);

        expect(
          service.hasAny([
            PermissionCode.RolesManage,
          ]),
        ).toBe(false);

        expect(
          service.hasAll([
            PermissionCode.RolesManage,
          ]),
        ).toBe(false);
      },
    );

    it(
      'should expose reactive permission signal',
      () => {
        const canManageRoles =
          service.canSignal(
            PermissionCode.RolesManage,
            PermissionScope.Company,
          );

        expect(
          canManageRoles(),
        ).toBe(false);

        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.RolesManage,
            ],

            scopes: {
              [
                PermissionCode
                  .RolesManage
              ]:
                PermissionScope.Company,
            },
          }),
        );

        service.load().subscribe();

        expect(
          canManageRoles(),
        ).toBe(true);

        service.reset();

        expect(
          canManageRoles(),
        ).toBe(false);
      },
    );

    it(
      'should reload permissions automatically when company changes',
      () => {
        http.get
          .mockReturnValueOnce(
            of({
              permissions: [
                PermissionCode.RolesManage,
              ],

              scopes: {
                [
                  PermissionCode
                    .RolesManage
                ]:
                  PermissionScope.Company,
              },
            }),
          )
          .mockReturnValueOnce(
            of({
              permissions: [
                PermissionCode.TasksRead,
              ],

              scopes: {
                [
                  PermissionCode
                    .TasksRead
                ]:
                  PermissionScope.Self,
              },
            }),
          );

        /*
         * Company 1.
         */
        service.load().subscribe();

        expect(
          service.can(
            PermissionCode.RolesManage,
          ),
        ).toBe(true);

        /*
         * Переключаемся на Company 2.
         */
        activeCompanyId.set(2);

        companyChanged.next(2);

        expect(
          http.get,
        ).toHaveBeenCalledTimes(2);

        expect(
          service.loadedCompanyId(),
        ).toBe(2);

        expect(
          service.can(
            PermissionCode.RolesManage,
          ),
        ).toBe(false);

        expect(
          service.can(
            PermissionCode.TasksRead,
          ),
        ).toBe(true);
      },
    );

    it(
      'should clear old permissions while new company permissions are loading',
      () => {
        const companyTwoResponse =
          new Subject<
            EffectivePermissionsResponse
          >();

        http.get
          .mockReturnValueOnce(
            of({
              permissions: [
                PermissionCode.RolesManage,
              ],

              scopes: {
                [
                  PermissionCode
                    .RolesManage
                ]:
                  PermissionScope.Company,
              },
            }),
          )
          .mockReturnValueOnce(
            companyTwoResponse,
          );

        service.load().subscribe();

        expect(
          service.can(
            PermissionCode.RolesManage,
          ),
        ).toBe(true);

        activeCompanyId.set(2);

        companyChanged.next(2);

        /*
         * Ответ Company 2 ещё НЕ пришёл.
         */
        expect(
          service.state(),
        ).toBe('loading');

        expect(
          service.loadedCompanyId(),
        ).toBeNull();

        expect(
          service.permissions().size,
        ).toBe(0);

        expect(
          service.can(
            PermissionCode.RolesManage,
          ),
        ).toBe(false);

        /*
         * Теперь приходит Company 2.
         */
        companyTwoResponse.next({
          permissions: [
            PermissionCode.TasksRead,
          ],

          scopes: {
            [
              PermissionCode
                .TasksRead
            ]:
              PermissionScope.Self,
          },
        });

        companyTwoResponse.complete();

        expect(
          service.state(),
        ).toBe('ready');

        expect(
          service.loadedCompanyId(),
        ).toBe(2);

        expect(
          service.can(
            PermissionCode.TasksRead,
          ),
        ).toBe(true);
      },
    );

    it(
      'should reset permissions when company context is cleared',
      () => {
        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.TasksRead,
            ],

            scopes: {
              [
                PermissionCode
                  .TasksRead
              ]:
                PermissionScope.Self,
            },
          }),
        );

        service.load().subscribe();

        expect(
          service.state(),
        ).toBe('ready');

        expect(
          service.permissions().size,
        ).toBe(1);

        activeCompanyId.set(null);

        companyChanged.next(null);

        expect(
          service.state(),
        ).toBe('idle');

        expect(
          service.loadedCompanyId(),
        ).toBeNull();

        expect(
          service.permissions().size,
        ).toBe(0);
      },
    );

    it(
      'should emit settled company after automatic permission reload succeeds',
      () => {
        const settledCompanies:
          number[] = [];

        service
          .companyPermissionsSettled$
          .subscribe(companyId => {
            settledCompanies.push(
              companyId,
            );
          });

        http.get.mockReturnValue(
          of({
            permissions: [
              PermissionCode.TasksRead,
            ],

            scopes: {
              [
                PermissionCode
                  .TasksRead
              ]:
                PermissionScope.Self,
            },
          }),
        );

        activeCompanyId.set(2);

        companyChanged.next(2);

        expect(
          settledCompanies,
        ).toEqual([
          2,
        ]);

        expect(
          service.loadedCompanyId(),
        ).toBe(2);
      },
    );

    it(
      'should emit settled company after automatic permission reload fails',
      () => {
        const settledCompanies:
          number[] = [];

        service
          .companyPermissionsSettled$
          .subscribe(companyId => {
            settledCompanies.push(
              companyId,
            );
          });

        http.get.mockReturnValue(
          throwError(
            () => new Error(
              'Permissions unavailable',
            ),
          ),
        );

        activeCompanyId.set(2);

        companyChanged.next(2);

        expect(
          settledCompanies,
        ).toEqual([
          2,
        ]);

        expect(
          service.state(),
        ).toBe('error');

        expect(
          service.loadedCompanyId(),
        ).toBeNull();
      },
    );
  },
);
