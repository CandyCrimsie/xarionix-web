import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
    HttpErrorResponse,
} from '@angular/common/http';

import {
    Observable,
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
    MembershipRoleApiService,
} from '../../../core/members/membership-role-api.service';

import type {
    CompanyMemberSummary,
} from '../../../core/members/member.models';

import type {
    Role,
} from '../../../core/roles/role.models';

import {
    MemberRoleEditor,
} from './member-role-editor';


describe(
    'MemberRoleEditor',
    () => {
        let fixture:
            ComponentFixture<
                MemberRoleEditor
            >;

        let component:
            MemberRoleEditor;


        const roleApi = {
            list:
                vi.fn(),

            listAssignable:
                vi.fn(),

            replace:
                vi.fn(),
        };


        const member:
            CompanyMemberSummary = {
            id: 15,
            user_id: 8,
            username: 'ivan.petrov',
            user_is_active: true,

            company_id: 1,
            is_active: true,

            primary_unit_id: null,
            primary_unit_name: null,
            primary_unit_type: null,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const lockedRole:
            Role = {
            id: 5,
            company_id: 1,

            name: 'Billing Viewer',
            description: null,

            is_system: false,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const editableRole:
            Role = {
            id: 10,
            company_id: 1,

            name: 'Employee',
            description: null,

            is_system: true,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const candidateRole:
            Role = {
            id: 20,
            company_id: 1,

            name: 'Support Trainee',
            description: null,

            is_system: false,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const inactiveRole:
            Role = {
            id: 30,
            company_id: 1,

            name: 'Legacy Role',
            description: null,

            is_system: false,
            is_active: false,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        beforeEach(async () => {
            vi.clearAllMocks();


            await TestBed
                .configureTestingModule({
                    imports: [
                        MemberRoleEditor,
                    ],

                    providers: [
                        {
                            provide:
                                MembershipRoleApiService,

                            useValue:
                                roleApi,
                        },
                    ],
                })
                .compileComponents();
        });


        function createEditor(
            options?: {
                current?: Role[];
                assignable?: Observable<Role[]>;
                canAssign?: boolean;
                currentMember?:
                CompanyMemberSummary;
            },
        ): void {
            roleApi.list
                .mockReturnValue(
                    of(
                        options?.current
                        ?? [
                            lockedRole,
                            editableRole,
                        ],
                    ),
                );


            roleApi.listAssignable
                .mockReturnValue(
                    options?.assignable
                    ?? of([
                        editableRole,
                        candidateRole,
                    ]),
                );


            fixture =
                TestBed.createComponent(
                    MemberRoleEditor,
                );

            component =
                fixture.componentInstance;


            fixture.componentRef
                .setInput(
                    'member',
                    options?.currentMember
                    ?? member,
                );

            fixture.componentRef
                .setInput(
                    'canAssign',
                    options?.canAssign
                    ?? true,
                );

            fixture.detectChanges();
        }


        it(
            'should load current and assignable roles',
            () => {
                createEditor();


                expect(
                    roleApi.list,
                ).toHaveBeenCalledWith(
                    15,
                );

                expect(
                    roleApi.listAssignable,
                ).toHaveBeenCalledWith(
                    15,
                );

                expect(
                    component.state(),
                ).toBe('ready');
            },
        );


        it(
            'should keep non assignable current role locked',
            () => {
                createEditor();


                expect(
                    component.isSelected(
                        lockedRole.id,
                    ),
                ).toBe(true);

                expect(
                    component.canToggle(
                        lockedRole,
                    ),
                ).toBe(false);
            },
        );


        it(
            'should allow active assignable role to be changed',
            () => {
                createEditor();


                component.toggleRole(
                    candidateRole,
                    true,
                );


                expect(
                    component.isSelected(
                        candidateRole.id,
                    ),
                ).toBe(true);

                expect(
                    component.hasChanges(),
                ).toBe(true);
            },
        );


        it(
            'should preserve locked roles in replace payload',
            () => {
                createEditor();


                component.toggleRole(
                    candidateRole,
                    true,
                );


                roleApi.replace
                    .mockReturnValue(
                        of([
                            lockedRole,
                            editableRole,
                            candidateRole,
                        ]),
                    );


                component.save();


                expect(
                    roleApi.replace,
                ).toHaveBeenCalledWith(
                    15,
                    {
                        role_ids: [
                            5,
                            10,
                            20,
                        ],
                    },
                );
            },
        );


        it(
            'should allow removing assigned inactive delegated role',
            () => {
                createEditor({
                    current: [
                        inactiveRole,
                    ],

                    assignable:
                        of([
                            inactiveRole,
                        ]),
                });


                expect(
                    component.canToggle(
                        inactiveRole,
                    ),
                ).toBe(true);


                component.toggleRole(
                    inactiveRole,
                    false,
                );


                expect(
                    component.isSelected(
                        inactiveRole.id,
                    ),
                ).toBe(false);
            },
        );


        it(
            'should not allow adding inactive role',
            () => {
                createEditor({
                    current: [],

                    assignable:
                        of([
                            inactiveRole,
                        ]),
                });


                expect(
                    component.canToggle(
                        inactiveRole,
                    ),
                ).toBe(false);


                component.toggleRole(
                    inactiveRole,
                    true,
                );


                expect(
                    component.isSelected(
                        inactiveRole.id,
                    ),
                ).toBe(false);
            },
        );


        it(
            'should be read only without roles assign permission',
            () => {
                createEditor({
                    canAssign:
                        false,
                });


                expect(
                    roleApi.listAssignable,
                ).not.toHaveBeenCalled();

                expect(
                    component.canEditTarget(),
                ).toBe(false);

                expect(
                    component.isSelected(
                        lockedRole.id,
                    ),
                ).toBe(true);
            },
        );


        it(
            'should remain readable when target is outside assignment scope',
            () => {
                createEditor({
                    assignable:
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status: 404,
                                }),
                        ),
                });


                expect(
                    component.state(),
                ).toBe('ready');

                expect(
                    component.canEditTarget(),
                ).toBe(false);

                expect(
                    component.isSelected(
                        lockedRole.id,
                    ),
                ).toBe(true);
            },
        );
    },
);