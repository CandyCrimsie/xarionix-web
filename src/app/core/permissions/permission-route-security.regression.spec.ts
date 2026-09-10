import {
    Component,
} from '@angular/core';

import {
    TestBed,
} from '@angular/core/testing';

import {
    NavigationEnd,
    Router,
    Routes,
    provideRouter,
} from '@angular/router';

import {
    filter,
    firstValueFrom,
    Subject,
    take,
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
} from './permission.models';

import {
    permissionGuard,
} from './permission-guard';

import {
    PermissionService,
} from './permission.service';

import {
    PermissionRouteRevalidationService,
} from './permission-route-revalidation.service';


@Component({
    standalone: true,
    template: '',
})
class TestHome { }


@Component({
    standalone: true,
    template: '',
})
class TestInvite { }


@Component({
    standalone: true,
    template: '',
})
class TestForbidden { }


const testRoutes: Routes = [
    {
        path: '',
        component: TestHome,
    },

    {
        path: 'invite',

        canActivate: [
            permissionGuard(
                PermissionCode.MembersManage,
            ),
        ],

        runGuardsAndResolvers:
            'always',

        component: TestInvite,
    },

    {
        path: 'forbidden',
        component: TestForbidden,
    },
];


describe(
    'permission route security regression',
    () => {
        let router:
            Router;

        let revalidation:
            PermissionRouteRevalidationService;

        const settled =
            new Subject<number>();

        const permissions = {
            can: vi.fn(),

            companyPermissionsSettled$:
                settled.asObservable(),
        };


        beforeEach(() => {
            vi.clearAllMocks();

            permissions.can
                .mockReturnValue(true);

            TestBed.configureTestingModule({
                providers: [
                    provideRouter(
                        testRoutes,
                    ),

                    PermissionRouteRevalidationService,

                    {
                        provide:
                            PermissionService,

                        useValue:
                            permissions,
                    },
                ],
            });

            router =
                TestBed.inject(
                    Router,
                );

            revalidation =
                TestBed.inject(
                    PermissionRouteRevalidationService,
                );

            revalidation.start();
        });


        it(
            'should allow navigation to protected route when permission is granted',
            async () => {
                permissions.can
                    .mockReturnValue(true);

                await router.navigateByUrl(
                    '/invite',
                );

                expect(
                    router.url,
                ).toBe(
                    '/invite',
                );

                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.MembersManage,
                    undefined,
                );
            },
        );


        it(
            'should redirect protected route to forbidden when permission is missing',
            async () => {
                permissions.can
                    .mockReturnValue(false);

                const navigation =
                    waitForNavigationEnd(
                        router,
                    );

                void router.navigateByUrl(
                    '/invite',
                );

                await navigation;

                expect(
                    router.url,
                ).toBe(
                    '/forbidden',
                );

                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.MembersManage,
                    undefined,
                );
            },
        );


        it(
            'should leave protected route after company switch removes permission',
            async () => {
                /*
                 * Company A:
                 * members.manage есть.
                 */
                permissions.can
                    .mockReturnValue(true);

                await router.navigateByUrl(
                    '/invite',
                );

                expect(
                    router.url,
                ).toBe(
                    '/invite',
                );


                /*
                 * Company B:
                 * members.manage больше нет.
                 */
                permissions.can
                    .mockReturnValue(false);

                const navigation =
                    waitForNavigationEnd(
                        router,
                    );

                settled.next(2);

                await navigation;


                expect(
                    router.url,
                ).toBe(
                    '/forbidden',
                );
            },
        );


        it(
            'should remain on protected route after company switch keeps permission',
            async () => {
                permissions.can
                    .mockReturnValue(true);

                await router.navigateByUrl(
                    '/invite',
                );

                expect(
                    router.url,
                ).toBe(
                    '/invite',
                );


                permissions.can.mockClear();

                const navigation =
                    waitForNavigationEnd(
                        router,
                    );

                settled.next(2);

                await navigation;


                expect(
                    router.url,
                ).toBe(
                    '/invite',
                );

                /*
                 * Guard действительно был
                 * выполнен повторно.
                 */
                expect(
                    permissions.can,
                ).toHaveBeenCalledWith(
                    PermissionCode.MembersManage,
                    undefined,
                );
            },
        );


        it(
            'should keep forbidden route stable during later permission revalidation',
            async () => {
                /*
                 * Сначала попадаем на forbidden.
                 */
                permissions.can
                    .mockReturnValue(false);

                const deniedNavigation =
                    waitForNavigationEnd(
                        router,
                    );

                void router.navigateByUrl(
                    '/invite',
                );

                await deniedNavigation;

                expect(
                    router.url,
                ).toBe(
                    '/forbidden',
                );


                /*
                 * Guard больше не должен
                 * выполняться для самого
                 * /forbidden.
                 */
                permissions.can.mockClear();

                const revalidationNavigation =
                    waitForNavigationEnd(
                        router,
                    );

                settled.next(3);

                await revalidationNavigation;


                expect(
                    router.url,
                ).toBe(
                    '/forbidden',
                );

                expect(
                    permissions.can,
                ).not.toHaveBeenCalled();
            },
        );
    },
);


function waitForNavigationEnd(
    router: Router,
): Promise<NavigationEnd> {
    return firstValueFrom(
        router.events.pipe(
            filter(
                (
                    event,
                ): event is NavigationEnd =>
                    event instanceof NavigationEnd,
            ),

            take(1),
        ),
    );
}