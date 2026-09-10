import {
    signal,
} from '@angular/core';

import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
    of,
    throwError,
} from 'rxjs';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    CompanyContextService,
} from '../../core/company/company-context.service';

import {
    MemberApiService,
} from '../../core/members/member-api.service';

import type {
    CompanyMemberSummary,
} from '../../core/members/member.models';

import {
    OrganizationalUnitType,
} from '../../core/organizational-units/organizational-unit.models';

import {
    PermissionCode,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    Members,
} from './members';


describe(
    'Members',
    () => {
        let fixture:
            ComponentFixture<Members>;

        let component:
            Members;


        const activeCompanyId =
            signal<number | null>(
                1,
            );

        const canReadMembers =
            signal(true);


        const member:
            CompanyMemberSummary = {
            id: 15,

            user_id: 8,

            username:
                'ivan.petrov',

            user_is_active:
                true,

            company_id: 1,

            is_active:
                true,

            primary_unit_id:
                4,

            primary_unit_name:
                'Technical Support',

            primary_unit_type:
                OrganizationalUnitType
                    .Department,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const secondCompanyMember:
            CompanyMemberSummary = {
            ...member,

            id: 25,
            user_id: 18,
            company_id: 2,

            username:
                'second.company.user',

            primary_unit_id:
                null,

            primary_unit_name:
                null,

            primary_unit_type:
                null,
        };


        const memberApi = {
            list:
                vi.fn(),
        };


        const companyContext = {
            activeCompanyId:
                activeCompanyId
                    .asReadonly(),
        };


        const permissions = {
            can:
                vi.fn(
                    (
                        permission:
                            PermissionCode,
                    ) => {
                        if (
                            permission
                            === PermissionCode
                                .MembersRead
                        ) {
                            return canReadMembers();
                        }

                        return false;
                    },
                ),
        };


        beforeEach(async () => {
            vi.clearAllMocks();

            activeCompanyId.set(1);

            canReadMembers.set(
                true,
            );

            memberApi.list
                .mockReturnValue(
                    of([
                        member,
                    ]),
                );


            await TestBed
                .configureTestingModule({
                    imports: [
                        Members,
                    ],

                    providers: [
                        {
                            provide:
                                MemberApiService,

                            useValue:
                                memberApi,
                        },

                        {
                            provide:
                                CompanyContextService,

                            useValue:
                                companyContext,
                        },

                        {
                            provide:
                                PermissionService,

                            useValue:
                                permissions,
                        },
                    ],
                })
                .compileComponents();


            fixture =
                TestBed.createComponent(
                    Members,
                );

            component =
                fixture.componentInstance;

            fixture.detectChanges();
        });


        it(
            'should load members for active company',
            () => {
                expect(
                    memberApi.list,
                ).toHaveBeenCalledWith(
                    1,
                );

                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.members(),
                ).toEqual([
                    member,
                ]);
            },
        );


        it(
            'should render member summary',
            () => {
                const element:
                    HTMLElement =
                    fixture.nativeElement;


                expect(
                    element.textContent,
                ).toContain(
                    'ivan.petrov',
                );

                expect(
                    element.textContent,
                ).toContain(
                    'Technical Support',
                );

                expect(
                    element.querySelector(
                        '[data-testid="member-row-15"]',
                    ),
                ).not.toBeNull();
            },
        );


        it(
            'should clear members when read permission is lost',
            () => {
                canReadMembers.set(
                    false,
                );

                fixture.detectChanges();


                expect(
                    component.members(),
                ).toEqual([]);

                expect(
                    component.state(),
                ).toBe(
                    'idle',
                );
            },
        );


        it(
            'should reload members after company switch',
            () => {
                memberApi.list
                    .mockReturnValue(
                        of([
                            secondCompanyMember,
                        ]),
                    );


                activeCompanyId.set(
                    2,
                );

                fixture.detectChanges();


                expect(
                    memberApi.list,
                ).toHaveBeenLastCalledWith(
                    2,
                );

                expect(
                    component.members(),
                ).toEqual([
                    secondCompanyMember,
                ]);
            },
        );


        it(
            'should show error and allow retry',
            () => {
                memberApi.list
                    .mockReturnValue(
                        throwError(
                            () =>
                                new Error(
                                    'Request failed',
                                ),
                        ),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'error',
                );

                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="members-error"]',
                        ),
                ).not.toBeNull();


                memberApi.list
                    .mockReturnValue(
                        of([
                            member,
                        ]),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );
            },
        );
    },
);