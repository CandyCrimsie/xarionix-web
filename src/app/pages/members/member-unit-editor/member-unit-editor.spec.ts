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
    OrganizationalUnitApiService,
} from '../../../core/organizational-units/organizational-unit-api.service';

import {
    OrganizationalUnitType,
} from '../../../core/organizational-units/organizational-unit.models';

import type {
    OrganizationalUnit,
} from '../../../core/organizational-units/organizational-unit.models';

import {
    UnitMembershipApiService,
} from '../../../core/members/unit-membership-api.service';

import type {
    UnitMembership,
} from '../../../core/members/unit-membership.models';

import type {
    CompanyMemberSummary,
} from '../../../core/members/member.models';

import {
    MemberUnitEditor,
} from './member-unit-editor';


describe(
    'MemberUnitEditor',
    () => {
        let fixture:
            ComponentFixture<
                MemberUnitEditor
            >;

        let component:
            MemberUnitEditor;


        const member:
            CompanyMemberSummary = {
            id: 15,

            user_id: 8,

            username:
                'ivan.petrov',

            user_is_active:
                true,

            company_id:
                1,

            is_active:
                true,

            primary_unit_id:
                4,

            primary_unit_name:
                'Support',

            primary_unit_type:
                OrganizationalUnitType
                    .Department,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const support:
            OrganizationalUnit = {
            id: 4,
            company_id: 1,
            parent_id: null,

            name: 'Support',

            type:
                OrganizationalUnitType
                    .Department,

            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const supportL1:
            OrganizationalUnit = {
            id: 5,
            company_id: 1,
            parent_id: 4,

            name: 'Support L1',

            type:
                OrganizationalUnitType
                    .Team,

            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const primary:
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


        const secondary:
            UnitMembership = {
            id: 31,

            company_membership_id:
                15,

            unit_id:
                5,

            is_primary:
                false,

            is_active:
                true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const unitApi = {
            list:
                vi.fn(),
        };


        const membershipApi = {
            list:
                vi.fn(),

            create:
                vi.fn(),

            update:
                vi.fn(),
        };


        beforeEach(async () => {
            vi.clearAllMocks();


            unitApi.list
                .mockReturnValue(
                    of([
                        support,
                        supportL1,
                    ]),
                );

            membershipApi.list
                .mockReturnValue(
                    of([
                        primary,
                    ]),
                );


            await TestBed
                .configureTestingModule({
                    imports: [
                        MemberUnitEditor,
                    ],

                    providers: [
                        {
                            provide:
                                OrganizationalUnitApiService,

                            useValue:
                                unitApi,
                        },

                        {
                            provide:
                                UnitMembershipApiService,

                            useValue:
                                membershipApi,
                        },
                    ],
                })
                .compileComponents();


            fixture =
                TestBed.createComponent(
                    MemberUnitEditor,
                );

            component =
                fixture.componentInstance;


            fixture.componentRef
                .setInput(
                    'member',
                    member,
                );

            fixture.componentRef
                .setInput(
                    'canManage',
                    true,
                );

            fixture.componentRef
                .setInput(
                    'canReadUnits',
                    true,
                );

            fixture.componentRef
                .setInput(
                    'canRemovePrimary',
                    false,
                );


            fixture.detectChanges();
        });


        it(
            'should load assignments and available units',
            () => {
                expect(
                    membershipApi.list,
                ).toHaveBeenCalledWith(
                    15,
                );

                expect(
                    unitApi.list,
                ).toHaveBeenCalledWith(
                    1,
                );

                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.assignments(),
                ).toEqual([
                    primary,
                ]);

                expect(
                    component.availableUnits(),
                ).toEqual([
                    supportL1,
                ]);
            },
        );


        it(
            'should add unit and reload assignments',
            () => {
                component.selectUnit(
                    5,
                );


                membershipApi.create
                    .mockReturnValue(
                        of(
                            secondary,
                        ),
                    );

                membershipApi.list
                    .mockReturnValueOnce(
                        of([
                            primary,
                            secondary,
                        ]),
                    );


                component.addSelected(
                    false,
                );


                expect(
                    membershipApi.create,
                ).toHaveBeenCalledWith(
                    15,
                    {
                        unit_id: 5,
                        is_primary: false,
                    },
                );

                expect(
                    component.assignments(),
                ).toEqual([
                    primary,
                    secondary,
                ]);

                expect(
                    component.selectedUnitId(),
                ).toBeNull();
            },
        );


        it(
            'should set new primary and reload server state',
            () => {
                membershipApi.list
                    .mockReturnValueOnce(
                        of([
                            primary,
                            secondary,
                        ]),
                    );

                component.retry();

                fixture.detectChanges();


                const newPrimary:
                    UnitMembership = {
                    ...secondary,

                    is_primary:
                        true,
                };

                const oldPrimary:
                    UnitMembership = {
                    ...primary,

                    is_primary:
                        false,
                };


                membershipApi.update
                    .mockReturnValue(
                        of(
                            newPrimary,
                        ),
                    );

                membershipApi.list
                    .mockReturnValueOnce(
                        of([
                            oldPrimary,
                            newPrimary,
                        ]),
                    );


                component.setPrimary(
                    secondary,
                );


                expect(
                    membershipApi.update,
                ).toHaveBeenCalledWith(
                    15,
                    31,
                    {
                        is_primary:
                            true,
                    },
                );

                expect(
                    component.assignments(),
                ).toEqual([
                    oldPrimary,
                    newPrimary,
                ]);
            },
        );


        it(
            'should not deactivate primary outside company scope',
            () => {
                component.toggleActive(
                    primary,
                );


                expect(
                    membershipApi.update,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should allow company manager to deactivate primary',
            () => {
                fixture.componentRef
                    .setInput(
                        'canRemovePrimary',
                        true,
                    );

                fixture.detectChanges();


                const inactive:
                    UnitMembership = {
                    ...primary,

                    is_primary:
                        false,

                    is_active:
                        false,
                };


                membershipApi.update
                    .mockReturnValue(
                        of(
                            inactive,
                        ),
                    );

                membershipApi.list
                    .mockReturnValueOnce(
                        of([
                            inactive,
                        ]),
                    );


                component.toggleActive(
                    primary,
                );


                expect(
                    membershipApi.update,
                ).toHaveBeenCalledWith(
                    15,
                    30,
                    {
                        is_active:
                            false,
                    },
                );

                expect(
                    component.assignments()[0]
                        .is_active,
                ).toBe(false);
            },
        );


        it(
            'should keep assignments readable when unit catalog fails',
            () => {
                unitApi.list
                    .mockReturnValue(
                        throwError(
                            () =>
                                new Error(
                                    'Catalog failed',
                                ),
                        ),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.assignments(),
                ).toEqual([
                    primary,
                ]);

                expect(
                    component.canEdit(),
                ).toBe(false);

                expect(
                    component.catalogMessage(),
                ).not.toBeNull();
            },
        );
    },
);