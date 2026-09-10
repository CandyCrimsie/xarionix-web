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
    RoleDelegation,
    RoleDelegationsUpdate,
} from './role-delegation.models';

import {
    RoleDelegationApiService,
} from './role-delegation-api.service';


describe(
    'RoleDelegationApiService',
    () => {
        let service:
            RoleDelegationApiService;


        const http = {
            get:
                vi.fn(),

            put:
                vi.fn(),
        };


        const delegation:
            RoleDelegation = {
            id: 100,

            manager_role_id: 10,
            assignable_role_id: 20,
        };


        beforeEach(() => {
            vi.clearAllMocks();


            TestBed.configureTestingModule({
                providers: [
                    RoleDelegationApiService,

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
                    RoleDelegationApiService,
                );
        });


        it(
            'should list role delegations',
            async () => {
                http.get.mockReturnValue(
                    of([
                        delegation,
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.list(10),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles/10/delegations`,
                );

                expect(
                    result,
                ).toEqual([
                    delegation,
                ]);
            },
        );


        it(
            'should replace role delegations',
            async () => {
                const data:
                    RoleDelegationsUpdate = {
                    assignable_role_ids: [
                        20,
                        30,
                    ],
                };


                const response:
                    RoleDelegation[] = [
                        delegation,

                        {
                            id: 101,

                            manager_role_id: 10,
                            assignable_role_id: 30,
                        },
                    ];


                http.put.mockReturnValue(
                    of(response),
                );


                const result =
                    await firstValueFrom(
                        service.replace(
                            10,
                            data,
                        ),
                    );


                expect(
                    http.put,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles/10/delegations`,
                    data,
                );

                expect(
                    result,
                ).toEqual(
                    response,
                );
            },
        );


        it(
            'should allow replacing delegations with empty list',
            async () => {
                const data:
                    RoleDelegationsUpdate = {
                    assignable_role_ids: [],
                };


                http.put.mockReturnValue(
                    of([]),
                );


                const result =
                    await firstValueFrom(
                        service.replace(
                            10,
                            data,
                        ),
                    );


                expect(
                    http.put,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles/10/delegations`,
                    {
                        assignable_role_ids: [],
                    },
                );

                expect(
                    result,
                ).toEqual([]);
            },
        );
    },
);