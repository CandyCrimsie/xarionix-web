import {
    signal,
} from '@angular/core';

import {
    ComponentFixture,
    TestBed,
} from '@angular/core/testing';

import {
    of,
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


        const setupState = {
            state:
                state.asReadonly(),

            isSetupRequired:
                setupRequired
                    .asReadonly(),

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

                statusError.set(
                    false,
                );


                setupState.refresh
                    .mockReturnValue(
                        of(
                            undefined,
                        ),
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
    },
);