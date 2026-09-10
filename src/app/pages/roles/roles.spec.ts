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
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    RoleApiService,
} from '../../core/roles/role-api.service';

import type {
    Role,
} from '../../core/roles/role.models';

import {
    Roles,
} from './roles';

import {
    HttpErrorResponse,
} from '@angular/common/http';

import type {
    BrnDialog,
} from '@spartan-ng/brain/dialog';


describe(
    'Roles',
    () => {
        let component:
            Roles;

        let fixture:
            ComponentFixture<Roles>;

        const canReadRoles =
            signal(true);

        const canManageRoles =
            signal(false);

        const roleApi = {
            list:
                vi.fn(),

            create:
                vi.fn(),

            update:
                vi.fn(),
        };

        const permissions = {
            can:
                vi.fn(
                    (
                        permission:
                            PermissionCode,

                        minimumScope?:
                            PermissionScope,
                    ) => {
                        if (
                            permission
                            !== PermissionCode.RolesRead
                        ) {
                            return false;
                        }

                        if (
                            minimumScope
                            !== PermissionScope.Company
                        ) {
                            return false;
                        }

                        return canReadRoles();
                    },
                ),

            canSignal:
                vi.fn(
                    (
                        permission:
                            PermissionCode,

                        minimumScope?:
                            PermissionScope,
                    ) => {
                        if (
                            permission
                            === PermissionCode.RolesManage
                            && minimumScope
                            === PermissionScope.Company
                        ) {
                            return canManageRoles
                                .asReadonly();
                        }

                        return signal(false)
                            .asReadonly();
                    },
                ),
        };


        const systemRole: Role = {
            id: 10,
            company_id: 1,

            name:
                'Administrator',

            description:
                'System administrator',

            is_system: true,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
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


        beforeEach(async () => {
            vi.clearAllMocks();

            canReadRoles.set(
                true,
            );

            canManageRoles.set(
                false,
            );

            roleApi.list.mockReturnValue(
                of([
                    systemRole,
                    customRole,
                ]),
            );


            await TestBed
                .configureTestingModule({
                    imports: [
                        Roles,
                    ],

                    providers: [
                        {
                            provide:
                                RoleApiService,

                            useValue:
                                roleApi,
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
                    Roles,
                );

            component =
                fixture.componentInstance;

            fixture.detectChanges();
        });


        it(
            'should load and render roles when roles read company permission is available',
            () => {
                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.RolesRead,
                    PermissionScope.Company,
                );

                expect(
                    roleApi.list,
                ).toHaveBeenCalledTimes(1);

                expect(
                    component.roles(),
                ).toEqual([
                    systemRole,
                    customRole,
                ]);

                expect(
                    getRoleRow(
                        systemRole.id,
                    ),
                ).not.toBeNull();

                expect(
                    getRoleRow(
                        customRole.id,
                    ),
                ).not.toBeNull();
            },
        );


        it(
            'should clear roles immediately when permission becomes unavailable',
            () => {
                expect(
                    component.roles().length,
                ).toBe(2);


                canReadRoles.set(
                    false,
                );

                fixture.detectChanges();


                expect(
                    component.roles(),
                ).toEqual([]);

                expect(
                    component.state(),
                ).toBe(
                    'idle',
                );

                expect(
                    getRoleRow(
                        systemRole.id,
                    ),
                ).toBeNull();
            },
        );


        it(
            'should reload roles when permission becomes available again',
            () => {
                canReadRoles.set(
                    false,
                );

                fixture.detectChanges();


                roleApi.list.mockReturnValue(
                    of([
                        customRole,
                    ]),
                );


                canReadRoles.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    roleApi.list,
                ).toHaveBeenCalledTimes(2);

                expect(
                    component.roles(),
                ).toEqual([
                    customRole,
                ]);
            },
        );


        it(
            'should show empty state when company has no roles',
            () => {
                canReadRoles.set(
                    false,
                );

                fixture.detectChanges();


                roleApi.list.mockReturnValue(
                    of([]),
                );

                canReadRoles.set(
                    true,
                );

                fixture.detectChanges();


                const element:
                    HTMLElement =
                    fixture.nativeElement;

                expect(
                    element.querySelector(
                        '[data-testid="roles-empty"]',
                    ),
                ).not.toBeNull();
            },
        );


        it(
            'should retry loading roles after an error',
            () => {
                canReadRoles.set(
                    false,
                );

                fixture.detectChanges();


                roleApi.list.mockReturnValue(
                    throwError(
                        () =>
                            new Error(
                                'Roles unavailable',
                            ),
                    ),
                );


                canReadRoles.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'error',
                );

                const element:
                    HTMLElement =
                    fixture.nativeElement;

                const retryButton =
                    element.querySelector<HTMLButtonElement>(
                        '[data-testid="roles-retry"]',
                    );

                expect(
                    retryButton,
                ).not.toBeNull();


                roleApi.list.mockReturnValue(
                    of([
                        customRole,
                    ]),
                );

                retryButton?.click();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.roles(),
                ).toEqual([
                    customRole,
                ]);
            },
        );

        it(
            'should hide create role action without roles manage permission',
            () => {
                const element:
                    HTMLElement =
                    fixture.nativeElement;

                expect(
                    element.querySelector(
                        '[data-testid="create-role-action"]',
                    ),
                ).toBeNull();

                expect(
                    permissions.canSignal,
                ).toHaveBeenCalledWith(
                    PermissionCode.RolesManage,
                    PermissionScope.Company,
                );
            },
        );


        it(
            'should show create role action with roles manage permission',
            () => {
                canManageRoles.set(
                    true,
                );

                fixture.detectChanges();

                const element:
                    HTMLElement =
                    fixture.nativeElement;

                expect(
                    element.querySelector(
                        '[data-testid="create-role-action"]',
                    ),
                ).not.toBeNull();
            },
        );


        it(
            'should create custom role and reload roles',
            () => {
                canManageRoles.set(
                    true,
                );

                fixture.detectChanges();


                component.createName.set(
                    'Dispatcher',
                );

                component.createDescription.set(
                    'Dispatches tasks',
                );


                roleApi.create.mockReturnValue(
                    of(customRole),
                );

                const close =
                    vi.fn();

                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.createRole(
                    dialog,
                );

                fixture.detectChanges();


                expect(
                    roleApi.create,
                ).toHaveBeenCalledWith({
                    name:
                        'Dispatcher',

                    description:
                        'Dispatches tasks',
                });

                expect(
                    close,
                ).toHaveBeenCalledTimes(1);

                expect(
                    component.createName(),
                ).toBe('');

                expect(
                    component.createDescription(),
                ).toBe('');

                /*
                 * Initial list + reload
                 * после создания.
                 */
                expect(
                    roleApi.list,
                ).toHaveBeenCalledTimes(2);
            },
        );


        it(
            'should not create role with empty name',
            () => {
                canManageRoles.set(
                    true,
                );

                component.createName.set(
                    '   ',
                );

                const dialog = {
                    close:
                        vi.fn(),
                } as unknown as BrnDialog;


                component.createRole(
                    dialog,
                );


                expect(
                    roleApi.create,
                ).not.toHaveBeenCalled();

                expect(
                    component.createError(),
                ).toBe(
                    'Укажите название роли',
                );
            },
        );


        it(
            'should show conflict error when role name already exists',
            () => {
                canManageRoles.set(
                    true,
                );

                component.createName.set(
                    'Dispatcher',
                );

                roleApi.create.mockReturnValue(
                    throwError(
                        () =>
                            new HttpErrorResponse({
                                status: 409,
                            }),
                    ),
                );

                const close =
                    vi.fn();

                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.createRole(
                    dialog,
                );


                expect(
                    close,
                ).not.toHaveBeenCalled();

                expect(
                    component.createError(),
                ).toBe(
                    'Роль с таким названием уже существует',
                );

                expect(
                    component.creating(),
                ).toBe(false);
            },
        );

        it(
            'should show edit action only for custom role when roles manage permission is available',
            () => {
                canManageRoles.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    getEditRoleAction(
                        customRole.id,
                    ),
                ).not.toBeNull();

                expect(
                    getEditRoleAction(
                        systemRole.id,
                    ),
                ).toBeNull();
            },
        );


        it(
            'should populate edit state from custom role',
            () => {
                canManageRoles.set(
                    true,
                );

                component.openEditRole(
                    customRole,
                );


                expect(
                    component.selectedRole(),
                ).toEqual(
                    customRole,
                );

                expect(
                    component.editName(),
                ).toBe(
                    customRole.name,
                );

                expect(
                    component.editDescription(),
                ).toBe(
                    customRole.description,
                );

                expect(
                    component.editActive(),
                ).toBe(true);
            },
        );


        it(
            'should refuse to edit system role',
            () => {
                canManageRoles.set(
                    true,
                );

                component.openEditRole(
                    systemRole,
                );


                expect(
                    component.selectedRole(),
                ).toBeNull();

                expect(
                    roleApi.update,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should update custom role and reload roles',
            () => {
                canManageRoles.set(
                    true,
                );

                component.openEditRole(
                    customRole,
                );

                component.editName.set(
                    'Senior Dispatcher',
                );

                component.editDescription.set(
                    'Manages dispatching',
                );

                component.editActive.set(
                    false,
                );


                const updatedRole: Role = {
                    ...customRole,

                    name:
                        'Senior Dispatcher',

                    description:
                        'Manages dispatching',

                    is_active:
                        false,
                };


                roleApi.update.mockReturnValue(
                    of(updatedRole),
                );


                const close =
                    vi.fn();

                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.updateRole(
                    dialog,
                );

                fixture.detectChanges();


                expect(
                    roleApi.update,
                ).toHaveBeenCalledWith(
                    customRole.id,
                    {
                        name:
                            'Senior Dispatcher',

                        description:
                            'Manages dispatching',

                        is_active:
                            false,
                    },
                );

                expect(
                    close,
                ).toHaveBeenCalledTimes(1);

                expect(
                    component.selectedRole(),
                ).toBeNull();

                /*
                 * Initial GET + reload
                 * после PATCH.
                 */
                expect(
                    roleApi.list,
                ).toHaveBeenCalledTimes(2);
            },
        );


        it(
            'should show conflict error when updated role name already exists',
            () => {
                canManageRoles.set(
                    true,
                );

                component.openEditRole(
                    customRole,
                );

                component.editName.set(
                    'Administrator',
                );


                roleApi.update.mockReturnValue(
                    throwError(
                        () =>
                            new HttpErrorResponse({
                                status: 409,

                                error: {
                                    detail:
                                        'Role with this name already exists',
                                },
                            }),
                    ),
                );


                const close =
                    vi.fn();

                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.updateRole(
                    dialog,
                );


                expect(
                    close,
                ).not.toHaveBeenCalled();

                expect(
                    component.editError(),
                ).toBe(
                    'Роль с таким названием уже существует',
                );

                expect(
                    component.updating(),
                ).toBe(false);
            },
        );

        it(
            'should show permissions action for system and custom roles',
            () => {
                expect(
                    getRolePermissionsAction(
                        systemRole.id,
                    ),
                ).not.toBeNull();

                expect(
                    getRolePermissionsAction(
                        customRole.id,
                    ),
                ).not.toBeNull();
            },
        );


        function getRoleRow(
            roleId: number,
        ): Element | null {
            const element:
                HTMLElement =
                fixture.nativeElement;

            return element.querySelector(
                `[data-testid="role-row-${roleId}"]`,
            );
        }

        function getEditRoleAction(
            roleId: number,
        ): Element | null {
            const element:
                HTMLElement =
                fixture.nativeElement;

            return element.querySelector(
                `[data-testid="edit-role-action-${roleId}"]`,
            );
        }

        function getRolePermissionsAction(
            roleId: number,
        ): Element | null {
            const element:
                HTMLElement =
                fixture.nativeElement;

            return element.querySelector(
                `[data-testid="role-permissions-action-${roleId}"]`,
            );
        }
    },
);