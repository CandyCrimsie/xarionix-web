import {
    TestBed,
} from '@angular/core/testing';

import {
    firstValueFrom,
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
    SetupApiService,
} from './setup-api.service';

import {
    InstallationState,
} from './setup.models';

import {
    SetupStateService,
} from './setup-state.service';


describe(
    'SetupStateService',
    () => {
        let service:
            SetupStateService;


        const api = {
            status:
                vi.fn(),
        };


        beforeEach(
            () => {
                vi.clearAllMocks();


                TestBed
                    .configureTestingModule({
                        providers: [
                            SetupStateService,

                            {
                                provide:
                                    SetupApiService,

                                useValue:
                                    api,
                            },
                        ],
                    });


                service =
                    TestBed.inject(
                        SetupStateService,
                    );
            },
        );


        it(
            'should expose ready installation as setup required',
            async () => {
                api.status
                    .mockReturnValue(
                        of({
                            state:
                                InstallationState.Ready,

                            setup_allowed:
                                true,

                            has_users:
                                false,

                            has_companies:
                                false,

                            has_memberships:
                                false,

                            has_administrator:
                                false,
                        }),
                    );


                await firstValueFrom(
                    service.initialize(),
                );


                expect(
                    service.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    service.isSetupRequired(),
                ).toBe(true);

                expect(
                    service.isInstalled(),
                ).toBe(false);

                expect(
                    service.isInconsistent(),
                ).toBe(false);
            },
        );


        it(
            'should expose installed installation',
            async () => {
                api.status
                    .mockReturnValue(
                        of({
                            state:
                                InstallationState.Installed,

                            setup_allowed:
                                false,

                            has_users:
                                true,

                            has_companies:
                                true,

                            has_memberships:
                                true,

                            has_administrator:
                                true,
                        }),
                    );


                await firstValueFrom(
                    service.initialize(),
                );


                expect(
                    service.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    service.isInstalled(),
                ).toBe(true);

                expect(
                    service.isSetupRequired(),
                ).toBe(false);

                expect(
                    service.isInconsistent(),
                ).toBe(false);
            },
        );


        it(
            'should expose inconsistent installation fail closed',
            async () => {
                api.status
                    .mockReturnValue(
                        of({
                            state:
                                InstallationState.Inconsistent,

                            setup_allowed:
                                false,

                            has_users:
                                true,

                            has_companies:
                                true,

                            has_memberships:
                                true,

                            has_administrator:
                                false,
                        }),
                    );


                await firstValueFrom(
                    service.initialize(),
                );


                expect(
                    service.state(),
                ).toBe(
                    'ready',
                );

                expect(
                    service.isInconsistent(),
                ).toBe(true);

                expect(
                    service.isInstalled(),
                ).toBe(false);

                expect(
                    service.isSetupRequired(),
                ).toBe(false);
            },
        );


        it(
            'should fail closed when installation status cannot be loaded',
            async () => {
                api.status
                    .mockReturnValue(
                        throwError(
                            () =>
                                new Error(
                                    'Setup unavailable',
                                ),
                        ),
                    );


                await firstValueFrom(
                    service.initialize(),
                );


                expect(
                    service.state(),
                ).toBe(
                    'error',
                );

                expect(
                    service.status(),
                ).toBeNull();

                expect(
                    service.hasError(),
                ).toBe(true);

                expect(
                    service.isInstalled(),
                ).toBe(false);

                expect(
                    service.isSetupRequired(),
                ).toBe(false);

                expect(
                    service.isInconsistent(),
                ).toBe(false);
            },
        );
    },
);