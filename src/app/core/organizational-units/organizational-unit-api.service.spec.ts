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
    OrganizationalUnitType,
} from './organizational-unit.models';

import type {
    OrganizationalUnit,
    OrganizationalUnitCreate,
    OrganizationalUnitUpdate,
} from './organizational-unit.models';

import {
    OrganizationalUnitApiService,
} from './organizational-unit-api.service';


describe(
    'OrganizationalUnitApiService',
    () => {
        let service:
            OrganizationalUnitApiService;


        const http = {
            get:
                vi.fn(),

            post:
                vi.fn(),

            patch:
                vi.fn(),
        };


        const unit:
            OrganizationalUnit = {
            id: 4,

            company_id: 1,

            parent_id:
                null,

            name:
                'Technical Support',

            type:
                OrganizationalUnitType
                    .Department,

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
                    OrganizationalUnitApiService,

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
                    OrganizationalUnitApiService,
                );
        });


        it(
            'should list organizational units',
            async () => {
                http.get.mockReturnValue(
                    of([
                        unit,
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.list(
                            1,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies/1/units`,
                );

                expect(
                    result,
                ).toEqual([
                    unit,
                ]);
            },
        );


        it(
            'should get organizational unit',
            async () => {
                http.get.mockReturnValue(
                    of(
                        unit,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.get(
                            1,
                            4,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies/1/units/4`,
                );

                expect(
                    result,
                ).toEqual(
                    unit,
                );
            },
        );


        it(
            'should create organizational unit',
            async () => {
                const data:
                    OrganizationalUnitCreate = {
                    name:
                        'Technical Support',

                    type:
                        OrganizationalUnitType
                            .Department,

                    parent_id:
                        null,
                };


                http.post.mockReturnValue(
                    of(
                        unit,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.create(
                            1,
                            data,
                        ),
                    );


                expect(
                    http.post,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies/1/units`,
                    data,
                );

                expect(
                    result,
                ).toEqual(
                    unit,
                );
            },
        );


        it(
            'should update organizational unit',
            async () => {
                const data:
                    OrganizationalUnitUpdate = {
                    name:
                        'Support',

                    is_active:
                        false,
                };


                const updated:
                    OrganizationalUnit = {
                    ...unit,

                    name:
                        'Support',

                    is_active:
                        false,
                };


                http.patch.mockReturnValue(
                    of(
                        updated,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.update(
                            1,
                            4,
                            data,
                        ),
                    );


                expect(
                    http.patch,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies/1/units/4`,
                    data,
                );

                expect(
                    result,
                ).toEqual(
                    updated,
                );
            },
        );
    },
);