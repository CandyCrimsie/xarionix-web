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
} from '../organizational-units/organizational-unit.models';

import type {
    CompanyMemberSummary,
    CompanyMembership,
    CompanyMembershipCreate,
    CompanyMembershipUpdate,
} from './member.models';

import {
    MemberApiService,
} from './member-api.service';


describe(
    'MemberApiService',
    () => {
        let service:
            MemberApiService;


        const http = {
            get:
                vi.fn(),

            post:
                vi.fn(),

            patch:
                vi.fn(),
        };


        const membership:
            CompanyMembership = {
            id: 15,

            user_id: 8,
            company_id: 1,

            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const member:
            CompanyMemberSummary = {
            ...membership,

            username:
                'ivan.petrov',

            user_is_active:
                true,

            primary_unit_id:
                4,

            primary_unit_name:
                'Technical Support',

            primary_unit_type:
                OrganizationalUnitType.Department,
        };


        beforeEach(() => {
            vi.clearAllMocks();


            TestBed.configureTestingModule({
                providers: [
                    MemberApiService,

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
                    MemberApiService,
                );
        });


        it(
            'should list company members',
            async () => {
                http.get.mockReturnValue(
                    of([
                        member,
                    ]),
                );


                const result =
                    await firstValueFrom(
                        service.list(1),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies/1/members`,
                );

                expect(
                    result,
                ).toEqual([
                    member,
                ]);
            },
        );


        it(
            'should get company member',
            async () => {
                http.get.mockReturnValue(
                    of(
                        membership,
                    ),
                );


                const result =
                    await firstValueFrom(
                        service.get(
                            1,
                            15,
                        ),
                    );


                expect(
                    http.get,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies/1/members/15`,
                );

                expect(
                    result,
                ).toEqual(
                    membership,
                );
            },
        );


        it(
            'should create company membership',
            async () => {
                const data:
                    CompanyMembershipCreate = {
                    user_id: 8,

                    primary_unit_id:
                        4,
                };


                http.post.mockReturnValue(
                    of(
                        membership,
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
                    `${API_BASE_URL}/companies/1/members`,
                    data,
                );

                expect(
                    result,
                ).toEqual(
                    membership,
                );
            },
        );


        it(
            'should update company membership',
            async () => {
                const data:
                    CompanyMembershipUpdate = {
                    is_active:
                        false,
                };


                const updated:
                    CompanyMembership = {
                    ...membership,

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
                            15,
                            data,
                        ),
                    );


                expect(
                    http.patch,
                ).toHaveBeenCalledWith(
                    `${API_BASE_URL}/companies/1/members/15`,
                    data,
                );

                expect(
                    result.is_active,
                ).toBe(false);
            },
        );
    },
);