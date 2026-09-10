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
    RoleDelegationApiService,
} from '../../../core/roles/role-delegation-api.service';

import type {
    Role,
} from '../../../core/roles/role.models';

import {
    RoleDelegationEditor,
} from './role-delegation-editor';


describe(
    'RoleDelegationEditor',
    () => {
        let fixture:
            ComponentFixture<
                RoleDelegationEditor
            >;

        let component:
            RoleDelegationEditor;


        const delegationApi = {
            list:
                vi.fn(),

            replace:
                vi.fn(),
        };


        const managerRole: Role = {
            id: 10,
            company_id: 1,

            name:
                'Dispatcher Manager',

            description:
                null,

            is_system: false,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const employeeRole: Role = {
            id: 20,
            company_id: 1,

            name:
                'Employee',

            description:
                null,

            is_system: true,
            is_active: true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const inactiveRole: Role = {
            id: 30,
            company_id: 1,

            name:
                'Old Role',

            description:
                null,

            is_system: false,
            is_active: false,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const roles = [
            managerRole,
            employeeRole,
            inactiveRole,
        ];


        beforeEach(async () => {
            vi.clearAllMocks();


            delegationApi
                .list
                .mockReturnValue(
                    of([
                        {
                            id: 100,

                            manager_role_id:
                                managerRole.id,

                            assignable_role_id:
                                employeeRole.id,
                        },
                    ]),
                );


            await TestBed
                .configureTestingModule({
                    imports: [
                        RoleDelegationEditor,
                    ],

                    providers: [
                        {
                            provide:
                                RoleDelegationApiService,

                            useValue:
                                delegationApi,
                        },
                    ],
                })
                .compileComponents();


            fixture =
                TestBed.createComponent(
                    RoleDelegationEditor,
                );

            component =
                fixture.componentInstance;


            fixture.componentRef
                .setInput(
                    'role',
                    managerRole,
                );

            fixture.componentRef
                .setInput(
                    'roles',
                    roles,
                );

            fixture.componentRef
                .setInput(
                    'canManage',
                    true,
                );

            fixture.detectChanges();
        });


        it(
            'should load current role delegations',
            () => {
                expect(
                    delegationApi.list,
                ).toHaveBeenCalledWith(
                    managerRole.id,
                );

                expect(
                    component.state(),
                ).toBe('ready');

                expect(
                    component.isDelegated(
                        employeeRole.id,
                    ),
                ).toBe(true);
            },
        );


        it(
            'should keep current role available as delegation candidate',
            () => {
                expect(
                    component
                        .candidateRoles()
                        .some(
                            role =>
                                role.id
                                === managerRole.id,
                        ),
                ).toBe(true);
            },
        );


        it(
            'should allow active role to be delegated',
            () => {
                component.toggleRole(
                    managerRole,
                    true,
                );

                expect(
                    component.isDelegated(
                        managerRole.id,
                    ),
                ).toBe(true);
            },
        );


        it(
            'should not allow inactive role to be newly delegated',
            () => {
                expect(
                    component.canToggleRole(
                        inactiveRole,
                    ),
                ).toBe(false);


                component.toggleRole(
                    inactiveRole,
                    true,
                );


                expect(
                    component.isDelegated(
                        inactiveRole.id,
                    ),
                ).toBe(false);
            },
        );


        it(
            'should replace complete delegation set',
            () => {
                component.toggleRole(
                    managerRole,
                    true,
                );


                delegationApi
                    .replace
                    .mockReturnValue(
                        of([
                            {
                                id: 101,

                                manager_role_id:
                                    managerRole.id,

                                assignable_role_id:
                                    managerRole.id,
                            },

                            {
                                id: 102,

                                manager_role_id:
                                    managerRole.id,

                                assignable_role_id:
                                    employeeRole.id,
                            },
                        ]),
                    );


                component
                    .saveDelegations();


                expect(
                    delegationApi.replace,
                ).toHaveBeenCalledWith(
                    managerRole.id,
                    {
                        assignable_role_ids: [
                            10,
                            20,
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
            'should keep system manager role read only',
            () => {
                const systemManager: Role = {
                    ...managerRole,

                    is_system:
                        true,
                };


                fixture.componentRef
                    .setInput(
                        'role',
                        systemManager,
                    );

                fixture.detectChanges();


                expect(
                    component.isReadOnly(),
                ).toBe(true);


                component
                    .saveDelegations();


                expect(
                    delegationApi.replace,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should keep inactive manager role read only',
            () => {
                const inactiveManager:
                    Role = {
                    ...managerRole,

                    is_active:
                        false,
                };


                fixture.componentRef
                    .setInput(
                        'role',
                        inactiveManager,
                    );

                fixture.detectChanges();


                expect(
                    component.isReadOnly(),
                ).toBe(true);


                component
                    .saveDelegations();


                expect(
                    delegationApi.replace,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should show invalid assignable roles error',
            () => {
                delegationApi
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
                    .saveDelegations();


                expect(
                    component.saveError(),
                ).toBe(
                    'Список доступных ролей изменился. '
                    + 'Обновите редактор и повторите попытку',
                );

                expect(
                    component.saving(),
                ).toBe(false);
            },
        );
    },
);