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
            'should protect invite route with a permission guard',
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
                            route.path === 'invite',
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
    },
);