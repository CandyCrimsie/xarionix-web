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
    SetupStateService,
} from '../../core/setup/setup-state.service';

import {
    Setup,
} from './setup';

import {
    HttpErrorResponse,
} from '@angular/common/http';

import {
    Router,
} from '@angular/router';

import {
    AuthService,
} from '../../core/auth/auth.service';

import {
    CompanyContextService,
} from '../../core/company/company-context.service';

import {
    PermissionService,
} from '../../core/permissions/permission.service';

import {
    SetupApiService,
} from '../../core/setup/setup-api.service';

import {
    InstallationState,
} from '../../core/setup/setup.models';


describe(
    'Setup',
    () => {
        let fixture:
            ComponentFixture<Setup>;

        let component:
            Setup;


        const state =
            signal<
                'idle'
                | 'loading'
                | 'ready'
                | 'error'
            >(
                'ready',
            );

        const setupRequired =
            signal(true);

        const inconsistent =
            signal(false);

        const statusError =
            signal(false);


        const installed =
            signal(false);


        const setupApi = {
            initialize:
                vi.fn(),
        };


        const auth = {
            login:
                vi.fn(),
        };


        const companyContext = {
            initialize:
                vi.fn(),
        };


        const permissions = {
            initialize:
                vi.fn(),
        };


        const router = {
            navigateByUrl:
                vi.fn(),
        };


        const setupState = {
            state:
                state.asReadonly(),

            isSetupRequired:
                setupRequired
                    .asReadonly(),

            isInstalled:
                installed.asReadonly(),

            isInconsistent:
                inconsistent
                    .asReadonly(),

            hasError:
                statusError
                    .asReadonly(),

            refresh:
                vi.fn(),
        };


        beforeEach(
            async () => {
                vi.clearAllMocks();

                state.set(
                    'ready',
                );

                setupRequired.set(
                    true,
                );

                inconsistent.set(
                    false,
                );

                installed.set(
                    false,
                );

                statusError.set(
                    false,
                );


                setupState.refresh
                    .mockReturnValue(
                        of(
                            undefined,
                        ),
                    );


                companyContext
                    .initialize
                    .mockReturnValue(
                        of(
                            undefined,
                        ),
                    );


                permissions
                    .initialize
                    .mockReturnValue(
                        of(
                            undefined,
                        ),
                    );


                router
                    .navigateByUrl
                    .mockResolvedValue(
                        true,
                    );


                await TestBed
                    .configureTestingModule({
                        imports: [
                            Setup,
                        ],

                        providers: [
                            {
                                provide:
                                    SetupStateService,

                                useValue:
                                    setupState,
                            },
                            {
                                provide:
                                    SetupApiService,

                                useValue:
                                    setupApi,
                            },

                            {
                                provide:
                                    AuthService,

                                useValue:
                                    auth,
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
                                    Router,

                                useValue:
                                    router,
                            },
                        ],
                    })
                    .compileComponents();


                fixture =
                    TestBed.createComponent(
                        Setup,
                    );

                component =
                    fixture.componentInstance;

                fixture.detectChanges();
            },
        );


        it(
            'should render initial setup form when setup is required',
            () => {
                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="setup-form"]',
                        ),
                ).not.toBeNull();
            },
        );


        it(
            'should reject invalid initial setup form',
            () => {
                component.submit();


                expect(
                    component.form.invalid,
                ).toBe(true);

                expect(
                    component.form.controls
                        .companyName
                        .touched,
                ).toBe(true);

                expect(
                    component.form.controls
                        .username
                        .touched,
                ).toBe(true);

                expect(
                    setupApi.initialize,
                ).not.toHaveBeenCalled();
            },
        );


        it(
            'should accept valid setup values',
            () => {
                component.form
                    .setValue({
                        companyName:
                            'Xarionix Telecom',

                        companyShortName:
                            'Xarionix',

                        username:
                            'admin',

                        password:
                            'strong-password',

                        passwordConfirm:
                            'strong-password',
                    });


                expect(
                    component.form.valid,
                ).toBe(true);
            },
        );


        it(
            'should reject different passwords',
            () => {
                component.form
                    .patchValue({
                        companyName:
                            'Xarionix Telecom',

                        username:
                            'admin',

                        password:
                            'strong-password',

                        passwordConfirm:
                            'different-password',
                    });


                component.form.controls
                    .passwordConfirm
                    .markAsTouched();


                fixture.detectChanges();


                expect(
                    component.form
                        .hasError(
                            'passwordMismatch',
                        ),
                ).toBe(true);

                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="setup-password-mismatch"]',
                        ),
                ).not.toBeNull();
            },
        );


        it(
            'should render inconsistent installation state',
            () => {
                setupRequired.set(
                    false,
                );

                inconsistent.set(
                    true,
                );

                fixture.detectChanges();


                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="setup-inconsistent"]',
                        ),
                ).not.toBeNull();

                expect(
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="setup-form"]',
                        ),
                ).toBeNull();
            },
        );


        it(
            'should render status error and retry',
            () => {
                setupRequired.set(
                    false,
                );

                state.set(
                    'error',
                );

                statusError.set(
                    true,
                );

                fixture.detectChanges();


                const retry =
                    fixture.nativeElement
                        .querySelector(
                            '[data-testid="setup-status-retry"]',
                        ) as HTMLButtonElement | null;


                expect(
                    retry,
                ).not.toBeNull();


                retry?.click();


                expect(
                    setupState.refresh,
                ).toHaveBeenCalledTimes(
                    1,
                );
            },
        );

        it(
            'should initialize system, login administrator and open application',
            () => {
                const initializeResponse = {
                    state:
                        InstallationState
                            .Installed,

                    company_id:
                        1,

                    company_name:
                        'Xarionix Telecom',

                    user_id:
                        1,

                    username:
                        'admin',

                    membership_id:
                        1,

                    administrator_role_id:
                        1,
                };


                component.form
                    .setValue({
                        companyName:
                            '  Xarionix Telecom  ',

                        companyShortName:
                            '  Xarionix  ',

                        username:
                            '  ADMIN  ',

                        password:
                            'strong-password',

                        passwordConfirm:
                            'strong-password',
                    });


                setupApi.initialize
                    .mockReturnValue(
                        of(
                            initializeResponse,
                        ),
                    );


                setupState.refresh
                    .mockImplementation(
                        () => {
                            setupRequired.set(
                                false,
                            );

                            installed.set(
                                true,
                            );

                            return of(
                                undefined,
                            );
                        },
                    );


                auth.login
                    .mockReturnValue(
                        of({
                            id:
                                1,

                            username:
                                'admin',

                            is_active:
                                true,

                            created_at:
                                '2026-01-01T00:00:00Z',

                            updated_at:
                                '2026-01-01T00:00:00Z',
                        }),
                    );


                component.submit();


                expect(
                    setupApi.initialize,
                ).toHaveBeenCalledWith({
                    company: {
                        name:
                            'Xarionix Telecom',

                        short_name:
                            'Xarionix',
                    },

                    administrator: {
                        username:
                            'admin',

                        password:
                            'strong-password',
                    },
                });


                expect(
                    setupState.refresh,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    auth.login,
                ).toHaveBeenCalledWith({
                    username:
                        'admin',

                    password:
                        'strong-password',
                });


                expect(
                    companyContext.initialize,
                ).toHaveBeenCalledTimes(
                    1,
                );

                expect(
                    permissions.initialize,
                ).toHaveBeenCalledTimes(
                    1,
                );


                expect(
                    router.navigateByUrl,
                ).toHaveBeenCalledWith(
                    '/',
                );


                expect(
                    component.isSubmitting(),
                ).toBe(false);
            },
        );

        it(
            'should show initialization validation error without login',
            () => {
                component.form
                    .setValue({
                        companyName:
                            'Xarionix',

                        companyShortName:
                            '',

                        username:
                            'admin',

                        password:
                            'strong-password',

                        passwordConfirm:
                            'strong-password',
                    });


                setupApi.initialize
                    .mockReturnValue(
                        throwError(
                            () =>
                                new HttpErrorResponse({
                                    status:
                                        422,
                                }),
                        ),
                    );


                component.submit();


                expect(
                    auth.login,
                ).not.toHaveBeenCalled();

                expect(
                    companyContext.initialize,
                ).not.toHaveBeenCalled();

                expect(
                    permissions.initialize,
                ).not.toHaveBeenCalled();


                expect(
                    component.submitError(),
                ).toContain(
                    'Сервер отклонил',
                );


                expect(
                    component.isSubmitting(),
                ).toBe(false);
            },
        );

        it(
            'should redirect to login when automatic administrator login fails after installation',
            () => {
                component.form
                    .setValue({
                        companyName:
                            'Xarionix',

                        companyShortName:
                            '',

                        username:
                            'admin',

                        password:
                            'strong-password',

                        passwordConfirm:
                            'strong-password',
                    });


                setupApi.initialize
                    .mockReturnValue(
                        of({
                            state:
                                InstallationState
                                    .Installed,

                            company_id:
                                1,

                            company_name:
                                'Xarionix',

                            user_id:
                                1,

                            username:
                                'admin',

                            membership_id:
                                1,

                            administrator_role_id:
                                1,
                        }),
                    );


                setupState.refresh
                    .mockImplementation(
                        () => {
                            setupRequired.set(
                                false,
                            );

                            installed.set(
                                true,
                            );

                            return of(
                                undefined,
                            );
                        },
                    );


                auth.login
                    .mockReturnValue(
                        throwError(
                            () =>
                                new Error(
                                    'Login unavailable',
                                ),
                        ),
                    );


                component.submit();


                expect(
                    router.navigateByUrl,
                ).toHaveBeenCalledWith(
                    '/login',
                );


                expect(
                    companyContext.initialize,
                ).not.toHaveBeenCalled();

                expect(
                    permissions.initialize,
                ).not.toHaveBeenCalled();


                expect(
                    component.isSubmitting(),
                ).toBe(false);
            },
        );
    },
);