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
    CompanyApiService,
} from '../../core/company/company-api.service';

import {
    CompanyContextService,
} from '../../core/company/company-context.service';

import type {
    CompanyTreeNode,
} from '../../core/company/company.models';

import {
    PermissionCode,
    PermissionScope,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    Companies,
} from './companies';

import type {
    BrnDialog,
} from '@spartan-ng/brain/dialog';

import {
    AuthService,
} from '../../core/auth/auth.service';

import type {
    User,
} from '../../core/auth/auth.models';


const canManage =
    signal(false);


describe(
    'Companies',
    () => {
        let fixture:
            ComponentFixture<Companies>;

        let component:
            Companies;


        const activeCompanyId =
            signal<number | null>(
                1,
            );

        const canRead =
            signal(true);


        const authUser =
            signal<User | null>({
                id: 100,

                username:
                    'admin',

                is_active:
                    true,

                is_system_admin:
                    false,

                created_at:
                    '2026-01-01T00:00:00Z',

                updated_at:
                    '2026-01-01T00:00:00Z',
            });


        const tree:
            CompanyTreeNode = {
            id:
                1,

            parent_id:
                null,

            name:
                'Main Company',

            short_name:
                'MAIN',

            is_active:
                true,

            created_at:
                '2026-01-01T00:00:00Z',

            updated_at:
                '2026-01-01T00:00:00Z',

            children: [
                {
                    id:
                        2,

                    parent_id:
                        1,

                    name:
                        'Branch',

                    short_name:
                        null,

                    is_active:
                        false,

                    created_at:
                        '2026-01-01T00:00:00Z',

                    updated_at:
                        '2026-01-01T00:00:00Z',

                    children:
                        [],
                },
            ],
        };


        const companyApi = {
            getTree:
                vi.fn(),

            createChild:
                vi.fn(),

            createRoot:
                vi.fn(),
        };


        const companyContext = {
            activeCompanyId:
                activeCompanyId
                    .asReadonly(),
            loadAvailableCompanies:
                vi.fn(),
        };


        const auth = {
            user:
                authUser.asReadonly(),
        };


        const permissions = {
            can:
                vi.fn(
                    (
                        permission:
                            PermissionCode,

                        scope?:
                            PermissionScope,
                    ) => {
                        if (
                            permission
                            === PermissionCode
                                .CompaniesRead
                            && scope
                            === PermissionScope
                                .Company
                        ) {
                            return canRead();
                        }

                        if (
                            permission
                            === PermissionCode
                                .CompaniesManage
                            && scope
                            === PermissionScope.Company
                        ) {
                            return canManage();
                        }

                        return false;
                    },
                ),
        };


        beforeEach(
            async () => {
                vi.clearAllMocks();

                activeCompanyId.set(
                    1,
                );

                canRead.set(
                    true,
                );

                companyApi
                    .createRoot
                    .mockReturnValue(
                        of({
                            ...tree,

                            id:
                                10,

                            parent_id:
                                null,

                            name:
                                'Independent Company',

                            short_name:
                                'IC',
                        }),
                    );


                companyContext
                    .loadAvailableCompanies
                    .mockReturnValue(
                        of([]),
                    );

                canManage.set(
                    false,
                );

                companyApi
                    .createChild
                    .mockReturnValue(
                        of(tree.children[0]),
                    );

                authUser.set({
                    id: 100,

                    username:
                        'admin',

                    is_active:
                        true,

                    is_system_admin:
                        false,

                    created_at:
                        '2026-01-01T00:00:00Z',

                    updated_at:
                        '2026-01-01T00:00:00Z',
                });


                await TestBed
                    .configureTestingModule({
                        imports: [
                            Companies,
                        ],

                        providers: [
                            {
                                provide:
                                    CompanyApiService,

                                useValue:
                                    companyApi,
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

                            {
                                provide:
                                    AuthService,

                                useValue:
                                    auth,
                            },
                        ],
                    })
                    .compileComponents();


                fixture =
                    TestBed
                        .createComponent(
                            Companies,
                        );

                component =
                    fixture
                        .componentInstance;

                fixture.detectChanges();
            },
        );


        it(
            'should render company hierarchy',
            () => {
                expect(
                    component.rows()
                        .length,
                ).toBe(2);


                const element:
                    HTMLElement =
                    fixture.nativeElement;


                expect(
                    element.querySelector(
                        '[data-testid="company-row-1"]',
                    ),
                ).not.toBeNull();

                expect(
                    element.querySelector(
                        '[data-testid="company-row-2"]',
                    ),
                ).not.toBeNull();


                expect(
                    element.textContent,
                ).toContain(
                    'Main Company',
                );

                expect(
                    element.textContent,
                ).toContain(
                    'Branch',
                );

                expect(
                    element.textContent,
                ).toContain(
                    'Отключена',
                );
            },
        );


        it(
            'should reload tree when active company changes',
            () => {
                const secondTree:
                    CompanyTreeNode = {
                    ...tree,

                    id:
                        2,

                    parent_id:
                        1,

                    name:
                        'Branch',

                    children:
                        [],
                };


                companyApi
                    .getTree
                    .mockImplementation(
                        (
                            companyId:
                                number,
                        ) =>
                            of(
                                companyId
                                    === 1
                                    ? tree
                                    : secondTree,
                            ),
                    );


                /*
                 * Сбрасываем счётчик,
                 * поскольку первый вызов
                 * произошёл при создании
                 * компонента.
                 */
                companyApi
                    .getTree
                    .mockClear();


                activeCompanyId.set(
                    2,
                );

                fixture.detectChanges();


                expect(
                    companyApi.getTree,
                ).toHaveBeenCalledWith(
                    2,
                );

                expect(
                    component.tree()?.id,
                ).toBe(2);
            },
        );


        it(
            'should show error and retry loading',
            () => {
                companyApi
                    .getTree
                    .mockReturnValueOnce(
                        throwError(
                            () =>
                                new Error(
                                    'Unavailable',
                                ),
                        ),
                    )
                    .mockReturnValue(
                        of(tree),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'error',
                );


                component.retry();

                fixture.detectChanges();


                expect(
                    component.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    component.tree(),
                ).toEqual(
                    tree,
                );
            },
        );

        it(
            'should hide create action without companies manage permission',
            () => {
                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="create-company-action"]',
                        ),
                ).toBeNull();
            },
        );


        it(
            'should show create action with companies manage permission',
            () => {
                canManage.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="create-company-action"]',
                        ),
                ).not.toBeNull();
            },
        );

        it(
            'should create child company and reload tree',
            () => {
                canManage.set(
                    true,
                );


                const close =
                    vi.fn();


                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.createName.set(
                    '  New Branch  ',
                );

                component.createShortName.set(
                    '  NB  ',
                );


                component.createChild(
                    dialog,
                );

                fixture.detectChanges();


                expect(
                    companyApi.createChild,
                ).toHaveBeenCalledWith(
                    1,
                    {
                        name:
                            'New Branch',

                        short_name:
                            'NB',
                    },
                );


                expect(
                    close,
                ).toHaveBeenCalledTimes(
                    1,
                );


                /*
                 * Первый getTree был вызван
                 * при создании компонента,
                 * второй — после успешного create.
                 */
                expect(
                    companyApi.getTree,
                ).toHaveBeenCalledTimes(
                    2,
                );


                expect(
                    component.createName(),
                ).toBe('');

                expect(
                    component.createShortName(),
                ).toBe('');

                expect(
                    component.createError(),
                ).toBeNull();
            },
        );

        it(
            'should reject empty company name',
            () => {
                canManage.set(
                    true,
                );


                const dialog = {
                    close:
                        vi.fn(),
                } as unknown as BrnDialog;


                component.createName.set(
                    '   ',
                );


                component.createChild(
                    dialog,
                );


                expect(
                    companyApi.createChild,
                ).not.toHaveBeenCalled();

                expect(
                    component.createError(),
                ).toBe(
                    'Укажите название компании',
                );
            },
        );

        it(
            'should hide independent root action for regular user',
            () => {
                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="create-root-company-action"]',
                        ),
                ).toBeNull();
            },
        );

        it(
            'should show independent root action for system administrator',
            () => {
                authUser.set({
                    ...authUser()!,

                    is_system_admin:
                        true,
                });


                fixture.detectChanges();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="create-root-company-action"]',
                        ),
                ).not.toBeNull();
            },
        );

        it(
            'should create independent root company and refresh available companies',
            () => {
                authUser.set({
                    ...authUser()!,

                    is_system_admin:
                        true,
                });


                fixture.detectChanges();


                const close =
                    vi.fn();


                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component
                    .rootCreateName
                    .set(
                        '  Second Company  ',
                    );

                component
                    .rootCreateShortName
                    .set(
                        '  SECOND  ',
                    );


                component.createRoot(
                    dialog,
                );


                expect(
                    companyApi.createRoot,
                ).toHaveBeenCalledWith({
                    name:
                        'Second Company',

                    short_name:
                        'SECOND',
                });


                expect(
                    companyContext
                        .loadAvailableCompanies,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    companyApi.getTree,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    close,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    component
                        .rootCreateName(),
                ).toBe('');


                expect(
                    component
                        .rootCreateShortName(),
                ).toBe('');


                expect(
                    component
                        .rootCreateError(),
                ).toBeNull();
            },
        );
    },
);