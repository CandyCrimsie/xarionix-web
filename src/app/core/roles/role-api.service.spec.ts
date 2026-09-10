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
    RoleApiService,
} from './role-api.service';

import {
    Role,
    RoleCreate,
    RoleUpdate,
} from './role.models';


describe(
    'RoleApiService',
    () => {
        let service:
            RoleApiService;

        const http = {
            get:
                vi.fn(),

            post:
                vi.fn(),

            patch:
                vi.fn(),
        };


        const role: Role = {
            id: 10,
            company_id: 2,

            name:
                'Department Manager',

            description:
                'Manages department employees',

            is_system: true,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        beforeEach(() => {
            vi.clearAllMocks();

            TestBed.configureTestingModule({
                providers: [
                    RoleApiService,

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
                    RoleApiService,
                );
        });


        it(
            'should list roles',
            async () => {
                http.get.mockReturnValue(
                    of([
                        role,
                    ]),
                );

                const result =
                    await firstValueFrom(
                        service.list(),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles`,
                );

                expect(
                    result,
                ).toEqual([
                    role,
                ]);
            },
        );


        it(
            'should get role by id',
            async () => {
                http.get.mockReturnValue(
                    of(role),
                );

                const result =
                    await firstValueFrom(
                        service.get(
                            role.id,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles/${role.id}`,
                );

                expect(
                    result,
                ).toEqual(role);
            },
        );


        it(
            'should create role',
            async () => {
                const data:
                    RoleCreate = {
                    name:
                        'Dispatcher',

                    description:
                        'Dispatches tasks',
                };

                http.post.mockReturnValue(
                    of(role),
                );


                const result =
                    await firstValueFrom(
                        service.create(
                            data,
                        ),
                    );


                expect(
                    http.post,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles`,
                    data,
                );

                expect(
                    result,
                ).toEqual(role);
            },
        );


        it(
            'should update role',
            async () => {
                const data:
                    RoleUpdate = {
                    name:
                        'Senior Dispatcher',

                    is_active:
                        false,
                };

                http.patch.mockReturnValue(
                    of(role),
                );


                const result =
                    await firstValueFrom(
                        service.update(
                            role.id,
                            data,
                        ),
                    );


                expect(
                    http.patch,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/roles/${role.id}`,
                    data,
                );

                expect(
                    result,
                ).toEqual(role);
            },
        );
    },
);