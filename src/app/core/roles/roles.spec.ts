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


describe(
    'Roles',
    () => {
        let component:
            Roles;

        let fixture:
            ComponentFixture<Roles>;

        const canReadRoles =
            signal(true);

        const roleApi = {
            list:
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
    },
);