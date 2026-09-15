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
    installationGuard,
} from './installation-guard';


describe(
    'installationGuard',
    () => {
        const setupState = {
            isInstalled:
                vi.fn(),
        };


        const setupTree =
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
                        setupTree,
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
            'should allow installed application',
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
                                installationGuard(
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
            'should redirect non installed application to setup',
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
                                installationGuard(
                                    {} as never,
                                    {} as never,
                                ),
                        );


                expect(
                    router.createUrlTree,
                ).toHaveBeenCalledWith(
                    [
                        '/setup',
                    ],
                );

                expect(
                    result,
                ).toBe(
                    setupTree,
                );
            },
        );
    },
);