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
    ActivatedRouteSnapshot,
    Router,
    RouterStateSnapshot,
    UrlTree,
} from '@angular/router';

import {
    of,
    Subject,
} from 'rxjs';

import {
    beforeEach,
    describe,
    expect,
    it,
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
    permissionGuard,
} from './permission-guard';

import {
    PermissionService,
} from './permission.service';


describe(
    'permissionGuard integration',
    () => {
        let permissions:
            PermissionService;

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

        const deniedTree =
            {} as UrlTree;

        const router = {
            createUrlTree:
                vi.fn(() => deniedTree),
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

                    {
                        provide: Router,
                        useValue: router,
                    },
                ],
            });

            permissions =
                TestBed.inject(
                    PermissionService,
                );
        });


        it(
            'should allow route when actual scope is broader than required',
            () => {
                loadPermission(
                    PermissionScope.OwnUnitTree,
                );

                const result =
                    executeGuard(
                        PermissionCode.MembersManage,
                        PermissionScope.OwnUnit,
                    );

                expect(
                    result,
                ).toBe(true);

                expect(
                    router.createUrlTree,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should allow route when actual scope equals required scope',
            () => {
                loadPermission(
                    PermissionScope.OwnUnitTree,
                );

                const result =
                    executeGuard(
                        PermissionCode.MembersManage,
                        PermissionScope.OwnUnitTree,
                    );

                expect(
                    result,
                ).toBe(true);
            },
        );


        it(
            'should deny route when actual scope is narrower than required',
            () => {
                loadPermission(
                    PermissionScope.OwnUnit,
                );

                const result =
                    executeGuard(
                        PermissionCode.MembersManage,
                        PermissionScope.OwnUnitTree,
                    );

                expect(
                    result,
                ).toBe(deniedTree);

                expect(
                    router.createUrlTree,
                ).toHaveBeenCalledWith(
                    ['/forbidden'],
                );
            },
        );


        it(
            'should deny route when permission has no effective scope',
            () => {
                http.get.mockReturnValue(
                    of({
                        permissions: [
                            PermissionCode.MembersManage,
                        ],

                        scopes: {},
                    }),
                );

                permissions
                    .load()
                    .subscribe();

                const result =
                    executeGuard(
                        PermissionCode.MembersManage,
                        PermissionScope.OwnUnit,
                    );

                expect(
                    result,
                ).toBe(deniedTree);

                expect(
                    router.createUrlTree,
                ).toHaveBeenCalledWith(
                    ['/forbidden'],
                );
            },
        );


        function loadPermission(
            scope: PermissionScope,
        ): void {
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
                            scope,
                    },
                }),
            );

            permissions
                .load()
                .subscribe();
        }
    },
);


function executeGuard(
    permission: PermissionCode,
    minimumScope?: PermissionScope,
) {
    return TestBed.runInInjectionContext(
        () =>
            permissionGuard(
                permission,
                minimumScope,
            )(
                {} as ActivatedRouteSnapshot,
                {} as RouterStateSnapshot,
            ),
    );
}