import {
    Component,
    inject,
    signal,
} from '@angular/core';

import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from '@angular/forms';

import {
    NgIcon,
    provideIcons,
} from '@ng-icons/core';

import {
    lucideAlertTriangle,
    lucideLoaderCircle,
    lucideRefreshCw,
    lucideSettings,
} from '@ng-icons/lucide';

import {
    HlmButtonImports,
} from '@spartan-ng/helm/button';

import {
    HlmFieldImports,
} from '@spartan-ng/helm/field';

import {
    HlmInputImports,
} from '@spartan-ng/helm/input';

import {
    SetupStateService,
} from '../../core/setup/setup-state.service';


const passwordsMatchValidator:
    ValidatorFn = (
        control:
            AbstractControl,
    ): ValidationErrors | null => {
        const password =
            control.get(
                'password',
            )?.value;

        const passwordConfirm =
            control.get(
                'passwordConfirm',
            )?.value;


        if (
            !password
            || !passwordConfirm
        ) {
            return null;
        }


        return password
            === passwordConfirm
            ? null
            : {
                passwordMismatch:
                    true,
            };
    };


@Component({
    selector:
        'app-setup',

    imports: [
        ReactiveFormsModule,
        NgIcon,
        HlmButtonImports,
        HlmFieldImports,
        HlmInputImports,
    ],

    providers: [
        provideIcons({
            lucideAlertTriangle,
            lucideLoaderCircle,
            lucideRefreshCw,
            lucideSettings,
        }),
    ],

    templateUrl:
        './setup.html',

    styleUrl:
        './setup.css',
})
export class Setup {
    private readonly formBuilder =
        inject(
            FormBuilder,
        );


    readonly setupState =
        inject(
            SetupStateService,
        );


    readonly refreshing =
        signal(false);


    readonly form =
        this.formBuilder
            .nonNullable
            .group(
                {
                    companyName: [
                        '',
                        [
                            Validators.required,
                            Validators.maxLength(
                                255,
                            ),
                        ],
                    ],

                    companyShortName: [
                        '',
                        [
                            Validators.maxLength(
                                100,
                            ),
                        ],
                    ],

                    username: [
                        '',
                        [
                            Validators.required,
                            Validators.minLength(
                                3,
                            ),
                            Validators.maxLength(
                                64,
                            ),
                        ],
                    ],

                    password: [
                        '',
                        [
                            Validators.required,
                            Validators.minLength(
                                8,
                            ),
                            Validators.maxLength(
                                128,
                            ),
                        ],
                    ],

                    passwordConfirm: [
                        '',
                        [
                            Validators.required,
                            Validators.minLength(
                                8,
                            ),
                            Validators.maxLength(
                                128,
                            ),
                        ],
                    ],
                },
                {
                    validators: [
                        passwordsMatchValidator,
                    ],
                },
            );


    submit(): void {
        /*
         * 18F.4 отвечает только за
         * форму и frontend validation.
         *
         * POST /setup/initialize
         * подключим в 18F.5.
         */
        if (
            this.form.invalid
        ) {
            this.form
                .markAllAsTouched();

            return;
        }
    }


    retryStatus(): void {
        if (
            this.refreshing()
        ) {
            return;
        }


        this.refreshing.set(
            true,
        );


        this.setupState
            .refresh()
            .subscribe({
                complete: () => {
                    this.refreshing.set(
                        false,
                    );
                },
            });
    }


    hasPasswordMismatch():
        boolean {
        return (
            this.form
                .hasError(
                    'passwordMismatch',
                )
            && (
                this.form.controls
                    .passwordConfirm
                    .touched
                || this.form.controls
                    .passwordConfirm
                    .dirty
            )
        );
    }
}