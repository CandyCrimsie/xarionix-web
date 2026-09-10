import {
    Component,
} from '@angular/core';

import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
    HttpClient,
} from '@angular/common/http';

import {
    of,
    Subject,
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
    CanPermissionDirective,
} from './can-permission.directive';

import {
    PermissionCode,
    PermissionScope,
    type EffectivePermissionsResponse,
} from './permission.models';

import {
    PermissionService,
} from './permission.service';


@Component({
    imports: [
        CanPermissionDirective,
    ],

    template: `
    <button
      *appCan="membersManage"
      data-testid="manage-members"
    >
      Manage members
    </button>

    <button
      *appCan="
        membersManage;
        scope: ownUnitTree
      "
      data-testid="manage-members-tree"
    >
      Manage unit tree
    </button>
  `,
})
class TestHost {
    readonly membersManage =
        PermissionCode.MembersManage;

    readonly ownUnitTree =
        PermissionScope.OwnUnitTree;
}


describe(
    'permission-aware UI company context regression',
    () => {
        let fixture:
            ComponentFixture<TestHost>;

        let companyContext:
            CompanyContextService;

        let permissions:
            PermissionService;

        let companyBResponse:
            Subject<EffectivePermissionsResponse>;

        const http = {
            get: vi.fn(),
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


        const auth = {
            isAuthenticated:
                vi.fn(() => true),

            user:
                vi.fn(() => user),
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


        beforeEach(async () => {
            vi.clearAllMocks();

            localStorage.clear();

            companyBResponse =
                new Subject<
                    EffectivePermissionsResponse
                >();


            await TestBed
                .configureTestingModule({
                    imports: [
                        TestHost,
                    ],

                    providers: [
                        CompanyContextService,
                        PermissionService,

                        {
                            provide:
                                HttpClient,

                            useValue:
                                http,
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


            companyContext =
                TestBed.inject(
                    CompanyContextService,
                );

            permissions =
                TestBed.inject(
                    PermissionService,
                );


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
                                    PermissionScope.Company,
                                ),
                            );
                        }

                        if (companyId === 2) {
                            return companyBResponse;
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


            fixture =
                TestBed.createComponent(
                    TestHost,
                );

            fixture.detectChanges();
        });


        it(
            'should render permission-aware actions for the initial company',
            () => {
                expect(
                    permissions
                        .loadedCompanyId(),
                ).toBe(1);

                expect(
                    getManageMembers(),
                ).not.toBeNull();

                expect(
                    getManageMembersTree(),
                ).not.toBeNull();
            },
        );


        it(
            'should hide stale actions immediately when company changes',
            () => {
                expect(
                    getManageMembers(),
                ).not.toBeNull();


                companyContext
                    .switchCompany(2);

                fixture.detectChanges();


                expect(
                    permissions.state(),
                ).toBe(
                    'loading',
                );

                expect(
                    permissions
                        .loadedCompanyId(),
                ).toBeNull();

                expect(
                    getManageMembers(),
                ).toBeNull();

                expect(
                    getManageMembersTree(),
                ).toBeNull();
            },
        );


        it(
            'should keep actions hidden when new company has no permission',
            () => {
                companyContext
                    .switchCompany(2);

                fixture.detectChanges();


                companyBResponse.next({
                    permissions: [],
                    scopes: {},
                });

                companyBResponse
                    .complete();

                fixture.detectChanges();


                expect(
                    permissions.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    permissions
                        .loadedCompanyId(),
                ).toBe(2);

                expect(
                    getManageMembers(),
                ).toBeNull();

                expect(
                    getManageMembersTree(),
                ).toBeNull();
            },
        );


        it(
            'should enforce minimum scope in UI after company switch',
            () => {
                companyContext
                    .switchCompany(2);

                fixture.detectChanges();


                companyBResponse.next(
                    permissionResponse(
                        PermissionScope.OwnUnit,
                    ),
                );

                companyBResponse
                    .complete();

                fixture.detectChanges();


                /*
                 * Сам permission есть.
                 */
                expect(
                    getManageMembers(),
                ).not.toBeNull();

                /*
                 * Но OWN_UNIT недостаточно
                 * для minimum OWN_UNIT_TREE.
                 */
                expect(
                    getManageMembersTree(),
                ).toBeNull();
            },
        );


        it(
            'should restore scope-aware UI when new company grants sufficient scope',
            () => {
                companyContext
                    .switchCompany(2);

                fixture.detectChanges();


                companyBResponse.next(
                    permissionResponse(
                        PermissionScope.Company,
                    ),
                );

                companyBResponse
                    .complete();

                fixture.detectChanges();


                expect(
                    permissions
                        .loadedCompanyId(),
                ).toBe(2);

                expect(
                    getManageMembers(),
                ).not.toBeNull();

                expect(
                    getManageMembersTree(),
                ).not.toBeNull();
            },
        );


        function getManageMembers():
            Element | null {
            const element:
                HTMLElement =
                fixture.nativeElement;

            return element.querySelector(
                '[data-testid="manage-members"]',
            );
        }


        function getManageMembersTree():
            Element | null {
            const element:
                HTMLElement =
                fixture.nativeElement;

            return element.querySelector(
                '[data-testid="manage-members-tree"]',
            );
        }
    },
);


function permissionResponse(
    scope: PermissionScope,
): EffectivePermissionsResponse {
    return {
        permissions: [
            PermissionCode.MembersManage,
        ],

        scopes: {
            [
                PermissionCode
                    .MembersManage
            ]:
                scope,
        },
    };
}