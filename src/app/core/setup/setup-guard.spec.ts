import {
    TestBed,
} from '@angular/core/testing';

import {
    Router,
} from '@angular/router';

import type {
    UrlTree,
} from '@angular/router';

import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import {
    SetupStateService,
} from './setup-state.service';

import {
    setupGuard,
} from './setup-guard';


describe(
    'setupGuard',
    () => {
        const setupState = {
            isInstalled:
                vi.fn(),
        };


        const homeTree =
            {} as UrlTree;


        const router = {
            createUrlTree:
                vi.fn(),
        };


        beforeEach(
            () => {
                vi.clearAllMocks();


                router
                    .createUrlTree
                    .mockReturnValue(
                        homeTree,
                    );


                TestBed
                    .configureTestingModule({
                        providers: [
                            {
                                provide:
                                    SetupStateService,

                                useValue:
                                    setupState,
                            },

                            {
                                provide:
                                    Router,

                                useValue:
                                    router,
                            },
                        ],
                    });
            },
        );


        it(
            'should allow setup for non installed application',
            () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        false,
                    );


                const result =
                    TestBed
                        .runInInjectionContext(
                            () =>
                                setupGuard(
                                    {} as never,
                                    {} as never,
                                ),
                        );


                expect(
                    result,
                ).toBe(true);

                expect(
                    router.createUrlTree,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should redirect installed application away from setup',
            () => {
                setupState
                    .isInstalled
                    .mockReturnValue(
                        true,
                    );


                const result =
                    TestBed
                        .runInInjectionContext(
                            () =>
                                setupGuard(
                                    {} as never,
                                    {} as never,
                                ),
                        );


                expect(
                    router.createUrlTree,
                ).toHaveBeenCalledWith(
                    [
                        '/',
                    ],
                );

                expect(
                    result,
                ).toBe(
                    homeTree,
                );
            },
        );
    },
);