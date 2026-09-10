import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
    HttpErrorResponse,
} from '@angular/common/http';

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
    PermissionApiService,
} from '../../../core/permissions/permission-api.service';

import type {
    PermissionCatalogItem,
} from '../../../core/permissions/permission-catalog.models';

import {
    PermissionCode,
    PermissionScope,
} from '../../../core/permissions/permission.models';

import {
    RolePermissionApiService,
} from '../../../core/roles/role-permission-api.service';

import type {
    RolePermission,
} from '../../../core/roles/role-permission.models';

import type {
    Role,
} from '../../../core/roles/role.models';

import {
    RolePermissionEditor,
} from './role-permission-editor';


describe(
    'RolePermissionEditor',
    () => {
        let fixture:
            ComponentFixture<
                RolePermissionEditor
            >;

        let component:
            RolePermissionEditor;


        const permissionApi = {
            list:
                vi.fn(),
        };

        const rolePermissionApi = {
            list:
                vi.fn(),

            replace:
                vi.fn(),
        };


        const customRole: Role = {
            id: 11,
            company_id: 1,

            name:
                'Dispatcher',

            description:
                'Dispatches tasks',

            is_system: false,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const systemRole: Role = {
            ...customRole,

            id: 10,

            name:
                'Administrator',

            is_system: true,
        };


        const membersRead:
            PermissionCatalogItem = {
            id: 1,

            code:
                PermissionCode
                    .MembersRead,

            name:
                'Просмотр сотрудников',

            module:
                'members',

            description:
                null,

            is_active:
                true,

            allowed_scopes: [
                PermissionScope.Self,
                PermissionScope.OwnUnit,
                PermissionScope.OwnUnitTree,
                PermissionScope.Company,
            ],
        };


        const tasksRead:
            PermissionCatalogItem = {
            id: 2,

            code:
                PermissionCode
                    .TasksRead,

            name:
                'Просмотр задач',

            module:
                'tasks',

            description:
                null,

            is_active:
                true,

            allowed_scopes: [
                PermissionScope.Self,
                PermissionScope.OwnUnit,
                PermissionScope.OwnUnitTree,
                PermissionScope.Company,
            ],
        };


        const assignedMembersRead:
            RolePermission = {
            permission_id:
                membersRead.id,

            code:
                membersRead.code,

            name:
                membersRead.name,

            module:
                membersRead.module,

            description:
                null,

            is_active:
                true,

            scope:
                PermissionScope
                    .OwnUnitTree,
        };


        beforeEach(async () => {
            vi.clearAllMocks();


            permissionApi
                .list
                .mockReturnValue(
                    of([
                        membersRead,
                        tasksRead,
                    ]),
                );

            rolePermissionApi
                .list
                .mockReturnValue(
                    of([
                        assignedMembersRead,
                    ]),
                );


            await TestBed
                .configureTestingModule({
                    imports: [
                        RolePermissionEditor,
                    ],

                    providers: [
                        {
                            provide:
                                PermissionApiService,

                            useValue:
                                permissionApi,
                        },

                        {
                            provide:
                                RolePermissionApiService,

                            useValue:
                                rolePermissionApi,
                        },
                    ],
                })
                .compileComponents();


            fixture =
                TestBed.createComponent(
                    RolePermissionEditor,
                );

            component =
                fixture.componentInstance;


            fixture.componentRef
                .setInput(
                    'role',
                    customRole,
                );

            fixture.componentRef
                .setInput(
                    'canManage',
                    true,
                );

            fixture.detectChanges();
        });


        it(
            'should load catalog and current role permissions',
            () => {
                expect(
                    permissionApi.list,
                ).toHaveBeenCalledTimes(1);

                expect(
                    rolePermissionApi.list,
                ).toHaveBeenCalledWith(
                    customRole.id,
                );

                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.isAssigned(
                        membersRead.id,
                    ),
                ).toBe(true);

                expect(
                    component.scopeFor(
                        membersRead.id,
                    ),
                ).toBe(
                    PermissionScope
                        .OwnUnitTree,
                );
            },
        );


        it(
            'should use narrowest allowed scope when permission is enabled',
            () => {
                component.togglePermission(
                    tasksRead,
                    true,
                );


                expect(
                    component.isAssigned(
                        tasksRead.id,
                    ),
                ).toBe(true);

                expect(
                    component.scopeFor(
                        tasksRead.id,
                    ),
                ).toBe(
                    PermissionScope.Self,
                );
            },
        );


        it(
            'should change permission scope only to allowed scope',
            () => {
                component.changeScope(
                    membersRead,
                    PermissionScope.Company,
                );

                expect(
                    component.scopeFor(
                        membersRead.id,
                    ),
                ).toBe(
                    PermissionScope.Company,
                );
            },
        );


        it(
            'should replace complete role permission set',
            () => {
                component.changeScope(
                    membersRead,
                    PermissionScope.Company,
                );

                component.togglePermission(
                    tasksRead,
                    true,
                );


                rolePermissionApi
                    .replace
                    .mockReturnValue(
                        of([
                            {
                                ...assignedMembersRead,

                                scope:
                                    PermissionScope
                                        .Company,
                            },

                            {
                                permission_id:
                                    tasksRead.id,

                                code:
                                    tasksRead.code,

                                name:
                                    tasksRead.name,

                                module:
                                    tasksRead.module,

                                description:
                                    null,

                                is_active:
                                    true,

                                scope:
                                    PermissionScope
                                        .Self,
                            },
                        ]),
                    );


                component
                    .savePermissions();


                expect(
                    rolePermissionApi
                        .replace,
                ).toHaveBeenCalledWith(
                    customRole.id,
                    {
                        permissions: [
                            {
                                permission_id: 1,

                                scope:
                                    PermissionScope
                                        .Company,
                            },

                            {
                                permission_id: 2,

                                scope:
                                    PermissionScope
                                        .Self,
                            },
                        ],
                    },
                );

                expect(
                    component.saved(),
                ).toBe(true);

                expect(
                    component.saving(),
                ).toBe(false);
            },
        );


        it(
            'should keep system role read only',
            () => {
                fixture.componentRef
                    .setInput(
                        'role',
                        systemRole,
                    );

                fixture.detectChanges();


                expect(
                    component.isReadOnly(),
                ).toBe(true);


                component.togglePermission(
                    tasksRead,
                    true,
                );

                component
                    .savePermissions();


                expect(
                    rolePermissionApi
                        .replace,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should keep custom role read only without manage permission',
            () => {
                fixture.componentRef
                    .setInput(
                        'canManage',
                        false,
                    );

                fixture.detectChanges();


                expect(
                    component.isReadOnly(),
                ).toBe(true);


                component
                    .savePermissions();


                expect(
                    rolePermissionApi
                        .replace,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should show backend validation error',
            () => {
                rolePermissionApi
                    .replace
                    .mockReturnValue(
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status: 400,
                                }),
                        ),
                    );


                component
                    .savePermissions();


                expect(
                    component.saveError(),
                ).toBe(
                    'Набор доступных прав изменился. '
                    + 'Обновите редактор и повторите попытку',
                );

                expect(
                    component.saving(),
                ).toBe(false);
            },
        );
    },
);