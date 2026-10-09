import {
    describe,
    expect,
    it,
} from 'vitest';

import {
    routes,
} from './app.routes';


describe(
    'application routes',
    () => {
        it(
            'should protect invitations route with a permission guard',
            () => {
                const appRoute =
                    routes.find(
                        route =>
                            route.path === '',
                    );

                expect(
                    appRoute,
                ).toBeDefined();

                const inviteRoute =
                    appRoute?.children?.find(
                        route =>
                            route.path === 'invitations',
                    );

                expect(
                    inviteRoute,
                ).toBeDefined();

                expect(
                    inviteRoute?.canActivate,
                ).toBeDefined();

                expect(
                    inviteRoute?.canActivate?.length,
                ).toBe(1);

                expect(
                    inviteRoute
                        ?.runGuardsAndResolvers,
                ).toBe(
                    'always',
                );
            },
        );

        it(
            'should expose public token route outside authenticated layout',
            () => {
                const publicInviteRoute =
                    routes.find(
                        route =>
                            route.path === 'invite',
                    );

                expect(publicInviteRoute).toBeDefined();
                expect(publicInviteRoute?.canActivate?.length).toBe(1);

                const appRoute =
                    routes.find(
                        route =>
                            route.path === '',
                    );

                expect(
                    appRoute?.children?.some(
                        route => route.path === 'invite',
                    ),
                ).toBe(false);
            },
        );

        it(
            'should keep forbidden route free from permission guards',
            () => {
                const appRoute =
                    routes.find(
                        route =>
                            route.path === '',
                    );

                const forbiddenRoute =
                    appRoute?.children?.find(
                        route =>
                            route.path === 'forbidden',
                    );

                expect(
                    forbiddenRoute,
                ).toBeDefined();

                expect(
                    forbiddenRoute?.canActivate,
                ).toBeUndefined();
            },
        );

        it(
            'should protect roles route with a permission guard',
            () => {
                const appRoute =
                    routes.find(
                        route =>
                            route.path === '',
                    );

                const rolesRoute =
                    appRoute
                        ?.children
                        ?.find(
                            route =>
                                route.path === 'roles',
                        );

                expect(
                    rolesRoute,
                ).toBeDefined();

                expect(
                    rolesRoute?.canActivate,
                ).toBeDefined();

                expect(
                    rolesRoute?.canActivate?.length,
                ).toBe(1);

                expect(
                    rolesRoute
                        ?.runGuardsAndResolvers,
                ).toBe(
                    'always',
                );
            },
        );
    },
);
