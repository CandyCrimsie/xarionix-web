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
    },
);