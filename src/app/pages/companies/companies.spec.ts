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

import {
    HttpErrorResponse,
} from '@angular/common/http';

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

            updateMetadata:
                vi.fn(),

            setActivation:
                vi.fn(),

            move:
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
                    .getTree
                    .mockReturnValue(
                        of(tree),
                    );

                companyApi
                    .updateMetadata
                    .mockReturnValue(
                        of({
                            ...tree.children[0],

                            name:
                                'Renamed Branch',

                            short_name:
                                'RB',
                        }),
                    );

                companyApi
                    .setActivation
                    .mockReturnValue(
                        of({
                            ...tree.children[0],

                            is_active:
                                true,
                        }),
                    );

                companyApi
                    .move
                    .mockReturnValue(
                        of({
                            ...tree.children[0],

                            parent_id:
                                1,
                        }),
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
                    companyContext
                        .loadAvailableCompanies,
                ).toHaveBeenCalledTimes(
                    1,
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

        it(
            'should hide edit actions without companies manage permission',
            () => {
                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="edit-company-action-1"]',
                        ),
                ).toBeNull();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="edit-company-action-2"]',
                        ),
                ).toBeNull();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="move-company-action-2"]',
                        ),
                ).toBeNull();
            },
        );

        it(
            'should show edit actions with companies manage permission',
            () => {
                canManage.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="edit-company-action-1"]',
                        ),
                ).not.toBeNull();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="edit-company-action-2"]',
                        ),
                ).not.toBeNull();
            },
        );

        it(
            'should update child company metadata and refresh tree and switcher',
            () => {
                canManage.set(
                    true,
                );


                const close =
                    vi.fn();


                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.startEdit(
                    tree.children[0],
                );


                component.editName.set(
                    '  Renamed Branch  ',
                );

                component.editShortName.set(
                    '  RB  ',
                );


                component
                    .saveCompanyMetadata(
                        dialog,
                    );


                fixture.detectChanges();


                expect(
                    companyApi.updateMetadata,
                ).toHaveBeenCalledWith(
                    1,
                    2,
                    {
                        name:
                            'Renamed Branch',

                        short_name:
                            'RB',
                    },
                );


                expect(
                    close,
                ).toHaveBeenCalledTimes(
                    1,
                );


                /*
                 * Первый getTree —
                 * создание компонента.
                 *
                 * Второй —
                 * успешный metadata update.
                 */
                expect(
                    companyApi.getTree,
                ).toHaveBeenCalledTimes(
                    2,
                );


                expect(
                    companyContext
                        .loadAvailableCompanies,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    component.editingCompany(),
                ).toBeNull();


                expect(
                    component.editName(),
                ).toBe('');


                expect(
                    component.editShortName(),
                ).toBe('');


                expect(
                    component.editError(),
                ).toBeNull();
            },
        );

        it(
            'should reject empty company name when editing',
            () => {
                canManage.set(
                    true,
                );


                const dialog = {
                    close:
                        vi.fn(),
                } as unknown as BrnDialog;


                component.startEdit(
                    tree.children[0],
                );

                component.editName.set(
                    '   ',
                );


                component
                    .saveCompanyMetadata(
                        dialog,
                    );


                expect(
                    companyApi.updateMetadata,
                ).not.toHaveBeenCalled();


                expect(
                    component.editError(),
                ).toBe(
                    'Укажите название компании',
                );
            },
        );

        it(
            'should not repeat metadata update when switcher refresh fails',
            () => {
                canManage.set(
                    true,
                );


                companyContext
                    .loadAvailableCompanies
                    .mockReturnValueOnce(
                        throwError(
                            () =>
                                new Error(
                                    'Switcher unavailable',
                                ),
                        ),
                    );


                const close =
                    vi.fn();


                component.startEdit(
                    tree.children[0],
                );

                component.editName.set(
                    'Renamed Branch',
                );


                component.saveCompanyMetadata({
                    close,
                } as unknown as BrnDialog);


                expect(
                    companyApi.updateMetadata,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    close,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    component.editError(),
                ).toBeNull();
            },
        );

        it(
            'should show activation only for inactive child company',
            () => {
                canManage.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="activate-company-action-2"]',
                        ),
                ).not.toBeNull();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="activate-company-action-1"]',
                        ),
                ).toBeNull();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="deactivate-company-action-1"]',
                        ),
                ).toBeNull();


                companyApi
                    .getTree
                    .mockReturnValue(
                        of({
                            ...tree,

                            children: [
                                {
                                    ...tree.children[0],

                                    is_active:
                                        true,
                                },
                            ],
                        }),
                    );


                component.retry();

                fixture.detectChanges();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="deactivate-company-action-2"]',
                        ),
                ).not.toBeNull();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="activate-company-action-2"]',
                        ),
                ).toBeNull();
            },
        );

        it(
            'should activate child company and refresh tree and switcher',
            () => {
                canManage.set(
                    true,
                );


                component.setCompanyActivation(
                    tree.children[0],
                    true,
                );


                fixture.detectChanges();


                expect(
                    companyApi.setActivation,
                ).toHaveBeenCalledWith(
                    1,
                    2,
                    {
                        is_active:
                            true,
                    },
                );


                expect(
                    companyApi.getTree,
                ).toHaveBeenCalledTimes(
                    2,
                );


                expect(
                    companyContext
                        .loadAvailableCompanies,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    component
                        .activationSavingCompanyId(),
                ).toBeNull();
            },
        );

        it(
            'should deactivate child company after confirmation and refresh contexts',
            () => {
                canManage.set(
                    true,
                );


                const activeChild:
                    CompanyTreeNode = {
                    ...tree.children[0],

                    is_active:
                        true,
                };


                const close =
                    vi.fn();


                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.setCompanyActivation(
                    activeChild,
                    false,
                    dialog,
                );


                fixture.detectChanges();


                expect(
                    companyApi.setActivation,
                ).toHaveBeenCalledWith(
                    1,
                    2,
                    {
                        is_active:
                            false,
                    },
                );


                expect(
                    close,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    companyApi.getTree,
                ).toHaveBeenCalledTimes(
                    2,
                );


                expect(
                    companyContext
                        .loadAvailableCompanies,
                ).toHaveBeenCalledTimes(
                    1,
                );
            },
        );

        it(
            'should explain that parent must be active before activation',
            () => {
                canManage.set(
                    true,
                );


                companyApi
                    .setActivation
                    .mockReturnValueOnce(
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status:
                                        409,
                                }),
                        ),
                    );


                component.setCompanyActivation(
                    tree.children[0],
                    true,
                );


                fixture.detectChanges();


                expect(
                    component.activationError(),
                ).toBe(
                    'Сначала активируйте родительскую компанию',
                );


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="company-activation-error"]',
                        )
                        ?.textContent,
                ).toContain(
                    'Сначала активируйте родительскую компанию',
                );
            },
        );

        it(
            'should show move action only for child companies with manage permission',
            () => {
                canManage.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="move-company-action-2"]',
                        ),
                ).not.toBeNull();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="move-company-action-1"]',
                        ),
                ).toBeNull();
            },
        );

        it(
            'should exclude moving company and its descendants from parent options',
            () => {
                const deepTree:
                    CompanyTreeNode = {
                    ...tree,

                    children: [
                        {
                            ...tree.children[0],

                            is_active:
                                true,

                            children: [
                                {
                                    ...tree.children[0],

                                    id:
                                        3,

                                    parent_id:
                                        2,

                                    name:
                                        'Branch Leaf',

                                    children:
                                        [],
                                },
                            ],
                        },

                        {
                            ...tree.children[0],

                            id:
                                4,

                            parent_id:
                                1,

                            name:
                                'Other Branch',

                            is_active:
                                true,

                            children:
                                [],
                        },
                    ],
                };


                companyApi
                    .getTree
                    .mockReturnValue(
                        of(deepTree),
                    );


                component.retry();

                fixture.detectChanges();


                component.startMove(
                    deepTree.children[0],
                );


                expect(
                    component
                        .moveParentOptions()
                        .map(
                            row =>
                                row.company.id,
                        ),
                ).toEqual([
                    1,
                    4,
                ]);


                expect(
                    component.getMoveParentLabel(
                        component
                            .moveParentOptions()[1],
                    ),
                ).toBe(
                    '\u00a0\u00a0Other Branch',
                );
            },
        );

        it(
            'should move child company and reload only the tree',
            () => {
                canManage.set(
                    true,
                );


                const close =
                    vi.fn();


                const dialog = {
                    close,
                } as unknown as BrnDialog;


                component.startMove(
                    tree.children[0],
                );

                component.setMoveParent(
                    '1',
                );


                component.moveCompany(
                    dialog,
                );


                fixture.detectChanges();


                expect(
                    companyApi.move,
                ).toHaveBeenCalledWith(
                    1,
                    2,
                    {
                        parent_id:
                            1,
                    },
                );


                expect(
                    close,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    companyApi.getTree,
                ).toHaveBeenCalledTimes(
                    2,
                );


                expect(
                    companyContext
                        .loadAvailableCompanies,
                ).not.toHaveBeenCalled();


                expect(
                    component.movingCompany(),
                ).toBeNull();


                expect(
                    component.moveParentId(),
                ).toBeNull();


                expect(
                    component.moveError(),
                ).toBeNull();
            },
        );

        it(
            'should require a new parent before moving company',
            () => {
                canManage.set(
                    true,
                );


                const dialog = {
                    close:
                        vi.fn(),
                } as unknown as BrnDialog;


                component.startMove(
                    tree.children[0],
                );

                component.setMoveParent(
                    null,
                );


                component.moveCompany(
                    dialog,
                );


                expect(
                    companyApi.move,
                ).not.toHaveBeenCalled();


                expect(
                    component.moveError(),
                ).toBe(
                    'Выберите новую родительскую компанию',
                );
            },
        );

        it.each([
            {
                status:
                    400,

                detail:
                    'Root company cannot be moved',

                expected:
                    'Корневую компанию нельзя перемещать',
            },

            {
                status:
                    404,

                detail:
                    'Company not found',

                expected:
                    'Компания или новый родитель недоступны в текущем дереве',
            },

            {
                status:
                    409,

                detail:
                    'Company hierarchy cycle detected',

                expected:
                    'Нельзя переместить компанию внутрь её дочерней ветки',
            },

            {
                status:
                    409,

                detail:
                    'Active company cannot be moved under inactive company',

                expected:
                    'Нельзя переместить активную компанию под отключённую',
            },
        ])(
            'should map move error $status: $detail',
            (
                {
                    status,
                    detail,
                    expected,
                },
            ) => {
                canManage.set(
                    true,
                );


                companyApi
                    .move
                    .mockReturnValueOnce(
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status,

                                    error: {
                                        detail,
                                    },
                                }),
                        ),
                    );


                component.startMove(
                    tree.children[0],
                );

                component.setMoveParent(
                    '1',
                );


                component.moveCompany({
                    close:
                        vi.fn(),
                } as unknown as BrnDialog);


                expect(
                    component.moveError(),
                ).toBe(
                    expected,
                );
            },
        );
    },
);
