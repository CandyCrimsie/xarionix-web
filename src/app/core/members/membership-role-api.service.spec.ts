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

import type {
    Role,
} from '../roles/role.models';

import type {
    MembershipRolesUpdate,
} from './membership-role.models';

import {
    MembershipRoleApiService,
} from './membership-role-api.service';


describe(
    'MembershipRoleApiService',
    () => {
        let service:
            MembershipRoleApiService;


        const http = {
            get:
                vi.fn(),

            put:
                vi.fn(),
        };


        const employeeRole:
            Role = {
            id: 10,
            company_id: 1,

            name:
                'Employee',

            description:
                null,

            is_system:
                true,

            is_active:
                true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const traineeRole:
            Role = {
            id: 20,
            company_id: 1,

            name:
                'Support Trainee',

            description:
                null,

            is_system:
                false,

            is_active:
                true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        beforeEach(() => {
            vi.clearAllMocks();


            TestBed.configureTestingModule({
                providers: [
                    MembershipRoleApiService,

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
                    MembershipRoleApiService,
                );
        });


        it(
            'should list membership roles',
            async () => {
                http.get.mockReturnValue(
                    of([
                        employeeRole,
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.list(15),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/roles`,
                );

                expect(
                    result,
                ).toEqual([
                    employeeRole,
                ]);
            },
        );


        it(
            'should list assignable membership roles',
            async () => {
                http.get.mockReturnValue(
                    of([
                        employeeRole,
                        traineeRole,
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.listAssignable(
                            15,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/roles/assignable`,
                );

                expect(
                    result,
                ).toEqual([
                    employeeRole,
                    traineeRole,
                ]);
            },
        );


        it(
            'should replace membership roles',
            async () => {
                const data:
                    MembershipRolesUpdate = {
                    role_ids: [
                        10,
                        20,
                    ],
                };


                http.put.mockReturnValue(
                    of([
                        employeeRole,
                        traineeRole,
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.replace(
                            15,
                            data,
                        ),
                    );


                expect(
                    http.put,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/roles`,
                    data,
                );

                expect(
                    result,
                ).toEqual([
                    employeeRole,
                    traineeRole,
                ]);
            },
        );


        it(
            'should allow replacing membership roles with empty list',
            async () => {
                const data:
                    MembershipRolesUpdate = {
                    role_ids: [],
                };


                http.put.mockReturnValue(
                    of([]),
                );


                const result =
                    await firstValueFrom(
                        service.replace(
                            15,
                            data,
                        ),
                    );


                expect(
                    http.put,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/members/15/roles`,
                    {
                        role_ids: [],
                    },
                );

                expect(
                    result,
                ).toEqual([]);
            },
        );
    },
);