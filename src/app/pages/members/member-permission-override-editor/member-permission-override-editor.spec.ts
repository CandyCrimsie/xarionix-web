import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
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
    MembershipPermissionOverrideApiService,
} from '../../../core/members/membership-permission-override-api.service';

import {
    PermissionOverrideEffect,
} from '../../../core/members/membership-permission-override.models';

import type {
    CompanyMemberSummary,
} from '../../../core/members/member.models';

import type {
    PermissionCatalogItem,
} from '../../../core/permissions/permission-catalog.models';

import {
    PermissionCode,
    PermissionScope,
} from '../../../core/permissions/permission.models';

import {
    MemberPermissionOverrideEditor,
} from './member-permission-override-editor';


describe(
    'MemberPermissionOverrideEditor',
    () => {
        let fixture:
            ComponentFixture<
                MemberPermissionOverrideEditor
            >;

        let component:
            MemberPermissionOverrideEditor;


        const api = {
            catalog:
                vi.fn(),

            list:
                vi.fn(),

            set:
                vi.fn(),

            remove:
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


        const permission:
            PermissionCatalogItem = {
            id: 8,

            code:
                PermissionCode.TasksRead,

            name:
                'Read tasks',

            module:
                'tasks',

            description:
                null,

            is_active:
                true,

            allowed_scopes: [
                PermissionScope.Self,
                PermissionScope.OwnUnit,
                PermissionScope.Company,
            ],
        };


        beforeEach(async () => {
            vi.clearAllMocks();

            api.catalog
                .mockReturnValue(
                    of([
                        permission,
                    ]),
                );

            api.list
                .mockReturnValue(
                    of([]),
                );


            await TestBed
                .configureTestingModule({
                    imports: [
                        MemberPermissionOverrideEditor,
                    ],

                    providers: [
                        {
                            provide:
                                MembershipPermissionOverrideApiService,

                            useValue:
                                api,
                        },
                    ],
                })
                .compileComponents();


            fixture =
                TestBed.createComponent(
                    MemberPermissionOverrideEditor,
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

            fixture.detectChanges();
        });


        it(
            'should load catalog and overrides',
            () => {
                expect(
                    api.catalog,
                ).toHaveBeenCalledWith(
                    15,
                );

                expect(
                    api.list,
                ).toHaveBeenCalledWith(
                    15,
                );

                expect(
                    component.state(),
                ).toBe('ready');
            },
        );


        it(
            'should default to inheritance',
            () => {
                expect(
                    component.modeFor(
                        8,
                    ),
                ).toBe(
                    'inherit',
                );

                expect(
                    component.isDirty(
                        8,
                    ),
                ).toBe(false);
            },
        );


        it(
            'should save allow override',
            () => {
                component.changeMode(
                    permission,
                    'allow',
                );

                component.changeScope(
                    permission,
                    PermissionScope.Company,
                );


                api.set.mockReturnValue(
                    of({
                        id: 100,

                        company_membership_id:
                            15,

                        permission_id:
                            8,

                        effect:
                            PermissionOverrideEffect
                                .Allow,

                        scope:
                            PermissionScope
                                .Company,
                    }),
                );


                component.savePermission(
                    permission,
                );


                expect(
                    api.set,
                ).toHaveBeenCalledWith(
                    15,
                    8,
                    {
                        effect:
                            PermissionOverrideEffect
                                .Allow,

                        scope:
                            PermissionScope
                                .Company,
                    },
                );

                expect(
                    component.isDirty(
                        8,
                    ),
                ).toBe(false);
            },
        );


        it(
            'should save deny without scope',
            () => {
                component.changeMode(
                    permission,
                    'deny',
                );


                api.set.mockReturnValue(
                    of({
                        id: 101,

                        company_membership_id:
                            15,

                        permission_id:
                            8,

                        effect:
                            PermissionOverrideEffect
                                .Deny,

                        scope:
                            null,
                    }),
                );


                component.savePermission(
                    permission,
                );


                expect(
                    api.set,
                ).toHaveBeenCalledWith(
                    15,
                    8,
                    {
                        effect:
                            PermissionOverrideEffect
                                .Deny,

                        scope:
                            null,
                    },
                );
            },
        );


        it(
            'should remove override when inheritance is selected',
            () => {
                api.list.mockReturnValue(
                    of([
                        {
                            id: 102,

                            company_membership_id:
                                15,

                            permission_id:
                                8,

                            effect:
                                PermissionOverrideEffect
                                    .Deny,

                            scope:
                                null,
                        },
                    ]),
                );


                fixture.destroy();


                fixture =
                    TestBed.createComponent(
                        MemberPermissionOverrideEditor,
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

                fixture.detectChanges();


                component.changeMode(
                    permission,
                    'inherit',
                );


                api.remove.mockReturnValue(
                    of(undefined),
                );


                component.savePermission(
                    permission,
                );


                expect(
                    api.remove,
                ).toHaveBeenCalledWith(
                    15,
                    8,
                );

                expect(
                    component.isDirty(
                        8,
                    ),
                ).toBe(false);
            },
        );
    },
);