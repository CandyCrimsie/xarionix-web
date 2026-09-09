import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    PermissionScope,
} from './permission.models';

import {
    getPermissionScopeRank,
    isScopeAtLeast,
} from './permission.utils';


describe(
    'permission scope utilities',
    () => {
        it(
            'should preserve backend scope order',
            () => {
                expect(
                    getPermissionScopeRank(
                        PermissionScope.Self,
                    ),
                ).toBe(10);

                expect(
                    getPermissionScopeRank(
                        PermissionScope.OwnUnit,
                    ),
                ).toBe(20);

                expect(
                    getPermissionScopeRank(
                        PermissionScope.OwnUnitTree,
                    ),
                ).toBe(30);

                expect(
                    getPermissionScopeRank(
                        PermissionScope.Company,
                    ),
                ).toBe(40);
            },
        );


        it(
            'should accept equal scope',
            () => {
                expect(
                    isScopeAtLeast(
                        PermissionScope.OwnUnit,
                        PermissionScope.OwnUnit,
                    ),
                ).toBe(true);
            },
        );


        it(
            'should accept broader scope',
            () => {
                expect(
                    isScopeAtLeast(
                        PermissionScope.Company,
                        PermissionScope.OwnUnitTree,
                    ),
                ).toBe(true);

                expect(
                    isScopeAtLeast(
                        PermissionScope.OwnUnitTree,
                        PermissionScope.Self,
                    ),
                ).toBe(true);
            },
        );


        it(
            'should reject narrower scope',
            () => {
                expect(
                    isScopeAtLeast(
                        PermissionScope.Self,
                        PermissionScope.OwnUnit,
                    ),
                ).toBe(false);

                expect(
                    isScopeAtLeast(
                        PermissionScope.OwnUnit,
                        PermissionScope.Company,
                    ),
                ).toBe(false);
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

                companyContext
                    .activeCompanyId
                    .mockReturnValue(1);

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
                companyContext
                    .activeCompanyId
                    .mockReturnValue(2);

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
    },
);