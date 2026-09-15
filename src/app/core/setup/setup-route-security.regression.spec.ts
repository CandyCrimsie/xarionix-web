import {
    Component,
} from '@angular/core';

import {
    TestBed,
} from '@angular/core/testing';

import {
    Router,
    Routes,
    provideRouter,
} from '@angular/router';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    routes as applicationRoutes,
} from '../../app.routes';

import {
    AuthService,
} from '../auth/auth.service';

import {
    authGuard,
} from '../auth/auth-guard';

import {
    guestGuard,
} from '../auth/guest-guard';

import {
    SetupStateService,
} from './setup-state.service';

import {
    installationGuard,
} from './installation-guard';

import {
    setupGuard,
} from './setup-guard';


@Component({
    selector:
        'app-test-setup',

    standalone:
        true,

    template:
        '',
})
class TestSetup { }


@Component({
    selector:
        'app-test-login',

    standalone:
        true,

    template:
        '',
})
class TestLogin { }


@Component({
    selector:
        'app-test-home',

    standalone:
        true,

    template:
        '',
})
class TestHome { }


const testRoutes:
    Routes = [
        {
            path:
                'setup',

            canActivate: [
                setupGuard,
            ],

            component:
                TestSetup,
        },

        {
            path:
                'login',

            canActivate: [
                installationGuard,
                guestGuard,
            ],

            component:
                TestLogin,
        },

        {
            path:
                '',

            canActivate: [
                installationGuard,
                authGuard,
            ],

            component:
                TestHome,
        },

        {
            path:
                '**',

            redirectTo:
                '',
        },
    ];


describe(
    'first run route security regression',
    () => {
        let router:
            Router;


        const setupState = {
            isInstalled:
                vi.fn(),
        };


        const auth = {
            isAuthenticated:
                vi.fn(),
        };


        beforeEach(
            () => {
                vi.clearAllMocks();


                setupState
                    .isInstalled
                    .mockReturnValue(
                        false,
                    );


                auth
                    .isAuthenticated
                    .mockReturnValue(
                        false,
                    );


                TestBed
                    .configureTestingModule({
                        providers: [
                            provideRouter(
                                testRoutes,
                            ),

                            {
                                provide:
                                    SetupStateService,

                                useValue:
                                    setupState,
                            },

                            {
                                provide:
                                    AuthService,

                                useValue:
                                    auth,
                            },
                        ],
                    });


                router =
                    TestBed.inject(
                        Router,
                    );
            },
        );


        it(
            'should keep installation guard before auth guards in application routes',
            () => {
                const setupRoute =
                    applicationRoutes
                        .find(
                            route =>
                                route.path
                                === 'setup',
                        );

                const loginRoute =
                    applicationRoutes
                        .find(
                            route =>
                                route.path
                                === 'login',
                        );

                const applicationRoute =
                    applicationRoutes
                        .find(
                            route =>
                                route.path
                                === '',
                        );


                expect(
                    setupRoute
                        ?.canActivate,
                ).toEqual([
                    setupGuard,
                ]);


                expect(
                    loginRoute
                        ?.canActivate,
                ).toEqual([
                    installationGuard,
                    guestGuard,
                ]);


                expect(
                    applicationRoute
                        ?.canActivate,
                ).toEqual([
                    installationGuard,
                    authGuard,
                ]);
            },
        );


        it(
            'should allow setup route when application is not installed',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        false,
                    );


                await router
                    .navigateByUrl(
                        '/setup',
                    );


                expect(
                    router.url,
                ).toBe(
                    '/setup',
                );
            },
        );


        it(
            'should redirect application route to setup before auth guard when not installed',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        false,
                    );


                await router
                    .navigateByUrl(
                        '/',
                    );


                expect(
                    router.url,
                ).toBe(
                    '/setup',
                );


                /*
                 * Очень важный regression:
                 * authGuard вообще не должен
                 * выполняться до завершения setup.
                 */
                expect(
                    auth.isAuthenticated,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should redirect login route to setup before guest guard when not installed',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        false,
                    );


                await router
                    .navigateByUrl(
                        '/login',
                    );


                expect(
                    router.url,
                ).toBe(
                    '/setup',
                );


                expect(
                    auth.isAuthenticated,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should redirect anonymous installed user from application to login',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        true,
                    );

                auth
                    .isAuthenticated
                    .mockReturnValue(
                        false,
                    );


                await router
                    .navigateByUrl(
                        '/',
                    );


                expect(
                    router.url
                        .startsWith(
                            '/login',
                        ),
                ).toBe(true);


                expect(
                    auth.isAuthenticated,
                ).toHaveBeenCalled();
            },
        );


        it(
            'should allow authenticated installed user into application',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        true,
                    );

                auth
                    .isAuthenticated
                    .mockReturnValue(
                        true,
                    );


                await router
                    .navigateByUrl(
                        '/',
                    );


                expect(
                    router.url,
                ).toBe(
                    '/',
                );
            },
        );


        it(
            'should allow anonymous installed user to open login',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        true,
                    );

                auth
                    .isAuthenticated
                    .mockReturnValue(
                        false,
                    );


                await router
                    .navigateByUrl(
                        '/login',
                    );


                expect(
                    router.url,
                ).toBe(
                    '/login',
                );
            },
        );


        it(
            'should redirect authenticated installed user away from login',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        true,
                    );

                auth
                    .isAuthenticated
                    .mockReturnValue(
                        true,
                    );


                await router
                    .navigateByUrl(
                        '/login',
                    );


                expect(
                    router.url,
                ).toBe(
                    '/',
                );
            },
        );


        it(
            'should redirect authenticated installed user away from setup',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        true,
                    );

                auth
                    .isAuthenticated
                    .mockReturnValue(
                        true,
                    );


                await router
                    .navigateByUrl(
                        '/setup',
                    );


                expect(
                    router.url,
                ).toBe(
                    '/',
                );
            },
        );


        it(
            'should redirect anonymous installed user from setup to login',
            async () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        true,
                    );

                auth
                    .isAuthenticated
                    .mockReturnValue(
                        false,
                    );


                await router
                    .navigateByUrl(
                        '/setup',
                    );


                /*
                 * setupGuard сначала отправит на "/",
                 * а authGuard уже отправит anonymous
                 * пользователя на /login.
                 */
                expect(
                    router.url
                        .startsWith(
                            '/login',
                        ),
                ).toBe(true);
            },
        );
    },
);