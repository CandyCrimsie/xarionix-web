import {
    signal,
} from '@angular/core';

import {
    TestBed,
} from '@angular/core/testing';

import {
    HttpClient,
} from '@angular/common/http';

import {
    of,
    Subject,
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
    API_BASE_URL,
} from '../api/api.config';

import {
    AuthService,
} from '../auth/auth.service';

import type {
    User,
} from '../auth/auth.models';

import {
    CompanyContextService,
} from '../company/company-context.service';

import type {
    Company,
} from '../company/company.models';

import {
    PermissionCode,
    PermissionScope,
    type EffectivePermissionsResponse,
} from './permission.models';

import {
    PermissionService,
} from './permission.service';


describe(
    'RBAC company context regression',
    () => {
        let companyContext:
            CompanyContextService;

        let permissions:
            PermissionService;

        const http = {
            get: vi.fn(),
        };


        const authenticated =
            signal(true);

        const authUser =
            signal<User | null>(null);

        const auth = {
            isAuthenticated:
                authenticated.asReadonly(),

            user:
                authUser.asReadonly(),
        };


        const user: User = {
            id: 100,
            username: 'admin@example.com',
            is_active: true,
            created_at:
                '2026-01-01T00:00:00Z',
            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const companyA: Company = {
            id: 1,
            parent_id: null,
            name: 'Company A',
            short_name: 'A',
            is_active: true,
            created_at:
                '2026-01-01T00:00:00Z',
            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const companyB: Company = {
            id: 2,
            parent_id: null,
            name: 'Company B',
            short_name: 'B',
            is_active: true,
            created_at:
                '2026-01-01T00:00:00Z',
            updated_at:
                '2026-01-01T00:00:00Z',
        };


        const companyC: Company = {
            id: 3,
            parent_id: null,
            name: 'Company C',
            short_name: 'C',
            is_active: true,
            created_at:
                '2026-01-01T00:00:00Z',
            updated_at:
                '2026-01-01T00:00:00Z',
        };


        beforeEach(() => {
            vi.clearAllMocks();

            localStorage.clear();

            authenticated.set(true);
            authUser.set(user);

            TestBed.configureTestingModule({
                providers: [
                    CompanyContextService,
                    PermissionService,

                    {
                        provide: HttpClient,
                        useValue: http,
                    },

                    {
                        provide: AuthService,
                        useValue: auth,
                    },
                ],
            });

            companyContext =
                TestBed.inject(
                    CompanyContextService,
                );

            /*
             * PermissionService должен быть
             * создан после CompanyContextService,
             * чтобы подписаться на
             * companyChanged$.
             */
            permissions =
                TestBed.inject(
                    PermissionService,
                );
        });


        it(
            'should restore active company and initialize its permissions without duplicate reload',
            () => {
                localStorage.setItem(
                    `erp.active-company-id:${user.id}`,
                    '2',
                );

                const companyEvents:
                    Array<number | null> = [];

                companyContext.companyChanged$
                    .subscribe(companyId => {
                        companyEvents.push(
                            companyId,
                        );
                    });

                http.get.mockImplementation(
                    (url: string) => {
                        if (
                            url ===
                            `${API_BASE_URL}/me/companies`
                        ) {
                            return of([
                                companyA,
                                companyB,
                            ]);
                        }

                        if (
                            url ===
                            `${API_BASE_URL}/me/permissions`
                        ) {
                            return of(
                                permissionResponse(
                                    PermissionCode.TasksRead,
                                    PermissionScope.Self,
                                ),
                            );
                        }

                        throw new Error(
                            `Unexpected GET ${url}`,
                        );
                    },
                );

                companyContext
                    .initialize()
                    .subscribe();

                permissions
                    .initialize()
                    .subscribe();

                expect(
                    companyContext
                        .activeCompanyId(),
                ).toBe(2);

                expect(
                    permissions.loadedCompanyId(),
                ).toBe(2);

                expect(
                    permissions.can(
                        PermissionCode.TasksRead,
                    ),
                ).toBe(true);

                /*
                 * restoreActiveCompany()
                 * специально не должен
                 * генерировать companyChanged$,
                 * иначе permissions загрузятся
                 * дважды:
                 *
                 * event reload + initialize().
                 */
                expect(
                    companyEvents,
                ).toEqual([]);

                expect(
                    http.get,
                ).toHaveBeenCalledTimes(2);
            },
        );


        it(
            'should replace permissions when switching companies and ignore repeated switch',
            () => {
                http.get.mockImplementation(
                    (url: string) => {
                        if (
                            url ===
                            `${API_BASE_URL}/me/companies`
                        ) {
                            return of([
                                companyA,
                                companyB,
                            ]);
                        }

                        if (
                            url ===
                            `${API_BASE_URL}/me/permissions`
                        ) {
                            const companyId =
                                companyContext
                                    .activeCompanyId();

                            if (companyId === 1) {
                                return of(
                                    permissionResponse(
                                        PermissionCode.RolesManage,
                                        PermissionScope.Company,
                                    ),
                                );
                            }

                            if (companyId === 2) {
                                return of(
                                    permissionResponse(
                                        PermissionCode.TasksRead,
                                        PermissionScope.Self,
                                    ),
                                );
                            }
                        }

                        throw new Error(
                            `Unexpected GET ${url}`,
                        );
                    },
                );

                companyContext
                    .initialize()
                    .subscribe();

                permissions
                    .initialize()
                    .subscribe();

                expect(
                    companyContext
                        .activeCompanyId(),
                ).toBe(1);

                expect(
                    permissions.can(
                        PermissionCode.RolesManage,
                    ),
                ).toBe(true);


                companyContext.switchCompany(2);


                expect(
                    permissions.loadedCompanyId(),
                ).toBe(2);

                expect(
                    permissions.can(
                        PermissionCode.RolesManage,
                    ),
                ).toBe(false);

                expect(
                    permissions.can(
                        PermissionCode.TasksRead,
                    ),
                ).toBe(true);

                /*
                 * companies + permissions A
                 * + permissions B
                 */
                expect(
                    http.get,
                ).toHaveBeenCalledTimes(3);

                /*
                 * Повторное переключение
                 * на уже активную компанию
                 * ничего делать не должно.
                 */
                companyContext.switchCompany(2);

                expect(
                    http.get,
                ).toHaveBeenCalledTimes(3);
            },
        );


        it(
            'should keep only the newest permissions during rapid company switching',
            () => {
                const companyBResponse =
                    new Subject<
                        EffectivePermissionsResponse
                    >();

                const companyCResponse =
                    new Subject<
                        EffectivePermissionsResponse
                    >();

                http.get.mockImplementation(
                    (url: string) => {
                        if (
                            url ===
                            `${API_BASE_URL}/me/companies`
                        ) {
                            return of([
                                companyA,
                                companyB,
                                companyC,
                            ]);
                        }

                        if (
                            url ===
                            `${API_BASE_URL}/me/permissions`
                        ) {
                            const companyId =
                                companyContext
                                    .activeCompanyId();

                            if (companyId === 1) {
                                return of(
                                    permissionResponse(
                                        PermissionCode.RolesManage,
                                        PermissionScope.Company,
                                    ),
                                );
                            }

                            if (companyId === 2) {
                                return companyBResponse;
                            }

                            if (companyId === 3) {
                                return companyCResponse;
                            }
                        }

                        throw new Error(
                            `Unexpected GET ${url}`,
                        );
                    },
                );


                companyContext
                    .initialize()
                    .subscribe();

                permissions
                    .initialize()
                    .subscribe();

                expect(
                    permissions.can(
                        PermissionCode.RolesManage,
                    ),
                ).toBe(true);


                /*
                 * Начали загрузку Company B.
                 */
                companyContext.switchCompany(2);

                expect(
                    permissions.state(),
                ).toBe('loading');

                expect(
                    permissions.permissions().size,
                ).toBe(0);


                /*
                 * До ответа B пользователь
                 * уже переключился на C.
                 *
                 * switchMap должен отменить
                 * подписку на B.
                 */
                companyContext.switchCompany(3);

                expect(
                    permissions.state(),
                ).toBe('loading');

                expect(
                    permissions.loadedCompanyId(),
                ).toBeNull();


                /*
                 * Поздний ответ B больше
                 * не должен ничего менять.
                 */
                companyBResponse.next(
                    permissionResponse(
                        PermissionCode.MembersManage,
                        PermissionScope.Company,
                    ),
                );

                companyBResponse.complete();

                expect(
                    permissions.loadedCompanyId(),
                ).toBeNull();

                expect(
                    permissions.can(
                        PermissionCode.MembersManage,
                    ),
                ).toBe(false);


                /*
                 * Приходит актуальный ответ C.
                 */
                companyCResponse.next(
                    permissionResponse(
                        PermissionCode.TasksCreate,
                        PermissionScope.Self,
                    ),
                );

                companyCResponse.complete();


                expect(
                    permissions.state(),
                ).toBe('ready');

                expect(
                    permissions.loadedCompanyId(),
                ).toBe(3);

                expect(
                    permissions.can(
                        PermissionCode.TasksCreate,
                    ),
                ).toBe(true);

                expect(
                    permissions.can(
                        PermissionCode.RolesManage,
                    ),
                ).toBe(false);

                expect(
                    permissions.can(
                        PermissionCode.MembersManage,
                    ),
                ).toBe(false);
            },
        );


        it(
            'should recover on a later company switch after permission reload failure',
            () => {
                http.get.mockImplementation(
                    (url: string) => {
                        if (
                            url ===
                            `${API_BASE_URL}/me/companies`
                        ) {
                            return of([
                                companyA,
                                companyB,
                                companyC,
                            ]);
                        }

                        if (
                            url ===
                            `${API_BASE_URL}/me/permissions`
                        ) {
                            const companyId =
                                companyContext
                                    .activeCompanyId();

                            if (companyId === 1) {
                                return of(
                                    permissionResponse(
                                        PermissionCode.RolesManage,
                                        PermissionScope.Company,
                                    ),
                                );
                            }

                            if (companyId === 2) {
                                return throwError(
                                    () => new Error(
                                        'Company B permissions unavailable',
                                    ),
                                );
                            }

                            if (companyId === 3) {
                                return of(
                                    permissionResponse(
                                        PermissionCode.TasksRead,
                                        PermissionScope.Self,
                                    ),
                                );
                            }
                        }

                        throw new Error(
                            `Unexpected GET ${url}`,
                        );
                    },
                );


                companyContext
                    .initialize()
                    .subscribe();

                permissions
                    .initialize()
                    .subscribe();

                expect(
                    permissions.can(
                        PermissionCode.RolesManage,
                    ),
                ).toBe(true);


                /*
                 * B падает.
                 */
                companyContext.switchCompany(2);

                expect(
                    permissions.state(),
                ).toBe('error');

                expect(
                    permissions.loadedCompanyId(),
                ).toBeNull();

                expect(
                    permissions.permissions().size,
                ).toBe(0);


                /*
                 * Но companyChanged$ subscription
                 * должна остаться живой.
                 *
                 * Следующий switch на C
                 * обязан восстановиться.
                 */
                companyContext.switchCompany(3);

                expect(
                    permissions.state(),
                ).toBe('ready');

                expect(
                    permissions.loadedCompanyId(),
                ).toBe(3);

                expect(
                    permissions.can(
                        PermissionCode.TasksRead,
                    ),
                ).toBe(true);
            },
        );


        it(
            'should preserve current context when switching to unavailable company',
            () => {
                http.get.mockImplementation(
                    (url: string) => {
                        if (
                            url ===
                            `${API_BASE_URL}/me/companies`
                        ) {
                            return of([
                                companyA,
                                companyB,
                            ]);
                        }

                        if (
                            url ===
                            `${API_BASE_URL}/me/permissions`
                        ) {
                            return of(
                                permissionResponse(
                                    PermissionCode.RolesManage,
                                    PermissionScope.Company,
                                ),
                            );
                        }

                        throw new Error(
                            `Unexpected GET ${url}`,
                        );
                    },
                );


                companyContext
                    .initialize()
                    .subscribe();

                permissions
                    .initialize()
                    .subscribe();

                expect(
                    permissions.can(
                        PermissionCode.RolesManage,
                    ),
                ).toBe(true);


                expect(
                    () =>
                        companyContext.switchCompany(
                            999,
                        ),
                ).toThrow(
                    'Company is not available for current user',
                );


                expect(
                    companyContext
                        .activeCompanyId(),
                ).toBe(1);

                expect(
                    permissions.loadedCompanyId(),
                ).toBe(1);

                expect(
                    permissions.can(
                        PermissionCode.RolesManage,
                    ),
                ).toBe(true);

                /*
                 * Только:
                 *
                 * GET companies
                 * GET permissions A
                 *
                 * Никакого reload для 999.
                 */
                expect(
                    http.get,
                ).toHaveBeenCalledTimes(2);
            },
        );
    },
);


function permissionResponse(
    permission: PermissionCode,
    scope: PermissionScope,
): EffectivePermissionsResponse {
    return {
        permissions: [
            permission,
        ],

        scopes: {
            [permission]: scope,
        },
    };
}