import {
    TestBed,
} from '@angular/core/testing';

import {
    HttpClient,
} from '@angular/common/http';

import {
    firstValueFrom,
    of,
} from 'rxjs';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    API_BASE_URL,
} from '../api/api.config';

import {
    PermissionScope,
    PermissionCode,
} from '../permissions/permission.models';

import {
    PermissionOverrideEffect,
} from './membership-permission-override.models';

import type {
    MembershipPermissionOverride,
} from './membership-permission-override.models';

import {
    MembershipPermissionOverrideApiService,
} from './membership-permission-override-api.service';


describe(
    'MembershipPermissionOverrideApiService',
    () => {
        let service:
            MembershipPermissionOverrideApiService;


        const http = {
            get:
                vi.fn(),

            put:
                vi.fn(),

            delete:
                vi.fn(),
        };


        const allowOverride:
            MembershipPermissionOverride = {
            id: 101,

            company_membership_id:
                15,

            permission_id:
                8,

            effect:
                PermissionOverrideEffect
                    .Allow,

            scope:
                PermissionScope.OwnUnitTree,
        };


        const denyOverride:
            MembershipPermissionOverride = {
            id: 102,

            company_membership_id:
                15,

            permission_id:
                9,

            effect:
                PermissionOverrideEffect
                    .Deny,

            scope:
                null,
        };


        beforeEach(() => {
            vi.clearAllMocks();


            TestBed.configureTestingModule({
                providers: [
                    MembershipPermissionOverrideApiService,

                    {
                        provide:
                            HttpClient,

                        useValue:
                            http,
                    },
                ],
            });


            service =
                TestBed.inject(
                    MembershipPermissionOverrideApiService,
                );
        });


        it(
            'should list membership permission overrides',
            async () => {
                http.get.mockReturnValue(
                    of([
                        allowOverride,
                        denyOverride,
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.list(
                            15,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/permission-overrides`,
                );

                expect(
                    result,
                ).toEqual([
                    allowOverride,
                    denyOverride,
                ]);
            },
        );


        it(
            'should set allow override with scope',
            async () => {
                http.put.mockReturnValue(
                    of(
                        allowOverride,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.set(
                            15,
                            8,
                            {
                                effect:
                                    PermissionOverrideEffect
                                        .Allow,

                                scope:
                                    PermissionScope
                                        .OwnUnitTree,
                            },
                        ),
                    );


                expect(
                    http.put,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/permission-overrides/8`,
                    {
                        effect:
                            'allow',

                        scope:
                            'own_unit_tree',
                    },
                );

                expect(
                    result,
                ).toEqual(
                    allowOverride,
                );
            },
        );


        it(
            'should set deny override without scope',
            async () => {
                http.put.mockReturnValue(
                    of(
                        denyOverride,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.set(
                            15,
                            9,
                            {
                                effect:
                                    PermissionOverrideEffect
                                        .Deny,

                                scope:
                                    null,
                            },
                        ),
                    );


                expect(
                    http.put,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/permission-overrides/9`,
                    {
                        effect:
                            'deny',

                        scope:
                            null,
                    },
                );

                expect(
                    result,
                ).toEqual(
                    denyOverride,
                );
            },
        );


        it(
            'should remove membership permission override',
            async () => {
                http.delete.mockReturnValue(
                    of(undefined),
                );


                await firstValueFrom(
                    service.remove(
                        15,
                        8,
                    ),
                );


                expect(
                    http.delete,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/permission-overrides/8`,
                );
            },
        );

        it(
            'should list permission override catalog',
            async () => {
                const catalog = [
                    {
                        id: 8,

                        code:
                            PermissionCode.TasksRead,

                        name:
                            'Read tasks',

                        module:
                            'tasks',

                        description:
                            null,

                        is_active:
                            true,

                        allowed_scopes: [
                            PermissionScope.Self,
                            PermissionScope.Company,
                        ],
                    },
                ];


                http.get.mockReturnValue(
                    of(catalog),
                );


                const result =
                    await firstValueFrom(
                        service.catalog(
                            15,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/permission-overrides/catalog`,
                );

                expect(
                    result,
                ).toEqual(
                    catalog,
                );
            },
        );
    },
);