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
    UnitMembership,
    UnitMembershipCreate,
    UnitMembershipUpdate,
} from './unit-membership.models';

import {
    UnitMembershipApiService,
} from './unit-membership-api.service';


describe(
    'UnitMembershipApiService',
    () => {
        let service:
            UnitMembershipApiService;


        const http = {
            get:
                vi.fn(),

            post:
                vi.fn(),

            patch:
                vi.fn(),
        };


        const unitMembership:
            UnitMembership = {
            id: 30,

            company_membership_id:
                15,

            unit_id:
                4,

            is_primary:
                true,

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
                    UnitMembershipApiService,

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
                    UnitMembershipApiService,
                );
        });


        it(
            'should list membership units',
            async () => {
                http.get.mockReturnValue(
                    of([
                        unitMembership,
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
                    `${API_BASE_URL}/company-memberships/15/units`,
                );

                expect(
                    result,
                ).toEqual([
                    unitMembership,
                ]);
            },
        );


        it(
            'should get membership unit',
            async () => {
                http.get.mockReturnValue(
                    of(
                        unitMembership,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.get(
                            15,
                            30,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/company-memberships/15/units/30`,
                );

                expect(
                    result,
                ).toEqual(
                    unitMembership,
                );
            },
        );


        it(
            'should create membership unit',
            async () => {
                const data:
                    UnitMembershipCreate = {
                    unit_id:
                        4,

                    is_primary:
                        true,
                };


                http.post.mockReturnValue(
                    of(
                        unitMembership,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.create(
                            15,
                            data,
                        ),
                    );


                expect(
                    http.post,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/company-memberships/15/units`,
                    data,
                );

                expect(
                    result,
                ).toEqual(
                    unitMembership,
                );
            },
        );


        it(
            'should update membership unit',
            async () => {
                const data:
                    UnitMembershipUpdate = {
                    is_primary:
                        false,

                    is_active:
                        false,
                };


                const updated:
                    UnitMembership = {
                    ...unitMembership,

                    is_primary:
                        false,

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
                            15,
                            30,
                            data,
                        ),
                    );


                expect(
                    http.patch,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/company-memberships/15/units/30`,
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