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

    const companyContext = {
      activeCompanyId:
        vi.fn<() => number | null>(),
    };


    beforeEach(() => {
      vi.clearAllMocks();

      companyContext
        .activeCompanyId
        .mockReturnValue(1);

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
        companyContext
          .activeCompanyId
          .mockReturnValue(null);

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

        companyContext
          .activeCompanyId
          .mockReturnValue(1);

        service.load().subscribe();

        /*
         * Пока request выполняется,
         * переключились на company 2.
         */
        companyContext
          .activeCompanyId
          .mockReturnValue(2);

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
  },
);
