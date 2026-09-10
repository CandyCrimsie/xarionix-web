import {
    TestBed,
} from '@angular/core/testing';

import {
    ActivatedRouteSnapshot,
    Router,
    RouterStateSnapshot,
    UrlTree,
} from '@angular/router';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    PermissionCode,
    PermissionScope,
} from './permission.models';

import {
    PermissionService,
} from './permission.service';

import {
    permissionGuard,
} from './permission-guard';


describe(
    'permissionGuard',
    () => {
        const permissions = {
            can: vi.fn(),
        };

        const deniedTree =
            {} as UrlTree;

        const router = {
            createUrlTree:
                vi.fn(() => deniedTree),
        };


        beforeEach(() => {
            vi.clearAllMocks();

            TestBed.configureTestingModule({
                providers: [
                    {
                        provide:
                            PermissionService,

                        useValue:
                            permissions,
                    },

                    {
                        provide:
                            Router,

                        useValue:
                            router,
                    },
                ],
            });
        });


        it(
            'should allow route when permission is granted',
            () => {
                permissions.can
                    .mockReturnValue(true);

                const result =
                    executeGuard(
                        PermissionCode.MembersRead,
                    );

                expect(
                    result,
                ).toBe(true);

                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.MembersRead,
                    undefined,
                );

                expect(
                    router.createUrlTree,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should deny route when permission is missing',
            () => {
                permissions.can
                    .mockReturnValue(false);

                const result =
                    executeGuard(
                        PermissionCode.RolesManage,
                    );

                expect(
                    result,
                ).toBe(deniedTree);

                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.RolesManage,
                    undefined,
                );

                expect(
                    router.createUrlTree,
                ).toHaveBeenCalledWith(
                    ['/'],
                    {
                        queryParams: {
                            accessDenied: '1',
                        },
                    },
                );
            },
        );


        it(
            'should require minimum scope when provided',
            () => {
                permissions.can
                    .mockReturnValue(true);

                const result =
                    executeGuard(
                        PermissionCode.MembersManage,
                        PermissionScope.OwnUnitTree,
                    );

                expect(
                    result,
                ).toBe(true);

                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.MembersManage,
                    PermissionScope.OwnUnitTree,
                );
            },
        );


        it(
            'should deny route when minimum scope is not satisfied',
            () => {
                permissions.can
                    .mockReturnValue(false);

                const result =
                    executeGuard(
                        PermissionCode.MembersManage,
                        PermissionScope.Company,
                    );

                expect(
                    result,
                ).toBe(deniedTree);

                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.MembersManage,
                    PermissionScope.Company,
                );
            },
        );
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