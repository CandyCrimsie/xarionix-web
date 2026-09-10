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
    PermissionCode,
    PermissionScope,
} from '../permissions/permission.models';

import type {
    RolePermission,
    RolePermissionsUpdate,
} from './role-permission.models';

import {
    RolePermissionApiService,
} from './role-permission-api.service';


describe(
    'RolePermissionApiService',
    () => {
        let service:
            RolePermissionApiService;

        const http = {
            get:
                vi.fn(),

            put:
                vi.fn(),
        };


        const rolePermission:
            RolePermission = {
            permission_id: 12,

            code:
                PermissionCode.TasksRead,

            name:
                'Read tasks',

            module:
                'tasks',

            description:
                'Read tasks',

            is_active:
                true,

            scope:
                PermissionScope.OwnUnitTree,
        };


        beforeEach(() => {
            vi.clearAllMocks();

            TestBed.configureTestingModule({
                providers: [
                    RolePermissionApiService,

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
                    RolePermissionApiService,
                );
        });


        it(
            'should list role permissions',
            async () => {
                http.get.mockReturnValue(
                    of([
                        rolePermission,
                    ]),
                );

                const result =
                    await firstValueFrom(
                        service.list(25),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles/25/permissions`,
                );

                expect(
                    result,
                ).toEqual([
                    rolePermission,
                ]);
            },
        );


        it(
            'should replace role permissions',
            async () => {
                const data:
                    RolePermissionsUpdate = {
                    permissions: [
                        {
                            permission_id:
                                rolePermission
                                    .permission_id,

                            scope:
                                PermissionScope
                                    .Company,
                        },
                    ],
                };

                http.put.mockReturnValue(
                    of([
                        {
                            ...rolePermission,

                            scope:
                                PermissionScope
                                    .Company,
                        },
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.replace(
                            25,
                            data,
                        ),
                    );


                expect(
                    http.put,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles/25/permissions`,
                    data,
                );

                expect(
                    result[0]?.scope,
                ).toBe(
                    PermissionScope.Company,
                );
            },
        );
    },
);